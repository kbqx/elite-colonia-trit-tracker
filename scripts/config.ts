/**
 * Zentrale Konfiguration. Alles lässt sich per Umgebungsvariable überschreiben,
 * z. B. im GitHub-Actions-Workflow oder lokal:
 *   RADIUS_LY=500 npm run snapshot
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;
const envNum = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Referenzsystem für die Distanzberechnung. */
  referenceSystem: env("REFERENCE_SYSTEM", "Colonia"),
  /** Suchradius um das Referenzsystem in Lichtjahren (500 ly = max. Sprungweite eines Fleet Carriers). */
  radiusLy: envNum("RADIUS_LY", 500),
  /** Ware, so wie Spansh sie benennt. */
  commodity: env("COMMODITY", "Tritium"),

  /** Spansh-Endpunkt für die Stationssuche (POST). */
  spanshUrl: env("SPANSH_URL", "https://spansh.co.uk/api/stations/search"),
  /**
   * Supply/Demand-Filter im Spansh-Request (empfohlen). Mit USE_MARKET_FILTER=0
   * kommen alle Stationen zurück (~43 MB) – nur als Fallback, falls Spansh den
   * Filter einmal anders erwartet.
   */
  useMarketFilter: env("USE_MARKET_FILTER", "1") !== "0",
  /** Ergebnisse pro Seite. */
  pageSize: envNum("PAGE_SIZE", 100),
  /** Sicherheitslimit, damit ein Fehler nicht endlos paginiert. */
  maxPages: envNum("MAX_PAGES", 30),
  /** Pause zwischen zwei Requests – Spansh ist ein privat betriebener Dienst, bitte nett sein. */
  requestDelayMs: envNum("REQUEST_DELAY_MS", 1200),
  requestTimeoutMs: envNum("REQUEST_TIMEOUT_MS", 30_000),
  userAgent: env("USER_AGENT", "colonia-trit-tracker/0.1 (+https://github.com/)"),

  /** Wie viele Tage Verlauf in history.json bleiben. */
  historyRetentionDays: envNum("HISTORY_RETENTION_DAYS", 30),

  /** Ausgabepfade (werden von GitHub Pages mit ausgeliefert). */
  latestFile: path.join(ROOT, "site", "data", "latest.json"),
  historyFile: path.join(ROOT, "site", "data", "history.json"),
  /** Rohantworten zum Debuggen (gitignored). */
  rawDir: path.join(ROOT, "data-raw"),
} as const;

export type Config = typeof config;
