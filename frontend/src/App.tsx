import { useEffect, useState } from "react";

// Helper to resolve STOCK_API from multiple injection points.
// Put your token in one of these places at build/runtime:
// - Vite define: import.meta.env.STOCK_API or import.meta.env.VITE_STOCK_API
// - Bundler replacement: process.env.STOCK_API or process.env.REACT_APP_STOCK_API
// - Runtime injection: window.__STOCK_API or globalThis.__STOCK_API
function getStockApiToken(): string | null {
  const imEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
  return (
    imEnv?.STOCK_API ||
    imEnv?.VITE_STOCK_API ||
    (globalThis as any).__STOCK_API ||
    (globalThis as any).process?.env?.STOCK_API ||
    (globalThis as any).process?.env?.REACT_APP_STOCK_API ||
    (window as any).__STOCK_API ||
    null
  );
}

type StreamStatus = "connecting" | "open" | "closed" | "error" | "mock";

type StreamCallbacks = {
  onStatus?: (status: StreamStatus) => void;
  onError?: (message: string) => void;
};

// Local fallback implementation for connectStockStream to satisfy TypeScript.
// Emits a mock price every second and returns a cleanup function.
function connectStockStream(
  symbol: string,
  onQuote: (data: { price: number }) => void,
  { onStatus, onError }: StreamCallbacks = {}
) {
  onStatus?.("connecting");
  const rawToken = getStockApiToken();
  const token = rawToken?.trim() || null;

  if (!token) {
    // Local fallback if no API key (keeps existing behavior)
    onStatus?.("mock");
    const id = setInterval(() => {
      const price = Math.round((100 + Math.random() * 50) * 100) / 100;
      onQuote({ price });
    }, 1000);
    return () => clearInterval(id);
  }

  const url = `wss://ws.finnhub.io?token=${encodeURIComponent(token)}`;
  const socket = new WebSocket(url);
  const watchdog = setTimeout(() => {
    onStatus?.("error");
    onError?.("Socket did not open (token/network/firewall?)");
    try {
      socket.close();
    } catch {}
  }, 5000);

  const onOpen = () => {
    clearTimeout(watchdog);
    onStatus?.("open");
    try {
      socket.send(JSON.stringify({ type: "subscribe", symbol }));
    } catch (err) {
      onError?.("Failed to subscribe on open");
    }
  };
  const onMessage = (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data);
      // Finnhub trade messages: { type: "trade", data: [{ p: price, ... }, ...] }
      if (msg.type === "trade" && Array.isArray(msg.data) && msg.data.length) {
        const last = msg.data[msg.data.length - 1];
        if (typeof last.p === "number") onQuote({ price: last.p });
      }
    } catch (e) {
      // ignore parse errors
    }
  };

  const onErrorEvent = () => {
    clearTimeout(watchdog);
    onStatus?.("error");
    onError?.("WebSocket error (often invalid token or network)");
  };

  const onClose = () => {
    clearTimeout(watchdog);
    onStatus?.("closed");
  };

  socket.addEventListener("open", onOpen);
  socket.addEventListener("message", onMessage);
  socket.addEventListener("error", onErrorEvent);
  socket.addEventListener("close", onClose);

  // cleanup: unsubscribe and close
  return () => {
    try {
      socket.send(JSON.stringify({ type: "unsubscribe", symbol }));
    } catch {}
    clearTimeout(watchdog);
    socket.removeEventListener("open", onOpen);
    socket.removeEventListener("message", onMessage);
    socket.removeEventListener("error", onErrorEvent);
    socket.removeEventListener("close", onClose);
    try {
      socket.close();
    } catch {}
  };
}

type Quote = { price: number; ts: number; source: "stream" | "quote" };

