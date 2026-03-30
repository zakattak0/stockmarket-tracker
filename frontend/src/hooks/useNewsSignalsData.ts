import { useEffect, useMemo, useState } from "react";
import { getGeminiApiKey, getMarketAuxApiKey, getStockApiToken } from "../utils/env";

export type NewsArticle = {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols: string[];
  averageSentiment: number | null;
};

export type WatchlistQuote = {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  asOf: string;
};

export type SymbolSignal = {
  symbol: string;
  action: "BUY" | "HOLD" | "SELL" | "WATCH";
  sentiment: "bullish" | "neutral" | "bearish" | "mixed";
  confidence: number;
  dayOutlook: string;
  weekOutlook: string;
  futureOutlook: string;
  rationale: string;
};

export type WatchlistAnalysis = {
  overallSentiment: "bullish" | "neutral" | "bearish" | "mixed";
  marketPulse: string;
  keyThemes: string[];
  riskFlags: string[];
  signals: SymbolSignal[];
};

export type SymbolNewsBucket = {
  symbol: string;
  articles: NewsArticle[];
  averageSentiment: number | null;
};

type MarketAuxArticleResponse = {
  uuid?: string;
  title?: string;
  description?: string;
  snippet?: string;
  url?: string;
  source?: string;
  published_at?: string;
  entities?: MarketAuxEntityResponse[];
};

type MarketAuxEntityResponse = {
  symbol?: string;
  sentiment_score?: number | null;
};

type RawAnalysis = {
  overallSentiment?: string;
  marketPulse?: string;
  keyThemes?: unknown;
  riskFlags?: unknown;
  signals?: unknown;
};

type UseNewsSignalsDataResult = {
  watchlist: string[];
  news: NewsArticle[];
  quotes: WatchlistQuote[];
  analysis: WatchlistAnalysis | null;
  symbolBuckets: SymbolNewsBucket[];
  quotesBySymbol: Map<string, WatchlistQuote>;
  newsLoading: boolean;
  quotesLoading: boolean;
  analysisLoading: boolean;
  newsError: string | null;
  quotesError: string | null;
  analysisError: string | null;
  lastUpdated: string | null;
  hasKeys: {
    marketAux: boolean;
    gemini: boolean;
    stocks: boolean;
  };
  refresh: () => void;
};

const MARKET_AUX_URL = "https://api.marketaux.com/v1/news/all";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_ARTICLES = 24;
const ANALYSIS_ARTICLE_LIMIT = 12;
const GEMINI_TIMEOUT_MS = 20000;

function formatMarketAuxDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeAction(value: unknown): SymbolSignal["action"] {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (normalized === "BUY" || normalized === "HOLD" || normalized === "SELL") {
    return normalized;
  }
  return "WATCH";
}

function normalizeSignalSentiment(value: unknown): SymbolSignal["sentiment"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "bullish" || normalized === "neutral" || normalized === "bearish") {
    return normalized;
  }
  return "mixed";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeAnalysis(raw: RawAnalysis, watchlist: string[]): WatchlistAnalysis {
  const rawSignals = Array.isArray(raw.signals) ? raw.signals : [];
  const signalMap = new Map<string, SymbolSignal>();

  for (const entry of rawSignals) {
    if (!entry || typeof entry !== "object") continue;

    const signal = entry as Record<string, unknown>;
    const symbol = typeof signal.symbol === "string" ? signal.symbol.trim().toUpperCase() : "";
    if (!watchlist.includes(symbol)) continue;

    signalMap.set(symbol, {
      symbol,
      action: normalizeAction(signal.action),
      sentiment: normalizeSignalSentiment(signal.sentiment),
      confidence:
        typeof signal.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(signal.confidence)))
          : 35,
      dayOutlook: typeof signal.dayOutlook === "string" ? signal.dayOutlook : "Insufficient evidence from the current headlines.",
      weekOutlook: typeof signal.weekOutlook === "string" ? signal.weekOutlook : "Insufficient evidence from the current headlines.",
      futureOutlook: typeof signal.futureOutlook === "string" ? signal.futureOutlook : "Insufficient evidence from the current headlines.",
      rationale: typeof signal.rationale === "string" ? signal.rationale : "The available articles do not provide enough signal for a stronger call.",
    });
  }

  for (const symbol of watchlist) {
    if (!signalMap.has(symbol)) {
      signalMap.set(symbol, {
        symbol,
        action: "WATCH",
        sentiment: "mixed",
        confidence: 25,
        dayOutlook: "Headline coverage is too thin for a confident day trade setup.",
        weekOutlook: "Watch for additional catalysts before leaning on this name.",
        futureOutlook: "Longer-term direction depends on follow-through beyond the current article set.",
        rationale: "Gemini did not have enough grounded evidence to produce a stronger symbol-specific signal.",
      });
    }
  }

  return {
    overallSentiment: normalizeSignalSentiment(raw.overallSentiment),
    marketPulse:
      typeof raw.marketPulse === "string"
        ? raw.marketPulse
        : "News flow is mixed and should be treated as directional context, not a forecast.",
    keyThemes: toStringArray(raw.keyThemes),
    riskFlags: toStringArray(raw.riskFlags),
    signals: watchlist.map((symbol) => signalMap.get(symbol) as SymbolSignal),
  };
}

