import { useEffect, useState } from "react";

type Headline = { title: string; source: string; url: string; published: string };
type Signal = { action: "BUY" | "HOLD" | "SELL"; rationale: string };

export function NewsSignalsPage() {
  const [news, setNews] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/news"); // your backend proxy or static JSON
        if (!res.ok) throw new Error(`news failed ${res.status}`);
        setNews(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const runAI = async () => {
    setSigLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news/signal", { method: "POST" });
      if (!res.ok) throw new Error(`signal failed ${res.status}`);
      setSignal(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSigLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Latest Financial News</h2>
        <button onClick={runAI} disabled={sigLoading || loading}>
          {sigLoading ? "Analyzing..." : "Run AI Signal"}
        </button>
      </div>
      {error && <div style={{ color: "#dc2626" }}>{error}</div>}
      {loading ? (
        <div>Loading news…</div>
      ) : (
        news.map((n) => (
          <a key={n.url} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ padding: "0.75rem 1rem", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{n.title}</div>
              <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                {n.source} • {new Date(n.published).toLocaleString()}
              </div>
            </div>
          </a>
        ))
      )}
      {signal && (
        <div style={{ padding: "1rem", borderRadius: 10, background: "#ecfeff", border: "1px solid #67e8f9" }}>
          <div style={{ fontWeight: 800 }}>AI Signal: {signal.action}</div>
          <div>{signal.rationale}</div>
        </div>
      )}
    </div>
  );
}
