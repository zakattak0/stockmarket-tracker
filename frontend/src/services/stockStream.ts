/*
  WebSocket connector
  - includes fallback when no token or something fails
*/

import { getStockApiToken } from "../utils/env";

export type StreamStatus = "connecting" | "open" | "closed" | "error" | "mock";

export type StreamCallbacks = {
  onStatus?: (status: StreamStatus) => void;
  onError?: (message: string) => void;
};

// WebSocket connector for Finnhub trade stream
export function connectStockStream(
  symbol: string,
  onQuote: (data: { price: number }) => void,
  { onStatus, onError }: StreamCallbacks = {}
) {
  onStatus?.("connecting");
  const rawToken = getStockApiToken();
  const token = rawToken?.trim() || null;

  // if no token, report error and return no-op cleanup
  if (!token) {
    onStatus?.("error");
    onError?.("Error!");
    return () => {};
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
    } catch {
      onError?.("Failed to subscribe on open");
    }
  };

  const onMessage = (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "trade" && Array.isArray(msg.data) && msg.data.length) {
        const last = msg.data[msg.data.length - 1];
        if (typeof last.p === "number") onQuote({ price: last.p });
      }
    } catch {
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
