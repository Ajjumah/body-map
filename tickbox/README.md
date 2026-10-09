# Tickbox Tracker

A tickbox grid where rows are tasks, clients, vendors or anything else, and columns are the checks each one needs. Every cell can have its own due date. Rows sort themselves by what is due next, and the cell that decides a row's place gets a highlight and a thick outline.

It is plain HTML, CSS and JavaScript with no framework, no build step, no backend and no network calls. Each person's trackers are saved in their own browser (`localStorage`).

## Run it

- **From disk:** open `index.html` in a browser. Everything works except installing and offline caching, which need a web server.
- **Locally over HTTP:** from this folder, run any static server, for example `npx http-server -c-1 .` or `python3 -m http.server`, then open the address it prints.

## Host it

Upload the contents of this folder (minus `tests/`) to any static host: GitHub Pages, Netlify, Cloudflare Pages or similar. All paths are relative, so it works from a subfolder.

In this repository it is deployed with the Body Map site: `npm run build` copies it to `dist/tickbox/`, and the Pages workflow publishes it at `https://<user>.github.io/<repo>/tickbox/`.

Once hosted, people can install it to a phone or laptop home screen and it works with no connection.

## Test

```bash
node --test tickbox/tests/*.js     # from the repo root (also run by `npm test`)
npm test                           # from this folder
```

The tests cover the sort and status rules (`getCellStatus`, `sortRows`), the worked example and the acceptance checks in the build document, date maths across month, year and DST boundaries, and import validation.

## Files

| File | What it does |
| --- | --- |
| `core.js` | Pure functions: dates, `getCellStatus(cell, today, dueSoonDays)`, `sortRows(tracker, today)`, row analysis, labels, file validation |
| `app.js` | The UI: home list, grid, popovers, menus, undo, import and export, drag to reorder |
| `styles.css` | Layout, light and dark themes, print view. Re-skin by changing `--accent` |
| `sw.js`, `manifest.webmanifest` | Offline support and install |
| `tests/` | Unit tests (Node's built-in test runner) |

## Sharing

- **The app:** send the hosted link. A new visitor gets the app with one sample tracker, which they can delete.
- **A template:** More → Share template. Downloads the tracker's name, row label, columns and settings, with no rows.
- **A full copy:** More → Export tracker. Downloads everything.
- **Back up everything / Restore backup** are on the home screen.

Import always adds a new tracker. It never overwrites one, and adds " (imported)" if the name is taken. Files are the tracker JSON exactly as stored (`schemaVersion: 1`), and a backup is `{ "kind": "tickbox-backup", "trackers": [ ... ] }`.

## Notes on behaviour

- Rows are ordered: rows with a due date (earliest first, so overdue comes before today), then open rows with no dates in your manual order, then the Complete group. Ties keep manual order. Turning off auto-sort keeps rows in manual order and lets you drag them.
- After a tick the row waits 1.5 seconds, then slides to its new place, and a toast offers Undo for 5 seconds. While a cell's popover is open, rows stay put until it closes.
- "Today" is the device's local date. The grid updates at midnight, when you come back to the tab, and when the app opens.
- The summary counts are of cells: "2 overdue" means two open cells are past their date.
- Undo covers the last 50 changes for each tracker, including deletes. Ctrl+Z or Cmd+Z works too.
- Keyboard: Tab to a box and press Space to tick. The button under each box opens its popover. Drag handles move rows (up and down arrows) and columns (left and right arrows).
