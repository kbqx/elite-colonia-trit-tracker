/**
 * Colonia Tritium Ticker – Frontend
 * Lädt data/latest.json + data/history.json und rendert KPIs, Laufband,
 * filterbare Tabelle, Top-Liste und Verlaufscharts. Filterzustand liegt in der URL.
 */
import { isGoneRow, type HistoryFile, type HistoryRow, type MarketEntry, type Snapshot, type StationKind } from "./types.js";
import { renderCharts, sparkline, type Series } from "./chart.js";
import { ageClass, esc, fmtCompact, fmtDateTime, fmtInt, fmtPct, relTime } from "./format.js";

// ---------------------------------------------------------------------------
// Typen & Zustand
// ---------------------------------------------------------------------------
type Mode = "buy" | "sell";
type SortKey = "station" | "system" | "kind" | "pad" | "dist" | "price" | "qty" | "delta" | "age";

interface State {
  mode: Mode;
  /** Mindest-Supply (Kaufen-Modus) in t. */
  minBuy: number;
  /** Mindest-Demand (Verkaufen-Modus) in t. */
  minSell: number;
  age: number; // Stunden, 0 = egal
  dist: number; // ly, 0 = egal
  pad: "any" | "L";
  /** "public": nur Märkte, an denen jeder andocken kann (Carrier-Zugang "All" oder unbekannt). */
  dock: "public" | "any";
  kinds: StationKind[];
  q: string;
  sort: SortKey;
  dir: "asc" | "desc";
  sel: string | null;
  days: number;
}

// Fleet Carrier zuerst – sie sind der Kern des Trackers.
const ALL_KINDS: StationKind[] = ["carrier", "orbital", "planetary", "settlement", "other"];
// Standard: nur Marktdaten ≤ 7 Tage und öffentlich andockbar – ältere/gesperrte
// Einträge verzerren sonst die Preise massiv (siehe echter Snapshot 23.11.).
// Mindestmengen: Kleinstbestände (z. B. 29 t zu 53k Cr) sind keine ernstzunehmenden
// Märkte und würden "günstigster Preis", Summen und Charts verzerren.
// Demand ist in Colonia typischerweise kleiner (meist < 5.000 t), daher eigener Wert.
const DEFAULT_MIN_BUY = 5000;
const DEFAULT_MIN_SELL = 1000;
const DEFAULTS: State = { mode: "buy", minBuy: DEFAULT_MIN_BUY, minSell: DEFAULT_MIN_SELL, age: 168, dist: 0, pad: "any", dock: "public", kinds: [...ALL_KINDS], q: "", sort: "qty", dir: "desc", sel: null, days: 7 };

const KIND_LABEL: Record<StationKind, string> = {
  orbital: "Orbital",
  planetary: "Planetar",
  settlement: "Settlement",
  carrier: "Fleet Carrier",
  other: "Sonstige",
};
const KIND_ICON: Record<StationKind, string> = {
  orbital: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/></svg>`,
  planetary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18c4-5 16-5 20 0"/><path d="M8 14V9h8v5"/><path d="M12 9V5"/></svg>`,
  settlement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18"/><path d="M5 20v-7l4-3v10"/><path d="M13 20V8l6 3v9"/></svg>`,
  carrier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 14h18l-3 4H6z"/><path d="M7 14V9h4v5"/><path d="M13 14v-3h4v3"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>`,
};
const COLOR_PRICE = "#f5842f";
const COLOR_QTY = "#4d9cf0";

let state: State = readStateFromUrl();
let snap: Snapshot;
let hist: HistoryFile | null = null;
let now = Date.now();

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---------------------------------------------------------------------------
// URL <-> Zustand (Filter teilbar per Link)
// ---------------------------------------------------------------------------
function readStateFromUrl(): State {
  const p = new URLSearchParams(location.hash.slice(1));
  const s: State = { ...DEFAULTS, kinds: [...DEFAULTS.kinds] };
  const n = (k: string, d: number) => (p.has(k) && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : d);
  if (p.get("mode") === "sell") s.mode = "sell";
  s.minBuy = n("min", s.minBuy);
  s.minSell = n("dmin", s.minSell);
  s.age = n("age", s.age);
  s.dist = n("dist", s.dist);
  if (p.get("pad") === "L") s.pad = "L";
  if (p.get("dock") === "any") s.dock = "any";
  if (p.has("kinds")) s.kinds = (p.get("kinds") ?? "").split(",").filter((k): k is StationKind => (ALL_KINDS as string[]).includes(k));
  s.q = p.get("q") ?? "";
  const sort = p.get("sort");
  if (sort) s.sort = sort as SortKey;
  if (p.get("dir") === "asc") s.dir = "asc";
  s.sel = p.get("sel");
  s.days = n("days", s.days);
  return s;
}

