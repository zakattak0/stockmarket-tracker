import { useCallback, useState } from "react";
import type React from "react";
import { useWatchlist } from "./hooks/useWatchlist";
import { useStockStream } from "./hooks/useStockStream";
import { useStockQuote } from "./hooks/useStockQuote";
import { AddSymbolForm } from "./components/AddSymbolForm";
import { WatchlistChips } from "./components/WatchlistChips";
import { PricePanel } from "./components/PricePanel";
import type { Quote } from "./types/quote";

export default function App() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const { watchlist, selectedSymbol, setSelectedSymbol, addSymbol, removeSymbol } = useWatchlist();
  const [newSymbol, setNewSymbol] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleStreamQuote = useCallback(
    (data: { price: number }) => setQuote({ price: data.price, ts: Date.now(), source: "stream" }),
    []
  );

  const { status } = useStockStream(selectedSymbol, (data) => {
    setStreamError(null);
    handleStreamQuote(data);
  });

  const { quoteError } = useStockQuote(selectedSymbol, setQuote);

  const error = streamError || quoteError;

  const submitSymbol = () => {
    addSymbol(newSymbol);
    setNewSymbol("");
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 920,
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
    borderRadius: 18,
    padding: "1.5rem",
    backdropFilter: "blur(8px)",
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 2rem",
        color: "#0b1224",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <main style={cardStyle}>
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>Realtime Watchlist</div>
          <h1 style={{ margin: 0, fontSize: "2rem", color: "#0f172a" }}>Live Stock Dashboard</h1>
        </header>

        <AddSymbolForm value={newSymbol} onChange={setNewSymbol} onSubmit={submitSymbol} />

        <WatchlistChips
          watchlist={watchlist}
          selectedSymbol={selectedSymbol}
          onSelect={setSelectedSymbol}
          onRemove={removeSymbol}
        />

        <PricePanel selectedSymbol={selectedSymbol} status={status} error={error} quote={quote} />
      </main>
    </div>
  );
}
