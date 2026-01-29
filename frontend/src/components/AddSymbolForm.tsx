import React from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function AddSymbolForm({ value, onChange, onSubmit }: Props) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <label style={{ display: "block", marginBottom: 8, color: "#1f2937", fontWeight: 600 }}>
        Add symbol
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
            onClick={onSubmit}
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
  );
}
