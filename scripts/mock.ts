/**
 * Erzeugt Demo-Daten (latest.json + history.json), damit das Frontend ohne
 * echten Spansh-Abruf entwickelt werden kann. Deterministisch (fester Seed).
 *
 *   npm run mock
 *   MOCK_DAYS=30 MOCK_STEP_MIN=30 npm run mock
 */
import type { MarketEntry, PadSize, Snapshot, StationKind } from "../site/src/types.ts";
import { config } from "./config.ts";
import { appendToHistory, emptyHistory, writeJsonAtomic } from "./history.ts";

const DAYS = Number(process.env.MOCK_DAYS ?? 14);
const STEP_MIN = Number(process.env.MOCK_STEP_MIN ?? 30);

// Kleiner deterministischer PRNG (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(3305);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;

interface Seed {
  station: string;
  system: string;
  kind: StationKind;
  typeLabel: string;
  maxPad: PadSize;
  distanceLy: number;
  arrivalLs: number;
  sells: boolean;
  buys: boolean;
  baseSupply: number;
  callsign?: string;
  dockingAccess?: string | null;
}

const systems: Array<[string, number]> = [
  ["Colonia", 0], ["Ratraii", 13.4], ["Tir", 17.9], ["Kojeara", 21.6], ["Los", 26.2],
  ["Eol Prou RS-T d3-94", 8.6], ["Desy", 31.8], ["Mobia", 38.5], ["Carlota", 44.1], ["Poe", 52.7],
  ["Kinesi", 61.3], ["Centralis", 74.9], ["Benjamin", 88.0], ["Eol Prou LW-L c8-127", 96.4],
];
const sys = (i: number) => systems[i % systems.length] as [string, number];

const fixed: Seed[] = [
  { station: "Jaques Station", system: "Colonia", kind: "orbital", typeLabel: "Orbis Starport", maxPad: "L", distanceLy: 0, arrivalLs: 1360, sells: true, buys: true, baseSupply: 48_000 },
  { station: "Colonia Hub", system: "Ratraii", kind: "orbital", typeLabel: "Coriolis Starport", maxPad: "L", distanceLy: 13.4, arrivalLs: 512, sells: true, buys: false, baseSupply: 22_000 },
  { station: "Gagnan Hub", system: "Tir", kind: "orbital", typeLabel: "Ocellus Starport", maxPad: "L", distanceLy: 17.9, arrivalLs: 2210, sells: true, buys: true, baseSupply: 31_000 },
  { station: "Vonarburg Co-operative", system: "Kojeara", kind: "orbital", typeLabel: "Outpost", maxPad: "M", distanceLy: 21.6, arrivalLs: 88, sells: true, buys: false, baseSupply: 6_500 },
  { station: "Bento Landing", system: "Los", kind: "planetary", typeLabel: "Planetary Port", maxPad: "L", distanceLy: 26.2, arrivalLs: 940, sells: true, buys: true, baseSupply: 18_000 },
  { station: "Huxley Refinery", system: "Desy", kind: "planetary", typeLabel: "Planetary Outpost", maxPad: "L", distanceLy: 31.8, arrivalLs: 3120, sells: true, buys: false, baseSupply: 12_500 },
  { station: "Prou Survey Camp", system: "Eol Prou RS-T d3-94", kind: "settlement", typeLabel: "Odyssey Settlement", maxPad: "M", distanceLy: 8.6, arrivalLs: 410, sells: true, buys: false, baseSupply: 1_800 },
  { station: "Mobia Extraction Site", system: "Mobia", kind: "settlement", typeLabel: "Odyssey Settlement", maxPad: "L", distanceLy: 38.5, arrivalLs: 1675, sells: true, buys: false, baseSupply: 3_200 },
  { station: "Carlota Depot", system: "Carlota", kind: "orbital", typeLabel: "Asteroid base", maxPad: "L", distanceLy: 44.1, arrivalLs: 770, sells: false, buys: true, baseSupply: 0 },
  { station: "Kinesi Gateway", system: "Kinesi", kind: "orbital", typeLabel: "Coriolis Starport", maxPad: "L", distanceLy: 61.3, arrivalLs: 205, sells: false, buys: true, baseSupply: 0 },
];

const carrierWords = ["TRITIUM DEPOT", "NEBULA FUEL", "COLONIA EXPRESS", "DEEP SPACE TANKER", "STARLIGHT HAULER", "OUTER RIM SUPPLY", "JAQUES TRIT", "VOID BARREL", "RED GIANT LOGISTICS", "PROU REFUEL", "ICE MINER COOP", "LONG HAUL ONE"];
// Echte Rufzeichen sehen aus wie "T1L-3VK" oder (individuell) "VOTB".
const code = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  const s = (n: number) => Array.from({ length: n }, () => c[Math.floor(rand() * c.length)]).join("");
  return rand() < 0.2 ? s(4) : `${s(3)}-${s(3)}`;
};
const accessPool = ["All", "All", "All", "All", "All", "All", null, null, "Squadron Friends", "Friends"] as const;

const carriers: Seed[] = carrierWords.map((w, i) => {
  const [system, dist] = sys(Math.floor(between(0, systems.length)));
  const callsign = code();
  // Nur ein Teil der Carrier hat bei Spansh einen Namen (real: ~1/3).
  return {
    station: rand() < 0.45 ? w : callsign,
    callsign,
    dockingAccess: pick(accessPool),
    system,
    kind: "carrier",
    typeLabel: "Drake-Class Carrier",
    maxPad: "L",
    distanceLy: dist,
    arrivalLs: Math.round(between(5, 4000)),
    sells: i !== 3 && i !== 9,
    buys: i === 3 || i === 9 || i === 6,
    baseSupply: Math.round(between(2_000, 24_000) / 10) * 10,
  };
});