function writeStateToUrl(): void {
  const p = new URLSearchParams();
  const d = DEFAULTS;
  if (state.mode !== d.mode) p.set("mode", state.mode);
  if (state.minBuy !== d.minBuy) p.set("min", String(state.minBuy));
  if (state.minSell !== d.minSell) p.set("dmin", String(state.minSell));
  if (state.age !== d.age) p.set("age", String(state.age));
  if (state.dist !== d.dist) p.set("dist", String(state.dist));
  if (state.pad !== d.pad) p.set("pad", state.pad);
  if (state.dock !== d.dock) p.set("dock", state.dock);
  if (state.kinds.length !== ALL_KINDS.length) p.set("kinds", state.kinds.join(","));
  if (state.q) p.set("q", state.q);
  if (state.sort !== defaultSort(state.mode)) p.set("sort", state.sort);
  if (state.dir !== "desc") p.set("dir", state.dir);
  if (state.sel) p.set("sel", state.sel);
  if (state.days !== d.days) p.set("days", String(state.days));
  const hash = p.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

const defaultSort = (mode: Mode): SortKey => (mode === "buy" ? "qty" : "price");

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------
async function loadData(): Promise<void> {
  // Für eingebettete Vorschauen können Daten direkt im HTML stehen.
  const inline = (window as unknown as { __CTT_DATA__?: { snap: Snapshot; hist: HistoryFile } }).__CTT_DATA__;
  if (inline) {
    snap = inline.snap;
    hist = inline.hist;
    return;
  }
  const bust = `?v=${Math.floor(Date.now() / 300_000)}`; // Cache max. 5 min
  const res = await fetch(`data/latest.json${bust}`);
  if (!res.ok) throw new Error(`latest.json: HTTP ${res.status}`);
  snap = (await res.json()) as Snapshot;
  try {
    const h = await fetch(`data/history.json${bust}`);
    const data = h.ok ? ((await h.json()) as HistoryFile) : null;
    hist = data?.schema === 2 ? data : null; // ältere Formate ignorieren
  } catch {
    hist = null;
  }
}

const priceOf = (m: MarketEntry, mode: Mode) => (mode === "buy" ? m.buyPrice : m.sellPrice);
const qtyOf = (m: MarketEntry, mode: Mode) => (mode === "buy" ? m.supply : m.demand);

/** Stationsbezogene Filter (gelten auch für den Verlauf). */
const isPublic = (m: MarketEntry) => m.kind !== "carrier" || m.dockingAccess == null || m.dockingAccess === "All";

function passesStatic(m: { kind: StationKind; station: string; system: string; callsign?: string }, full?: MarketEntry): boolean {
  if (!state.kinds.includes(m.kind)) return false;
  if (state.q) {
    const q = state.q.toLowerCase();
    const hay = `${m.station} ${m.system} ${m.callsign ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (full) {
    if (state.dock === "public" && !isPublic(full)) return false;
    if (state.pad === "L" && full.maxPad !== "L") return false;
    if (state.dist > 0 && (full.distanceLy ?? Infinity) > state.dist) return false;
  }
  return true;
}

/** Mindestmenge für den jeweiligen Modus. */
const minFor = (mode: Mode) => (mode === "buy" ? state.minBuy : state.minSell);

function filtered(mode: Mode = state.mode): MarketEntry[] {
  return snap.markets.filter((m) => {
    const price = priceOf(m, mode);
    const qty = qtyOf(m, mode);
    if (price == null || qty <= 0 || qty < minFor(mode)) return false;
    if (state.age > 0) {
      if (!m.marketUpdatedAt || now - Date.parse(m.marketUpdatedAt) > state.age * 3_600_000) return false;
    }
    return passesStatic(m, m);
  });
}

// ---------------------------------------------------------------------------
// Verlauf (Schema 2): pro Markt nur Änderungen. Zustand zum Zeitpunkt T =
// letzte Zeile mit t ≤ T. "Weg"-Zeilen bedeuten: kein Handel mehr.
// ---------------------------------------------------------------------------

/** Ende der Zeitachse = Zeitpunkt des aktuellen Snapshots (ms). */
const historyEnd = () => Date.parse(snap.generatedAt);

/** Letzte Zeile mit t ≤ tSec (binäre Suche) – oder null. */
function rowAt(rows: HistoryRow[] | undefined, tSec: number): HistoryRow | null {
  if (!rows || rows.length === 0 || (rows[0] as HistoryRow)[0] > tSec) return null;
  let lo = 0, hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((rows[mid] as HistoryRow)[0] <= tSec) lo = mid;
    else hi = mid - 1;
  }
  const r = rows[lo] as HistoryRow;
  return isGoneRow(r) ? null : r;
}

const rowPrice = (r: HistoryRow, mode: Mode) => (mode === "buy" ? r[1] : r[3]);
const rowQty = (r: HistoryRow, mode: Mode) => (mode === "buy" ? r[2] : r[4]);

/**
 * Gleichmäßige Zeitachse über `days` Tage bis zum aktuellen Snapshot.
 * clip=true: nicht vor dem ersten Snapshot beginnen (davor ist der Markt nur
 * lückenhaft bekannt und Summen würden einen Scheinanstieg zeigen).
 */
function timeGrid(days: number, clip = true): number[] {
  const end = historyEnd();
  const stepH = days <= 1 ? 0.5 : days <= 7 ? 2 : days <= 14 ? 3 : 6;
  const step = stepH * 3_600_000;
  let n = Math.round((days * 86_400_000) / step);
  const started = clip && hist?.startedAt ? Date.parse(hist.startedAt) : -Infinity;
  while (n > 0 && end - n * step < started) n--;
  return Array.from({ length: n + 1 }, (_, i) => end - (n - i) * step);
}

/** Preis pro Markt-ID vor `hours` Stunden (für Δ-Spalte und Laufband). */
function pricesAgo(hours: number): Map<string, number> {
  const out = new Map<string, number>();
  if (!hist) return out;
  const tSec = Math.floor((historyEnd() - hours * 3_600_000) / 1000);
  for (const [id, rows] of Object.entries(hist.series)) {
    const r = rowAt(rows, tSec);
    const v = r ? rowPrice(r, state.mode) : null;
    if (v != null) out.set(id, v);
  }
  return out;
}

/** Preisverlauf eines Marktes für die Sparkline. */
function seriesFor(id: string, days: number): Array<number | null> {
  const rows = hist?.series[id];
  if (!rows) return [];
  // Einzelmarkt: hier ist jede Zeile echt, also auch Daten vor dem ersten Snapshot zeigen.
  return timeGrid(days, false).map((t) => {
    const r = rowAt(rows, Math.floor(t / 1000));
    return r ? rowPrice(r, state.mode) : null;
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderHeader(): void {
  $("#status-age").textContent = relTime(snap.generatedAt, now);
  $("#status-pill").title = `Letzter Snapshot: ${fmtDateTime(snap.generatedAt)}`;
  $("#source-pill").hidden = snap.source !== "mock";
  $("#footer-stamp").textContent = fmtDateTime(snap.generatedAt);

  // Hero-Zahl folgt den aktiven Filtern, aber immer auf der Angebotsseite.
  const sellers = filtered("buy");
  const totalSupply = sellers.reduce((s, m) => s + m.supply, 0);
  $("#hero-supply").innerHTML = `${fmtInt(totalSupply)}<small>t</small>`;
  const ageTxt = state.age > 0 ? ` · Update ≤ ${state.age >= 48 ? `${state.age / 24} T` : `${state.age} h`}` : "";
  const minTxt = state.minBuy > 0 ? ` · ab ${fmtInt(state.minBuy)} t` : "";
  $("#hero-supply-label").textContent = `Tonnen Tritium im Angebot bei ${sellers.length} Märkten im Umkreis von ${fmtInt(snap.radiusLy)} ly um ${snap.referenceSystem}${minTxt}${ageTxt}${state.dock === "public" ? " · öffentlich andockbar" : ""}`;
}

/** Anzeigename + Zusatzzeile (Rufzeichen bei Carriern). */
function displayName(m: MarketEntry): { name: string; sub: string } {
  const cs = m.callsign && m.callsign !== m.station ? m.callsign : "";
  const ACCESS: Record<string, string> = { Squadron: "nur Squadron", Friends: "nur Freunde", "Squadron Friends": "nur Squadron & Freunde", None: "gesperrt" };
  const access = m.kind === "carrier" && m.dockingAccess && m.dockingAccess !== "All" ? ` · ${ACCESS[m.dockingAccess] ?? m.dockingAccess}` : "";
  return { name: m.station, sub: [cs, m.typeLabel || "–"].filter(Boolean).join(" · ") + access };
}

/** Nach Menge gewichteter Median – robust gegen Fantasiepreise und Mini-Bestände. */
function weightedMedian(pairs: Array<[value: number, weight: number]>): number | null {
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

let lastTicker = "";
function renderTicker(): void {
  const ago = pricesAgo(24);
  const items = filtered("buy")
    .sort((a, b) => b.supply - a.supply)
    .slice(0, 14)
    .map((m) => {
      const prev = ago.get(m.id);
      const pct = prev && m.buyPrice ? ((m.buyPrice - prev) / prev) * 100 : null;
      const cls = pct == null ? "" : pct > 0 ? "up" : pct < 0 ? "down" : "";
      const arrow = pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "■";
      const change = pct == null ? "" : ` <span class="${cls}">${arrow} ${fmtPct(pct)}</span>`;
      return `<span class="ticker-item"><b>${esc(m.station.toUpperCase())}</b>${fmtInt(m.buyPrice)} Cr · ${fmtCompact(m.supply)} t${change}</span>`;
    })
    .join("");
  // Zweimal einfügen → nahtloser Loop (Animation läuft bis -50 %).
  // Nur neu setzen, wenn sich etwas geändert hat – sonst springt die Animation.
  if (items !== lastTicker) {
    lastTicker = items;
    $("#ticker").innerHTML = items + items;
  }
}

function renderKpis(rows: MarketEntry[]): void {
  const buy = state.mode === "buy";
  const withPrice = rows.filter((m) => priceOf(m, state.mode) != null);
  const best = [...withPrice].sort((a, b) => buy ? (a.buyPrice ?? 0) - (b.buyPrice ?? 0) : (b.sellPrice ?? 0) - (a.sellPrice ?? 0))[0];
  const qtySum = rows.reduce((s, m) => s + qtyOf(m, state.mode), 0);
  const weighted = weightedMedian(rows.map((m) => [priceOf(m, state.mode) ?? 0, qtyOf(m, state.mode)]));
  const carrierRows = rows.filter((m) => m.kind === "carrier");
  const carrierQty = carrierRows.reduce((s, m) => s + qtyOf(m, state.mode), 0);
  const carrierShare = qtySum > 0 ? (carrierQty / qtySum) * 100 : null;

  // Δ des gewichteten Medians ggü. 24 h (gleiche Stationen, aktuelle Mengen als Gewicht)
  const ago = pricesAgo(24);
  const prevPairs: Array<[number, number]> = [];
  for (const m of rows) {
    const prev = ago.get(m.id);
    if (prev != null) prevPairs.push([prev, qtyOf(m, state.mode)]);
  }
  const prevWeighted = weightedMedian(prevPairs);
  const dW = weighted != null && prevWeighted ? ((weighted - prevWeighted) / prevWeighted) * 100 : null;
  const dCls = (p: number | null) => (p == null ? "" : p > 0 ? "delta-up" : p < 0 ? "delta-down" : "");

  const card = (label: string, value: string, sub: string) =>
    `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;

  $("#kpis").innerHTML = [
    card(
      buy ? "Günstigster Kaufpreis" : "Höchster Ankaufspreis",
      `${fmtInt(best ? priceOf(best, state.mode) : null)} <small>Cr/t</small>`,
      best ? `${esc(best.station)} · ${esc(best.system)} · ${fmtInt(qtyOf(best, state.mode))} t` : "keine Treffer",
    ),
    card(
      buy ? "Typischer Preis (Median, nach Supply gewichtet)" : "Typischer Ankauf (Median, nach Demand gewichtet)",
      `${fmtInt(weighted)} <small>Cr/t</small>`,
      `<span class="${dCls(dW)}">${fmtPct(dW)}</span> ggü. 24 h`,
    ),
    card(buy ? "Supply (gefiltert)" : "Demand (gefiltert)", `${fmtInt(qtySum)} <small>t</small>`, `über ${rows.length} Märkte`),
    card(
      buy ? "Fleet-Carrier-Anteil am Supply" : "Fleet-Carrier-Anteil an Demand",
      `${carrierShare == null ? "–" : Math.round(carrierShare)} <small>%</small>`,
      `${carrierRows.length} Carrier · ${rows.length} von ${snap.markets.length} Märkten`,
    ),
  ].join("");
}

interface Column {
  key: SortKey | "trend";
  label: string;
  right?: boolean;
  sortable?: boolean;
  title?: string;
}

function columns(): Column[] {
  const buy = state.mode === "buy";
  return [
    { key: "station", label: "Station", sortable: true },
    { key: "system", label: "System", sortable: true },
    { key: "kind", label: "Typ", sortable: true },
    { key: "pad", label: "Pad", sortable: true },
    { key: "dist", label: "Distanz", right: true, sortable: true, title: "Entfernung zu Colonia / Anflug vom Hauptstern" },
    { key: "price", label: buy ? "Kaufpreis" : "Ankauf", right: true, sortable: true },
    { key: "qty", label: buy ? "Supply" : "Demand", right: true, sortable: true },
    { key: "delta", label: "Δ 24 h", right: true, sortable: true },
    { key: "trend", label: "7 Tage" },
    { key: "age", label: "Update", sortable: true },
  ];
}

function sortValue(m: MarketEntry, key: SortKey, deltas: Map<string, number | null>): number | string {
  switch (key) {
    case "station": return m.station.toLowerCase();
    case "system": return m.system.toLowerCase();
    case "kind": return KIND_LABEL[m.kind];
    case "pad": return m.maxPad === "L" ? 3 : m.maxPad === "M" ? 2 : m.maxPad === "S" ? 1 : 0;
    case "dist": return m.distanceLy ?? Infinity;
    case "price": return priceOf(m, state.mode) ?? -Infinity;
    case "qty": return qtyOf(m, state.mode);
    case "delta": return deltas.get(m.id) ?? -Infinity;
    case "age": return m.marketUpdatedAt ? -Date.parse(m.marketUpdatedAt) : Infinity;
  }
}

function renderTable(rows: MarketEntry[]): void {
  const cols = columns();
  $("#thead-row").innerHTML = cols
    .map((c) => {
      const sorted = c.key === state.sort ? (state.dir === "asc" ? "ascending" : "descending") : null;
      return `<th class="${c.right ? "r " : ""}${c.sortable ? "sortable" : ""}" data-key="${c.key}"${sorted ? ` aria-sort="${sorted}"` : ""}${c.title ? ` title="${c.title}"` : ""}>${c.label}</th>`;
    })
    .join("");

  const ago = pricesAgo(24);
  const deltas = new Map<string, number | null>();
  for (const m of rows) {
    const prev = ago.get(m.id);
    const cur = priceOf(m, state.mode);
    deltas.set(m.id, prev && cur ? ((cur - prev) / prev) * 100 : null);
  }

  const dir = state.dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, state.sort, deltas), vb = sortValue(b, state.sort, deltas);
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });

  const maxQty = Math.max(1, ...rows.map((m) => qtyOf(m, state.mode)));
  $("#result-count").textContent = `${rows.length} von ${snap.markets.length} Märkten`;
  $("#market-title").textContent = state.mode === "buy" ? "Größte Verkäufer" : "Beste Abnehmer";

  if (sorted.length === 0) {
    $("#tbody").innerHTML = `<tr><td colspan="${cols.length}" class="empty">Keine Station passt zu den Filtern.</td></tr>`;
    return;
  }

  $("#tbody").innerHTML = sorted
    .map((m) => {
      const qty = qtyOf(m, state.mode);
      const d = deltas.get(m.id) ?? null;
      const ac = ageClass(m.marketUpdatedAt, now);
      const dn = displayName(m);
      return `<tr data-id="${esc(m.id)}" class="${m.id === state.sel ? "selected" : ""}${ac === "stale" ? " dim" : ""}">
        <td><span class="st-name">${esc(dn.name)}</span><span class="st-type">${esc(dn.sub)}</span></td>
        <td>${esc(m.system)}</td>
        <td><span class="kind ${m.kind}">${KIND_ICON[m.kind]}${KIND_LABEL[m.kind]}</span></td>
        <td><span class="pad ${m.maxPad ?? ""}">${m.maxPad ?? "?"}</span></td>
        <td class="r num">${m.distanceLy == null ? "–" : `${m.distanceLy.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ly`}<span class="st-type">${m.arrivalLs == null ? "" : `${fmtInt(m.arrivalLs)} ls`}</span></td>
        <td class="r num price">${fmtInt(priceOf(m, state.mode))}</td>
        <td class="r num"><div class="bar-cell">${fmtInt(qty)}<span class="qty-bar"><i style="width:${((qty / maxQty) * 100).toFixed(1)}%"></i></span></div></td>
        <td class="r num ${d == null ? "faint" : d > 0 ? "delta-up" : d < 0 ? "delta-down" : ""}">${fmtPct(d)}</td>
        <td>${sparkline(seriesFor(m.id, 7), COLOR_PRICE)}</td>
        <td><span class="age ${ac}" title="${m.marketUpdatedAt ? fmtDateTime(m.marketUpdatedAt) : ""}">${relTime(m.marketUpdatedAt, now)}</span></td>
      </tr>`;
    })
    .join("");
}

