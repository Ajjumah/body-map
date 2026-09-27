# Body Map — Emotion & Sensation Tracker

A private, offline-first PWA for noticing where feelings show up in the body. Built from [SPEC.md](SPEC.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (dist/, with service worker)
npm run preview    # serve dist/ at http://localhost:4173 (use this to test offline/install)
npm test           # unit tests (logic, PIN hashing, CSV, IndexedDB backup round trip)
```

## Layout

- `src/data/regions.ts`: SVG geometry for the 26 front and 8 back regions, plus "Whole body"
- `src/data/emotions.ts`: default emotions and sensations
- `src/db.ts`: IndexedDB schema (`idb`): emotions, sessions, entries, images (blobs), meta
- `src/store.tsx`: app state and all mutations (everything is written through to IndexedDB)
- `src/components/`: body figure, check-in sheet, summary, grounding exercises, lock screen
- `src/screens/`: map, history (timeline, heatmap, insights), settings, help
- `src/lib/`: backup/CSV, image resize, PIN hashing (PBKDF2), insights maths

## Privacy notes

- No backend and no network calls for user data. Export/CSV downloads use local object URLs.
- The app-lock PIN is stored as a salted PBKDF2-SHA256 hash. It locks the UI; it does not encrypt IndexedDB.
- JSON backups exclude the PIN. Importing keeps the device's current PIN.
- The SADAG number (0800 567 567, Suicide Crisis Helpline, 24h) was checked against sadag.org on 2026-09-27.
