/**
 * Marktkennzahlen – reine Funktionen ohne DOM, damit sie leicht testbar sind.
 *
 * Ein "Paar" ist [Preis, Menge] eines Marktes. Im Kaufen-Modus ist das
 * [Kaufpreis, Supply], im Verkaufen-Modus [Ankaufspreis, Demand].
 */
export type Mode = "buy" | "sell";
export type Pair = [price: number, qty: number];

/** Preise über diesem Vielfachen des gewichteten Medians gelten als Ausreißer. */
export const OUTLIER_FACTOR = 2;

/** Mengen für die Kurven "effektiver Preis für X t". */
export const VOLUMES: Record<Mode, number[]> = {
  buy: [5_000, 25_000, 50_000],
  sell: [1_000, 5_000, 10_000],
};

/** Nach Menge gewichteter Median – robust gegen Fantasiepreise und Mini-Bestände. */
export function weightedMedian(pairs: Pair[]): number | null {
  const sorted = pairs.filter(([, w]) => w > 0).sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let acc = 0;
  for (const [v, w] of sorted) {
    acc += w;
    if (acc >= total / 2) return v;
  }
  return null;
}

/**
 * Obergrenze für "ernst gemeinte" Preise: OUTLIER_FACTOR × gewichteter Median.
 * Gilt in beiden Modi nach oben – Carrier-Besitzer setzen absurde Preise
 * (z. B. 5.129.400 Cr) als "verkaufe/kaufe nicht"-Signal.
 */
export function outlierCap(pairs: Pair[]): number | null {
  const med = weightedMedian(pairs);
  return med == null ? null : med * OUTLIER_FACTOR;
}

/** Teilt Paare in normale und Ausreißer. */
export function splitOutliers<T>(items: T[], pairOf: (t: T) => Pair): { ok: T[]; outliers: T[]; cap: number | null } {
  const cap = outlierCap(items.map(pairOf));
  if (cap == null) return { ok: items, outliers: [], cap };
  const ok: T[] = [], outliers: T[] = [];
  for (const it of items) (pairOf(it)[0] > cap ? outliers : ok).push(it);
  return { ok, outliers, cap };
}

/**
 * Effektiver Preis für `volume` Tonnen: Durchschnittspreis, wenn man der Reihe
 * nach bei den besten Angeboten handelt (Kaufen: günstigste zuerst, Verkaufen:
 * höchster Ankauf zuerst), bis die Menge erreicht ist.
 * null = der Markt kann diese Menge gar nicht liefern/abnehmen.
 */
export function effectivePrice(pairs: Pair[], volume: number, mode: Mode): number | null {
  const sorted = pairs.filter(([, q]) => q > 0).sort((a, b) => (mode === "buy" ? a[0] - b[0] : b[0] - a[0]));
  let need = volume, cost = 0;
  for (const [p, q] of sorted) {
    const take = Math.min(q, need);
    cost += take * p;
    need -= take;
    if (need <= 0) return cost / volume;
  }
  return null;
}

/** Bester Einzelpreis (Kaufen: niedrigster, Verkaufen: höchster). */
export function bestPrice(pairs: Pair[], mode: Mode): number | null {
  let best: number | null = null;
  for (const [p] of pairs) best = best == null ? p : mode === "buy" ? Math.min(best, p) : Math.max(best, p);
  return best;
}
