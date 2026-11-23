/**
 * Zweisprachigkeit (Englisch = Standard, Deutsch).
 *
 * - Statische Texte im HTML tragen data-i18n="key" (Text), data-i18n-html="key"
 *   (HTML), data-i18n-title / data-i18n-placeholder / data-i18n-aria (Attribute).
 * - Dynamische Texte im Code holen sich ihren Text über t("key", params).
 * - Sprache: ?lang=de in der URL > gespeicherte Wahl (localStorage) > Englisch.
 */
export type Lang = "en" | "de";
type P = Record<string, string | number>;
type Entry = string | ((p: P) => string);

const en: Record<string, Entry> = {
  // Navigation & Kopf
  "nav.market": "Market",
  "nav.history": "History",
  "nav.about": "About",
  "nav.source": "Data source",
  "pill.demo": "Demo",
  "pill.demoLong": " data",
  "pill.snapshot": "Snapshot",
  "status.title": (p) => `Last snapshot: ${p.time}`,
  "video.placeholder": "Video placeholder",
  "hero.eyebrow": "Elite Dangerous · Colonia region",
  "hero.lead": "Where can you get Tritium right now, at what price and in what quantity? Automatic market snapshots of every station and fleet carrier around Colonia.",
  "hero.supplyDefault": "Tritium currently on offer",
  "hero.label": (p) => `tonnes of Tritium on offer at ${p.n} markets within ${p.radius} ly of ${p.ref}${p.extra}`,
  "hero.min": (p) => ` · from ${p.min} t`,
  "hero.age": (p) => ` · updated ≤ ${p.age}`,
  "hero.public": " · public docking",
  "ticker.aria": "Ticker with current prices",

  // Markt & Filter
  "market.eyebrow": "Market",
  "market.titleBuy": "Sellers",
  "market.titleSell": "Buyers",
  "filter.iwant": "I want to …",
  "mode.buy": "buy",
  "mode.sell": "sell",
  "filter.minSupply": "Min. supply (t)",
  "filter.minDemand": "Min. demand (t)",
  "filter.update": "Market update",
  "age.1": "≤ 1 hour",
  "age.6": "≤ 6 hours",
  "age.24": "≤ 24 hours",
  "age.72": "≤ 3 days",
  "age.168": "≤ 7 days",
  "age.720": "≤ 30 days",
  "any": "any",
  "filter.dist": "Max. distance to Colonia",
  "filter.pad": "Landing pad",
  "pad.all": "all",
  "pad.large": "Large only",
  "filter.dock": "Docking",
  "dock.public": "public",
  "dock.all": "all",
  "filter.outl": "Price outliers",
  "filter.outlTitle": "Prices above twice the volume-weighted median (e.g. 5,129,400 Cr as a “not for sale” signal)",
  "outl.ignore": "ignore",
  "outl.include": "include",
  "filter.kind": "Station type",
  "filter.onlyCarrier": "carriers only",
  "filter.search": "Search",
  "filter.searchPh": "Station or system",
  "filter.reset": "Reset",
  "count.markets": (p) => `${p.n} of ${p.total} markets`,
  "count.outliers": (p) => ` · ${p.n} price outlier${p.n === 1 ? "" : "s"}`,
  "count.notInKpis": " (not included in calculations)",

  // Stationsarten & Zugang
  "kind.orbital": "Orbital",
  "kind.planetary": "Planetary (landing)",
  "kind.settlement": "Settlement",
  "kind.carrier": "Fleet Carrier",
  "kind.squadron": "Squadron Carrier",
  "kind.other": "Other",
  "access.Squadron": "squadron only",
  "access.Friends": "friends only",
  "access.Squadron Friends": "squadron & friends only",
  "access.None": "closed",

  // Tabelle
  "col.station": "Station",
  "col.system": "System",
  "col.type": "Type",
  "col.pad": "Pad",
  "col.dist": "Distance",
  "col.distTitle": "Distance to Colonia / from arrival star",
  "col.buyPrice": "Buy price",
  "col.sellPrice": "Sell price",
  "col.supply": "Supply",
  "col.demand": "Demand",
  "col.delta": "Δ 24 h",
  "col.trend": "7 days",
  "col.age": "Updated",
  "table.empty": "No station matches the filters.",
  "table.outlier": "Outlier",
  "table.outlierTitle": (p) => `Not included in any calculation: price above ${p.f}× the weighted median (limit ${p.cap} Cr/t)`,
  "load.error": (p) => `Could not load data: ${p.msg}`,

  // Kennzahlen
  "kpi.bestBuy": "Lowest buy price",
  "kpi.bestSell": "Highest sell price",
  "kpi.noResults": "no results",
  "kpi.effBuy": (p) => `Effective price for ${p.v}`,
  "kpi.effSell": (p) => `Effective revenue for ${p.v}`,
  "kpi.effNA": "volume not available",
  "kpi.vs24h": "vs. 24 h",
  "kpi.effBuyTitle": (p) => `Average price if you buy ${p.v} t one after another from the cheapest sellers – all stock sizes count, small ones only with their actual quantity (independent of the min. supply filter).`,
  "kpi.effSellTitle": (p) => `Average revenue if you sell ${p.v} t one after another to the best buyers.`,
  "kpi.supply": "Total supply",
  "kpi.demand": "Total demand",
  "kpi.overMarkets": (p) => `across ${p.n} markets`,
  "kpi.carrierSupply": "Fleet carrier share of total supply",
  "kpi.carrierDemand": "Fleet carrier share of total demand",
  "kpi.carrierSub": (p) => `${p.q} t on ${p.c} of ${p.n} markets`,

  // Verlauf
  "history.eyebrow": "History",
  "history.h2": "Market price & volume over time",
  "range.1": "24 h",
  "range.7": "7 d",
  "range.14": "14 d",
  "range.30": "30 d",
  "leader.buy": "Top 5 by supply",
  "leader.sell": "Top 5 by demand",
  "leader.sub": "filtered like the table · click to select a station",
  "chart.market": "Whole market",
  "chart.showMarket": "× show whole market",
  "chart.sub": "filtered like the table",
  "chart.subOutl": (p) => ` · without price outliers (> ${p.f}× median)`,
  "chart.buyPrice": "Buy price (Cr/t)",
  "chart.sellPrice": "Sell price (Cr/t)",
  "chart.price": "Price",
  "chart.effBuyTitle": "Buy price in Cr/t – “avg. for X t” = average when buying X t from the cheapest sellers",
  "chart.effSellTitle": "Sell price in Cr/t – “avg. for X t” = average when selling X t to the best buyers",
  "chart.avgFor": (p) => `avg. for ${p.v}`,
  "chart.best": "Best single price (any qty)",
  "chart.totalSupply": "Total supply (t)",
  "chart.totalDemand": "Total demand (t)",
  "chart.supplyT": "Supply (t)",
  "chart.demandT": "Demand (t)",
  "chart.empty": "No market data for this period and these filters yet. The history fills up with every new market update.",
  "chart.startsAt": (p) => `The market history starts with the first snapshot (${p.time}) and appears with the next run. You can already look at single markets by clicking a table row.`,

  // Info & Fuß
  "info.eyebrow": "How it works",
  "info.h2": "Snapshots instead of gut feeling",
  "info.p": "A script regularly queries Spansh's station search, stores the current Tritium market of every station around Colonia and adds new market updates to the history. GitHub Actions then rebuilds this page.",
  "info.li1": "Data comes from player uploads (EDDN) – <b>Market update</b> shows how old an entry really is.",
  "info.li2": "Fleet carriers jump – their system can change between two snapshots.",
  "info.li3": "Filters are stored in the URL – views can be shared as a link.",
  "footer.data": "Data:",
  "footer.asOf": "as of",
  "footer.disclaimer": "Fan project, not affiliated with Frontier Developments. Elite Dangerous is a trademark of Frontier.",

  // Zeit
  "time.unknown": "unknown",
  "time.now": "just now",
  "time.min": (p) => `${p.n} min ago`,
  "time.h": (p) => `${p.n} h ago`,
  "time.d": (p) => `${p.n} d ago`,
  "unit.days": (p) => `${p.n} d`,
};

