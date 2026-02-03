import { useEffect, useMemo, useState } from "react";
import { getStockApiToken } from "../utils/env";

type Props = {
  symbols: string[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

type PriceEntry = { price: number | null; prevClose: number | null };
type PriceState = Record<string, PriceEntry>;

export function WatchlistSidebar({ symbols, selectedSymbol, onSelect, onRemove }: Props) {
  const [prices, setPrices] = useState<PriceState>({});
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => getStockApiToken()?.trim() || null, []);

  useEffect(() => {
    let cancelled = false;
    if (!symbols.length) return;
    if (!token) {
      setError("Add STOCK_API token to load prices");
      return;
    }
    const load = async () => {
      try {
        const next: PriceState = {};
        await Promise.all(
          symbols.map(async (symbol) => {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`
            );
            if (!res.ok) throw new Error(`quote ${symbol} failed`);
            const data = await res.json();
            const price = typeof data.c === "number" && data.c > 0 ? data.c : null;
            const prevClose = typeof data.pc === "number" && data.pc > 0 ? data.pc : null;
            next[symbol] = { price: price ?? prevClose ?? null, prevClose };
          })
        );
        if (!cancelled) {
          setPrices(next);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load prices");
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols, token]);

  return (
    <aside
      style={{
        minWidth: 220,
        maxWidth: 280,
        borderRight: "1px solid #e5e7eb",
        paddingRight: 12,
        marginRight: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Watchlist Prices</div>
      {error && <div style={{ color: "#dc2626", fontSize: "0.9rem" }}>{error}</div>}
      {symbols.length === 0 && <div style={{ color: "#6b7280" }}>No symbols.</div>}
      {symbols.map((symbol) => {
        const active = symbol === selectedSymbol;
        const entry = prices[symbol];
        const price = entry?.price ?? null;
        const pc = entry?.prevClose ?? null;
        const pct =
          price != null && pc != null && pc > 0
            ? ((price - pc) / pc) * 100
            : null;

        const isUp = pct != null && pct > 0;
        const isDown = pct != null && pct < 0;
        const color = isUp ? "#059669" : isDown ? "#dc2626" : "#0b1224";
        const arrow = isUp ? "▲" : isDown ? "▼" : "−";
        const pctText = pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "…";

        return (
          <div
            key={symbol}
            style={{
              width: "100%",
              padding: "0.6rem 0.7rem",
              borderRadius: 10,
              border: active ? "1px solid #10b981" : "1px solid #e5e7eb",
              background: active ? "rgba(16,185,129,0.15)" : "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <button
              onClick={() => onSelect(symbol)}
              style={{
                flex: 1,
                textAlign: "left",
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#0b1224",
              }}
            >
              <span style={{ fontWeight: 700 }}>{symbol}</span>
              <span style={{ color, fontVariantNumeric: "tabular-nums", display: "flex", gap: 6, alignItems: "center" }}>
                {price != null ? `$${price.toFixed(2)}` : "…"}
                <span style={{ fontWeight: 700 }}>{pct != null ? `${arrow} ${pctText}` : ""}</span>
              </span>
            </button>
            <button
              onClick={() => onRemove(symbol)}
              aria-label={`Remove ${symbol}`}
              style={{
                border: "none",
                background: "transparent",
                color: "#9ca3af",
                cursor: "pointer",
                fontWeight: 800,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </aside>
  );
}
