/**
 * Lesen/Schreiben von latest.json und history.json.
 *
 * history.json speichert nur Änderungen (Schema 2): pro Markt eine Liste von
 * Beobachtungen. Ein neuer Snapshot fügt nur dann eine Zeile hinzu, wenn sich
 * market_updated_at geändert hat oder ein Markt verschwunden/zurück ist.
 * Damit wächst die Datei mit der Zahl echter Marktupdates (~50/Tag in Colonia),
 * nicht mit der Zahl der Snapshots.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isGoneRow, type HistoryFile, type HistoryRow, type MarketEntry, type Snapshot } from "../site/src/types.ts";

/** Schreibt atomar (erst .tmp, dann rename) – kein halbes JSON bei Abbruch. */
export async function writeJsonAtomic(file: string, data: unknown, pretty = false): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, pretty ? 2 : 0) + "\n", "utf8");
  await rename(tmp, file);
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export function emptyHistory(commodity: string, retentionDays: number): HistoryFile {
  return { schema: 2, commodity, updatedAt: new Date(0).toISOString(), retentionDays, stations: {}, series: {} };
}

/** Lädt history.json; ältere Schemata werden verworfen (Neustart des Verlaufs). */
export async function loadHistory(file: string, commodity: string, retentionDays: number): Promise<HistoryFile> {
  const h = await readJson<{ schema?: number }>(file);
  if (!h || h.schema !== 2) return emptyHistory(commodity, retentionDays);
  return h as HistoryFile;
}

const toSec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const rowOf = (t: number, e: MarketEntry): HistoryRow => [t, e.buyPrice, e.supply, e.sellPrice, e.demand];
const sameValues = (a: HistoryRow, b: HistoryRow) => a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];

export interface AppendResult {
  history: HistoryFile;
  /** Neue Marktupdates (geänderte market_updated_at bzw. neue Märkte). */
  updates: number;
  /** Märkte, die seit dem letzten Snapshot verschwunden sind. */
  gone: number;
  /** Märkte, die nach Verschwinden wieder auftauchen. */
  returned: number;
  /** Zeilen/Märkte, die wegen Aufbewahrungsfrist entfernt wurden. */
  pruned: number;
}

/**
 * Wendet einen Snapshot auf den Verlauf an. Verändert `history` nicht, sondern
 * gibt eine neue Version zurück. `updatedAt` ändert sich nur bei echten Änderungen –
 * so bleibt die Datei byte-gleich, wenn nichts passiert ist (→ kein Git-Commit).
 */
export function appendToHistory(history: HistoryFile, snap: Snapshot, retentionDays: number): AppendResult {
  const now = toSec(snap.generatedAt);
  const stations = { ...history.stations };
  const series: Record<string, HistoryRow[]> = {};
  for (const [id, rows] of Object.entries(history.series)) series[id] = [...rows];

  let updates = 0, gone = 0, returned = 0, pruned = 0;
  const seen = new Set<string>();

  for (const e of snap.markets) {
    seen.add(e.id);
    stations[e.id] = { station: e.station, system: e.system, kind: e.kind, ...(e.callsign ? { callsign: e.callsign } : {}) };

    const t = e.marketUpdatedAt ? toSec(e.marketUpdatedAt) : now;
    const rows = (series[e.id] ??= []);
    const last = rows[rows.length - 1];

    if (!last) {
      rows.push(rowOf(t, e));
      updates++;
    } else if (isGoneRow(last)) {
      // War weg, ist wieder da. Zeit darf nicht vor der "weg"-Zeile liegen.
      rows.push(rowOf(Math.max(t, last[0] + 1), e));
      returned++;
    } else if (t > last[0]) {
      rows.push(rowOf(t, e));
      updates++;
    } else if (t === last[0] && !sameValues(last, rowOf(t, e))) {
      // Gleicher Zeitstempel, andere Werte (sollte selten sein) → korrigieren.
      rows[rows.length - 1] = rowOf(t, e);
      updates++;
    }
  }

  // Märkte, die nicht mehr in den Suchergebnissen sind, handeln kein Tritium mehr.
  for (const [id, rows] of Object.entries(series)) {
    if (seen.has(id)) continue;
    const last = rows[rows.length - 1];
    if (last && !isGoneRow(last)) {
      rows.push([Math.max(now, last[0] + 1), null, 0, null, 0]);
      gone++;
    }
  }

  // Aufbewahrung: alles vor dem Stichtag weg – bis auf die letzte Zeile davor,
  // damit der Zustand am Anfang des Zeitraums bekannt bleibt.
  const cutoff = now - retentionDays * 86_400;
  for (const [id, rows] of Object.entries(series)) {
    let firstKept = rows.findIndex((r) => r[0] >= cutoff);
    if (firstKept === -1) firstKept = rows.length; // alle alt
    const start = Math.max(0, firstKept - 1);
    if (start > 0) {
      pruned += start;
      series[id] = rows.slice(start);
    }
    const kept = series[id] as HistoryRow[];
    // Markt nur noch als alte "weg"-Zeile vorhanden → komplett entfernen.
    if (kept.length === 1 && isGoneRow(kept[0] as HistoryRow) && (kept[0] as HistoryRow)[0] < cutoff) {
      delete series[id];
      delete stations[id];
      pruned++;
    }
  }

  const changed = updates + gone + returned + pruned > 0;
  return {
    history: {
      schema: 2,
      commodity: snap.commodity,
      updatedAt: changed ? snap.generatedAt : history.updatedAt,
      startedAt: history.startedAt ?? snap.generatedAt,
      retentionDays,
      stations,
      series,
    },
    updates,
    gone,
    returned,
    pruned,
  };
}
