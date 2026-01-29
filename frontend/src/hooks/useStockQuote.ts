import { useEffect, useState } from "react";
import { getStockApiToken } from "../utils/env";
import type { Quote } from "../types/quote";

type UseStockQuoteResult = {
  quoteError: string | null;
};

export function useStockQuote(symbol: string, setQuote: (quote: Quote) => void): UseStockQuoteResult {
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getStockApiToken()?.trim();
    if (!symbol || !token) return undefined;

    const fetchQuote = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`
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
          setQuoteError((prev) => prev ?? "Failed to fetch last quote (after-hours fallback)");
        }
      }
    };

    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [symbol, setQuote]);

  return { quoteError };
}
