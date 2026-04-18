export interface ArticleListItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  source: string | null;
  author: string | null;
}

export interface Analysis {
  summary: string;
  sentiment_analysis: "positive" | "neutral" | "negative" | null;
}

export interface Article extends ArticleListItem {
  content: string | null;
  analysis?: Analysis;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis: Analysis;
}

export interface GroupingSource {
  id: string;
  title: string;
  author: string | null;
  url: string;
  source: string | null;
}

export interface Grouping {
  name: string;
  sources: GroupingSource[];
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | null;
}

export interface DailyAggregate {
  date: string;
  groupings: Grouping[];
}
