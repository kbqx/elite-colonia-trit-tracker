/**
 * Gemeinsame Datentypen – werden von den Node-Scripts (scripts/) UND vom
 * Frontend (site/src/) benutzt. Nur Typen, kein Laufzeitcode, damit tsc im
 * Browser-Build nichts davon ausgeben muss.
 */

/** Grobe Stationskategorie, auf die im Frontend gefiltert wird. */
export type StationKind = "orbital" | "planetary" | "settlement" | "carrier" | "other";

/** Größte Landepad-Klasse einer Station. */
export type PadSize = "L" | "M" | "S";

/** Ein Markt (= eine Station) mit den Werten für EINE Ware (hier Tritium). */
export interface MarketEntry {
  /** Stabile ID (Spansh market_id bzw. Fallback "system/station"). */
  id: string;
  /** Anzeigename: bei Carriern der Carrier-Name (falls bekannt), sonst Stationsname/Callsign. */
  station: string;
  /** Nur Fleet Carrier: Rufzeichen, z. B. "VOTB" oder "T1L-3VK". */
  callsign?: string;
  /**
   * Nur Fleet Carrier: Andockrechte laut Spansh
   * ("All", "Squadron", "Friends", "Squadron Friends", "None") – null = unbekannt.
   */
  dockingAccess?: string | null;
  system: string;
  kind: StationKind;
  /** Originaler Stationstyp laut Spansh, z. B. "Coriolis Starport". */
  typeLabel: string;
  maxPad: PadSize | null;
  /** Entfernung vom Referenzsystem (Colonia) in Lichtjahren. */
  distanceLy: number | null;
  /** Entfernung vom Hauptstern in Lichtsekunden. */
  arrivalLs: number | null;
  /** Preis, den DU beim Kauf zahlst (Station verkauft). null = Station verkauft nicht. */
  buyPrice: number | null;
  /** Bestand der Station. */
  supply: number;
  /** Preis, den DU beim Verkauf bekommst (Station kauft). null = Station kauft nicht. */
  sellPrice: number | null;
  /** Nachfrage der Station. */
  demand: number;
  /** Zeitpunkt der letzten Marktaktualisierung (ISO 8601), laut Spansh/EDDN. */
  marketUpdatedAt: string | null;
}

/** Inhalt von site/data/latest.json */
export interface Snapshot {
  schema: 1;
  generatedAt: string;
  source: "spansh" | "mock";
  referenceSystem: string;
  commodity: string;
  radiusLy: number;
  markets: MarketEntry[];
}

/** Ein Messpunkt im Verlauf: pro Markt-ID [buyPrice, supply, sellPrice, demand]. */
export type HistoryTuple = [buy: number | null, supply: number, sell: number | null, demand: number];

export interface HistoryPoint {
  /** Zeitpunkt des Snapshots (ISO 8601). */
  t: string;
  m: Record<string, HistoryTuple>;
}

/** Inhalt von site/data/history.json */
export interface HistoryFile {
  schema: 1;
  commodity: string;
  updatedAt: string;
  retentionDays: number;
  /** Stammdaten je Markt-ID, damit Punkte kompakt bleiben. */
  stations: Record<string, { station: string; system: string; kind: StationKind; callsign?: string }>;
  points: HistoryPoint[];
}
