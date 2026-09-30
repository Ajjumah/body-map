# The Lions Ledger

A personal newspaper built from your email. It reads a defined set of messages (first source: Sea Point Lions
Club), works out what matters, and publishes a one-page HTML "edition": what needs you, news by project, meeting
decisions, club notices and dates for the diary.

**Cost: R0.** No paid APIs and no API keys. Python does the fetching, cleaning, storage and rendering. The AI
work (classifying emails and writing articles) is done by **Claude Code** under your normal Claude subscription,
through the `/edition` slash command. Everything stays on your computer.

```
ledger fetch            Gmail (read-only) -> clean -> SQLite -> data/inbox/pending.json
claude -p "/edition"    Claude Code classifies, finds projects, writes articles (prompts/*.md)
ledger render           Jinja2 -> editions/YYYY-MM-DD-seapoint-lions.html, latest.html, index.html
```

`./run_edition.sh` (Windows: `run_edition.bat`) does all three and is safe to run at any time.

---

## 1. Install (once)

You need Python 3.11+ and [Claude Code](https://claude.com/claude-code) signed in with your subscription.

```bash
cd lions-ledger
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .
```

## 2. One-off Google setup (about 10 minutes, the only manual part)

This creates a private "app" in your own Google account so `ledger` can **read** your Gmail. It is free and
nobody else can use it.

1. Go to <https://console.cloud.google.com/> and sign in with the Gmail account that receives the Lions mail.
2. Top bar → project picker → **New project**. Name it `Lions Ledger` → **Create**, then select it.
3. Menu → **APIs & Services → Library**. Search **Gmail API** → **Enable**. Then search **Google Drive API** →
   **Enable** (the club shares minutes as Drive links; see `follow_drive_links` below).
4. Menu → **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**):
   - User type **External** → Create. App name `Lions Ledger`, your email as support and developer contact → Save.
   - **Audience / Test users** → **Add users** → add your own Gmail address → Save.
   - Leave the app in **Testing**. You do not need to publish or verify it.
5. Menu → **APIs & Services → Credentials** → **Create credentials → OAuth client ID**.
   Application type **Desktop app**, name `ledger` → Create → **Download JSON**.
6. Save that file as `lions-ledger/credentials.json`.
7. Run:
   ```bash
   ledger auth
   ```
   A browser opens. Choose your account. Google warns "Google hasn't verified this app": click **Continue**
   (it is your own app). Allow **"View your email messages and settings"** and **"See and download all your
   Google Drive files"** (both read-only). You'll see
   `Signed in as …`, and `token.json` is saved.

Notes:
- While the app is in Testing, Google may expire the sign-in after 7 days of **not** being used. The weekly run
  keeps it fresh; if it ever lapses, `ledger fetch` says so and you just run `ledger auth` again.
- `credentials.json` and `token.json` are git-ignored. Never share them.

## 3. First run

```bash
ledger discover                 # top senders/subjects/labels for a broad "lions" search
ledger fetch                    # first run pulls the last 60 days
claude                          # then type:  /edition
```

or simply `./run_edition.sh`. The first edition covers the last 30 days (`first_edition_days`); after that each
edition covers everything since the previous one (normally a week).

## 4. The weekly schedule (Monday 07:00 SAST)

```bash
ledger schedule install         # cron on macOS/Linux, Task Scheduler on Windows
ledger schedule show            # what is installed
ledger schedule remove
```

The time is converted from SAST to your computer's time zone. The computer must be on (and awake) at that time;
if it was off, the next run catches up automatically because fetching and editions work from the last run.

Manual equivalents, if you prefer:
- **macOS/Linux:** `crontab -e` and add
  `0 7 * * 1 "/path/to/lions-ledger/run_edition.sh" --scheduled >> "/path/to/lions-ledger/data/logs/scheduled.log" 2>&1`
  (macOS: give `cron` Full Disk Access in System Settings → Privacy & Security if it does not run.)
- **Windows:** Task Scheduler → Create Basic Task → Weekly, Monday 07:00 → Start a program →
  `C:\path\to\lions-ledger\run_edition.bat` with argument `--scheduled`.

`--scheduled` stops the browser popping open; open `editions/latest.html` when you are ready.

## 5. Everyday use

| Command | What it does |
|---|---|
| `ledger fetch [--since YYYY-MM-DD] [--reprocess]` | Store new mail; export what needs classifying |
| `ledger status` | Stored / filtered / classified / pending counts |
| `ledger projects` | Project registry with email counts |
| `ledger period-data [--from --to]` | The grouped JSON Claude Code writes from |
| `ledger save-classifications FILE` / `save-articles FILE` | Validate and store Claude Code's output |
| `ledger render [--from --to] [--open]` | Build the edition, `latest.html` and `index.html` |
| `ledger import-json FILE` | Load messages from JSON instead of Gmail (offline/testing) |

**Curate projects** in `projects/seapoint-lions.yaml`. New projects arrive as `proposed` (they carry a
"New on the desk" badge). Change `status` to `active` to keep them, or `ignore` to drop them from editions
(their emails are still stored). Add `aliases` so different names map to one project.

**Re-classify** after changing prompts: `ledger fetch --reprocess --since 2026-09-01`, then `/edition`.

**Edit the house style** in `prompts/` (plain Markdown, no code changes needed).

## 6. Adding another organisation

Add a `sources:` entry to `config.yaml` with its own `id`, `name` and `gmail_query`; its project registry lives in
`projects/<id>.yaml` and its editions are `editions/YYYY-MM-DD-<id>.html`. No code changes.

## 7. Options in `config.yaml`

- `follow_drive_links` (per source, **on** for Sea Point Lions): the club often shares minutes as Google Drive links
  rather than attachments, so `fetch` reads the linked documents too (up to 3 per email). This needs the
  read-only `drive.readonly` scope. Set it to `false` and run `ledger auth` again to go back to Gmail-only access.
- `exclude_senders`: addresses to store but never classify.
- `email_to_self` (default off): email each edition to yourself; adds the `gmail.send` scope (run `ledger auth` again).
- `gmail_link_template`: change `u/0` if the Lions Gmail is not your first signed-in Google account.

## Privacy

Read-only Gmail access (plus read-only Drive access for linked minutes). Email text is read only by Claude Code on your machine. `data/` (database, logs, work
files), `editions/` and the credentials are git-ignored and never leave your computer.

## Development

```bash
pip install -e ".[dev]"
pytest
```
