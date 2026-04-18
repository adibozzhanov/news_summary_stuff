import os
import json
import hashlib
from datetime import datetime, timezone, timedelta

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from openai import OpenAI

app = Flask(__name__)
CORS(app)

mongo_uri = os.environ.get("MONGO_URI", "mongodb://mongo:27017/news_summary")
mongo = MongoClient(mongo_uri)
db = mongo.get_default_database()
articles_col = db["articles"]

articles_daily_col = db["aggregates_daily"]

NEWS_API_KEY = os.environ["NEWS_API_KEY"]
openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def parse_published(raw):
    """Parse an ISO 8601 date string to a datetime, or return None."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def article_to_json(doc):
    """Convert a mongo document to a JSON-safe dict."""
    doc["id"] = str(doc.pop("_id"))
    if isinstance(doc.get("published_at"), datetime):
        doc["published_at"] = doc["published_at"].isoformat()
    return doc


@app.route("/news", methods=["GET"])
def get_news():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "query parameter 'q' is required"}), 400

    # Fetch from NewsAPI
    resp = requests.get(
        "https://newsapi.org/v2/everything",
        params={"q": query, "pageSize": 20, "apiKey": NEWS_API_KEY},
        timeout=15,
    )
    data = resp.json()

    if data.get("status") != "ok":
        return jsonify({"error": "NewsAPI error", "details": data}), 502

    # Upsert articles into mongo (deduplicate by url)
    for item in data.get("articles", []):
        url = item.get("url", "")
        stable_id = hashlib.sha256(url.encode()).hexdigest()[:24]

        articles_col.update_one(
            {"url_hash": stable_id},
            {
                "$setOnInsert": {
                    "url_hash": stable_id,
                    "title": item.get("title"),
                    "description": item.get("description"),
                    "url": url,
                    "image_url": item.get("urlToImage"),
                    "published_at": parse_published(item.get("publishedAt")),
                    "source": item.get("source", {}).get("name"),
                    "author": item.get("author"),
                    "content": item.get("content"),
                }
            },
            upsert=True,
        )

    # Return all matching articles (search in stored data)
    cursor = articles_col.find(
        {"$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"description": {"$regex": query, "$options": "i"}},
        ]},
        {"content": 0, "analysis": 0},  # exclude heavy fields from list
    ).limit(20)

    results = [article_to_json(doc) for doc in cursor]
    return jsonify(results)


@app.route("/news/<article_id>", methods=["GET"])
def get_article(article_id):
    try:
        doc = articles_col.find_one({"_id": ObjectId(article_id)})
    except Exception:
        doc = None

    if not doc:
        return jsonify({"error": "article not found"}), 404

    return jsonify(article_to_json(doc))


@app.route("/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True)
    article_id = body.get("id")
    if not article_id:
        return jsonify({"error": "'id' is required"}), 400

    try:
        doc = articles_col.find_one({"_id": ObjectId(article_id)})
    except Exception:
        doc = None

    if not doc:
        return jsonify({"error": "article not found"}), 404

    # Build text to analyze from available fields
    text = "\n\n".join(filter(None, [
        doc.get("title", ""),
        doc.get("description", ""),
        doc.get("content", ""),
    ]))

    if not text.strip():
        return jsonify({"error": "article has no content to analyze"}), 400

    # Call OpenAI for summary
    summary_resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a concise news summarizer. Summarize the following article in 2-3 sentences."},
            {"role": "user", "content": text},
        ],
        max_tokens=300,
    )
    summary = summary_resp.choices[0].message.content.strip()

    # Call OpenAI for sentiment
    sentiment_resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a sentiment classifier. Classify the sentiment of the following article "
                    "as exactly one of: positive, neutral, negative. "
                    "Respond with ONLY that single word, nothing else."
                ),
            },
            {"role": "user", "content": text},
        ],
        max_tokens=10,
    )
    sentiment_raw = sentiment_resp.choices[0].message.content.strip().lower()

    valid_sentiments = {"positive", "neutral", "negative"}
    sentiment = sentiment_raw if sentiment_raw in valid_sentiments else None

    analysis = {"summary": summary, "sentiment_analysis": sentiment}

    articles_col.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"analysis": analysis}},
    )

    return jsonify({"success": True, "analysis": analysis})


@app.route("/analyse_daily", methods=["POST"])
def analyse_daily():
    body = request.get_json(silent=True) or {}
    requested_date = body.get("date")

    if requested_date:
        try:
            day_start = datetime.strptime(requested_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return jsonify({"error": "invalid date format, use YYYY-MM-DD"}), 400
    else:
        latest = articles_col.find_one(
            {"published_at": {"$type": "date"}},
            sort=[("published_at", -1)],
        )
        if not latest or not latest.get("published_at"):
            return jsonify({"error": "no articles with a publish date found"}), 404
        latest_dt = latest["published_at"]
        day_start = datetime(latest_dt.year, latest_dt.month, latest_dt.day, tzinfo=timezone.utc)

    day_end = day_start + timedelta(days=1)
    target_date = day_start.strftime("%Y-%m-%d")

    today_articles = list(articles_col.find({
        "published_at": {"$gte": day_start, "$lt": day_end},
    }))

    if not today_articles:
        return jsonify({"error": f"no articles found for {target_date}"}), 404

    # Build a numbered list for the LLM to group
    article_list = []
    for i, a in enumerate(today_articles):
        article_list.append({
            "index": i,
            "id": str(a["_id"]),
            "title": a.get("title", ""),
            "description": a.get("description", ""),
            "author": a.get("author"),
            "url": a.get("url", ""),
            "source": a.get("source"),
        })

    listing = "\n".join(
        f"[{a['index']}] {a['title']}" for a in article_list
    )

    # Step 1: Ask LLM to group related articles by index
    group_resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You group related news articles. Given a numbered list of article titles, "
                    "return a JSON array of groups. Each group is an object with:\n"
                    '  "name": a short descriptive title for the group,\n'
                    '  "indices": array of article index numbers that belong together.\n'
                    "Every article must appear in exactly one group. "
                    "Articles that don't relate to others should be in their own group. "
                    "Return ONLY valid JSON, no markdown fences."
                ),
            },
            {"role": "user", "content": listing},
        ],
        max_tokens=2000,
    )
    raw_groups = group_resp.choices[0].message.content.strip()

    try:
        groups = json.loads(raw_groups)
    except json.JSONDecodeError:
        return jsonify({"error": "LLM returned invalid grouping JSON", "raw": raw_groups}), 502

    # Step 2: For each group, build a compound summary + sentiment
    groupings = []
    for g in groups:
        indices = g.get("indices", [])
        group_articles = [article_list[i] for i in indices if i < len(article_list)]

        if not group_articles:
            continue

        sources = [
            {
                "id": a["id"],
                "title": a["title"],
                "author": a["author"],
                "url": a["url"],
                "source": a["source"],
            }
            for a in group_articles
        ]

        # Build text from titles + descriptions for summary
        texts = []
        for a in group_articles:
            parts = [a["title"], a.get("description") or ""]
            texts.append(f"[{a['title']}]: {' '.join(p for p in parts if p)}")
        combined = "\n\n".join(texts)

        summary_resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a news summarizer. You are given multiple related articles (titles and descriptions). "
                        "Write a compound summary that covers the key points across all of them. "
                        "Cite sources by their title in brackets, e.g. [Article Title]. "
                        "Keep it to 3-5 sentences."
                    ),
                },
                {"role": "user", "content": combined},
            ],
            max_tokens=500,
        )
        summary = summary_resp.choices[0].message.content.strip()

        sentiment_resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify the overall sentiment of these related news articles "
                        "as exactly one of: positive, neutral, negative. "
                        "Respond with ONLY that single word."
                    ),
                },
                {"role": "user", "content": combined},
            ],
            max_tokens=10,
        )
        sentiment_raw = sentiment_resp.choices[0].message.content.strip().lower()
        sentiment = sentiment_raw if sentiment_raw in {"positive", "neutral", "negative"} else None

        groupings.append({
            "name": g.get("name", "Unnamed Group"),
            "sources": sources,
            "summary": summary,
            "sentiment": sentiment,
        })

    # Upsert into aggregates_daily — completely replace this date's document
    articles_daily_col.replace_one(
        {"date": target_date},
        {"date": target_date, "groupings": groupings},
        upsert=True,
    )

    return jsonify({"success": True, "date": target_date, "groupings": groupings})


@app.route("/daily", methods=["GET"])
def get_daily():
    requested_date = request.args.get("date")
    if requested_date:
        doc = articles_daily_col.find_one({"date": requested_date})
    else:
        doc = articles_daily_col.find_one(sort=[("date", -1)])
    if not doc:
        return jsonify({"date": requested_date, "groupings": []})
    doc.pop("_id", None)
    return jsonify(doc)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