export default function App() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const fallback = ["META", "AAPL", "GOOGL"];
    if (typeof localStorage === "undefined") return fallback;
    try {
      const raw = localStorage.getItem("watchlist");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed;
    } catch {
      // ignore parse errors
    }
    return fallback;
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => "META");
  const [newSymbol, setNewSymbol] = useState("");

  // Persist watchlist and keep selectedSymbol valid
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("watchlist", JSON.stringify(watchlist));
      } catch {
        // ignore storage errors
      }
    }
    if (!watchlist.includes(selectedSymbol)) {
      setSelectedSymbol(watchlist[0] ?? "");
    }
  }, [watchlist, selectedSymbol]);

  // Fetch a last-known quote (works after hours when stream is quiet)
  useEffect(() => {
    let cancelled = false;
    const token = getStockApiToken()?.trim();
    if (!selectedSymbol || !token) return undefined;

    const fetchQuote = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            selectedSymbol
          )}&token=${encodeURIComponent(token)}`
        );
        if (!res.ok) throw new Error(`Quote request failed: ${res.status}`);
        const data = await res.json();
        const price = typeof data.c === "number" && data.c > 0 ? data.c : null;
        const fallback = typeof data.pc === "number" && data.pc > 0 ? data.pc : null;
        const value = price ?? fallback;
        if (!cancelled && value != null) {
          setQuote({ price: value, ts: Date.now(), source: "quote" });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError((prev) => prev ?? "Failed to fetch last quote (after-hours fallback)");
        }
      }
    };

    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  useEffect(() => {
    return connectStockStream(
      selectedSymbol || "META",
      (data) => setQuote({ price: data.price, ts: Date.now(), source: "stream" }),
      { onStatus: setStatus, onError: setError }
    );
  }, [selectedSymbol]);

  const addSymbol = () => {
    const cleaned = newSymbol.trim().toUpperCase();
    if (!cleaned) return;
    if (watchlist.includes(cleaned)) {
      setSelectedSymbol(cleaned);
      setNewSymbol("");
      return;
    }
    setWatchlist((prev) => [...prev, cleaned]);
    setSelectedSymbol(cleaned);
    setNewSymbol("");
  };

  const removeSymbol = (symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 860,
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
    borderRadius: 18,
    padding: "1.5rem",
    backdropFilter: "blur(8px)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "linear-gradient(135deg, #111827, #1f2937)",
        color: "#0b1224",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <main style={cardStyle}>
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>Realtime Watchlist</div>
          <h1 style={{ margin: 0, fontSize: "2rem", color: "#0f172a" }}>Live Stock Dashboard</h1>
        </header>

        <section style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: 8, color: "#1f2937", fontWeight: 600 }}>
            Add symbol
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="e.g. META"
                style={{
                  flex: 1,
                  padding: "0.65rem 0.8rem",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  fontSize: "1rem",
                  minWidth: 0,
                  outline: "none",
                }}
              />
              <button
                onClick={addSymbol}
                style={{
                  padding: "0.65rem 1.2rem",
                  borderRadius: 10,
                  border: "none",
                  background: "#10b981",
                  color: "#0b1224",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </div>
          </label>
        </section>

        <section
          style={{
            display: "flex",
            gap: "0.6rem",
            flexWrap: "wrap",
            marginBottom: "1.25rem",
            justifyContent: "center",
          }}
        >
          {watchlist.map((symbol) => {
            const active = symbol === selectedSymbol;
            return (
              <button
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                style={{
                  padding: "0.5rem 0.85rem",
                  border: active ? "1px solid #10b981" : "1px solid #e5e7eb",
                  borderRadius: 999,
                  background: active ? "rgba(16,185,129,0.15)" : "#f9fafb",
                  color: "#0b1224",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 700 }}>{symbol}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSymbol(symbol);
                  }}
                  style={{ color: "#9ca3af", cursor: "pointer" }}
                  title="Remove"
                >
                  ×
                </span>
              </button>
            );
          })}
          {watchlist.length === 0 && <div style={{ color: "#6b7280" }}>No symbols yet.</div>}
        </section>

        <section
          style={{
            border: "1px solid #e5e7eb",
            padding: "1.25rem",
            borderRadius: 14,
            background: "#f9fafb",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: 4, color: "#6b7280" }}>
            Selected: <span style={{ color: "#111827", fontWeight: 700 }}>{selectedSymbol || "—"}</span>
          </div>
          <div style={{ color: "#6b7280" }}>Stream status: {status}</div>
          {error && <div style={{ color: "#dc2626", marginTop: 4 }}>{error}</div>}
          {quote ? (
            <>
              <div style={{ fontSize: "2.4rem", marginTop: 10, color: "#0b1224" }}>
                {quote.source === "quote" ? "Last quote (after hours): " : "Price: $"}
                {quote.price.toFixed(2)}
              </div>
              <div style={{ color: "#6b7280" }}>
                Updated: {new Date(quote.ts).toLocaleTimeString()} ({quote.source})
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, color: "#6b7280" }}>Connecting…</div>
          )}
        </section>
      </main>
    </div>
  );
}
