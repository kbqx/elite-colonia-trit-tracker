/**
 * Schlichter Sternenhimmel auf einem <canvas class="stars">.
 * Ein paar hundert Punkte, wenige davon funkeln leicht. Kein Bild, kein Video,
 * ein paar KB Code. Läuft nur, solange der Canvas sichtbar ist, und steht still
 * bei "reduzierte Bewegung".
 */
interface Star { x: number; y: number; r: number; a: number; tint: string; tw: number; ph: number }

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

export function initStars(canvas: HTMLCanvasElement, seed = 1): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stars: Star[] = [];
  let w = 0, h = 0, raf = 0, visible = true, last = 0;

  const build = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Dichte ~1 Stern pro 2.600 px², feste Positionen je Seed (gleich bei jedem Laden).
    const r = rng(seed);
    const n = Math.round((w * h) / 2600);
    stars = Array.from({ length: n }, () => {
      const big = r() < 0.04;
      const t = r();
      return {
        x: r() * w,
        y: r() * h,
        r: big ? 1.1 + r() * 0.8 : 0.4 + r() * 0.7,
        a: 0.25 + r() * 0.65,
        tint: t < 0.12 ? "255,214,170" : t < 0.22 ? "190,212,255" : "255,255,255",
        tw: r() < 0.12 ? 0.6 + r() * 1.6 : 0, // nur ~12 % funkeln
        ph: r() * Math.PI * 2,
      };
    });
    draw(performance.now());
  };

  const draw = (now: number) => {
    ctx.clearRect(0, 0, w, h);
    const s = now / 1000;
    for (const st of stars) {
      const a = st.tw && !reduce ? st.a * (0.55 + 0.45 * Math.sin(s * st.tw + st.ph)) : st.a;
      ctx.fillStyle = `rgba(${st.tint},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible || now - last < 66) return; // ~15 fps reicht fürs Funkeln
    last = now;
    draw(now);
  };

  build();
  let t: number | undefined;
  new ResizeObserver(() => {
    clearTimeout(t);
    t = window.setTimeout(build, 120);
  }).observe(canvas);
  if (reduce) return;
  new IntersectionObserver((entries) => (visible = entries.some((e) => e.isIntersecting))).observe(canvas);
  raf = requestAnimationFrame(loop);
  void raf;
}
