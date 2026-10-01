# Sea Point Lions Club Bingo Caller — Build Spec

## 1. Purpose
A bingo **caller** app used by the Sea Point Lions Club at bingo sessions at an old age home. The app draws random numbers, shows the current call very large, and shows every number already called. Players use their own paper boards. The caller runs the app on a laptop or tablet, usually connected to a TV or projector.

**Build everything in one go.** No phased delivery or review stops.

---

## 2. Tech & Delivery
- Single-page web app: **plain HTML, CSS, and vanilla JavaScript** (no framework needed). Vite is fine if useful, but output must be static files.
- **Progressive Web App (PWA)**: manifest + service worker so it installs on a laptop/tablet and **works fully offline** (the venue may have no Wi-Fi).
- Must run by opening `index.html` locally *and* when hosted (GitHub Pages / Netlify).
- Target browsers: current Chrome, Edge, Safari (iPad), Firefox.
- No backend, no accounts, no analytics, no external network calls at runtime.

---

## 3. Core Features

### 3.1 Configurable number range
- Default range: **1–75**.
- Settings allow any maximum from **10 to 200** (common presets as quick buttons: **75, 90, 100**).
- Changing the range is only allowed **before the first call** of a game, or by starting a new game (confirm dialog).
- **BINGO letters (B-I-N-G-O):**
  - Toggle in settings, default **on** for 75.
  - When on and the max is divisible by 5, split numbers into 5 equal columns (75 → B 1–15, I 16–30, N 31–45, G 46–60, O 61–75; 100 → 20 per letter).
  - If the max isn't divisible by 5, letters are automatically disabled with a short note in settings.
  - Called numbers display as e.g. **"N 42"** when letters are on.

### 3.2 Random number draw
- **"Call Next Number"** button draws a random number that has **not yet been called** (draw without replacement).
- Use `crypto.getRandomValues()` for randomness (not `Math.random()`).
- Implementation: on new game, build a shuffled deck (Fisher–Yates with crypto random) and pop from it. Persist the deck.
- When all numbers are called, button disables and shows "All numbers called".
- Optional short **draw animation** (~1 second of numbers flickering before landing) — toggle in settings, default on. Must never block or delay calling beyond ~1.5s.

### 3.3 Display
Main screen, designed to be read from across a room by elderly players:
- **Current number**: huge, centre-stage (at least ~35% of screen height on a 1080p display). Letter shown above or beside it.
- **Last 5 calls**: row beneath the current number, smaller, most recent first.
- **Called-numbers board**: full grid of all numbers in range.
  - Called numbers: highlighted (filled yellow, dark blue text, bold).
  - Uncalled numbers: muted.
  - Most recent call: extra emphasis (outline/pulse).
  - With letters on: one row per letter (B/I/N/G/O label on the left), like a classic masterboard.
  - Grid must auto-fit the screen for any range up to 200 without scrolling on a 1080p landscape screen.
- **Counter**: "Called: 23 / 75".

### 3.4 Game controls
- **Call Next Number** — the primary, largest button.
- **Undo Last Call** — returns the last number to the deck (for mis-clicks). Confirm dialog.
- **New Game** — clears all calls, reshuffles. Confirm dialog ("Start a new game? All called numbers will be cleared.").
- **Check a Card** — caller types in up to 25 numbers from a claimed winning card (or taps them on a grid); app shows which have/haven't been called. Validation help only — no automatic pattern detection.
- **Call History** — panel listing every call in order with call number (1st, 2nd, …).
- **Fullscreen** toggle.
- **Keyboard shortcuts**: `Space` or `Enter` = call next; `U` = undo (with confirm); `F` = fullscreen; `H` = history. Shortcuts listed in settings.

### 3.5 Voice announcement
- Optional spoken call using the browser **Web Speech API** (`speechSynthesis`), e.g. "N… forty-two".
- Toggle in settings, default **on**. Prefer an English (South African or UK) voice if available, falling back to the default voice.
- **Repeat Call** button re-speaks the current number.
- Works offline where the device has local voices; if no voice is available, hide the toggle silently.

### 3.6 Screen stays on / no timeout
- Use the **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) while the app is open.
- Re-acquire the wake lock when the page becomes visible again (`visibilitychange`).
- Fallback for browsers without Wake Lock (older iPad Safari): play a tiny silent looping muted video (the NoSleep.js approach, implemented inline — no CDN).
- Small indicator in the corner: "Screen lock: On" / "Not supported — set device auto-lock to Never".
- **No game timeouts**: no inactivity resets, no session expiry. A game remains open indefinitely.

