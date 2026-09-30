"""`ledger` command line."""
from __future__ import annotations

import base64
import json
import sys
from datetime import date, datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.utils import parseaddr
from pathlib import Path
from typing import Optional

import typer

from . import config, db, ingest, period, render, schedule, store
from .gmail_client import Attachment, RawMessage
from .projects import Registry

app = typer.Typer(add_completion=False, no_args_is_help=True, help="The Lions Ledger: email-to-newspaper digest.")


def _cfg() -> config.Config:
    return config.load_config()


def _date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise typer.BadParameter(f"'{s}' is not a YYYY-MM-DD date")


def _sources(cfg, source: Optional[str]):
    return [cfg.source(source)] if source else cfg.enabled_sources()


def _read_json(file: Path):
    try:
        return json.loads(Path(file).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        typer.echo(f"INVALID JSON in {file}: {e.msg} at line {e.lineno} column {e.colno}", err=True)
        raise typer.Exit(1)


@app.command()
def auth():
    """Sign in to Gmail (one-off browser consent). Saves token.json."""
    from . import gmail_client

    cfg = _cfg()
    svc = gmail_client.service(cfg, interactive=True)
    profile = svc.users().getProfile(userId="me").execute()
    typer.echo(f"Signed in as {profile['emailAddress']} ({profile.get('messagesTotal', '?')} messages). Token saved to {config.TOKEN_PATH.name}.")


@app.command()
def discover(
    source: Optional[str] = typer.Option(None, help="Source id (only used for its lookback window)."),
    query: str = typer.Option("lions", help="Broad Gmail search to analyse."),
    limit: int = typer.Option(300, help="Maximum messages to inspect."),
):
    """List top senders, subjects and labels for a broad search, to tune gmail_query."""
    from . import gmail_client

    cfg = _cfg()
    src = cfg.source(source)
    q = f"({query}) newer_than:{src.lookback_days_first_run}d"
    res = gmail_client.discover(gmail_client.service(cfg), q, limit)
    typer.echo(f"Query: {q}\nMessages: {res['total']}\n")
    for title, key in (("TOP SENDERS", "senders"), ("TOP SUBJECTS (digits as #)", "subjects"), ("LABELS / LISTS", "labels")):
        typer.echo(title)
        for name, n in res[key]:
            typer.echo(f"  {n:4d}  {name}")
        typer.echo("")
    typer.echo(f"Current gmail_query for {src.id}: {src.gmail_query}")


@app.command()
def fetch(
    since: Optional[str] = typer.Option(None, help="Fetch mail since YYYY-MM-DD (default: last run, or the first-run lookback)."),
    reprocess: bool = typer.Option(False, "--reprocess", help="Re-export already classified mail in the window so it is classified again."),
    source: Optional[str] = typer.Option(None, help="Only this source id."),
):
    """Store new mail and export data/inbox/pending.json for Claude Code."""
    from . import gmail_client

    cfg = _cfg()
    log = config.setup_logging()
    conn = db.connect()
    svc = gmail_client.service(cfg)
    me = svc.users().getProfile(userId="me").execute()["emailAddress"].lower()
    drive = None
    for src in _sources(cfg, source):
        since_d = _date(since)
        last = db.get_last_fetch(conn, src.id)
        if since_d:
            after = datetime.combine(since_d, datetime.min.time(), tzinfo=config.TZ)
        elif last:
            after = datetime.fromisoformat(last) - timedelta(days=1)  # overlap; ids de-duplicate
        else:
            after = config.now() - timedelta(days=src.lookback_days_first_run)
        q = f"({src.gmail_query}) after:{int(after.timestamp())} -in:sent -in:drafts -from:me"
        ids = gmail_client.list_message_ids(svc, q)
        new_ids = [i for i in ids if not conn.execute("SELECT 1 FROM emails WHERE id=?", (i,)).fetchone()]
        counts = {"stored": 0, "skipped": 0, "failed": 0}
        for mid in reversed(new_ids):  # oldest first so duplicates point at the original
            try:
                raw = gmail_client.fetch_message(svc, mid)
                if src.follow_drive_links:
                    drive = drive or gmail_client.drive_service(cfg)
                    texts = []
                    for fid in gmail_client.drive_ids_in((raw.text_body or "") + (raw.html_body or ""))[:3]:
                        try:
                            _, t = gmail_client.fetch_drive_text(drive, fid)
                            if t:
                                texts.append(t)
                        except Exception as exc:
                            log.warning("Drive file %s in %s unreadable: %s", fid, mid, exc)
                    raw.extra_text = "\n\n".join(texts)
                result = ingest.store_message(conn, cfg, src, raw, {me})
                conn.commit()
                counts["stored" if result == "stored" else "skipped"] += result != "exists"
                if result.startswith("skipped"):
                    log.info("%s %s", mid, result)
            except Exception as exc:  # one bad email never kills the run
                conn.rollback()
                counts["failed"] += 1
                log.exception("Failed to fetch/store %s: %s", mid, exc)
                typer.echo(f"  ! {mid}: {exc} (logged, skipped)", err=True)
        if reprocess:
            n = ingest.reset_for_reprocess(conn, src.id, after.astimezone(timezone.utc).isoformat())
            typer.echo(f"  {src.id}: {n} emails queued for re-classification")
        db.set_last_fetch(conn, src.id, config.now().isoformat())
        conn.commit()
        typer.echo(
            f"{src.id}: {len(ids)} matched, {len(new_ids)} new -> {counts['stored']} stored, "
            f"{counts['skipped']} filtered, {counts['failed']} failed"
        )
    summary = ingest.export_pending(conn, cfg)
    typer.echo(f"Pending for Claude Code: {summary['pending']} emails in {len(summary['batches'])} batch file(s) under data/inbox/")


@app.command("import-json")
def import_json(
    file: Path,
    source: Optional[str] = typer.Option(None, help="Source id to file the messages under."),
):
    """Store messages from a JSON file instead of the Gmail API (offline use, tests, other mail tools).

    Format: a list of {id, thread_id, date (ISO), from ("Name <addr>"), subject, text_body, html_body,
    attachments: [{filename, mime_type, data_base64 | text}], labels}.
    """
    cfg = _cfg()
    log = config.setup_logging()
    conn = db.connect()
    src = cfg.source(source)
    items = _read_json(file)
    counts = {"stored": 0, "skipped": 0, "exists": 0, "failed": 0}
    for m in sorted(items, key=lambda x: x.get("date", "")):
        try:
            name, addr = parseaddr(m.get("from", ""))
            atts, extra = [], []
            for a in m.get("attachments", []) or []:
                if a.get("text"):
                    extra.append(f"=== Attachment: {a.get('filename', 'attachment')} ===\n{a['text'][:15000]}")
                elif a.get("data_base64"):
                    atts.append(Attachment(a.get("filename", ""), a.get("mime_type", ""), base64.b64decode(a["data_base64"])))
            raw = RawMessage(
                id=m["id"], thread_id=m.get("thread_id") or m["id"],
                received_at=datetime.fromisoformat(m["date"].replace("Z", "+00:00")),
                sender_name=name or addr, sender_email=addr.lower(), subject=m.get("subject", "(no subject)"),
                text_body=m.get("text_body", ""), html_body=m.get("html_body", ""), attachments=atts,
                headers=m.get("headers", {}), label_ids=m.get("labels", []), extra_text="\n\n".join(extra),
            )
            r = ingest.store_message(conn, cfg, src, raw, set(x.lower() for x in m.get("own_addresses", [])))
            conn.commit()
            counts["stored" if r == "stored" else "exists" if r == "exists" else "skipped"] += 1
        except Exception as exc:
            conn.rollback()
            counts["failed"] += 1
            log.exception("import failed for %s: %s", m.get("id"), exc)
            typer.echo(f"  ! {m.get('id')}: {exc} (logged, skipped)", err=True)
    typer.echo(f"{src.id}: {counts}")
    summary = ingest.export_pending(conn, cfg)
    typer.echo(f"Pending for Claude Code: {summary['pending']} emails in {len(summary['batches'])} batch file(s) under data/inbox/")


@app.command("save-classifications")
def save_classifications(file: Path, model: str = typer.Option("claude-code", help="Recorded in classifications.model.")):
    """Validate and store Claude Code's classifications (JSON list)."""
    cfg = _cfg()
    conn = db.connect()
    try:
        res = store.save_classifications(conn, cfg, _read_json(file), model=model)
    except store.ValidationError as e:
        typer.echo(f"REJECTED {file} ({len(e.errors)} problem(s)); nothing was saved. Fix and retry:", err=True)
        for err in e.errors:
            typer.echo(f"  - {err}", err=True)
        raise typer.Exit(1)
    typer.echo(f"Saved {res['saved']} classifications.")
    if res["new_projects"]:
        typer.echo("New projects added as 'proposed': " + ", ".join(res["new_projects"]))
    left = conn.execute("SELECT COUNT(*) n FROM emails WHERE processed_at IS NULL AND skip_reason IS NULL").fetchone()["n"]
    typer.echo(f"Still unclassified: {left}")


@app.command("period-data")
def period_data(
    from_: Optional[str] = typer.Option(None, "--from", help="Period start YYYY-MM-DD."),
    to: Optional[str] = typer.Option(None, "--to", help="Period end YYYY-MM-DD."),
    source: Optional[str] = typer.Option(None, help="Source id (default: every enabled source)."),
):
    """Print the edition period's classified emails grouped by project (JSON), for article writing."""
    cfg = _cfg()
    conn = db.connect()
    out = []
    for src in _sources(cfg, source):
        start, end = _date(from_), _date(to)
        if not (start and end):
            ds, de = period.default_period(conn, cfg, src.id)
            start, end = start or ds, end or de
        data = period.period_data(conn, cfg, src.id, start, end)
        path = config.WORK_DIR / f"period-{src.id}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        out.append(data)
    unclassified = conn.execute("SELECT COUNT(*) n FROM emails WHERE processed_at IS NULL AND skip_reason IS NULL").fetchone()["n"]
    if unclassified:
        typer.echo(f"WARNING: {unclassified} emails are not classified yet.", err=True)
    typer.echo(json.dumps(out[0] if len(out) == 1 else out, ensure_ascii=False, indent=1))


@app.command("save-articles")
def save_articles(file: Path):
    """Validate and store Claude Code's articles for an edition."""
    cfg = _cfg()
    conn = db.connect()
    data = _read_json(file)
    try:
        res = store.save_articles(conn, cfg, data)
    except store.ValidationError as e:
        typer.echo(f"REJECTED {file} ({len(e.errors)} problem(s)); nothing was saved. Fix and retry:", err=True)
        for err in e.errors:
            typer.echo(f"  - {err}", err=True)
        raise typer.Exit(1)
    for w in res["warnings"]:
        typer.echo(f"  note: {w}")
    typer.echo(f"Saved {res['articles']} articles to edition id {res['edition_id']}.")


@app.command()
def projects(source: Optional[str] = typer.Option(None, help="Source id.")):
    """List the project registry, including proposed projects, with email counts."""
    cfg = _cfg()
    conn = db.connect()
    for src in _sources(cfg, source):
        reg = Registry.load(src.projects_path)
        counts: dict[str, int] = {}
        latest: dict[str, str] = {}
        for r in conn.execute(
            "SELECT c.project_ids, e.received_at FROM classifications c JOIN emails e ON e.id=c.email_id WHERE e.source_id=?",
            (src.id,),
        ):
            for pid in json.loads(r["project_ids"] or "[]"):
                counts[pid] = counts.get(pid, 0) + 1
                latest[pid] = max(latest.get(pid, ""), r["received_at"])
        typer.echo(f"{src.name} ({src.projects_path.relative_to(config.ROOT)})")
        order = {"active": 0, "proposed": 1, "ignore": 2}
        for p in sorted(reg.projects, key=lambda p: (order[p.status], -counts.get(p.id, 0), p.name)):
            last = config.fmt_short(latest[p.id]) if p.id in latest else "-"
            aliases = f"  aka {', '.join(p.aliases)}" if p.aliases else ""
            n = counts.get(p.id, 0)
            typer.echo(f"  {p.status:8s} {n:3d} {'email ' if n == 1 else 'emails'} last {last:11s} {p.name} [{p.id}]{aliases}")
        if not reg.projects:
            typer.echo("  (no projects yet)")


@app.command("render")
def render_cmd(
    from_: Optional[str] = typer.Option(None, "--from", help="Period start YYYY-MM-DD."),
    to: Optional[str] = typer.Option(None, "--to", help="Period end YYYY-MM-DD."),
    source: Optional[str] = typer.Option(None, help="Source id (default: every enabled source)."),
    open_: bool = typer.Option(False, "--open", help="Open the edition in the default browser."),
):
    """Render the edition HTML, latest.html and the archive index."""
    cfg = _cfg()
    conn = db.connect()
    paths = []
    for src in _sources(cfg, source):
        start, end = _date(from_), _date(to)
        if not (start and end):
            ds, de = period.default_period(conn, cfg, src.id)
            start, end = start or ds, end or de
        p = render.render_edition(conn, cfg, src.id, start, end)
        paths.append(p)
        typer.echo(f"Rendered {p.relative_to(config.ROOT) if p.is_relative_to(config.ROOT) else p}")
    idx = render.render_index(conn, cfg)
    typer.echo(f"Archive: {idx.relative_to(config.ROOT) if idx.is_relative_to(config.ROOT) else idx}")
    if cfg.email_to_self:
        for p in paths:
            _email_to_self(cfg, p)
    if open_ and paths:
        render.open_in_browser(paths[0])


def _email_to_self(cfg, path: Path) -> None:
    from . import gmail_client

    svc = gmail_client.service(cfg)
    me = svc.users().getProfile(userId="me").execute()["emailAddress"]
    msg = MIMEText(path.read_text(encoding="utf-8"), "html", "utf-8")
    msg["To"] = me
    msg["From"] = me
    msg["Subject"] = f"{cfg.title}: {path.stem}"
    svc.users().messages().send(userId="me", body={"raw": base64.urlsafe_b64encode(msg.as_bytes()).decode()}).execute()
    typer.echo(f"Emailed {path.name} to {me}")


@app.command("schedule")
def schedule_cmd(
    action: str = typer.Argument("install", help="install | remove | show"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be installed."),
):
    """Install the weekly Monday 07:00 SAST run (cron or Windows Task Scheduler)."""
    if action == "show":
        typer.echo(schedule.describe())
    elif action == "remove":
        typer.echo(schedule.remove())
    elif action == "install":
        typer.echo(schedule.install(dry_run=dry_run))
    else:
        raise typer.BadParameter("action must be install, remove or show")


@app.command()
def status():
    """Show counts: stored, filtered, classified, pending, editions."""
    cfg = _cfg()
    conn = db.connect()
    for src in cfg.sources:
        q = lambda sql: conn.execute(sql, (src.id,)).fetchone()[0]
        typer.echo(
            f"{src.id}: {q('SELECT COUNT(*) FROM emails WHERE source_id=?')} stored, "
            f"{q('SELECT COUNT(*) FROM emails WHERE source_id=? AND skip_reason IS NOT NULL')} filtered, "
            f"{q('SELECT COUNT(*) FROM emails e JOIN classifications c ON c.email_id=e.id WHERE e.source_id=? AND e.skip_reason IS NULL')} classified, "
            f"{q('SELECT COUNT(*) FROM emails WHERE source_id=? AND processed_at IS NULL AND skip_reason IS NULL')} pending, "
            f"{q('SELECT COUNT(*) FROM editions WHERE source_id=?')} editions; last fetch {db.get_last_fetch(conn, src.id) or 'never'}"
        )


def main():  # pragma: no cover
    app()


if __name__ == "__main__":  # pragma: no cover
    main()
