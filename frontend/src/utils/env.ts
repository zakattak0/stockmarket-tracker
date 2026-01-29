// looks for API key, returns it
export function getStockApiToken(): string | null {
  const imEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
  return (
    imEnv?.STOCK_API ||
    imEnv?.VITE_STOCK_API ||
    (globalThis as any).__STOCK_API ||
    (globalThis as any).process?.env?.STOCK_API ||
    (globalThis as any).process?.env?.REACT_APP_STOCK_API ||
    (typeof window !== "undefined" ? (window as any).__STOCK_API : null) ||
    null
  );
}