### 3.7 Persistence
- Save full game state to `localStorage` after every action: range, letters setting, shuffled deck, called list (in order), settings.
- On load, **restore the in-progress game automatically**. An accidental refresh, closed tab, or flat battery must not lose the game.
- Wrap all storage access in try/catch; app must still work if storage is unavailable.

---

## 4. Design

### 4.1 Branding
- Header: **Sea Point Lions Club** name, with the club logo on the left and "Bingo" as a subtitle.
- Logo: load from `assets/logo.png` (I will supply the club's official logo file). **Do not draw or recreate the logo.** If the file is missing, show the club name only, with no broken image.
- Favicon and PWA icons: generate from `assets/logo.png` if present; otherwise a simple blue circle with a yellow "B".

### 4.2 Colours (yellow and blue)
Define as CSS variables:
- `--blue-dark: #00338D` (primary background / header)
- `--blue: #1F5FBF` (panels, buttons)
- `--yellow: #FFC72C` (called numbers, primary button, highlights)
- `--yellow-light: #FFE38A` (hover / recent-call accent)
- `--white: #FFFFFF`, `--muted: #7A8BB0` (uncalled numbers)
- All text/background pairs must meet **WCAG AA contrast**, ideally AAA for the current number.

### 4.3 Accessibility & readability (elderly audience)
- Very large, bold, sans-serif numerals (system font stack; e.g. "Segoe UI", Roboto, Helvetica, Arial).
- Minimum touch target 56×56px; the Call button much bigger.
- No colour-only meaning: called numbers are also bold/filled, not just recoloured.
- Respect `prefers-reduced-motion` (disable the draw animation and pulse).
- Layout: landscape-first (TV/laptop); must also be usable on a portrait tablet.

### 4.4 Cellphone support
Must work fully on Android (Chrome) and iPhone (Safari) phones, portrait and landscape.
- **Portrait phone layout:** current number and Call button fill the top ~60% of the screen. The called-numbers board sits below in a compact grid, and you can tap it to expand to full screen.
- Board on phones: smaller cells but numbers stay legible (min ~14px). For ranges above 100, the board may scroll vertically (allowed on phones only).
- Call button stays in the bottom thumb zone and is always visible (sticky).
- Settings, History and Check a Card open as full-screen sheets on phones.
- Respect safe areas (notch / home bar) with `env(safe-area-inset-*)`.
- Disable pull-to-refresh and double-tap zoom on the game screen so a mis-swipe doesn't interrupt play.
- Wake lock and voice must work on phones as on other devices.
- PWA installs to the home screen on both Android and iPhone.
- Add to acceptance criteria: the full game is playable one-handed on a 6" phone in portrait, and the screen stays on for 30+ minutes on Android Chrome and iPhone Safari.

---

## 5. Settings panel
Gear icon opens a panel with:
- Max number (input + 75 / 90 / 100 presets) — locked mid-game unless starting new.
- BINGO letters on/off
- Voice on/off + voice picker
- Draw animation on/off
- Keyboard shortcut reference
- "Reset everything" (clears storage, confirm dialog)

---

## 6. Out of scope
- Player cards / digital boards for players
- Automatic win-pattern detection
- Multi-device sync, accounts, online play
- Prize tracking or money handling

---

## 7. Project structure
```
/index.html
/styles.css
/app.js
/manifest.webmanifest
/sw.js
/assets/logo.png        (supplied by me; app must work without it)
/assets/icons/          (generated PWA icons)
/README.md
```

---

## 8. Acceptance criteria
1. With range 75, calling 75 times produces every number 1–75 exactly once, then disables the Call button.
2. Changing the range to 90 and 100 works; grid fits a 1080p screen without scrolling.
3. Letters display correctly for 75 and 100; auto-disable for a non-divisible range (e.g. 90).
4. Refreshing the page mid-game restores the exact same state (current number, history, remaining deck).
5. Undo puts the last number back and it can be drawn again.
6. Screen stays on for 30+ minutes with no interaction on Chrome (laptop) and iPad Safari.
7. App loads and works with Wi-Fi turned off after the first visit.
8. Current number is clearly readable from 6 metres on a 40"+ TV.
9. Voice announces each call and Repeat Call works.
10. Missing `assets/logo.png` causes no errors or broken images.

---

## 9. README must include
- How to run locally (double-click `index.html` or a one-line local server).
- How to deploy free to GitHub Pages or Netlify.
- How to install it as an app on a laptop and iPad.
- How to replace the logo.
- Tip: connect the laptop to the TV via HDMI and press `F` for fullscreen.
