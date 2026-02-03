// IMPORTANT: Chart non-functioning currently, hiding for now
  const showChart = false;

import { useCallback, useMemo, useState } from "react";
import type React from "react";
import { useWatchlist } from "./hooks/useWatchlist";
import { useStockStream } from "./hooks/useStockStream";
import { useStockQuote } from "./hooks/useStockQuote";
import { AddSymbolForm } from "./components/AddSymbolForm";
import { PricePanel } from "./components/PricePanel";
import type { Quote } from "./types/quote";
import { Tabs } from "./components/Tabs";
import { NewsSignalsPage } from "./pages/NewsSignalsPage";
import { WatchlistSidebar } from "./components/WatchlistSidebar";
import { StockChart } from "./components/StockChart";

type Page = { id: string; label: string; render: () => React.ReactNode };

export default function App() {
  // Watchlist + streaming state (Watchlist page)
  const [quote, setQuote] = useState<Quote | null>(null);
  const { watchlist, selectedSymbol, setSelectedSymbol, addSymbol, removeSymbol } = useWatchlist();
  const [newSymbol, setNewSymbol] = useState("");

  const handleStreamQuote = useCallback((data: { price: number }) => {
    setQuote((prev) => ({
      price: data.price,
      ts: Date.now(),
      source: "stream",
      prevClose: prev?.prevClose ?? null,
    }));
  }, []);

  const { status, streamError } = useStockStream(selectedSymbol, handleStreamQuote);
  const { quoteError } = useStockQuote(selectedSymbol, setQuote);
  const error = streamError || quoteError;

  const submitSymbol = () => {
    addSymbol(newSymbol);
    setNewSymbol("");
  };

  // Page routing (tabs)
  const [activePage, setActivePage] = useState<string>("watchlist");

  // Different Pages
  const pages: Page[] = useMemo(
    () => [
      {
        id: "watchlist",
        label: "Watchlist",
        render: () => (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <WatchlistSidebar
              symbols={watchlist}
              selectedSymbol={selectedSymbol}
              onSelect={setSelectedSymbol}
              onRemove={removeSymbol}
            />
            <div style={{ display: "grid", gap: 16, flex: 1 }}>
              <AddSymbolForm value={newSymbol} onChange={setNewSymbol} onSubmit={submitSymbol} />
              <PricePanel selectedSymbol={selectedSymbol} status={status} error={error} quote={quote} />
              
              {showChart && <StockChart symbol={selectedSymbol} />}
            </div>
          </div>
        ),
      },
      {
        id: "news",
        label: "News & Signals",
        render: () => <NewsSignalsPage />,
      }
    ],
    [newSymbol, submitSymbol, watchlist, selectedSymbol, setSelectedSymbol, removeSymbol, status, error, quote]
  );

  const active = pages.find((p) => p.id === activePage) ?? pages[0];

  const cardStyle: React.CSSProperties = {
    width: "90vw",
    maxWidth: 1600,
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
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "4vh 0 0",
        color: "#0b1224",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <main style={cardStyle}>
        <header style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>Realtime Dashboard</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "2rem", color: "#0f172a" }}>StockCheck</h1>
            <Tabs pages={pages} activeId={activePage} onSelect={setActivePage} />
          </div>
        </header>

        {active.render()}
      </main>
    </div>
  );
}
