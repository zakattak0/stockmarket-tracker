import type { Quote } from "../types/quote";
import type { StreamStatus } from "../services/stockStream";

type Props = {
  selectedSymbol: string;
  status: StreamStatus;
  error: string | null;
  quote: Quote | null;
};

export function PricePanel({ selectedSymbol, status, error, quote }: Props) {
  return (
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
  );
}
