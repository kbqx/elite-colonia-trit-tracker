/**
 * Spansh-Client: fragt die Stationssuche ab und normalisiert die Antwort
 * in unser eigenes, stabiles Format (MarketEntry).
 *
 * Spansh hat keine offizielle API-Doku. Die Feldnamen unten sind gegen eine
 * echte Antwort geprüft (Snapshot vom 23.11.2026, 500 ly um Colonia).
 *
 * Wichtig aus diesem Test: Ein Market-Filter nur mit { name: "Tritium" }
 * filtert NICHT – jede Station führt Tritium in ihrer Warenliste (meist mit
 * 0 Supply/0 Demand). Das lieferte 875 Stationen / 43 MB. Deshalb fragen wir
 * zwei Seiten getrennt ab: Supply ≥ 1 (hier kann man kaufen) und
 * Demand ≥ 1 (hier kann man verkaufen).
 */
import type { MarketEntry, PadSize, StationKind } from "../site/src/types.ts";
import type { Config } from "./config.ts";

/** Ein Treffer aus Spansh – nur die Felder, die wir (vermutlich) brauchen. */
export interface SpanshStation {
  id?: string | number;
  market_id?: number;
  name?: string;
  system_name?: string;
  type?: string;
  distance?: number;
  distance_to_arrival?: number;
  has_large_pad?: boolean;
  large_pads?: number;
  medium_pads?: number;
  small_pads?: number;
  is_planetary?: boolean;
  market_updated_at?: string;
  updated_at?: string;
  market?: SpanshCommodity[];
  /** Nur Carrier: frei vergebener Name (oft leer), `name` ist dann das Rufzeichen. */
  carrier_name?: string | null;
  /** Nur Carrier: "All" | "Squadron" | "Friends" | "Squadron Friends" | "None" */
  carrier_docking_access?: string | null;
  [key: string]: unknown;
}

export interface SpanshCommodity {
  commodity?: string;
  name?: string;
  buy_price?: number;
  sell_price?: number;
  supply?: number;
  demand?: number;
  [key: string]: unknown;
}

export interface SpanshSearchResponse {
  count?: number;
  size?: number;
  from?: number;
  results?: SpanshStation[];
  [key: string]: unknown;
}

export type MarketSide = "supply" | "demand";

/** Obergrenze für Bereichsfilter – Spansh erwartet [min, max]. */
const MAX = 999_999_999;

/**
 * Baut den Request-Body für eine Seite der Suche.
 * side = "supply": Stationen, die Tritium VERKAUFEN (Supply ≥ 1)
 * side = "demand": Stationen, die Tritium KAUFEN (Demand ≥ 1)
 * Format der Bereichsfilter wie in der Spansh-Weboberfläche ({ value, comparison: "<=>" }).
 */
export function buildSearchBody(cfg: Config, page: number, side: MarketSide): Record<string, unknown> {
  const commodityFilter: Record<string, unknown> = { name: cfg.commodity };
  if (cfg.useMarketFilter) commodityFilter[side] = { value: [1, MAX], comparison: "<=>" };
  return {
    filters: {
      distance: { min: "0", max: String(cfg.radiusLy) },
      market: [commodityFilter],
    },
    sort: [{ distance: { direction: "asc" } }],
    size: cfg.pageSize,
    page,
    reference_system: cfg.referenceSystem,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson(cfg: Config, body: unknown): Promise<SpanshSearchResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.requestTimeoutMs);
  try {
    const res = await fetch(cfg.spanshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": cfg.userAgent,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Spansh antwortete mit HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as SpanshSearchResponse;
  } finally {
    clearTimeout(timer);
  }
}

/** Holt alle Seiten. Gibt Rohantworten zurück (für Debug) plus alle Treffer. */
export async function fetchAllStations(
  cfg: Config,
  log: (msg: string) => void = console.log,
): Promise<{ raw: SpanshSearchResponse[]; stations: SpanshStation[] }> {
  // Ohne Market-Filter reicht eine Abfrage (liefert dann ALLE Stationen).
  const sides: MarketSide[] = cfg.useMarketFilter ? ["supply", "demand"] : ["supply"];
  const raw: SpanshSearchResponse[] = [];
  const stations: SpanshStation[] = [];
  for (const side of sides) {
    log(cfg.useMarketFilter ? `→ ${side === "supply" ? "Verkäufer (Supply ≥ 1)" : "Käufer (Demand ≥ 1)"}` : "→ alle Stationen (ohne Market-Filter)");
    const part = await fetchSide(cfg, side, log);
    raw.push(...part.raw);
    stations.push(...part.stations);
    await sleep(cfg.requestDelayMs);
  }
  return { raw, stations };
}

async function fetchSide(
  cfg: Config,
  side: MarketSide,
  log: (msg: string) => void,
): Promise<{ raw: SpanshSearchResponse[]; stations: SpanshStation[] }> {
  const raw: SpanshSearchResponse[] = [];
  const stations: SpanshStation[] = [];

  for (let page = 0; page < cfg.maxPages; page++) {
    const body = buildSearchBody(cfg, page, side);
    let resp: SpanshSearchResponse | undefined;

    // Bis zu 3 Versuche mit wachsender Pause (Spansh ist manchmal kurz überlastet).
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        resp = await postJson(cfg, body);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        log(`  Seite ${page}: Versuch ${attempt} fehlgeschlagen (${(err as Error).message}) – neuer Versuch …`);
        await sleep(cfg.requestDelayMs * attempt * 2);
      }
    }
    if (!resp) break;

    raw.push(resp);
    const results = Array.isArray(resp.results) ? resp.results : [];
    stations.push(...results);
    log(`  Seite ${page}: ${results.length} Treffer (gesamt ${stations.length}${resp.count != null ? ` / ${resp.count}` : ""})`);

    const total = typeof resp.count === "number" ? resp.count : undefined;
    if (results.length < cfg.pageSize) break;
    if (total !== undefined && stations.length >= total) break;
    await sleep(cfg.requestDelayMs);
  }
  return { raw, stations };
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function classifyStation(typeLabel: string, isPlanetary?: boolean): StationKind {
  const t = typeLabel.toLowerCase();
  if (t.includes("carrier")) return "carrier";
  if (t.includes("settlement")) return "settlement";
  if (t.includes("planetary") || t.includes("surface") || isPlanetary === true) return "planetary";
  if (t.length === 0) return "other";
  return "orbital";
}

