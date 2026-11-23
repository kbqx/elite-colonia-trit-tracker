/** Formatierungs-Helfer – folgen der gewählten Sprache (en-US / de-DE). */
import { locale, t } from "./i18n.js";

// Intl-Formatter sind teuer → je Locale einmal anlegen.
const cache = new Map<string, { int: Intl.NumberFormat; dec: Intl.NumberFormat; compact: Intl.NumberFormat; dt: Intl.DateTimeFormat }>();
function f() {
  const loc = locale();
  let c = cache.get(loc);
  if (!c) {
    c = {
      int: new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }),
      dec: new Intl.NumberFormat(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
      compact: new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 }),
      dt: new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
    cache.set(loc, c);
  }
  return c;
}

export const fmtInt = (n: number | null | undefined): string => (n == null ? "–" : f().int.format(n));
export const fmtDec = (n: number | null | undefined): string => (n == null ? "–" : f().dec.format(n));
export const fmtCompact = (n: number | null | undefined): string => (n == null ? "–" : f().compact.format(n));
export const fmtDateTime = (v: number | string): string => f().dt.format(new Date(v));
/** Zahl mit max. 1 Nachkommastelle (z. B. Lichtjahre). */
export const fmtNum1 = (n: number): string => n.toLocaleString(locale(), { maximumFractionDigits: 1 });

/** "+1,2 %" / "−0,8 %" mit echtem Minuszeichen. */
export function fmtPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "–";
  const s = fmtDec(Math.abs(p));
  return `${p > 0 ? "+" : p < 0 ? "−" : "±"}${s} %`;
}

export function relTime(iso: string | null, now: number): string {
  if (!iso) return t("time.unknown");
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.round(diff / 60_000);
  if (min < 1) return t("time.now");
  if (min < 60) return t("time.min", { n: min });
  const h = Math.round(min / 60);
  if (h < 48) return t("time.h", { n: h });
  return t("time.d", { n: Math.round(h / 24) });
}

/** Klassifiziert das Alter eines Markt-Updates für die Farbmarkierung. */
export function ageClass(iso: string | null, now: number): "fresh" | "ok" | "old" | "stale" {
  if (!iso) return "stale";
  const h = (now - Date.parse(iso)) / 3_600_000;
  if (h <= 1) return "fresh";
  if (h <= 24) return "ok";
  if (h <= 72) return "old";
  return "stale";
}

/** Gegen HTML-Injection: Stations-/Carrier-Namen sind Spielereingaben! */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
