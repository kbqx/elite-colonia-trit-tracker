/**
 * Kleine, abhängigkeitsfreie SVG-Charts.
 * Mehrere Kennzahlen werden als übereinanderliegende "Small Multiples" mit
 * gemeinsamer Zeitachse gezeichnet (keine zweite Y-Achse!) und teilen sich
 * ein Fadenkreuz + Tooltip.
 */
import { esc, fmtDateTime } from "./format.js";

export interface Series {
  label: string;
  color: string;
  values: Array<number | null>;
  format: (v: number) => string;
  /** Fläche unter der Linie füllen (für Mengen). Y-Achse beginnt dann bei 0. */
  area?: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const M = { l: 62, r: 14, t: 18, b: 24 };

function niceStep(range: number, ticks: number): number {
  const raw = range / Math.max(1, ticks);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
}

function extent(values: Array<number | null>, fromZero: boolean): [number, number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!Number.isFinite(lo)) return [0, 1, 0.25];
  if (fromZero) lo = 0;
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceStep(hi - lo, 4);
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step];
}

function linePath(xs: number[], ys: Array<number | null>): string {
  let d = "", pen = false;
  ys.forEach((y, i) => {
    if (y == null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${(xs[i] as number).toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

function areaPath(xs: number[], ys: Array<number | null>, base: number): string {
  // Fläche pro zusammenhängendem Segment schließen.
  let d = "", seg: Array<[number, number]> = [];
  const flush = () => {
    if (seg.length > 1) {
      const first = seg[0] as [number, number], last = seg[seg.length - 1] as [number, number];
      d += `M${first[0]},${base}` + seg.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join("") + `L${last[0]},${base}Z`;
    }
    seg = [];
  };
  ys.forEach((y, i) => (y == null ? flush() : seg.push([xs[i] as number, y])));
  flush();
  return d;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function renderCharts(host: HTMLElement, times: number[], series: Series[], tooltip: HTMLElement): void {
  host.innerHTML = "";
  if (times.length < 2) {
    host.innerHTML = `<div class="empty">Der Verlauf beginnt mit dem ersten automatischen Snapshot – ab dem zweiten Lauf (≈ 30 min) erscheint hier der Chart.</div>`;
    return;
  }

  const width = Math.max(320, host.clientWidth);
  const height = 168;
  const t0 = times[0] as number, t1 = times[times.length - 1] as number;
  const spanH = (t1 - t0) / 3_600_000;
  const x = (t: number) => M.l + ((t - t0) / (t1 - t0 || 1)) * (width - M.l - M.r);
  const xs = times.map(x);

  // X-Ticks: Stunden bei ≤ 36 h, sonst Tage.
  const xTicks: Array<{ t: number; label: string }> = [];
  const stepMs = spanH <= 36 ? 6 * 3_600_000 : (spanH <= 24 * 8 ? 1 : spanH <= 24 * 16 ? 2 : 5) * 86_400_000;
  const startTick = Math.ceil(t0 / stepMs) * stepMs;
  for (let t = startTick; t <= t1; t += stepMs) {
    const d = new Date(t);
    xTicks.push({
      t,
      label: spanH <= 36
        ? `${String(d.getHours()).padStart(2, "0")}:00`
        : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`,
    });
  }

  const hovers: Array<(i: number | null) => void> = [];

  series.forEach((s, si) => {
    const wrap = document.createElement("div");
    wrap.className = "chart";
    const lastVal = [...s.values].reverse().find((v) => v != null) ?? null;
    wrap.innerHTML = `<div class="c-label"><span>${esc(s.label)}</span><b data-val>${lastVal == null ? "–" : esc(s.format(lastVal))}</b></div>`;
    const valueEl = wrap.querySelector("[data-val]") as HTMLElement;

    const [lo, hi, step] = extent(s.values, !!s.area);
    const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (height - M.t - M.b);
    const ys = s.values.map((v) => (v == null ? null : y(v)));

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, height, role: "img", "aria-label": s.label });
    const grid = el("g", { class: "grid" });
    const axis = el("g", { class: "axis" });
    for (let v = lo; v <= hi + step * 1e-6; v += step) {
      grid.append(el("line", { x1: M.l, x2: width - M.r, y1: y(v), y2: y(v) }));
      const tx = el("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end" });
      tx.textContent = s.format(v);
      axis.append(tx);
    }
    // X-Achsenbeschriftung nur unter dem letzten Chart.
    if (si === series.length - 1) {
      for (const tk of xTicks) {
        const tx = el("text", { x: x(tk.t), y: height - 6, "text-anchor": "middle" });
        tx.textContent = tk.label;
        axis.append(tx);
      }
    }
    svg.append(grid, axis);

    if (s.area) svg.append(el("path", { d: areaPath(xs, ys, y(lo)), fill: s.color, opacity: 0.16 }));
    svg.append(el("path", { d: linePath(xs, ys), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    const cross = el("line", { class: "crosshair", y1: M.t, y2: height - M.b, visibility: "hidden" });
    const dot = el("circle", { r: 4.5, fill: s.color, stroke: "#0f131a", "stroke-width": 2, visibility: "hidden" });
    const hit = el("rect", { x: M.l, y: 0, width: width - M.l - M.r, height, fill: "transparent" });
    svg.append(cross, dot, hit);

    hovers.push((i) => {
      if (i == null) {
        cross.setAttribute("visibility", "hidden");
        dot.setAttribute("visibility", "hidden");
        valueEl.textContent = lastVal == null ? "–" : s.format(lastVal);
        return;
      }
      const cx = xs[i] as number;
      cross.setAttribute("x1", String(cx));
      cross.setAttribute("x2", String(cx));
      cross.setAttribute("visibility", "visible");
      const yy = ys[i];
      if (yy != null) {
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(yy));
        dot.setAttribute("visibility", "visible");
      } else dot.setAttribute("visibility", "hidden");
      const v = s.values[i];
      valueEl.textContent = v == null ? "–" : s.format(v);
    });

    const onMove = (ev: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * width;
      // nächster Index per binärer Suche
      let a = 0, b = xs.length - 1;
      while (b - a > 1) { const m = (a + b) >> 1; if ((xs[m] as number) < px) a = m; else b = m; }
      const i = Math.abs((xs[a] as number) - px) < Math.abs((xs[b] as number) - px) ? a : b;
      hovers.forEach((h) => h(i));

      const rows = series.map((ser) => {
        const v = ser.values[i];
        return `<div class="t-row"><span><i class="sw" style="background:${ser.color}"></i>${esc(ser.label)}</span><b>${v == null ? "–" : esc(ser.format(v))}</b></div>`;
      }).join("");
      tooltip.innerHTML = `<div class="t-time">${fmtDateTime(times[i] as number)}</div>${rows}`;
      tooltip.hidden = false;
      const tw = tooltip.offsetWidth;
      const left = ev.pageX + 16 + tw > window.scrollX + window.innerWidth ? ev.pageX - tw - 16 : ev.pageX + 16;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${ev.pageY - 20}px`;
    };
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerleave", () => { hovers.forEach((h) => h(null)); tooltip.hidden = true; });

    wrap.append(svg);
    host.append(wrap);
  });
}

/** Mini-Verlaufslinie für Tabellenzellen. */
export function sparkline(values: Array<number | null>, color: string, w = 88, h = 24): string {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return `<span class="faint">–</span>`;
  let lo = Infinity, hi = -Infinity;
  for (const [, v] of pts) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (lo === hi) { lo -= 1; hi += 1; }
  const n = values.length - 1 || 1;
  const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${((i / n) * (w - 4) + 2).toFixed(1)},${(2 + (1 - (v - lo) / (hi - lo)) * (h - 4)).toFixed(1)}`).join("");
  const [li, lv] = pts[pts.length - 1] as readonly [number, number];
  const cx = ((li / n) * (w - 4) + 2).toFixed(1), cy = (2 + (1 - (lv - lo) / (hi - lo)) * (h - 4)).toFixed(1);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="${color}"/></svg>`;
}
