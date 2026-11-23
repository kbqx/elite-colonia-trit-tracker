# Colonia Tritium Ticker

Statische Website (GitHub Pages) + TypeScript-Scripts, die regelmäßig den Tritium-Markt rund um Colonia von [Spansh](https://spansh.co.uk/) abfragen und als Verlauf speichern.

```
colonia-trit-tracker/
├─ scripts/                 Node-Scripts (laufen mit tsx)
│  ├─ config.ts             Referenzsystem, Radius, Ware, Pfade – per ENV überschreibbar
│  ├─ spansh.ts             API-Client + Normalisierung der Spansh-Antwort
│  ├─ snapshot.ts           Snapshot holen → site/data/latest.json + history.json
│  ├─ history.ts            Verlauf anhängen, alte Punkte aufräumen
│  ├─ mock.ts               Demo-Daten fürs Frontend
│  └─ serve.ts              Mini-Dev-Server
├─ site/                    ← wird 1:1 auf GitHub Pages veröffentlicht
│  ├─ index.html, styles.css
│  ├─ src/*.ts              Frontend (TypeScript, ohne Framework) → dist/
│  ├─ assets/               Platzhalter-Bilder (später Videos)
│  └─ data/                 latest.json, history.json (vom Workflow aktualisiert)
└─ .github/workflows/snapshot.yml
```

## Lokal starten

```bash
npm install
npm run mock      # Demo-Daten erzeugen (14 Tage Verlauf)
npm run dev       # TypeScript bauen + http://localhost:5173
```

Echte Daten:

```bash
npm run snapshot              # Spansh abfragen, Daten schreiben
npm run snapshot -- --dry-run # nur abfragen + Top-Listen in der Konsole
npm run snapshot:raw          # zusätzlich Rohantwort nach data-raw/ (zum Debuggen)
npm run snapshot -- --from-file data-raw/xyz.json   # gespeicherte Antwort normalisieren
```

Standard-Radius: 500 ly um Colonia (max. Sprungweite eines Fleet Carriers). Konfiguration über Umgebungsvariablen, z. B. `RADIUS_LY=300 HISTORY_RETENTION_DAYS=60 npm run snapshot`.
Der Request fragt Verkäufer (Supply ≥ 1) und Käufer (Demand ≥ 1) getrennt ab. Ohne diesen Filter liefert Spansh alle ~875 Stationen mit kompletter Warenliste (~43 MB); `USE_MARKET_FILTER=0` schaltet ihn als Fallback ab.

Liegen noch Mock-Daten in `site/data/`, beginnt der erste echte Snapshot automatisch einen neuen Verlauf.

## Deploy auf GitHub Pages

1. Repo auf GitHub pushen.
2. **Settings → Pages → Source: „GitHub Actions“**.
3. **Actions → Snapshot & Deploy → Run workflow** (danach läuft er alle 30 min von selbst).

Der Workflow committet nur `site/data/`. Ein Push vom `GITHUB_TOKEN` löst keinen neuen Workflow aus, es gibt also keine Schleife.

## Video-Platzhalter

Zwei Stellen sind markiert (`data-video-slot="hero"` und `"info"` in `index.html`). Zum Austauschen das `<img>` durch das auskommentierte `<video>` ersetzen und `data-placeholder` + das Badge entfernen. Die Bilder in `site/assets/` sind prozedural erzeugte Platzhalter.

## Datenformat

`site/src/types.ts` ist die einzige Quelle der Wahrheit für `latest.json` (`Snapshot`) und `history.json` (`HistoryFile`). Ein Verlaufspunkt speichert pro Markt-ID `[Kaufpreis, Supply, Ankaufspreis, Demand]`.
