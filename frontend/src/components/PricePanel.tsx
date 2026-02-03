import { useEffect, useState } from "react";
import { getStockApiToken } from "../utils/env";
import type { Quote } from "../types/quote";
import type { StreamStatus } from "../services/stockStream";

type Props = {
  selectedSymbol: string;
  status: StreamStatus;
  error: string | null;
  quote: Quote | null;
};

export function PricePanel({ selectedSymbol, status, error, quote }: Props) {
  const [companyName, setCompanyName] = useState<string>("");

  // Fetch company name from Finnhub profile2
  useEffect(() => {
    let cancelled = false;
    const token = getStockApiToken()?.trim();
    if (!selectedSymbol || !token) {
      setCompanyName("");
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(selectedSymbol)}&token=${encodeURIComponent(
            token
          )}`
        );
        if (!res.ok) throw new Error(`profile ${res.status}`);
        const data = await res.json();
        if (!cancelled && data?.name) setCompanyName(data.name);
      } catch {
        if (!cancelled) setCompanyName("");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  const pct =
    quote?.prevClose && quote.prevClose > 0
      ? ((quote.price - quote.prevClose) / quote.prevClose) * 100
      : null;
  const isUp = pct != null && pct > 0;
  const isDown = pct != null && pct < 0;
  const color = isUp ? "#059669" : isDown ? "#dc2626" : "#0b1224";
  const arrow = isUp ? "▲" : isDown ? "▼" : "−";

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        padding: "1.25rem",
        borderRadius: 14,
        background: "#f9fafb",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
        {companyName || selectedSymbol || "—"}
      </div>
      <div style={{ marginBottom: 4, color: "#6b7280" }}>
        Selected: <span style={{ color: "#111827", fontWeight: 700 }}>{selectedSymbol || "—"}</span>
      </div>
      <div style={{ color: "#6b7280" }}>Stream status: {status}</div>
      {error && <div style={{ color: "#dc2626", marginTop: 4 }}>{error}</div>}
      {quote ? (
        <>
          <div style={{ fontSize: "2.4rem", marginTop: 10, color }}>
            ${quote.price.toFixed(2)}{" "}
            <span style={{ fontSize: "1.2rem" }}>
              {arrow} {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : ""}
            </span>
          </div>
          <div style={{ color: "#6b7280" }}>
            Updated: {new Date(quote.ts).toLocaleTimeString()} ({quote.source})
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10, color: "#6b7280" }}>Connecting…</div>
      )}
    </section>
  );
}
