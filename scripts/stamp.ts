/**
 * Cache-Busting für das Deployment: hängt eine Version (Commit-SHA) an alle
 * Verweise auf JS/CSS, damit Browser nach einem Update nie alte und neue
 * Dateien mischen. GitHub Pages lässt Dateien ~10 min im Browser-Cache.
 *
 *   npm run stamp            → Version aus $GITHUB_SHA, sonst Zeitstempel
 *
 * Läuft nur im Workflow auf der gebauten Kopie, nicht auf den Quelldateien im Repo.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./config.ts";

const SITE = path.join(ROOT, "site");
const version = (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 10);

// index.html: styles.css und dist/main.js versionieren
const indexFile = path.join(SITE, "index.html");
let html = await readFile(indexFile, "utf8");
html = html
  .replace(/href="styles\.css(\?v=[^"]*)?"/, `href="styles.css?v=${version}"`)
  .replace(/src="dist\/main\.js(\?v=[^"]*)?"/, `src="dist/main.js?v=${version}"`);
await writeFile(indexFile, html);

// dist/*.js: relative Modul-Importe versionieren ("./chart.js" → "./chart.js?v=…")
const distDir = path.join(SITE, "dist");
let files = 0;
for (const name of await readdir(distDir)) {
  if (!name.endsWith(".js")) continue;
  const file = path.join(distDir, name);
  const src = await readFile(file, "utf8");
  const out = src.replace(/(from\s+["']\.\/[\w-]+\.js)(\?v=[^"']*)?(["'])/g, `$1?v=${version}$3`);
  if (out !== src) {
    await writeFile(file, out);
    files++;
  }
}
console.log(`✔ Cache-Busting: Version ${version} (index.html + ${files} JS-Dateien)`);
