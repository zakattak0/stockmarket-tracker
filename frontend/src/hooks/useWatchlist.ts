/*
  Watchlist management hook
  - persists to localStorage
*/

import { useEffect, useState } from "react";

const DEFAULT_WATCHLIST = ["META", "AAPL", "GOOGL"];

type UseWatchlistResult = {
  watchlist: string[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
};

// Hook to manage a stock watchlist with localStorage persistence
export function useWatchlist(): UseWatchlistResult {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof localStorage === "undefined") return DEFAULT_WATCHLIST;
    try {
      const raw = localStorage.getItem("watchlist");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed;
    } catch {
      // ignore parse errors
    }
    return DEFAULT_WATCHLIST;
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => watchlist[0] ?? "");

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

  // allows users to add a symbol to their watchlist
  const addSymbol = (raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    if (!cleaned) return;
    setWatchlist((prev) => {
      if (prev.includes(cleaned)) return prev;
      return [...prev, cleaned];
    });
    setSelectedSymbol(cleaned);
  };

  // allows users to remove a symbol from their watchlist
  const removeSymbol = (symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  };

  return { watchlist, selectedSymbol, setSelectedSymbol, addSymbol, removeSymbol };
}
