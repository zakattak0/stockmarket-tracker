import React from "react";

type Props = {
  watchlist: string[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

export function WatchlistChips({ watchlist, selectedSymbol, onSelect, onRemove }: Props) {
  return (
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
            onClick={() => onSelect(symbol)}
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
                onRemove(symbol);
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
  );
}
