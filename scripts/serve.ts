/**
 * Minimaler statischer Dev-Server für site/ (keine Abhängigkeiten).
 *   npm run serve   → http://localhost:5173
 * Nötig, weil Browser fetch() auf file://-URLs blockieren.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./config.ts";

const SITE = path.join(ROOT, "site");
const PORT = Number(process.env.PORT ?? 5173);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.normalize(path.join(SITE, decodeURIComponent(url.pathname)));
    if (!file.startsWith(SITE)) throw new Error("outside");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404");
  }
}).listen(PORT, () => console.log(`Dev-Server: http://localhost:${PORT}`));
