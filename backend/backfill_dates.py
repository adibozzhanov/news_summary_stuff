"""Backfill: convert string published_at fields to datetime objects in MongoDB."""

import os
from datetime import datetime

from pymongo import MongoClient

mongo_uri = os.environ.get("MONGO_URI", "mongodb://mongo:27017/news_summary")
mongo = MongoClient(mongo_uri)
db = mongo.get_default_database()
articles = db["articles"]

cursor = articles.find({"published_at": {"$type": "string"}})
updated = 0

for doc in cursor:
    raw = doc["published_at"]
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        print(f"  skipped {doc['_id']}: unparseable date '{raw}'")
        continue

    articles.update_one({"_id": doc["_id"]}, {"$set": {"published_at": dt}})
    updated += 1

print(f"Backfilled {updated} articles.")
