import { useMemo } from "react";
import type { NewsArticle, SymbolNewsBucket, WatchlistQuote } from "../hooks/useNewsSignalsData";

type NewsPageProps = {
  watchlist: string[];
  news: NewsArticle[];
  quotesBySymbol: Map<string, WatchlistQuote>;
  symbolBuckets: SymbolNewsBucket[];
  newsLoading: boolean;
  newsError: string | null;
  quotesError: string | null;
  lastUpdated: string | null;
  hasKeys: {
    alphaVantage: boolean;
    gemini: boolean;
    stocks: boolean;
  };
  refresh: () => void;
  refreshDisabled: boolean;
};

function formatSentiment(value: number | null): string {
  if (value == null) return "No sentiment";
  if (value >= 0.2) return "Positive";
  if (value <= -0.2) return "Negative";
  return "Neutral";
}

function formatSentimentNumber(value: number | null): string {
  if (value == null) return "N/A";
  return value.toFixed(2);
}

export function NewsPage({
  watchlist,
  news,
  quotesBySymbol,
  symbolBuckets,
  newsLoading,
  newsError,
  quotesError,
  lastUpdated,
  hasKeys,
  refresh,
  refreshDisabled,
}: NewsPageProps) {
  const lastUpdatedLabel = lastUpdated ? new Date(lastUpdated).toLocaleString() : "Not yet loaded";
  const sortedNews = useMemo(() => {
    return [...news].sort((left, right) => {
      const leftChange = Math.max(
        ...left.symbols.map((symbol) => Math.abs(quotesBySymbol.get(symbol)?.changePercent ?? 0))
      );
      const rightChange = Math.max(
        ...right.symbols.map((symbol) => Math.abs(quotesBySymbol.get(symbol)?.changePercent ?? 0))
      );

      if (rightChange !== leftChange) {
        return rightChange - leftChange;
      }

      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    });
  }, [news, quotesBySymbol]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Watchlist Headlines</h2>
          <div style={{ color: "#4b5563", fontSize: "0.95rem" }}>
            Full-width Alpha Vantage coverage for the active watchlist. These headlines also feed the Signals tab.
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={refreshDisabled}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 12,
            border: "1px solid #0f766e",
            background: "#0f766e",
            color: "#f8fafc",
            fontWeight: 700,
            cursor: refreshDisabled ? "wait" : "pointer",
          }}
        >
          {refreshDisabled ? "Refreshing..." : "Refresh News"}
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ padding: "1rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Tracking
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>{watchlist.length}</div>
          <div style={{ color: "#64748b" }}>watchlist symbols</div>
        </div>

        <div style={{ padding: "1rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Headlines
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>{news.length}</div>
          <div style={{ color: "#64748b" }}>matched Alpha Vantage articles</div>
        </div>

        <div style={{ padding: "1rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Updated
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>{lastUpdatedLabel}</div>
          <div style={{ color: "#64748b" }}>last Alpha Vantage refresh</div>
        </div>

        <div style={{ padding: "1rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Keys
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            {hasKeys.alphaVantage ? "Alpha Vantage ready" : "Alpha Vantage missing"}
          </div>
          <div style={{ color: "#64748b" }}>
            {hasKeys.gemini ? "Gemini ready" : "Gemini missing"} • {hasKeys.stocks ? "Quotes ready" : "Quotes missing"}
          </div>
        </div>
      </section>

      {newsError && (
        <div style={{ padding: "0.9rem 1rem", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
          {newsError}
        </div>
      )}

      {quotesError && (
        <div style={{ padding: "0.9rem 1rem", borderRadius: 12, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }}>
          {quotesError}
        </div>
      )}

      <section style={{ padding: "1rem 1.1rem", borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Watchlist Headlines</h3>
          <div style={{ color: "#64748b", fontSize: "0.92rem" }}>
            {newsLoading ? "Fetching latest coverage..." : `${sortedNews.length} articles loaded`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {newsLoading && !news.length ? (
            <div style={{ color: "#475569" }}>Loading news...</div>
          ) : sortedNews.length ? (
            sortedNews.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "0.95rem 1rem",
                  borderRadius: 14,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                }}
                >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>{article.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div
                      style={{
                        padding: "0.3rem 0.55rem",
                        borderRadius: 999,
                        background:
                          article.averageSentiment != null && article.averageSentiment >= 0.2
                            ? "#dcfce7"
                            : article.averageSentiment != null && article.averageSentiment <= -0.2
                              ? "#fee2e2"
                              : "#e2e8f0",
                        color: "#0f172a",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatSentiment(article.averageSentiment)} ({formatSentimentNumber(article.averageSentiment)})
                    </div>
                    <div
                      style={{
                        padding: "0.3rem 0.55rem",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Move{" "}
                      {Math.max(...article.symbols.map((symbol) => Math.abs(quotesBySymbol.get(symbol)?.changePercent ?? 0))).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div style={{ color: "#475569", fontSize: "0.94rem" }}>{article.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: "0.85rem" }}>
                  <div>
                    {article.source} • {new Date(article.publishedAt).toLocaleString()}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {article.symbols.map((symbol) => (
                      <span
                        key={`${article.id}-${symbol}`}
                        style={{
                          padding: "0.22rem 0.45rem",
                          borderRadius: 999,
                          background: "#dbeafe",
                          color: "#1d4ed8",
                          fontWeight: 700,
                        }}
                      >
                        {symbol}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div style={{ color: "#475569" }}>No recent Alpha Vantage coverage matched your current watchlist.</div>
          )}
        </div>
      </section>

      <section style={{ padding: "1rem 1.1rem", borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>Coverage by Symbol</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {symbolBuckets.map((bucket) => (
            <div key={bucket.symbol} style={{ padding: "0.9rem", borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{bucket.symbol}</div>
                <div style={{ color: "#475569", fontSize: "0.88rem" }}>
                  {bucket.articles.length} articles • {formatSentiment(bucket.averageSentiment)}
                </div>
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6, color: "#475569", fontSize: "0.92rem" }}>
                {bucket.articles.length ? (
                  bucket.articles.map((article) => <div key={article.id}>• {article.title}</div>)
                ) : (
                  <div>No recent headlines for this symbol.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