const de: Record<string, Entry> = {
  "nav.market": "Markt",
  "nav.history": "Verlauf",
  "nav.about": "Info",
  "nav.source": "Datenquelle",
  "pill.demo": "Demo",
  "pill.demoLong": "-Daten",
  "pill.snapshot": "Snapshot",
  "status.title": (p) => `Letzter Snapshot: ${p.time}`,
  "video.placeholder": "Video-Platzhalter",
  "hero.eyebrow": "Elite Dangerous · Colonia-Region",
  "hero.lead": "Wo gibt es gerade Tritium, zu welchem Preis und in welcher Menge? Automatische Markt-Snapshots aller Stationen und Fleet Carrier rund um Colonia.",
  "hero.supplyDefault": "Tritium aktuell im Angebot",
  "hero.label": (p) => `Tonnen Tritium im Angebot bei ${p.n} Märkten im Umkreis von ${p.radius} ly um ${p.ref}${p.extra}`,
  "hero.min": (p) => ` · ab ${p.min} t`,
  "hero.age": (p) => ` · Update ≤ ${p.age}`,
  "hero.public": " · öffentlich andockbar",
  "ticker.aria": "Laufband mit aktuellen Preisen",

  "market.eyebrow": "Markt",
  "market.titleBuy": "Verkäufer",
  "market.titleSell": "Abnehmer",
  "filter.iwant": "Ich will …",
  "mode.buy": "kaufen",
  "mode.sell": "verkaufen",
  "filter.minSupply": "Min. Supply (t)",
  "filter.minDemand": "Min. Demand (t)",
  "filter.update": "Market-Update",
  "age.1": "≤ 1 Stunde",
  "age.6": "≤ 6 Stunden",
  "age.24": "≤ 24 Stunden",
  "age.72": "≤ 3 Tage",
  "age.168": "≤ 7 Tage",
  "age.720": "≤ 30 Tage",
  "any": "beliebig",
  "filter.dist": "Max. Distanz zu Colonia",
  "filter.pad": "Landepad",
  "pad.all": "alle",
  "pad.large": "nur Large",
  "filter.dock": "Andocken",
  "dock.public": "öffentlich",
  "dock.all": "alle",
  "filter.outl": "Preis-Ausreißer",
  "filter.outlTitle": "Preise über dem Doppelten des nach Menge gewichteten Medians (z. B. 5.129.400 Cr als „verkaufe nicht“-Signal)",
  "outl.ignore": "ignorieren",
  "outl.include": "einbeziehen",
  "filter.kind": "Stationstyp",
  "filter.onlyCarrier": "nur Carrier",
  "filter.search": "Suche",
  "filter.searchPh": "Station oder System",
  "filter.reset": "Zurücksetzen",
  "count.markets": (p) => `${p.n} von ${p.total} Märkten`,
  "count.outliers": (p) => ` · ${p.n} Preis-Ausreißer`,
  "count.notInKpis": " (nicht in Kennzahlen)",

  "kind.orbital": "Orbital",
  "kind.planetary": "Planetar (Landung)",
  "kind.settlement": "Settlement",
  "kind.carrier": "Fleet Carrier",
  "kind.squadron": "Squadron Carrier",
  "kind.other": "Sonstige",
  "access.Squadron": "nur Squadron",
  "access.Friends": "nur Freunde",
  "access.Squadron Friends": "nur Squadron & Freunde",
  "access.None": "gesperrt",

  "col.station": "Station",
  "col.system": "System",
  "col.type": "Typ",
  "col.pad": "Pad",
  "col.dist": "Distanz",
  "col.distTitle": "Entfernung zu Colonia / Anflug vom Hauptstern",
  "col.buyPrice": "Kaufpreis",
  "col.sellPrice": "Ankauf",
  "col.supply": "Supply",
  "col.demand": "Demand",
  "col.delta": "Δ 24 h",
  "col.trend": "7 Tage",
  "col.age": "Update",
  "table.empty": "Keine Station passt zu den Filtern.",
  "table.outlier": "Ausreißer",
  "table.outlierTitle": (p) => `Fließt in keine Berechnung ein: Preis über ${p.f}× dem gewichteten Median (Grenze ${p.cap} Cr/t)`,
  "load.error": (p) => `Daten konnten nicht geladen werden: ${p.msg}`,

  "kpi.bestBuy": "Günstigster Kaufpreis",
  "kpi.bestSell": "Höchster Ankaufspreis",
  "kpi.noResults": "keine Treffer",
  "kpi.effBuy": (p) => `Effektiver Preis für ${p.v}`,
  "kpi.effSell": (p) => `Effektiver Erlös für ${p.v}`,
  "kpi.effNA": "Menge nicht verfügbar",
  "kpi.vs24h": "ggü. 24 h",
  "kpi.effBuyTitle": (p) => `Durchschnittspreis, wenn du ${p.v} t nacheinander bei den günstigsten Anbietern kaufst – alle Bestände zählen, kleine nur mit ihrer echten Menge (unabhängig vom Min.-Supply-Filter).`,
  "kpi.effSellTitle": (p) => `Durchschnittserlös, wenn du ${p.v} t nacheinander an die besten Abnehmer verkaufst.`,
  "kpi.supply": "Gesamt-Supply",
  "kpi.demand": "Gesamt-Demand",
  "kpi.overMarkets": (p) => `über ${p.n} Märkte`,
  "kpi.carrierSupply": "Fleet-Carrier-Anteil am Gesamt-Supply",
  "kpi.carrierDemand": "Fleet-Carrier-Anteil am Gesamt-Demand",
  "kpi.carrierSub": (p) => `${p.q} t auf ${p.c} von ${p.n} Märkten`,

  "history.eyebrow": "Verlauf",
  "history.h2": "Marktpreis & Menge über Zeit",
  "range.1": "24 h",
  "range.7": "7 T",
  "range.14": "14 T",
  "range.30": "30 T",
  "leader.buy": "Top 5 nach Supply",
  "leader.sell": "Top 5 nach Demand",
  "leader.sub": "gefiltert wie die Tabelle · Klick wählt Station",
  "chart.market": "Gesamter Markt",
  "chart.showMarket": "× Gesamtmarkt anzeigen",
  "chart.sub": "gefiltert wie die Tabelle",
  "chart.subOutl": (p) => ` · ohne Preis-Ausreißer (> ${p.f}× Median)`,
  "chart.buyPrice": "Kaufpreis (Cr/t)",
  "chart.sellPrice": "Ankaufspreis (Cr/t)",
  "chart.price": "Preis",
  "chart.effBuyTitle": "Kaufpreis in Cr/t – „Ø für X t“ = Durchschnitt beim Kauf von X t bei den günstigsten Anbietern",
  "chart.effSellTitle": "Ankaufspreis in Cr/t – „Ø für X t“ = Durchschnitt beim Verkauf von X t an die besten Abnehmer",
  "chart.avgFor": (p) => `Ø für ${p.v}`,
  "chart.best": "Bester Einzelpreis (jede Menge)",
  "chart.totalSupply": "Gesamt-Supply (t)",
  "chart.totalDemand": "Gesamt-Demand (t)",
  "chart.supplyT": "Supply (t)",
  "chart.demandT": "Demand (t)",
  "chart.empty": "Für diesen Zeitraum und diese Filter gibt es noch keine Marktdaten. Der Verlauf füllt sich mit jedem neuen Marktupdate.",
  "chart.startsAt": (p) => `Der Gesamtverlauf startet mit dem ersten Snapshot (${p.time}) und erscheint ab dem nächsten Lauf. Einzelne Märkte kannst du schon jetzt per Klick in der Tabelle ansehen.`,

  "info.eyebrow": "Wie das funktioniert",
  "info.h2": "Snapshots statt Bauchgefühl",
  "info.p": "Ein Script fragt in festen Abständen die Stationssuche von Spansh ab, speichert den aktuellen Tritium-Markt aller Stationen im Umkreis von Colonia und hängt neue Marktupdates an den Verlauf an. GitHub Actions baut daraus diese Seite neu.",
  "info.li1": "Daten stammen von Spieler-Uploads (EDDN) – <b>Market-Update</b> zeigt, wie alt ein Eintrag wirklich ist.",
  "info.li2": "Fleet Carrier springen – ihr System kann sich zwischen zwei Snapshots ändern.",
  "info.li3": "Filter landen in der URL – Ansichten lassen sich als Link teilen.",
  "footer.data": "Daten:",
  "footer.asOf": "Stand",
  "footer.disclaimer": "Fan-Projekt, nicht mit Frontier Developments verbunden. Elite Dangerous ist eine Marke von Frontier.",

  "time.unknown": "unbekannt",
  "time.now": "gerade eben",
  "time.min": (p) => `vor ${p.n} min`,
  "time.h": (p) => `vor ${p.n} h`,
  "time.d": (p) => `vor ${p.n} T`,
  "unit.days": (p) => `${p.n} T`,
};