function renderLeader(rows: MarketEntry[]): void {
  const top = [...rows].sort((a, b) => qtyOf(b, state.mode) - qtyOf(a, state.mode)).slice(0, 5);
  const max = Math.max(1, ...top.map((m) => qtyOf(m, state.mode)));
  $("#leader-title").textContent = state.mode === "buy" ? "Top 5 nach Supply" : "Top 5 nach Demand";
  $("#leader").innerHTML = top.length
    ? top
        .map(
          (m) => `<li data-id="${esc(m.id)}">
          <div class="l-top"><span class="l-name">${esc(m.station)}</span><span class="l-val">${fmtInt(qtyOf(m, state.mode))} t</span></div>
          <div class="l-sub">${esc(m.system)} · ${fmtInt(priceOf(m, state.mode))} Cr/t · ${KIND_LABEL[m.kind]}</div>
          <div class="l-bar"><i style="width:${((qtyOf(m, state.mode) / max) * 100).toFixed(1)}%"></i></div>
        </li>`,
        )
        .join("")
    : `<li class="muted">Keine Treffer.</li>`;
}

function renderHistory(): void {
  const host = $("#charts");
  const buy = state.mode === "buy";
  if (!hist) {
    renderCharts(host, [], [], $("#tooltip"));
    return;
  }
  const selMeta = state.sel ? hist.stations[state.sel] : undefined;
  // Einzelmarkt: volle Zeitachse; Gesamtmarkt: erst ab dem ersten Snapshot.
  const times = timeGrid(state.days, !selMeta);
  let price: Array<number | null>, qty: Array<number | null>;

  if (state.sel && selMeta) {
    const rows = hist.series[state.sel];
    const at = times.map((t) => rowAt(rows, Math.floor(t / 1000)));
    price = at.map((r) => (r ? rowPrice(r, state.mode) : null));
    qty = at.map((r) => (r ? rowQty(r, state.mode) : null));
    $("#chart-title").innerHTML = `${esc(selMeta.station)} <a href="#" class="clear" id="clear-sel">× Gesamtmarkt anzeigen</a>`;
    $("#chart-sub").textContent = [selMeta.callsign && selMeta.callsign !== selMeta.station ? selMeta.callsign : "", selMeta.system, KIND_LABEL[selMeta.kind]].filter(Boolean).join(" · ");
  } else {
    // Gesamtmarkt: bester Preis + Summe der Menge zu jedem Zeitpunkt, über alle
    // Märkte, die die Filter erfüllen. Das Market-Update-Alter wird relativ zum
    // jeweiligen Zeitpunkt geprüft – genau wie die Tabelle es "damals" gezeigt hätte.
    const current = new Map(snap.markets.map((m) => [m.id, m]));
    const markets = Object.entries(hist.series).filter(([id]) => {
      const meta = hist!.stations[id];
      return meta ? passesStatic(meta, current.get(id)) : false;
    });
    const minQty = Math.max(1, minFor(state.mode));
    const maxAge = state.age > 0 ? state.age * 3_600 : Infinity;
    price = [];
    qty = [];
    for (const t of times) {
      const tSec = Math.floor(t / 1000);
      let best: number | null = null, sum = 0, any = false;
      for (const [, rows] of markets) {
        const r = rowAt(rows, tSec);
        if (!r) continue;
        any = true;
        if (tSec - r[0] > maxAge) continue;
        const pr = rowPrice(r, state.mode), q = rowQty(r, state.mode);
        if (pr == null || q < minQty) continue;
        sum += q;
        best = best == null ? pr : buy ? Math.min(best, pr) : Math.max(best, pr);
      }
      price.push(best);
      qty.push(any ? sum : null);
    }
    $("#chart-title").textContent = "Gesamter Markt";
    $("#chart-sub").textContent = `${buy ? "günstigster Kaufpreis & Gesamt-Supply" : "höchster Ankaufspreis & Gesamt-Demand"} · gefiltert wie die Tabelle · Zeile anklicken für Einzelstation`;
  }

  const series: Series[] = [
    { label: buy ? (state.sel ? "Kaufpreis (Cr/t)" : "Bester Kaufpreis (Cr/t)") : state.sel ? "Ankaufspreis (Cr/t)" : "Bester Ankaufspreis (Cr/t)", color: COLOR_PRICE, values: price, format: (v) => fmtInt(v), step: true },
    { label: buy ? "Supply (t)" : "Demand (t)", color: COLOR_QTY, values: qty, format: (v) => fmtCompact(v), area: true, step: true },
  ];
  renderCharts(host, times, series, $("#tooltip"));
  if (times.length < 2 && hist.startedAt) {
    host.querySelector(".empty")!.textContent =
      `Der Gesamtverlauf startet mit dem ersten Snapshot (${fmtDateTime(hist.startedAt)}) und erscheint nach ein bis zwei Läufen. ` +
      `Einzelne Märkte kannst du schon jetzt per Klick in der Tabelle ansehen.`;
  }
  document.querySelector("#clear-sel")?.addEventListener("click", (e) => {
    e.preventDefault();
    update({ sel: null });
  });
}

