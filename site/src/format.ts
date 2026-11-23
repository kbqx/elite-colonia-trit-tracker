/** Formatierungs-Helfer (deutsche Schreibweise). */

const intFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const oneDec = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const compactFmt = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined): string => (n == null ? "–" : intFmt.format(n));
export const fmtDec = (n: number | null | undefined): string => (n == null ? "–" : oneDec.format(n));
export const fmtCompact = (n: number | null | undefined): string => (n == null ? "–" : compactFmt.format(n));

/** "+1,2 %" / "−0,8 %" mit echtem Minuszeichen. */
export function fmtPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "–";
  const s = oneDec.format(Math.abs(p));
  return `${p > 0 ? "+" : p < 0 ? "−" : "±"}${s} %`;
}

export function relTime(iso: string | null, now: number): string {
  if (!iso) return "unbekannt";
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.round(diff / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} T`;
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

const dtFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (t: number | string): string => dtFmt.format(new Date(t));

/** Gegen HTML-Injection: Stations-/Carrier-Namen sind Spielereingaben! */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
