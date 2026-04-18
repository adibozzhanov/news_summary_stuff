import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDaily, triggerDailyAnalysis } from "../api";
import type { DailyAggregate, Grouping } from "../types";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#16a34a",
  neutral: "#ca8a04",
  negative: "#dc2626",
};

function SentimentBadge({ sentiment }: { sentiment: Grouping["sentiment"] }) {
  if (!sentiment) return null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: SENTIMENT_COLORS[sentiment] ?? "#888",
      }}
    >
      {sentiment.toUpperCase()}
    </span>
  );
}

export default function TodaysHot() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const queryClient = useQueryClient();

  // undefined means "latest"
  const dateParam = selectedDate || undefined;

  const { data, isLoading } = useQuery<DailyAggregate>({
    queryKey: ["daily", dateParam],
    queryFn: () => getDaily(dateParam),
  });

  const mutation = useMutation({
    mutationFn: () => triggerDailyAnalysis(dateParam),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["daily", dateParam] });
    },
  });

  const hasGroupings = data && data.groupings.length > 0;
  const displayDate = data?.date
    ? new Date(data.date + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>
          Latest{displayDate ? ` — ${displayDate}` : ""}
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: "0.45rem 0.75rem",
            fontSize: "0.9rem",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        {selectedDate && (
          <button
            onClick={() => setSelectedDate("")}
            style={{
              padding: "0.45rem 0.75rem",
              fontSize: "0.85rem",
              background: "transparent",
              color: "#555",
              border: "1px solid #ccc",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Latest
          </button>
        )}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: mutation.isPending ? "wait" : "pointer",
            opacity: mutation.isPending ? 0.7 : 1,
          }}
        >
          {mutation.isPending ? "Generating..." : "Generate Summary"}
        </button>
      </div>

      {mutation.isError && (
        <p style={{ color: "red", marginBottom: "1rem" }}>
          {(mutation.error as Error).message}
        </p>
      )}

      {isLoading && <p>Loading...</p>}

      {!isLoading && !hasGroupings && (
        <p style={{ color: "#888" }}>
          No summary yet. Click the button to generate one from the latest articles.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {data?.groupings.map((group, i) => (
          <div
            key={i}
            style={{
              padding: "1.25rem",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0 }}>{group.name}</h3>
              <SentimentBadge sentiment={group.sentiment} />
            </div>

            <p style={{ lineHeight: 1.7, marginBottom: "0.75rem" }}>{group.summary}</p>

            <div style={{ fontSize: "0.8rem", color: "#666" }}>
              <strong>Sources:</strong>
              <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
                {group.sources.map((s) => (
                  <li key={s.id} style={{ marginBottom: "0.2rem" }}>
                    <Link to={`/article/${s.id}`} style={{ color: "#2563eb" }}>
                      {s.title}
                    </Link>
                    {s.source && <span> ({s.source})</span>}
                    {s.author && <span> — {s.author}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
