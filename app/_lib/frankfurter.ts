/**
 * Thin fetch client for Frankfurter (api.frankfurter.dev) — free, no API key
 * required, ECB daily reference rates. See SPEC.md's "The FINANCE() function"
 * for why this provider was chosen over a keyed one.
 */

export interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/** Fetches rates for `base` -> each of `quotes` in one batched request. Returns null on any failure. */
export async function fetchFrankfurterRates(
  base: string,
  quotes: string[],
): Promise<FrankfurterResponse | null> {
  if (quotes.length === 0) return null;
  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quotes.join(','))}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as FrankfurterResponse;
  } catch {
    return null;
  }
}
