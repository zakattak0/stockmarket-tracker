function readEnv(keys: string[]): string | null {
  const imEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;

  for (const key of keys) {
    const value =
      imEnv?.[key] ||
      (globalThis as any)[`__${key}`] ||
      (globalThis as any).process?.env?.[key] ||
      (typeof window !== "undefined" ? (window as any)[`__${key}`] : null);

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

// looks for API key, returns it
export function getStockApiToken(): string | null {
  return readEnv(["STOCK_API", "VITE_STOCK_API", "REACT_APP_STOCK_API"]);
}

export function getMarketAuxApiKey(): string | null {
  return readEnv(["MARKETAUX_API_KEY", "VITE_MARKETAUX_API_KEY"]);
}

export function getGeminiApiKey(): string | null {
  return readEnv(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"]);
}