function normalizeArticle(article: MarketAuxArticleResponse, watchlist: string[]): NewsArticle | null {
  if (!article.url || !article.title || !article.published_at) return null;

  const matchedSymbols = Array.from(
    new Set(
      (article.entities ?? [])
        .map((entity) => entity.symbol?.toUpperCase().trim())
        .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0 && watchlist.includes(symbol))
    )
  );

  if (!matchedSymbols.length) return null;

  const sentimentValues = (article.entities ?? [])
    .filter((entity) => entity.symbol && matchedSymbols.includes(entity.symbol.toUpperCase()))
    .map((entity) => entity.sentiment_score)
    .filter((score): score is number => typeof score === "number");

  return {
    id: article.uuid ?? article.url,
    title: article.title,
    description: article.description ?? article.snippet ?? "No summary provided.",
    url: article.url,
    source: article.source ?? "Unknown source",
    publishedAt: article.published_at,
    symbols: matchedSymbols,
    averageSentiment: average(sentimentValues),
  };
}

async function fetchWatchlistNews(watchlist: string[], signal?: AbortSignal): Promise<NewsArticle[]> {
  const marketAuxKey = getMarketAuxApiKey()?.trim();
  if (!marketAuxKey) {
    throw new Error("Missing MarketAux API key. Add MARKETAUX_API_KEY to the repo root .env.");
  }

  const publishedAfter = formatMarketAuxDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7));
  const params = new URLSearchParams({
    api_token: marketAuxKey,
    symbols: watchlist.join(","),
    filter_entities: "true",
    must_have_entities: "true",
    language: "en",
    sort: "published_at",
    limit: String(MAX_ARTICLES),
    published_after: publishedAfter,
  });

  const response = await fetch(`${MARKET_AUX_URL}?${params.toString()}`, { signal });
  if (!response.ok) {
    let details = `MarketAux request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) {
        details = `MarketAux request failed: ${payload.error.message}`;
      }
    } catch {
      // ignore response parsing failure
    }
    throw new Error(details);
  }

  const payload = (await response.json()) as { data?: MarketAuxArticleResponse[] };
  return (payload.data ?? [])
    .map((article) => normalizeArticle(article, watchlist))
    .filter((article): article is NewsArticle => Boolean(article));
}

async function fetchWatchlistQuotes(watchlist: string[], signal?: AbortSignal): Promise<WatchlistQuote[]> {
  const stockToken = getStockApiToken()?.trim();
  if (!stockToken) {
    throw new Error("Missing stock API key. Add STOCK_API to the repo root .env.");
  }

  return Promise.all(
    watchlist.map(async (symbol) => {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(stockToken)}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error(`Quote request failed for ${symbol}: ${response.status}`);
      }

      const payload = (await response.json()) as { c?: number; pc?: number; t?: number };
      const price = typeof payload.c === "number" && payload.c > 0 ? payload.c : null;
      const prevClose = typeof payload.pc === "number" && payload.pc > 0 ? payload.pc : null;
      const usablePrice = price ?? prevClose;
      const changeAmount = usablePrice != null && prevClose != null ? usablePrice - prevClose : null;
      const changePercent =
        changeAmount != null && prevClose != null && prevClose > 0 ? (changeAmount / prevClose) * 100 : null;

      return {
        symbol,
        price: usablePrice,
        prevClose,
        changeAmount,
        changePercent,
        asOf: new Date((typeof payload.t === "number" && payload.t > 0 ? payload.t : Date.now() / 1000) * 1000).toISOString(),
      };
    })
  );
}

async function analyzeWatchlistNews(
  watchlist: string[],
  articles: NewsArticle[],
  quotes: WatchlistQuote[],
  signal?: AbortSignal
): Promise<WatchlistAnalysis> {
  const geminiKey = getGeminiApiKey()?.trim();
  if (!geminiKey) {
    throw new Error("Missing Gemini API key. Add GEMINI_API_KEY to the repo root .env.");
  }

  const compactArticles = articles.slice(0, ANALYSIS_ARTICLE_LIMIT).map((article) => ({
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    symbols: article.symbols,
    sentimentScore: article.averageSentiment,
    summary: article.description,
  }));

  const compactQuotes = quotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.price,
    prevClose: quote.prevClose,
    changeAmount: quote.changeAmount,
    changePercent: quote.changePercent,
    asOf: quote.asOf,
  }));

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const request = fetch(GEMINI_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You analyze financial news for a stock watchlist. Ground every conclusion only in the supplied articles and quote snapshots. " +
              "Use the current price and the change versus the previous close only to judge whether market reaction confirms or contradicts the headlines. " +
              "Do not claim certainty, do not invent earnings numbers or price targets, and frame all outlooks as probabilistic scenarios rather than financial advice.",
          },
        ],
      },
      contents: [
        {
          parts: [
            {
              text:
                "Analyze the following watchlist data.\n" +
                "Return one signal object for every watchlist symbol, even if the evidence is weak.\n" +
                "Use BUY, HOLD, SELL, or WATCH as the action. Confidence should be an integer from 0 to 100.\n" +
                "The day/week/future outlooks should be short scenario summaries, not guarantees.\n" +
                "If there are no relevant articles for a symbol, say that the outlook is constrained by limited news coverage.\n" +
                "Explain when price action confirms, fades, or contradicts the available articles.\n\n" +
                JSON.stringify({ watchlist, quotes: compactQuotes, articles: compactArticles }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            overallSentiment: { type: "string" },
            marketPulse: { type: "string" },
            keyThemes: { type: "array", items: { type: "string" } },
            riskFlags: { type: "array", items: { type: "string" } },
            signals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  symbol: { type: "string" },
                  action: { type: "string" },
                  sentiment: { type: "string" },
                  confidence: { type: "integer" },
                  dayOutlook: { type: "string" },
                  weekOutlook: { type: "string" },
                  futureOutlook: { type: "string" },
                  rationale: { type: "string" },
                },
                required: [
                  "symbol",
                  "action",
                  "sentiment",
                  "confidence",
                  "dayOutlook",
                  "weekOutlook",
                  "futureOutlook",
                  "rationale",
                ],
              },
            },
          },
          required: ["overallSentiment", "marketPulse", "keyThemes", "riskFlags", "signals"],
        },
      },
    }),
  });

  let response: Response;
  try {
    response = (await Promise.race([
      request,
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Gemini request timed out after 20 seconds.")), GEMINI_TIMEOUT_MS);
      }),
    ])) as Response;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no analysis.");
  }

  return normalizeAnalysis(JSON.parse(text) as RawAnalysis, watchlist);
}

export function useNewsSignalsData(watchlistInput: string[]): UseNewsSignalsDataResult {
  const watchlist = useMemo(
    () => Array.from(new Set(watchlistInput.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))),
    [watchlistInput]
  );
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [analysis, setAnalysis] = useState<WatchlistAnalysis | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!watchlist.length) {
      setNews([]);
      setQuotes([]);
      setAnalysis(null);
      return;
    }

    const newsController = new AbortController();
    const quotesController = new AbortController();

    const loadNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const articles = await fetchWatchlistNews(watchlist, newsController.signal);
        setNews(articles);
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        if (!newsController.signal.aborted) {
          setNews([]);
          setNewsError(getErrorMessage(error));
        }
      } finally {
        if (!newsController.signal.aborted) {
          setNewsLoading(false);
        }
      }
    };

    const loadQuotes = async () => {
      setQuotesLoading(true);
      setQuotesError(null);
      try {
        setQuotes(await fetchWatchlistQuotes(watchlist, quotesController.signal));
      } catch (error) {
        if (!quotesController.signal.aborted) {
          setQuotes([]);
          setQuotesError(getErrorMessage(error));
        }
      } finally {
        if (!quotesController.signal.aborted) {
          setQuotesLoading(false);
        }
      }
    };

    void loadNews();
    void loadQuotes();

    return () => {
      newsController.abort();
      quotesController.abort();
    };
  }, [watchlist, refreshToken]);

  useEffect(() => {
    if (!watchlist.length || newsLoading || quotesLoading || (!news.length && !quotes.length)) {
      setAnalysis(null);
      setAnalysisLoading(false);
      return;
    }

    const controller = new AbortController();

    const runAnalysis = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        setAnalysis(await analyzeWatchlistNews(watchlist, news, quotes, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) {
          setAnalysis(null);
          setAnalysisError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setAnalysisLoading(false);
        }
      }
    };

    void runAnalysis();
    return () => controller.abort();
  }, [watchlist, news, quotes, newsLoading, quotesLoading]);

  const symbolBuckets = useMemo<SymbolNewsBucket[]>(
    () =>
      watchlist.map((symbol) => {
        const articles = news.filter((article) => article.symbols.includes(symbol)).slice(0, 4);
        const averageSentiment = average(
          articles
            .map((article) => article.averageSentiment)
            .filter((value): value is number => typeof value === "number")
        );
        return { symbol, articles, averageSentiment };
      }),
    [watchlist, news]
  );

  const quotesBySymbol = useMemo(() => new Map(quotes.map((quote) => [quote.symbol, quote])), [quotes]);

  return {
    watchlist,
    news,
    quotes,
    analysis,
    symbolBuckets,
    quotesBySymbol,
    newsLoading,
    quotesLoading,
    analysisLoading,
    newsError,
    quotesError,
    analysisError,
    lastUpdated,
    hasKeys: {
      marketAux: Boolean(getMarketAuxApiKey()?.trim()),
      gemini: Boolean(getGeminiApiKey()?.trim()),
      stocks: Boolean(getStockApiToken()?.trim()),
    },
    refresh: () => setRefreshToken((current) => current + 1),
  };
}
