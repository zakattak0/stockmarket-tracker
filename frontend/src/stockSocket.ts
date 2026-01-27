/**
 * Connect to Finnhub's trade stream for a symbol.
 * Expects a Vite env var `VITE_STOCK_API` containing the API token.
 */
export function connectStockStream(symbol: string, onQuote: (data: { price: number }) => void) {
  const token = (import.meta.env.VITE_STOCK_API as string | undefined)?.trim();
  if (!token) throw new Error("Missing VITE_STOCK_API");

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);

  const onOpen = () => {
    try {
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    } catch {
      // swallow send errors; onerror will fire if socket is bad
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
    } catch {
      // ignore parse errors
    }
  };

  ws.addEventListener("open", onOpen);
  ws.addEventListener("message", onMessage);

  return () => {
    try {
      ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
    } catch {}
    ws.removeEventListener("open", onOpen);
    ws.removeEventListener("message", onMessage);
    try {
      ws.close();
    } catch {}
  };
}
