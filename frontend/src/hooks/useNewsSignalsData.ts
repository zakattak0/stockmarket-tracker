import { useEffect, useMemo, useState } from "react";
import { getAlphaVantageApiKey, getGeminiApiKey, getStockApiToken } from "../utils/env";

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

type AlphaVantageArticleResponse = {
  url?: string;
  title?: string;
  summary?: string;
  source?: string;
  time_published?: string;
  overall_sentiment_score?: string;
  ticker_sentiment?: AlphaVantageTickerSentiment[];
};

type AlphaVantageTickerSentiment = {
  ticker?: string;
  ticker_sentiment_score?: string;
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
    alphaVantage: boolean;
    gemini: boolean;
    stocks: boolean;
  };
  refresh: () => void;
};

type UseNewsSignalsDataOptions = {
  shouldAnalyze?: boolean;
};

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_ARTICLES = 50;
const ANALYSIS_ARTICLE_LIMIT = 12;
const GEMINI_TIMEOUT_MS = 20000;
const ANALYSIS_CACHE_PREFIX = "news-signals-analysis:";
const NEWS_CACHE_PREFIX = "alpha-vantage-news:";
const ALPHA_VANTAGE_REQUEST_SPACING_MS = 1100;

function formatAlphaVantageDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}`;
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

function normalizeAlphaVantageTimestamp(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function normalizeArticle(article: AlphaVantageArticleResponse, watchlist: string[]): NewsArticle | null {
  if (!article.url || !article.title || !article.time_published) return null;

  const publishedAt = normalizeAlphaVantageTimestamp(article.time_published);
  if (!publishedAt) return null;

  const matchedSymbols = Array.from(
    new Set(
      (article.ticker_sentiment ?? [])
        .map((entity) => entity.ticker?.toUpperCase().trim())
        .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0 && watchlist.includes(symbol))
    )
  );

  if (!matchedSymbols.length) return null;

  const sentimentValues = (article.ticker_sentiment ?? [])
    .filter((entity) => entity.ticker && matchedSymbols.includes(entity.ticker.toUpperCase()))
    .map((entity) => (typeof entity.ticker_sentiment_score === "string" ? Number(entity.ticker_sentiment_score) : null))
    .filter((score): score is number => typeof score === "number");

  const overallSentiment =
    typeof article.overall_sentiment_score === "string" ? Number(article.overall_sentiment_score) : null;

  return {
    id: article.url,
    title: article.title,
    description: article.summary ?? "No summary provided.",
    url: article.url,
    source: article.source ?? "Unknown source",
    publishedAt,
    symbols: matchedSymbols,
    averageSentiment: sentimentValues.length ? average(sentimentValues) : overallSentiment,
  };
}

function getAnalysisCacheKey(watchlist: string[], news: NewsArticle[], quotes: WatchlistQuote[]): string {
  const newsKey = news
    .slice(0, ANALYSIS_ARTICLE_LIMIT)
    .map((article) => `${article.id}:${article.publishedAt}`)
    .join("|");
  const quoteKey = quotes
    .map((quote) => `${quote.symbol}:${quote.price ?? "na"}:${quote.prevClose ?? "na"}:${quote.asOf}`)
    .join("|");

  return `${ANALYSIS_CACHE_PREFIX}${JSON.stringify({ watchlist, newsKey, quoteKey })}`;
}

function readCachedAnalysis(cacheKey: string): WatchlistAnalysis | null {
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as WatchlistAnalysis) : null;
  } catch {
    return null;
  }
}

function writeCachedAnalysis(cacheKey: string, analysis: WatchlistAnalysis): void {
  if (typeof sessionStorage === "undefined") return;

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(analysis));
  } catch {
    // ignore storage errors
  }
}

function getLocalDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNewsCacheKey(watchlist: string[]): string {
  return `${NEWS_CACHE_PREFIX}${getLocalDayKey()}:${watchlist.join(",")}`;
}

function readCachedNews(cacheKey: string): NewsArticle[] | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const payload = JSON.parse(raw) as { dayKey?: string; articles?: NewsArticle[] };
    if (payload.dayKey !== getLocalDayKey()) return null;
    return Array.isArray(payload.articles) ? payload.articles : null;
  } catch {
    return null;
  }
}

function readStaleCachedNews(cacheKey: string): NewsArticle[] | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const payload = JSON.parse(raw) as { articles?: NewsArticle[] };
    return Array.isArray(payload.articles) ? payload.articles : null;
  } catch {
    return null;
  }
}

function writeCachedNews(cacheKey: string, articles: NewsArticle[]): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        dayKey: getLocalDayKey(),
        articles,
      })
    );
  } catch {
    // ignore storage errors
  }
}

function isAlphaVantageRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("1 request per second") || normalized.includes("25 requests per day");
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!ms) return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("Request cancelled."));
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort);
  });
}

function mergeArticles(articles: NewsArticle[]): NewsArticle[] {
  const byId = new Map<string, NewsArticle>();

  for (const article of articles) {
    const existing = byId.get(article.id);
    if (!existing) {
      byId.set(article.id, article);
      continue;
    }

    const symbols = Array.from(new Set([...existing.symbols, ...article.symbols])).sort();
    const sentimentValues = [existing.averageSentiment, article.averageSentiment].filter(
      (value): value is number => typeof value === "number"
    );

    byId.set(article.id, {
      ...existing,
      symbols,
      averageSentiment: sentimentValues.length ? average(sentimentValues) : existing.averageSentiment ?? article.averageSentiment,
      description:
        existing.description !== "No summary provided."
          ? existing.description
          : article.description,
    });
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

async function fetchWatchlistNews(watchlist: string[], signal?: AbortSignal): Promise<NewsArticle[]> {
  const alphaVantageKey = getAlphaVantageApiKey()?.trim();
  if (!alphaVantageKey) {
    throw new Error("Missing Alpha Vantage API key. Add ALPHAVANTAGE_API_KEY to the repo root .env.");
  }

  const cacheKey = getNewsCacheKey(watchlist);
  const cachedNews = readCachedNews(cacheKey);
  if (cachedNews) {
    return cachedNews;
  }

  const timeFrom = formatAlphaVantageDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7));
  const collected: NewsArticle[] = [];

  for (const [index, symbol] of watchlist.entries()) {
    if (index > 0) {
      await delay(ALPHA_VANTAGE_REQUEST_SPACING_MS, signal);
    }

    const params = new URLSearchParams({
      function: "NEWS_SENTIMENT",
      apikey: alphaVantageKey,
      tickers: symbol,
      sort: "LATEST",
      limit: String(Math.max(10, Math.ceil(MAX_ARTICLES / Math.max(watchlist.length, 1)))),
      time_from: timeFrom,
    });

    const response = await fetch(`${ALPHA_VANTAGE_URL}?${params.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Alpha Vantage news request failed for ${symbol}: ${response.status}`);
    }

    const payload = (await response.json()) as {
      feed?: AlphaVantageArticleResponse[];
      Information?: string;
      Note?: string;
      "Error Message"?: string;
    };
    const upstreamError = payload["Error Message"] || payload.Note || payload.Information;
    if (upstreamError) {
      if (isAlphaVantageRateLimitMessage(upstreamError)) {
        const staleCachedNews = readStaleCachedNews(cacheKey);
        if (staleCachedNews) {
          return staleCachedNews;
        }
      }
      throw new Error(`Alpha Vantage news request failed for ${symbol}: ${upstreamError}`);
    }

    const symbolArticles = (payload.feed ?? [])
      .map((article) => normalizeArticle(article, watchlist))
      .filter((article): article is NewsArticle => Boolean(article));

    collected.push(...symbolArticles);
  }

  const mergedArticles = mergeArticles(collected).slice(0, MAX_ARTICLES);
  writeCachedNews(cacheKey, mergedArticles);
  return mergedArticles;
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
    if (response.status === 429) {
      throw new Error("Gemini rate limit hit (429). Wait a bit, then reopen the Signals tab or try Refresh Signals.");
    }
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

export function useNewsSignalsData(
  watchlistInput: string[],
  { shouldAnalyze = true }: UseNewsSignalsDataOptions = {}
): UseNewsSignalsDataResult {
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
  const analysisCacheKey = useMemo(() => getAnalysisCacheKey(watchlist, news, quotes), [watchlist, news, quotes]);

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
    if (!shouldAnalyze) {
      setAnalysisLoading(false);
      return;
    }

    if (!watchlist.length || newsLoading || quotesLoading || (!news.length && !quotes.length)) {
      setAnalysisLoading(false);
      return;
    }

    const cachedAnalysis = readCachedAnalysis(analysisCacheKey);
    if (cachedAnalysis) {
      setAnalysis(cachedAnalysis);
      setAnalysisError(null);
      setAnalysisLoading(false);
      return;
    }

    const controller = new AbortController();

    const runAnalysis = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const nextAnalysis = await analyzeWatchlistNews(watchlist, news, quotes, controller.signal);
        writeCachedAnalysis(analysisCacheKey, nextAnalysis);
        setAnalysis(nextAnalysis);
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
  }, [watchlist, news, quotes, newsLoading, quotesLoading, shouldAnalyze, analysisCacheKey]);

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
      alphaVantage: Boolean(getAlphaVantageApiKey()?.trim()),
      gemini: Boolean(getGeminiApiKey()?.trim()),
      stocks: Boolean(getStockApiToken()?.trim()),
    },
    refresh: () => setRefreshToken((current) => current + 1),
  };
}
