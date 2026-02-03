import { useEffect, useMemo, useState } from "react";
import { getStockApiToken } from "../utils/env";

type Timeframe = "1D" | "5D" | "1M" | "1Y";

type CandleResponse = {
  c: number[]; // close
  t: number[]; // timestamp
  s: "ok" | string;
};

type Props = {
  symbol: string;
};

const OPTIONS: Timeframe[] = ["1D", "5D", "1M", "1Y"];

function timeframeToParams(tf: Timeframe): { resolution: string; from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  switch (tf) {
    case "1D":
      return { resolution: "5", from: now - day, to: now };
    case "5D":
      return { resolution: "30", from: now - 5 * day, to: now };
    case "1M":
      return { resolution: "D", from: now - 32 * day, to: now };
    case "1Y":
    default:
      return { resolution: "W", from: now - 370 * day, to: now };
  }
}

export function StockChart({ symbol }: Props) {
  const [tf, setTf] = useState<Timeframe>("1D");
  const [points, setPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => getStockApiToken()?.trim() || null, []);
  const baseUrl = useMemo(
    () => (token && token.startsWith("sandbox_") ? "https://sandbox.finnhub.io" : "https://finnhub.io"),
    [token]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!symbol) return;
      if (!token) {
        setError("Missing API token for chart");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { resolution, from, to } = timeframeToParams(tf);
        const url = `${baseUrl}/api/v1/stock/candle?symbol=${encodeURIComponent(
          symbol
        )}&resolution=${resolution}&from=${from}&to=${to}&token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        if (res.status === 403) throw new Error("Candle 403 (token/plan/CORS)");
        if (!res.ok) throw new Error(`candle ${res.status}`);
        const data: CandleResponse = await res.json();
        if (data.s !== "ok" || !Array.isArray(data.c) || data.c.length < 2) {
          throw new Error("No chart data");
        }
        if (!cancelled) setPoints(data.c);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Chart load failed");
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, tf, token]);

  const { delta, pct, color } = useMemo(() => {
    if (points.length < 2) return { delta: null, pct: null, color: "#0b1224" };
    const first = points[0];
    const last = points[points.length - 1];
    const change = last - first;
    const pctChange = first !== 0 ? (change / first) * 100 : null;
    const col = change > 0 ? "#059669" : change < 0 ? "#dc2626" : "#6b7280";
    return { delta: change, pct: pctChange, color: col };
  }, [points]);

  const path = useMemo(() => {
    if (points.length < 2) return "";
    const width = 320;
    const height = 140;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / span) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "1rem 1.25rem",
        background: "#f9fafb",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {symbol || "—"} chart ({tf})
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setTf(opt)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                border: opt === tf ? "1px solid #10b981" : "1px solid #e5e7eb",
                background: opt === tf ? "rgba(16,185,129,0.15)" : "white",
                cursor: "pointer",
                fontWeight: 700,
                color: "#0b1224",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minHeight: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading chart…</div>
        ) : error ? (
          <div style={{ color: "#dc2626" }}>{error}</div>
        ) : points.length < 2 ? (
          <div style={{ color: "#6b7280" }}>No data</div>
        ) : (
          <svg width="100%" height="160" viewBox="0 0 320 160" role="img" aria-label="price chart">
            <path d={path} fill="none" stroke={color} strokeWidth={2.4} />
          </svg>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, color }}>
        {delta != null && (
          <div style={{ fontWeight: 800 }}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}
          </div>
        )}
        {pct != null && <div style={{ fontWeight: 700 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>}
      </div>
    </section>
  );
}