function syncControls(): void {
  document.querySelectorAll<HTMLButtonElement>("#f-mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
  document.querySelectorAll<HTMLButtonElement>("#f-pad button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pad === state.pad)));
  document.querySelectorAll<HTMLButtonElement>("#f-dock button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dock === state.dock)));
  document.querySelectorAll<HTMLButtonElement>("#f-range button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === state.days)));
  document.querySelectorAll<HTMLButtonElement>("#f-kinds button").forEach((b) => b.setAttribute("aria-pressed", String(state.kinds.includes(b.dataset.kind as StationKind))));
  const onlyCarrier = state.kinds.length === 1 && state.kinds[0] === "carrier";
  document.querySelector("#f-only-carrier")?.setAttribute("aria-pressed", String(onlyCarrier));
  $<HTMLInputElement>("#f-min").value = String(minFor(state.mode));
  $("#f-min-label").textContent = state.mode === "buy" ? "Min. Supply (t)" : "Min. Demand (t)";
  $<HTMLSelectElement>("#f-age").value = String(state.age);
  $<HTMLSelectElement>("#f-dist").value = String(state.dist);
  const q = $<HTMLInputElement>("#f-q");
  if (q.value !== state.q) q.value = state.q;
}

function renderAll(): void {
  now = Date.now();
  const rows = filtered();
  syncControls();
  renderHeader();
  renderTicker();
  renderKpis(rows);
  renderTable(rows);
  renderLeader(rows);
  renderHistory();
}

function update(patch: Partial<State>): void {
  state = { ...state, ...patch };
  writeStateToUrl();
  renderAll();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function bindEvents(): void {
  $("#f-kinds").innerHTML = ALL_KINDS.filter((k) => k !== "other")
    .map((k) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="true">${KIND_ICON[k]}${KIND_LABEL[k]}</button>`)
    .join("") + `<button type="button" class="btn btn-sm" id="f-only-carrier">nur Carrier</button>`;

  $("#f-mode").addEventListener("click", (e) => {
    const mode = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.mode as Mode | undefined;
    if (mode && mode !== state.mode) update({ mode, sort: defaultSort(mode), dir: "desc" });
  });
  $("#f-pad").addEventListener("click", (e) => {
    const pad = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.pad as State["pad"] | undefined;
    if (pad) update({ pad });
  });
  $("#f-dock").addEventListener("click", (e) => {
    const dock = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.dock as State["dock"] | undefined;
    if (dock) update({ dock });
  });
  $("#f-range").addEventListener("click", (e) => {
    const days = Number((e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.days);
    if (days) update({ days });
  });
  $("#f-kinds").addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("#f-only-carrier")) {
      const onlyCarrier = state.kinds.length === 1 && state.kinds[0] === "carrier";
      update({ kinds: onlyCarrier ? [...ALL_KINDS] : ["carrier"] });
      return;
    }
    const kind = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.kind as StationKind | undefined;
    if (!kind) return;
    let kinds = state.kinds.includes(kind) ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind];
    // "Sonstige" läuft immer mit, solange nicht gezielt gefiltert wird.
    if (kinds.filter((k) => k !== "other").length === 4) kinds = [...ALL_KINDS];
    else kinds = kinds.filter((k) => k !== "other");
    update({ kinds });
  });
  const setMin = (v: number) => update(state.mode === "buy" ? { minBuy: v } : { minSell: v });
  $("#f-min").addEventListener("change", (e) => setMin(Math.max(0, Number((e.target as HTMLInputElement).value) || 0)));
  $("#f-min-presets").addEventListener("click", (e) => {
    const v = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.v;
    if (v !== undefined) setMin(Number(v));
  });
  $("#f-age").addEventListener("change", (e) => update({ age: Number((e.target as HTMLSelectElement).value) }));
  $("#f-dist").addEventListener("change", (e) => update({ dist: Number((e.target as HTMLSelectElement).value) }));
  let qTimer: number | undefined;
  $("#f-q").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    const q = (e.target as HTMLInputElement).value.trim();
    qTimer = window.setTimeout(() => update({ q }), 180);
  });
  $("#f-reset").addEventListener("click", () => update({ ...DEFAULTS, kinds: [...ALL_KINDS], mode: state.mode, sort: defaultSort(state.mode) }));

  $("#thead-row").addEventListener("click", (e) => {
    const th = (e.target as HTMLElement).closest<HTMLElement>("th.sortable");
    const key = th?.dataset.key as SortKey | undefined;
    if (!key) return;
    if (key === state.sort) update({ dir: state.dir === "asc" ? "desc" : "asc" });
    else update({ sort: key, dir: ["station", "system", "kind", "dist", "age"].includes(key) ? "asc" : "desc" });
  });

  const select = (id: string | undefined) => {
    if (!id) return;
    update({ sel: state.sel === id ? null : id });
    document.querySelector("#verlauf")?.scrollIntoView({ behavior: "smooth" });
  };
  $("#tbody").addEventListener("click", (e) => select((e.target as HTMLElement).closest<HTMLElement>("tr[data-id]")?.dataset.id));
  $("#leader").addEventListener("click", (e) => select((e.target as HTMLElement).closest<HTMLElement>("li[data-id]")?.dataset.id));

  let rTimer: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(rTimer);
    rTimer = window.setTimeout(renderHistory, 150);
  });
  window.addEventListener("hashchange", () => {
    state = readStateFromUrl();
    renderAll();
  });
  // Relative Zeiten ("vor 3 min") jede Minute auffrischen.
  setInterval(() => {
    now = Date.now();
    renderHeader();
  }, 60_000);
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  try {
    await loadData();
  } catch (err) {
    $("#tbody").innerHTML = `<tr><td class="empty">Daten konnten nicht geladen werden: ${esc((err as Error).message)}</td></tr>`;
    return;
  }
  bindEvents();
  renderAll();
}

void main();
