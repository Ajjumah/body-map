"""Render editions and the archive index with Jinja2."""
from __future__ import annotations

import os
import re
import shutil
import webbrowser
from datetime import date, datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import config, db, period
from .projects import Registry

TEMPLATES = Path(__file__).parent / "templates"

NOTICE_TITLES = {"birthday": "Birthdays", "bereavement": "In Memoriam", "social": "Socials", "other": "Also noted"}


def _env() -> Environment:
    env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html", "j2"]))
    env.filters["date_long"] = config.fmt_date
    env.filters["date_short"] = config.fmt_short
    env.filters["day_month"] = config.fmt_day_month
    return env


def _email_meta(conn, ids: list[str]) -> list[dict]:
    out = []
    for eid in ids:
        r = conn.execute("SELECT id, sender_name, received_at, subject, gmail_link FROM emails WHERE id=?", (eid,)).fetchone()
        if r:
            out.append(dict(r))
    out.sort(key=lambda r: r["received_at"])
    for r in out:
        r["label"] = source_label(r["subject"])
    return out


def source_label(subject: str, limit: int = 42) -> str:
    """Short, recognisable label for a source link: the subject without Fwd:/Invitation: noise."""
    s = re.sub(r"^\s*((re|fwd?|fw)\s*:\s*)+", "", subject or "", flags=re.I)
    s = re.sub(r"^(Updated invitation with note|Invitation|Notification|Item shared with you):\s*", "", s, flags=re.I)
    s = re.sub(r"\s*@.*$", "", s).strip(' "')
    return s if len(s) <= limit else s[: limit - 1].rsplit(" ", 1)[0] + "…"


def _decorate(conn, a: dict, reg: Registry) -> dict:
    a = db.row_to_dict(a) if not isinstance(a, dict) else a
    sources = _email_meta(conn, a["source_email_ids"])
    a["sources"] = sources
    latest = sources[-1] if sources else None
    a["byline"] = f"From {latest['sender_name']}, {config.fmt_day_month(latest['received_at'])}" if latest else ""
    p = reg.get(a["project_id"]) if a.get("project_id") else None
    a["project_name"] = p.name if p else None
    a["is_new"] = bool(p and p.status == "proposed")
    a["ignored"] = bool(p and p.status == "ignore")
    return a


def render_edition(conn, cfg: config.Config, source_id: str, start: date | None = None, end: date | None = None) -> Path:
    source = cfg.source(source_id)
    reg = Registry.load(source.projects_path)
    if end is None:
        start, end = period.default_period(conn, cfg, source_id)
    ed = conn.execute("SELECT * FROM editions WHERE source_id=? AND period_end=?", (source_id, end.isoformat())).fetchone()
    if not ed:
        num = conn.execute("SELECT COALESCE(MAX(number),0) n FROM editions WHERE source_id=?", (source_id,)).fetchone()["n"] + 1
        cur = conn.execute(
            "INSERT INTO editions(source_id, number, period_start, period_end) VALUES(?,?,?,?)",
            (source_id, num, start.isoformat(), end.isoformat()),
        )
        ed = conn.execute("SELECT * FROM editions WHERE id=?", (cur.lastrowid,)).fetchone()
    start = date.fromisoformat(ed["period_start"])

    arts = [
        _decorate(conn, db.row_to_dict(r), reg)
        for r in conn.execute("SELECT * FROM articles WHERE edition_id=? ORDER BY rank, id", (ed["id"],))
    ]
    arts = [a for a in arts if not a["ignored"]]
    by = lambda s: [a for a in arts if a["section"] == s]
    lead = (by("front") or [None])[0]
    projects = by("project")
    if lead is None and projects:
        lead, projects = projects[0], projects[1:]
    notices: dict[str, list] = {}
    for a in by("notices"):
        notices.setdefault(a["kind"] or "other", []).append(a)
    notice_groups = [(NOTICE_TITLES[k], notices[k]) for k in ("birthday", "bereavement", "social", "other") if k in notices]

    attention = period.attention_items(conn, source_id, start, end)
    diary = period.diary(conn, source_id, end)
    n_emails = len(period.classified_emails(conn, source_id, start, end))

    sections = []
    if projects:
        sections.append(("projects", "Projects"))
    if by("meetings"):
        sections.append(("boardroom", "From the Boardroom"))
    if by("briefly"):
        sections.append(("briefly", "Briefly"))
    if notice_groups:
        sections.append(("notices", "Club Notices"))

    html = _env().get_template("edition.html.j2").render(
        cfg=cfg,
        source=source,
        edition=dict(ed),
        published=end,
        period_start=start,
        period_end=end,
        lead=lead,
        projects=projects,
        meetings=by("meetings"),
        briefly=by("briefly"),
        notice_groups=notice_groups,
        attention=attention,
        diary=diary,
        sections=sections,
        n_emails=n_emails,
        generated=config.now(),
    )
    out_dir = cfg.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{end.isoformat()}-{source_id}.html"
    path.write_text(html, encoding="utf-8")
    shutil.copyfile(path, out_dir / f"latest-{source_id}.html")
    if source_id == cfg.enabled_sources()[0].id:
        shutil.copyfile(path, out_dir / "latest.html")
    conn.execute(
        "UPDATE editions SET html_path=?, published_at=? WHERE id=?",
        (str(path.relative_to(config.ROOT)) if path.is_relative_to(config.ROOT) else str(path),
         datetime.now(timezone.utc).isoformat(), ed["id"]),
    )
    conn.commit()
    return path


def render_index(conn, cfg: config.Config) -> Path:
    rows = conn.execute("SELECT * FROM editions WHERE html_path IS NOT NULL ORDER BY period_end DESC, source_id").fetchall()
    names = {s.id: s.name for s in cfg.sources}
    items = []
    for r in rows:
        lead = conn.execute(
            "SELECT headline FROM articles WHERE edition_id=? AND section IN ('front','project') ORDER BY section='front' DESC, rank LIMIT 1",
            (r["id"],),
        ).fetchone()
        items.append(
            {
                "file": Path(r["html_path"]).name,
                "number": r["number"],
                "source": names.get(r["source_id"], r["source_id"]),
                "period_start": r["period_start"],
                "period_end": r["period_end"],
                "lead": lead["headline"] if lead else None,
            }
        )
    html = _env().get_template("index.html.j2").render(cfg=cfg, items=items, generated=config.now())
    path = cfg.output_dir / "index.html"
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    return path


def open_in_browser(path: Path) -> None:
    if os.environ.get("LEDGER_NO_OPEN"):
        return
    try:
        webbrowser.open(path.resolve().as_uri())
    except Exception:
        pass
