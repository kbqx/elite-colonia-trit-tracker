/**
 * Macht einen Snapshot des aktuellen Tritium-Markts rund um Colonia.
 *
 *   npm run snapshot                 → Spansh abfragen, latest.json + history.json schreiben
 *   npm run snapshot -- --raw        → zusätzlich Rohantwort nach data-raw/ speichern
 *   npm run snapshot -- --dry-run    → nur abfragen + Zusammenfassung, nichts schreiben
 *   npm run snapshot -- --at 2026-11-23T13:48:00Z   → Snapshot-Zeit festlegen (z. B. mit --from-file)
 *   npm run snapshot -- --from-file data-raw/xyz.json
 *                                    → keine Abfrage, sondern eine gespeicherte Spansh-Antwort
 *                                      (oder ein Array davon) normalisieren – zum Testen des Mappings
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MarketEntry, Snapshot } from "../site/src/types.ts";
import { config } from "./config.ts";
import { appendToHistory, emptyHistory, loadHistory, readJson, writeJsonAtomic } from "./history.ts";
import { fetchAllStations, normalizeStation, type SpanshSearchResponse, type SpanshStation } from "./spansh.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function loadStations(): Promise<{ raw: SpanshSearchResponse[]; stations: SpanshStation[] }> {
  const fromFile = option("--from-file");
  if (fromFile) {
    console.log(`Lese gespeicherte Antwort aus ${fromFile}`);
    const parsed = JSON.parse(await readFile(fromFile, "utf8")) as SpanshSearchResponse | SpanshSearchResponse[];
    const raw = Array.isArray(parsed) ? parsed : [parsed];
    return { raw, stations: raw.flatMap((r) => r.results ?? []) };
  }
  console.log(
    `Frage Spansh ab: ${config.commodity} im Umkreis von ${config.radiusLy} ly um ${config.referenceSystem} …`,
  );
  return fetchAllStations(config);
}

function summarize(markets: MarketEntry[]): void {
  const sellers = markets.filter((m) => m.buyPrice !== null).sort((a, b) => b.supply - a.supply);
  const buyers = markets.filter((m) => m.sellPrice !== null).sort((a, b) => (b.sellPrice ?? 0) - (a.sellPrice ?? 0));
  const fmt = (n: number | null) => (n === null ? "–" : n.toLocaleString("de-DE"));
  const age = (m: MarketEntry) =>
    m.marketUpdatedAt ? `${((Date.now() - Date.parse(m.marketUpdatedAt)) / 86_400_000).toFixed(1)} T` : "?";
  const name = (m: MarketEntry) => (m.callsign && m.callsign !== m.station ? `${m.station} [${m.callsign}]` : m.station).slice(0, 34);

  console.log(`\n${markets.length} Märkte mit ${config.commodity}: ${sellers.length} verkaufen, ${buyers.length} kaufen.`);
  console.log("\nTop 5 nach Supply (hier kannst du kaufen):");
  for (const m of sellers.slice(0, 5)) {
    console.log(`  ${name(m).padEnd(34)} ${m.system.slice(0, 20).padEnd(20)} ${fmt(m.buyPrice).padStart(10)} Cr ${fmt(m.supply).padStart(8)} t  ${age(m).padStart(7)}  ${m.dockingAccess ?? m.kind}`);
  }
  console.log("\nTop 5 nach Ankaufspreis (hier kannst du verkaufen):");
  for (const m of buyers.slice(0, 5)) {
    console.log(`  ${name(m).padEnd(34)} ${m.system.slice(0, 20).padEnd(20)} ${fmt(m.sellPrice).padStart(10)} Cr ${fmt(m.demand).padStart(8)} t  ${age(m).padStart(7)}  ${m.dockingAccess ?? m.kind}`);
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const { raw, stations } = await loadStations();

  // Snapshot-Zeit auf volle Minute runden. Mit --at <ISO> überschreibbar (Tests/Nachträge).
  const at = option("--at");
  const now = at ? new Date(at) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--at: ungültiges Datum "${at}"`);
  now.setUTCSeconds(0, 0);
  const generatedAt = now.toISOString();

  if (flag("--raw") && !option("--from-file")) {
    const file = path.join(config.rawDir, `spansh-${generatedAt.replace(/[:.]/g, "-")}.json`);
    await writeJsonAtomic(file, raw, true);
    console.log(`Rohantwort gespeichert: ${path.relative(process.cwd(), file)}`);
  }

  // Normalisieren + Duplikate (gleiche ID über mehrere Seiten) entfernen.
  const byId = new Map<string, MarketEntry>();
  let skipped = 0;
  for (const s of stations) {
    const entry = normalizeStation(s, config.commodity);
    if (entry) byId.set(entry.id, entry);
    else skipped++;
  }
  const markets = [...byId.values()].sort((a, b) => (a.distanceLy ?? 1e9) - (b.distanceLy ?? 1e9));

  if (stations.length > 0 && markets.length === 0) {
    // Sehr wahrscheinlich hat sich das Antwortformat geändert → lieber abbrechen
    // als einen leeren Snapshot in den Verlauf zu schreiben.
    const sample = JSON.stringify(stations[0], null, 2).slice(0, 1500);
    throw new Error(
      `Spansh lieferte ${stations.length} Stationen, aber keine davon enthielt "${config.commodity}" ` +
        `im erwarteten Format. Erster Treffer:\n${sample}`,
    );
  }
  if (skipped > 0) console.log(`${skipped} Treffer ohne ${config.commodity}-Handel (Supply und Demand 0) übersprungen.`);

  const snapshot: Snapshot = {
    schema: 1,
    generatedAt,
    source: "spansh",
    referenceSystem: config.referenceSystem,
    commodity: config.commodity,
    radiusLy: config.radiusLy,
    markets,
  };

  summarize(markets);

  if (flag("--dry-run")) {
    console.log("\n--dry-run: nichts geschrieben.");
    return;
  }

  // Liegen noch Demo-Daten (npm run mock) im Ordner, NICHT daran anhängen.
  const previous = await readJson<Snapshot>(config.latestFile);
  const startFresh = previous?.source === "mock";
  if (startFresh) console.log("Vorhandene Daten sind Mock-Daten → Verlauf wird neu begonnen.");
  const history = startFresh
    ? emptyHistory(config.commodity, config.historyRetentionDays)
    : await loadHistory(config.historyFile, config.commodity, config.historyRetentionDays);
  const r = appendToHistory(history, snapshot, config.historyRetentionDays);
  const changed = r.updates + r.gone + r.returned + r.pruned > 0;

  // latest.json immer (für "Snapshot vor X min"), history.json nur bei Änderungen.
  await writeJsonAtomic(config.latestFile, snapshot, true);
  if (changed || startFresh) await writeJsonAtomic(config.historyFile, r.history);

  const rows = Object.values(r.history.series).reduce((n, rs) => n + rs.length, 0);
  console.log(
    `\n✔ ${r.updates} Marktupdates, ${r.gone} verschwunden, ${r.returned} zurück, ${r.pruned} alte Einträge entfernt.` +
      `\n  history.json: ${Object.keys(r.history.series).length} Märkte, ${rows} Zeilen` +
      `${changed ? "" : " (unverändert, nicht neu geschrieben)"} · ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
}

main().catch((err: unknown) => {
  console.error(`\n✖ Snapshot fehlgeschlagen: ${(err as Error).message}`);
  process.exit(1);
});