const DICTS: Record<Lang, Record<string, Entry>> = { en, de };
const STORAGE_KEY = "ctt-lang";
let lang: Lang = "en";

export const getLang = (): Lang => lang;
/** Locale für Intl-Formatierung (Zahlen, Datum). */
export const locale = (): string => (lang === "de" ? "de-DE" : "en-US");

export function t(key: string, p: P = {}): string {
  const e = DICTS[lang][key] ?? en[key];
  if (e === undefined) return key;
  return typeof e === "function" ? e(p) : e;
}

/** Ermittelt die Startsprache: ?lang= > gespeichert > Englisch. */
export function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "de" || q === "en") return q;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "de" || s === "en") return s;
  } catch {
    /* localStorage nicht verfügbar */
  }
  return "en";
}

/** Setzt die Sprache, merkt sie sich und aktualisiert alle statischen Texte. */
export function setLang(l: Lang, persist = true): void {
  lang = l;
  document.documentElement.lang = l;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* egal */
    }
    // ?lang= in der URL mitführen, damit Links die Sprache behalten (Hash bleibt erhalten).
    const url = new URL(location.href);
    if (l === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", l);
    history.replaceState(null, "", url.toString());
  }
  applyStatic();
}

/** Übersetzt alle Elemente mit data-i18n*-Attributen. */
export function applyStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n as string)));
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml as string)));
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle as string)));
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria as string)));
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder as string)));
}
