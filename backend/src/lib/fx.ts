const FALLBACK_GHS_PER_USD = 12.8;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedRate: number | null = null;
let cachedAt = 0;

/**
 * Live USD -> GHS rate (how many GHS is 1 USD), cached for an hour to
 * avoid hammering the FX provider. Falls back to the last known rate, or
 * a static estimate, if the provider is unreachable.
 */
export async function getGhsPerUsd(): Promise<number> {
  const now = Date.now();
  if (cachedRate && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    const body = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    const rate = body.rates?.GHS;
    if (body.result === "success" && typeof rate === "number" && rate > 0) {
      cachedRate = rate;
      cachedAt = now;
      return rate;
    }
  } catch {
    // fall through to cached/fallback value below
  }

  return cachedRate ?? FALLBACK_GHS_PER_USD;
}
