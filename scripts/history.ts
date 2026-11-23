/**
 * Lesen/Schreiben von latest.json und history.json.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HistoryFile, HistoryTuple, Snapshot } from "../site/src/types.ts";

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
  return { schema: 1, commodity, updatedAt: new Date(0).toISOString(), retentionDays, stations: {}, points: [] };
}

/**
 * Hängt einen Snapshot an den Verlauf an und wirft alte Punkte raus.
 * Stationen, die in keinem Punkt mehr vorkommen, werden aus den Stammdaten entfernt.
 */
export function appendToHistory(history: HistoryFile, snap: Snapshot, retentionDays: number): HistoryFile {
  const m: Record<string, HistoryTuple> = {};
  const stations = { ...history.stations };

  for (const e of snap.markets) {
    m[e.id] = [e.buyPrice, e.supply, e.sellPrice, e.demand];
    stations[e.id] = { station: e.station, system: e.system, kind: e.kind, ...(e.callsign ? { callsign: e.callsign } : {}) };
  }

  // Doppelte Zeitstempel vermeiden (z. B. Workflow zweimal gestartet).
  const points = history.points.filter((p) => p.t !== snap.generatedAt);
  points.push({ t: snap.generatedAt, m });
  points.sort((a, b) => a.t.localeCompare(b.t));

  const cutoff = Date.parse(snap.generatedAt) - retentionDays * 86_400_000;
  const kept = points.filter((p) => Date.parse(p.t) >= cutoff);

  const used = new Set<string>();
  for (const p of kept) for (const id of Object.keys(p.m)) used.add(id);
  for (const id of Object.keys(stations)) if (!used.has(id)) delete stations[id];

  return {
    schema: 1,
    commodity: snap.commodity,
    updatedAt: snap.generatedAt,
    retentionDays,
    stations,
    points: kept,
  };
}