const seeds = [...fixed, ...carriers];

// --- Simulation ------------------------------------------------------------
// Wie in echt: Der "wahre" Markt ändert sich ständig, Spansh sieht ihn aber nur,
// wenn ein Spieler andockt (Dock-Ereignis → neues market_updated_at). Jeder
// simulierte Snapshot läuft durch dieselbe appendToHistory()-Logik wie echte.
const now = new Date();
now.setUTCMinutes(Math.floor(now.getUTCMinutes() / STEP_MIN) * STEP_MIN, 0, 0);
const steps = Math.round((DAYS * 24 * 60) / STEP_MIN);
const times = Array.from({ length: steps + 1 }, (_, i) => new Date(now.getTime() - (steps - i) * STEP_MIN * 60_000));

interface Sim { buy: number; sell: number; supply: number; demand: number; seen: MarketEntry | null; awayUntil: number }
// Preisniveau kalibriert am echten Snapshot vom 23.11.2026 (Carrier um ~125–130k Cr/t).
const marketPrice = { v: 127_000 };
const states: Sim[] = seeds.map((s) => ({
  buy: s.kind === "carrier" ? between(118_000, 140_000) : between(120_000, 135_000),
  sell: between(55_000, 80_000),
  supply: s.baseSupply * between(0.4, 1),
  demand: s.buys ? between(2_000, 40_000) : 0,
  seen: null,
  awayUntil: 0,
}));
const ids = seeds.map((s, i) => (s.kind === "carrier" ? `37${String(1000000 + i * 7919).slice(1)}` : `32${String(1000000 + i * 104729).slice(1)}`));
// Dock-Wahrscheinlichkeit pro Stunde (Carrier in Colonia werden oft angeflogen).
const dockPerHour = (s: Seed) => (s.kind === "carrier" ? 0.22 : s.kind === "orbital" ? 0.3 : 0.08);

let history = emptyHistory(config.commodity, DAYS);
let snapshot!: Snapshot;

for (const t of times) {
  marketPrice.v = Math.min(150_000, Math.max(105_000, marketPrice.v + between(-1_100, 1_150) * (STEP_MIN / 60)));
  const daily = Math.sin((t.getTime() / 86_400_000) * Math.PI * 2) * 1_500;
  const markets: MarketEntry[] = [];

  seeds.forEach((s, i) => {
    const st = states[i] as Sim;
    st.buy += (marketPrice.v + daily - st.buy) * 0.08 + between(-800, 800);
    st.sell += (marketPrice.v * 0.55 - st.sell) * 0.08 + between(-600, 600);
    if (s.sells) {
      st.supply -= between(0, s.baseSupply * (s.kind === "carrier" ? 0.05 : 0.02));
      const restock = s.kind === "carrier" ? rand() < 0.035 : rand() < 0.12;
      if (restock) st.supply += s.baseSupply * (s.kind === "carrier" ? between(0.6, 1.1) : between(0.1, 0.3));
      st.supply = Math.max(0, Math.min(s.baseSupply * 1.3, st.supply));
    }
    if (s.buys) st.demand = Math.max(0, st.demand + between(-1500, 1600));

    // Carrier springen gelegentlich für ein paar Stunden aus dem Radius.
    if (s.kind === "carrier" && st.awayUntil < t.getTime() && rand() < 0.004) st.awayUntil = t.getTime() + between(3, 30) * 3_600_000;
    if (st.awayUntil > t.getTime()) { st.seen = null; return; }

    // Dock-Ereignis → Spansh bekommt aktuelle Werte.
    if (!st.seen || rand() < dockPerHour(s) * (STEP_MIN / 60)) {
      const supply = s.sells ? Math.round(st.supply) : 0;
      st.seen = {
        id: ids[i] as string,
        station: s.station,
        ...(s.callsign ? { callsign: s.callsign, dockingAccess: s.dockingAccess ?? null } : {}),
        system: s.system,
        kind: s.kind,
        typeLabel: s.typeLabel,
        maxPad: s.maxPad,
        distanceLy: s.distanceLy,
        arrivalLs: s.arrivalLs,
        buyPrice: s.sells && supply > 0 ? Math.round(st.buy) : null,
        supply,
        sellPrice: s.buys ? Math.round(st.sell) : null,
        demand: s.buys ? Math.round(st.demand) : 0,
        // Spieler-Upload irgendwann im letzten Intervall
        marketUpdatedAt: new Date(t.getTime() - Math.floor(between(0, STEP_MIN)) * 60_000).toISOString(),
      };
    }
    const e = st.seen;
    if (e.supply > 0 || e.demand > 0) markets.push(e);
  });

  snapshot = {
    schema: 1,
    generatedAt: t.toISOString(),
    source: "mock",
    referenceSystem: config.referenceSystem,
    commodity: config.commodity,
    radiusLy: config.radiusLy,
    markets: markets.sort((a, b) => (a.distanceLy ?? 0) - (b.distanceLy ?? 0)),
  };
  history = appendToHistory(history, snapshot, DAYS).history;
}

await writeJsonAtomic(config.latestFile, snapshot, true);
await writeJsonAtomic(config.historyFile, history);
const rows = Object.values(history.series).reduce((n, r) => n + r.length, 0);
console.log(`✔ Mock-Daten: ${snapshot.markets.length} Märkte, ${rows} Verlaufszeilen (${DAYS} Tage, ${times.length} simulierte Snapshots).`);
