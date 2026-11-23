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

/**
 * Eine Beobachtung eines Marktes:
 * [Zeit (Unix-Sekunden), Kaufpreis, Supply, Ankaufspreis, Demand]
 *
 * Zeit = market_updated_at laut Spansh, also wann ein Spieler den Markt
 * tatsächlich gesehen hat. Eine Zeile [t, null, 0, null, 0] heißt: Markt
 * handelt seit diesem Snapshot kein Tritium mehr (ausverkauft, Carrier weg …).
 */
export type HistoryRow = [t: number, buy: number | null, supply: number, sell: number | null, demand: number];

/**
 * Inhalt von site/data/history.json (Schema 2).
 * Gespeichert werden nur ÄNDERUNGEN: eine neue Zeile entsteht nur, wenn sich
 * market_updated_at eines Marktes ändert oder er verschwindet. Der Zustand zu
 * einem Zeitpunkt T ist die letzte Zeile mit t ≤ T.
 */
export interface HistoryFile {
  schema: 2;
  commodity: string;
  /** Zeitpunkt der letzten inhaltlichen Änderung (ISO 8601). */
  updatedAt: string;
  /**
   * Erster Snapshot dieses Verlaufs. Davor ist pro Markt nur die jeweils letzte
   * Beobachtung bekannt – Charts beginnen deshalb erst hier.
   */
  startedAt?: string;
  retentionDays: number;
  /** Stammdaten je Markt-ID. */
  stations: Record<string, { station: string; system: string; kind: StationKind; callsign?: string }>;
  /** Zeilen je Markt-ID, chronologisch sortiert. */
  series: Record<string, HistoryRow[]>;
}

/** Ist das eine "Markt weg"-Zeile? */
export const isGoneRow = (r: HistoryRow): boolean => r[1] === null && r[2] === 0 && r[3] === null && r[4] === 0;
