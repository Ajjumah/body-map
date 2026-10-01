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

## Deploy

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`, after the tests pass. The workflow sets `BASE_PATH=/<repo>/` so assets, the manifest and the service worker all resolve under the Pages subpath. To reproduce that build locally:

```bash
BASE_PATH=/body-map/ npm run build && BASE_PATH=/body-map/ npm run preview   # http://localhost:4173/body-map/
```

## Layout

- `src/data/regions.ts`: SVG geometry for the 26 front and 8 back regions, plus "Whole body"
- `src/data/emotions.ts`: default emotions and sensations
- `src/db.ts`: IndexedDB schema (`idb`): emotions, sessions, entries, images (blobs), meta
- `src/store.tsx`: app state and all mutations (everything is written through to IndexedDB)
- `src/components/`: body figure, check-in sheet, summary, grounding exercises, lock screen
- `src/screens/`: map, history (timeline, heatmap, insights), settings, help
- `src/lib/`: backup/CSV, image resize, PIN hashing (PBKDF2), insights maths

## Worlds (themes)

Three playful worlds, switchable in Settings → "Choose your world":

- **Sticker Book** (default): dotted paper, crayon colours, with Sunny the sun
- **Cozy Island**: sky, clouds and hills, with Sprout
- **Starlight Pocket**: a dark night sky, with Twinkle the star
- **Match my device**: Sticker Book in light mode, Starlight Pocket in dark mode

Tokens live in `src/index.css` under `[data-world="…"]`. `--ink` and `--muted` switch automatically between page text and text on a surface, so `.card`, `.btn`, `.chip`, `.sticker` and `.field` stay readable in every world. Fonts (Nunito, Gaegu, Fredoka, Baloo 2) are bundled through `@fontsource` and precached, so nothing is fetched from Google. Older `light`/`dark`/`system` settings migrate to `sticker`/`starlight`/`sticker`.

## Languages

English, Afrikaans, isiZulu, isiXhosa, Spanish, French and Portuguese, chosen in Settings → Language (English until changed). Strings live in `src/i18n/<code>.ts`. Each file must provide every key in `en.ts` (TypeScript enforces this), and a test checks that `{placeholders}` survive translation. All translations except English are machine-drafted. **Have first-language speakers review them, especially isiZulu and isiXhosa and the Help screen, before relying on them.** Saved data stays language-neutral: emotions, sensations, regions and context tags are stored by id and translated on display, and renamed feelings keep the person's own wording.

## Helplines

`src/data/helplines.ts` lists free crisis lines and emergency numbers for South Africa, the US, Canada, the UK, Ireland, Australia, New Zealand, India, Spain, France, Portugal, Brazil and Mexico, with findahelpline.com for anywhere else. The Help screen guesses the country from the device time zone, then the browser language, then falls back to South Africa, and Settings → Helpline country overrides it. The numbers were checked on 2026-09-28; re-check them periodically.

## Feeling colours

Default feelings are colour-coded: hard feelings (anxious, low, hurt/angry) in shades of red and coral, good feelings in greens, and tired or unsure in soft neutrals. Every colour keeps dark text at 4.5:1 or better (tested), and each feeling always shows its emoji and name, so colour is never the only signal.

## Calm corner

The Calm tab is a library of 14 short breathing and regulation exercises, available any time:

- **Breathing:** balloon (4-7-8), square (4-4-4-4), ocean waves (5 in, 5 out), sigh it out (double inhale, long exhale), humming bee, five-finger breathing
- **Moving and tapping:** butterfly hug (alternating taps), squeeze and let go (short progressive muscle relaxation), shake it out
- **Senses and imagination:** 5-4-3-2-1 treasure hunt, my cosy place
- **Rest and comfort:** kind hand, a cosy little rest, keep the good feeling

They're defined in `src/data/exercises.ts` and played by `src/components/ExercisePlayer.tsx`. After a check-in, the summary suggests one matched to the strongest feeling (for example, movement for big angry feelings, comfort for low ones), with "Try another" and a link to the full library. Animations stop under `prefers-reduced-motion`; the text and countdowns still guide you.

## Check-in context

After finishing a check-in, optional "What were you doing? / Who were you with? / Where were you?" tags can be added, including your own. They are saved on the session, shown in Memories, and included in the CSV export.

## Privacy notes

- No backend and no network calls for user data. Export/CSV downloads use local object URLs.
- The app-lock PIN is stored as a salted PBKDF2-SHA256 hash. It locks the UI; it does not encrypt IndexedDB.
- JSON backups exclude the PIN. Importing keeps the device's current PIN.
- The SADAG number (0800 567 567, Suicide Crisis Helpline, 24h) was checked against sadag.org on 2026-09-27.
