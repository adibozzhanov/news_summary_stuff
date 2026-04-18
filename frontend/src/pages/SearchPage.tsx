import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { searchNews } from "../api";
import type { ArticleListItem } from "../types";
import TodaysHot from "../components/TodaysHot";

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error } = useQuery<ArticleListItem[]>({
    queryKey: ["news", query],
    queryFn: () => searchNews(query),
    enabled: query.length > 0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setQuery(trimmed);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left panel — Search (40%) */}
      <div
        style={{
          width: "40%",
          padding: "2rem 1.5rem",
          borderRight: "1px solid #e0e0e0",
          overflowY: "auto",
        }}
      >
        <h1 style={{ marginBottom: "1.5rem" }}>Search</h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search news..."
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              background: "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        {isLoading && <p>Loading...</p>}
        {isError && <p style={{ color: "red" }}>Error: {(error as Error).message}</p>}
        {data && data.length === 0 && <p>No articles found.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {data?.map((article) => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              style={{
                display: "block",
                padding: "1rem",
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <h3 style={{ margin: "0 0 0.5rem" }}>{article.title}</h3>
              {article.description && (
                <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
                  {article.description}
                </p>
              )}
              <p style={{ margin: "0.5rem 0 0", color: "#888", fontSize: "0.8rem" }}>
                {article.source}
                {article.published_at
                  ? ` - ${new Date(article.published_at).toLocaleDateString()}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Right panel — Today's Hot (60%) */}
      <div style={{ width: "60%", padding: "2rem 1.5rem", overflowY: "auto" }}>
        <TodaysHot />
      </div>
    </div>
  );
}
