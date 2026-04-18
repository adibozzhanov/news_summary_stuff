import type { ArticleListItem, Article, AnalyzeResponse, DailyAggregate } from "./types";

const BASE = "/api";

export async function searchNews(query: string): Promise<ArticleListItem[]> {
  const res = await fetch(`${BASE}/news?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to fetch news");
  return res.json() as Promise<ArticleListItem[]>;
}

export async function getArticle(id: string): Promise<Article> {
  const res = await fetch(`${BASE}/news/${id}`);
  if (!res.ok) throw new Error("Failed to fetch article");
  return res.json() as Promise<Article>;
}

export async function analyzeArticle(id: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Analysis failed");
  return res.json() as Promise<AnalyzeResponse>;
}

export async function getDaily(date?: string): Promise<DailyAggregate> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${BASE}/daily${params}`);
  if (!res.ok) throw new Error("Failed to fetch daily aggregate");
  return res.json() as Promise<DailyAggregate>;
}

export async function triggerDailyAnalysis(date?: string): Promise<DailyAggregate> {
  const res = await fetch(`${BASE}/analyse_daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(date ? { date } : {}),
  });
  if (!res.ok) throw new Error("Daily analysis failed");
  return res.json() as Promise<DailyAggregate>;
}
