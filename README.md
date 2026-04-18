# News Summary

A full-stack news aggregation and analysis app. Search for news articles, read them, and get AI-powered summaries and sentiment analysis — both per-article and as grouped daily digests.

## Architecture

- **Frontend**: React (Vite) + TypeScript (strict mode) + TanStack Query + React Router
- **Backend**: Python Flask + Gunicorn
- **Database**: MongoDB 7
- **AI**: OpenAI (gpt-4o-mini) for summarization, sentiment analysis, and article grouping
- **News source**: [NewsAPI](https://newsapi.org/docs/endpoints/everything)
- **Infra**: Docker Compose (3 services), devenv for local development

## Features

### Article Search
Search for news via the left panel. Queries hit the NewsAPI, store results in MongoDB (deduplicated by URL), and return matching articles.

### Article Detail View
Click an article to view its full content. Each article page includes:
- Title, source, author, publish date, image
- Link to the original article
- **Analysis section** (top of the page) — either shows the AI summary + sentiment badge, or an "Analyze Article" button to trigger analysis on demand

### Per-Article Analysis
Clicking "Analyze Article" sends the article text to OpenAI which returns:
- A 2-3 sentence summary
- Sentiment classification: `positive`, `neutral`, or `negative`

If sentiment classification fails, a "Re-analyze" button appears.

### Daily Grouped Summaries (Latest panel)
The right panel (60% width) shows grouped article summaries for a given date:

1. The backend finds all articles published on the selected date
2. An LLM groups related articles by topic (based on titles)
3. For each group, a compound summary is generated from titles and descriptions, citing each source
4. Sentiment is classified per group
5. Results are stored in the `aggregates_daily` MongoDB collection

Each time you regenerate, the document for that date is fully replaced — groupings may change as new articles are ingested.

A **date picker** lets you browse summaries for any date. Defaults to the latest available date.

### MongoDB Collections

- **`articles`** — all ingested articles. `published_at` stored as native `datetime`. Deduplicated by URL hash.
- **`aggregates_daily`** — one document per date, containing grouped summaries with sources, sentiment, and citations.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/news?q={query}` | Fetch from NewsAPI, store in MongoDB, return matches |
| GET | `/news/{id}` | Return full article by ID (includes analysis if present) |
| POST | `/analyze` | Trigger per-article AI summary + sentiment. Body: `{"id": "..."}` |
| GET | `/daily?date=YYYY-MM-DD` | Return grouped summary for a date (latest if omitted) |
| POST | `/analyse_daily` | Generate grouped summary. Body: `{"date": "YYYY-MM-DD"}` (latest if omitted) |

## Setup

### Prerequisites

- Docker and Docker Compose
- A [NewsAPI](https://newsapi.org/) API key
- An [OpenAI](https://platform.openai.com/) API key

### Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```
NEWS_API_KEY=your_newsapi_key
OPENAI_API_KEY=your_openai_key
MONGO_USER=newsapp
MONGO_PASSWORD=changeme
MONGO_URI=mongodb://newsapp:changeme@mongo:27017/news_summary?authSource=admin
```

### Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- MongoDB: `localhost:27017` (user/password from `.env`)

To rebuild after code changes:

```bash
docker compose up --build
```

To start fresh (wipe DB):

```bash
docker compose down -v && docker compose up --build
```

### Run with devenv (local development)

```bash
devenv shell
```

This gives you:
- `dev` — starts both backend and frontend (MongoDB runs via devenv services)
- `dev-backend` — start Flask backend only (port 5000)
- `dev-frontend` — start Vite frontend only (port 5173)

### Backfill

If you have existing articles with string dates (from before the datetime migration), run:

```bash
docker compose exec backend python backfill_dates.py
```

## Project Structure

```
.
├── .env.example
├── docker-compose.yml
├── devenv.nix
├── devenv.yaml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py              # Flask server (all routes)
│   └── backfill_dates.py   # One-off migration script
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json        # strict: true
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── index.css
        ├── types.ts         # Shared TypeScript interfaces
        ├── api.ts           # Typed API client
        ├── pages/
        │   ├── SearchPage.tsx
        │   └── ArticlePage.tsx
        └── components/
            └── TodaysHot.tsx
```
