# Sea Point Lions Club — Bingo Caller

A bingo caller for the Sea Point Lions Club. It draws random numbers, shows the current call very large, and shows every number already called. Players use their own paper boards. It runs in any modern browser on a laptop, tablet or phone, and keeps working with no internet.

Plain HTML, CSS and JavaScript. No build step, no accounts, no tracking, and no network calls while you play.

```
index.html             the app page
styles.css             layout and colours
app.js                 game logic
manifest.webmanifest   install-as-app details
sw.js                  offline support
assets/logo.png        club logo (optional; replace with your own)
assets/icons/          favicon and app icons made from the logo
tools/make-icons.sh    regenerates the icons
```

## Running it

**Easiest:** double-click `index.html`. It opens in your browser and works straight away. The game is saved as you play.

**As a small local website** (needed for "install as app" and offline mode). From this folder, run one of these:

```sh
python3 -m http.server 8000      # then open http://localhost:8000
npx serve .                      # or this, if you have Node.js
```

> Offline mode and installing need the app to be served over `http://localhost` or `https://`. Opening the file directly works for playing, but it can't be installed.

## Putting it online for free

Upload the **contents of this folder** (the files listed above) to the root of any static host.

**Netlify (drag and drop):** go to <https://app.netlify.com/drop> and drag this folder onto the page. Netlify gives you a link like `https://something.netlify.app`. Open that link once on each device, and it will then work offline.

**GitHub Pages:**
1. Create a new GitHub repository and upload these files to it, with `index.html` at the top level.
2. In the repository, go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
3. After a minute the app is live at `https://<your-user>.github.io/<repo-name>/`.

When you change any file later, also change the `VERSION` line at the top of `sw.js` (for example to `splc-bingo-v2`). Devices then pick up the new version the next time they open the app online.

## Installing it as an app

Open the hosted link once while you're online. After that it works without Wi-Fi.

- **Laptop (Chrome or Edge):** click the install icon at the right of the address bar (a monitor with a down arrow), or open the ⋮ menu and choose **Install Sea Point Lions Club Bingo** (in Edge: **Apps → Install this site as an app**). It gets its own window and a desktop or Start-menu shortcut.
- **iPad or iPhone (Safari):** tap the **Share** button, then **Add to Home Screen**, then **Add**.
- **Android (Chrome):** tap ⋮, then **Install app** (or **Add to Home screen**).

## Replacing the logo

Replace `assets/logo.png` with your logo. A square PNG with a transparent background, at least 512×512, works best. The header picks it up straight away.

To update the browser-tab icon and the installed-app icons too, run this (it needs ImageMagick):

```sh
sh tools/make-icons.sh
```

If there is no `assets/logo.png`, the header shows only the club name, and the icon script draws a blue circle with a yellow "B" instead.

## Running a session

- **TV tip:** connect the laptop to the TV with an HDMI cable, open the app, and press **F** for fullscreen.
- Press **Space** (or click **Call Next Number**) to call. The number appears large, is announced aloud, and lights up on the board.
- Check the **Screen lock** note in the corner of the number panel. "Screen lock: On" means the screen won't go to sleep. If it says "Not supported", set the device's auto-lock or sleep to **Never** before the session. On iPad, that's **Settings → Display & Brightness → Auto-Lock → Never**.
- If you refresh the page by accident, close the tab, or the battery dies, the game comes back exactly where you left it.
- **Check a Card:** type the numbers from a claimed winning card, or tap them on the grid. Each number shows ✓ if it has been called and ✗ if not.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space / Enter | Call next number |
| U | Undo last call (asks first) |
| R | Repeat the call (spoken again) |
| F | Fullscreen on/off |
| H | Call history |
| C | Check a card |
| Esc | Close a panel |

### Settings (gear icon)

- **Highest number:** any number from 10 to 200, with quick buttons for 75, 90 and 100. Once a game has started, changing it starts a new game (it asks first).
- **BINGO letters:** off by default. Turn on to split the numbers into B-I-N-G-O columns. This works when the highest number divides by 5 (75 gives B 1–15 … O 61–75; 100 gives 20 per letter). For other ranges, such as 42, letters switch off automatically.
- **Voice:** announce each call, and choose the voice. A South African or UK English voice is picked automatically when the device has one. The voice settings are hidden if the device has no voices.
- **Draw animation:** a short flicker before the number lands. It is switched off automatically if the device is set to reduce motion.
- **Reset everything:** clears the game and settings on this device.

## Browser notes

- Works in current Chrome, Edge, Firefox and Safari (iPad and iPhone included).
- Keeping the screen awake uses the Screen Wake Lock API. Older iPads that don't have it play a tiny silent video instead. That fallback starts after the first tap on the screen.
- On iPhone and iPad, voice works only after the first tap (this is an Apple rule). Pressing **Call Next Number** counts as that tap.
- iPhone Safari has no fullscreen button. Install the app to the Home Screen for a full-screen view.