export function inferMaxPad(s: SpanshStation, kind: StationKind): PadSize | null {
  if (s.has_large_pad === true || (num(s.large_pads) ?? 0) > 0) return "L";
  if ((num(s.medium_pads) ?? 0) > 0) return "M";
  if ((num(s.small_pads) ?? 0) > 0) return "S";
  if (s.has_large_pad === false) return "M"; // weiß nur: kein L
  // Fallback über den Typ, falls Spansh keine Pad-Felder liefert.
  const t = (s.type ?? "").toLowerCase();
  if (kind === "carrier") return "L";
  if (t.includes("outpost") && !t.includes("planetary")) return "M";
  if (t.includes("starport") || t.includes("asteroid") || t.includes("planetary port") || t.includes("mega ship")) return "L";
  return null;
}

/**
 * Wandelt einen Spansh-Treffer in einen MarketEntry um.
 * Gibt null zurück, wenn die Station die Ware nicht im Markt führt.
 */
export function normalizeStation(s: SpanshStation, commodity: string): MarketEntry | null {
  const wanted = commodity.toLowerCase();
  const item = (s.market ?? []).find((c) => (c.commodity ?? c.name ?? "").toLowerCase() === wanted);
  if (!item) return null;

  const typeLabel = s.type ?? "";
  const kind = classifyStation(typeLabel, s.is_planetary);
  const buy = num(item.buy_price);
  const sell = num(item.sell_price);
  const supply = num(item.supply) ?? 0;
  const demand = num(item.demand) ?? 0;
  // Ware steht nur in der Liste, wird aber weder ge- noch verkauft → irrelevant.
  if (supply <= 0 && demand <= 0) return null;

  const carrierName = typeof s.carrier_name === "string" ? s.carrier_name.trim() : "";
  return {
    id: String(s.market_id ?? s.id ?? `${s.system_name}/${s.name}`),
    station: kind === "carrier" && carrierName ? carrierName : s.name ?? "?",
    ...(kind === "carrier" ? { callsign: s.name ?? "?", dockingAccess: s.carrier_docking_access ?? null } : {}),
    system: s.system_name ?? "?",
    kind,
    typeLabel,
    maxPad: inferMaxPad(s, kind),
    distanceLy: num(s.distance),
    arrivalLs: num(s.distance_to_arrival),
    // Ein Preis von 0 heißt in ED: wird hier nicht gehandelt.
    buyPrice: buy && buy > 0 && supply > 0 ? buy : null,
    supply,
    sellPrice: sell && sell > 0 && demand > 0 ? sell : null,
    demand,
    marketUpdatedAt: toIso(s.market_updated_at ?? s.updated_at),
  };
}

/**
 * Spansh liefert Zeitstempel teils im Postgres-Format ("2026-11-23 12:01:00+00"),
 * das nicht jeder Browser parst. Wir speichern immer echtes ISO 8601.
 */
export function toIso(v: unknown): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  let s = v.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s += ":00"; // "+00" → "+00:00"
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) s += "Z"; // ohne Zone → UTC
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
