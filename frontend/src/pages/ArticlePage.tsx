import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getArticle, analyzeArticle } from "../api";
import type { Article } from "../types";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#16a34a",
  neutral: "#ca8a04",
  negative: "#dc2626",
};

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: article, isLoading, isError, error } = useQuery<Article>({
    queryKey: ["article", id],
    queryFn: () => getArticle(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: () => analyzeArticle(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["article", id] });
    },
  });

  if (isLoading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (isError) return <div style={{ padding: "2rem", color: "red" }}>Error: {(error as Error).message}</div>;
  if (!article) return <div style={{ padding: "2rem" }}>Article not found.</div>;

  const analysis = article.analysis;
  const hasAnalysis = analysis && analysis.summary;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <Link to="/" style={{ color: "#555", fontSize: "0.9rem", display: "inline-block", marginBottom: "1rem" }}>
        &larr; Back to search
      </Link>

      <h1 style={{ marginBottom: "0.5rem" }}>{article.title}</h1>

      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        {article.source}
        {article.author ? ` - ${article.author}` : ""}
        {article.published_at ? ` - ${new Date(article.published_at).toLocaleDateString()}` : ""}
      </p>

      <div
        style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Analysis</h2>

        {hasAnalysis ? (
          <>
            {analysis.sentiment_analysis ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.75rem",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: SENTIMENT_COLORS[analysis.sentiment_analysis] ?? "#888",
                  marginBottom: "1rem",
                }}
              >
                {analysis.sentiment_analysis.toUpperCase()}
              </span>
            ) : (
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.75rem",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  color: "#888",
                  border: "1px solid #ccc",
                  marginBottom: "1rem",
                }}
              >
                Sentiment unavailable
              </span>
            )}
            <p style={{ lineHeight: 1.7 }}>{analysis.summary}</p>

            {!analysis.sentiment_analysis && (
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                style={{
                  marginTop: "1rem",
                  padding: "0.6rem 1.2rem",
                  fontSize: "0.9rem",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: mutation.isPending ? "wait" : "pointer",
                  opacity: mutation.isPending ? 0.7 : 1,
                }}
              >
                {mutation.isPending ? "Re-analyzing..." : "Re-analyze"}
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ color: "#555", marginBottom: "1rem" }}>
              This article has not been analyzed yet.
            </p>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              style={{
                padding: "0.6rem 1.2rem",
                fontSize: "0.9rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: mutation.isPending ? "wait" : "pointer",
                opacity: mutation.isPending ? 0.7 : 1,
              }}
            >
              {mutation.isPending ? "Analyzing..." : "Analyze Article"}
            </button>
            {mutation.isError && (
              <p style={{ color: "red", marginTop: "0.5rem" }}>
                {(mutation.error as Error).message}
              </p>
            )}
          </>
        )}
      </div>

      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          style={{ width: "100%", borderRadius: 8, marginBottom: "1.5rem", objectFit: "cover", maxHeight: 400 }}
        />
      )}

      {article.description && (
        <p style={{ fontSize: "1.1rem", color: "#333", marginBottom: "1rem", fontStyle: "italic" }}>
          {article.description}
        </p>
      )}

      {article.content && (
        <div style={{ lineHeight: 1.8, marginBottom: "2rem" }}>
          {article.content}
        </div>
      )}

      {article.url && (
        <p style={{ marginBottom: "2rem" }}>
          <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
            Read full article &rarr;
          </a>
        </p>
      )}
    </div>
  );
}
