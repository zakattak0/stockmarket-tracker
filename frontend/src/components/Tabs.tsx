type Tab = { id: string; label: string };

type Props = {
  pages: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function Tabs({ pages, activeId, onSelect }: Props) {
  return (
    <nav
      style={{
        display: "flex",
        gap: 8,
        padding: 4,
        borderRadius: 999,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
      }}
      aria-label="Page selector"
    >
      {pages.map((page) => {
        const active = page.id === activeId;
        return (
          <button
            key={page.id}
            onClick={() => onSelect(page.id)}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 999,
              border: active ? "1px solid #10b981" : "1px solid transparent",
              background: active ? "rgba(16,185,129,0.15)" : "transparent",
              color: "#0b1224",
              cursor: "pointer",
              fontWeight: 700,
              minWidth: 90,
            }}
          >
            {page.label}
          </button>
        );
      })}
    </nav>
  );
}
