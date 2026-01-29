import { useEffect, useState } from "react";
import { connectStockStream, StreamStatus } from "../services/stockStream";

export function useStockStream(
  symbol: string,
  onQuote: (data: { price: number }) => void
): { status: StreamStatus; streamError: string | null } {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const handleQuote = (data: { price: number }) => {
      setStreamError(null);
      onQuote(data);
    };

    return connectStockStream(symbol || "META", handleQuote, {
      onStatus: setStatus,
      onError: setStreamError,
    });
  }, [symbol, onQuote]);

  return { status, streamError };
}
