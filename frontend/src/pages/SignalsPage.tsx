import type { SymbolSignal, WatchlistAnalysis, WatchlistQuote } from "../hooks/useNewsSignalsData";

type SignalsPageProps = {
  watchlist: string[];
  quotesBySymbol: Map<string, WatchlistQuote>;
  analysis: WatchlistAnalysis | null;
  analysisLoading: boolean;
  analysisError: string | null;
  quotesError: string | null;
  refresh: () => void;
  refreshDisabled: boolean;
};

function formatPrice(value: number | null): string {
  if (value == null) return "N/A";
  return `$${value.toFixed(2)}`;
}

function formatSignedNumber(value: number | null, digits = 2): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function getSignalsInWatchlistOrder(
  watchlist: string[],
  analysis: WatchlistAnalysis | null
): SymbolSignal[] {
  if (!analysis) return [];
  const bySymbol = new Map(analysis.signals.map((signal) => [signal.symbol.toUpperCase(), signal]));
  return watchlist
    .map((symbol) => bySymbol.get(symbol))
    .filter((signal): signal is SymbolSignal => Boolean(signal));
}

export function SignalsPage({
  watchlist,
  quotesBySymbol,
  analysis,
  analysisLoading,
  analysisError,
  quotesError,
  refresh,
  refreshDisabled,
}: SignalsPageProps) {
  const sortedSignals = getSignalsInWatchlistOrder(watchlist, analysis);

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
          <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Gemini Watchlist Outlook</h2>
          <div style={{ color: "#4b5563", fontSize: "0.95rem" }}>
            Scenario-based signals informed by the same watchlist headlines plus current price reaction versus the previous close.
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
          {refreshDisabled ? "Refreshing..." : "Refresh Signals"}
        </button>
      </section>

      {analysisError && (
        <div style={{ padding: "0.9rem 1rem", borderRadius: 12, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}>
          {analysisError}
        </div>
      )}

      {quotesError && (
        <div style={{ padding: "0.9rem 1rem", borderRadius: 12, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }}>
          {quotesError}
        </div>
      )}

      <section style={{ padding: "1rem 1.1rem", borderRadius: 16, background: "#ecfeff", border: "1px solid #a5f3fc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Gemini Watchlist Outlook</h3>
          <div style={{ color: "#155e75", fontSize: "0.9rem" }}>
            {analysisLoading ? "Analyzing..." : analysis ? "Updated from headlines and quote context" : "Awaiting analysis"}
          </div>
        </div>

        {analysis ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: "0.84rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#155e75" }}>
                Market pulse
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{analysis.overallSentiment.toUpperCase()}</div>
              <div style={{ color: "#164e63" }}>{analysis.marketPulse}</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {sortedSignals.length ? (
                sortedSignals.map((signal) => {
                  const quote = quotesBySymbol.get(signal.symbol);
                  return (
                    <div
                      key={signal.symbol}
                      style={{
                        padding: "1rem",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.78)",
                        border: "1px solid #bae6fd",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{signal.symbol}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "0.22rem 0.55rem", borderRadius: 999, background: "#cffafe", color: "#155e75", fontWeight: 800 }}>
                            {signal.action}
                          </span>
                          <span style={{ padding: "0.22rem 0.55rem", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                            {signal.confidence}% confidence
                          </span>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", color: "#164e63", fontSize: "0.92rem" }}>
                        <div style={{ fontWeight: 700 }}>{signal.sentiment.toUpperCase()}</div>
                        <div>
                          {formatPrice(quote?.price ?? null)} • {formatSignedNumber(quote?.changeAmount ?? null)} (
                          {formatSignedNumber(quote?.changePercent ?? null)}%) vs prev close
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: "#0f172a" }}>{signal.rationale}</div>

                      <div style={{ marginTop: 10, display: "grid", gap: 8, color: "#164e63", fontSize: "0.94rem" }}>
                        <div><strong>Day:</strong> {signal.dayOutlook}</div>
                        <div><strong>Week:</strong> {signal.weekOutlook}</div>
                        <div><strong>Future:</strong> {signal.futureOutlook}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "#164e63" }}>No symbol-level signals are available yet.</div>
              )}
            </div>

            {analysis.keyThemes.length ? (
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Key themes</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {analysis.keyThemes.map((theme) => (
                    <span key={theme} style={{ padding: "0.28rem 0.6rem", borderRadius: 999, background: "#ffffff", color: "#164e63", border: "1px solid #bae6fd" }}>
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.riskFlags.length ? (
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Risk flags</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {analysis.riskFlags.map((flag) => (
                    <div key={flag} style={{ color: "#9a3412" }}>
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: "#164e63" }}>
            {analysisLoading ? "Gemini is reviewing the latest watchlist headlines." : "Analysis will appear after the first successful news and quote fetch."}
          </div>
        )}
      </section>
    </div>
  );
}
