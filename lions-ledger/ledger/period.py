"""Period selection and the grouped data Claude Code writes articles from."""
from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta

from . import config, db
from .clean import truncate
from .projects import Registry

EMAIL_BODY_CAP = 6_000
ATTACH_CAP = 12_000


def default_period(conn, cfg: config.Config, source_id: str) -> tuple[date, date]:
    end = config.today()
    last = conn.execute(
        "SELECT period_start, period_end FROM editions WHERE source_id=? ORDER BY period_end DESC LIMIT 1", (source_id,)
    ).fetchone()
    if last:
        last_end = date.fromisoformat(last["period_end"])
        if last_end >= end:
            return date.fromisoformat(last["period_start"]), last_end  # same-day re-run
        return last_end + timedelta(days=1), end  # catches up if runs were missed
    return end - timedelta(days=cfg.first_edition_days - 1), end


def _bounds(start: date, end: date) -> tuple[str, str]:
    s = datetime.combine(start, time.min, tzinfo=config.TZ)
    e = datetime.combine(end + timedelta(days=1), time.min, tzinfo=config.TZ)
    return s.astimezone(config.timezone_utc()).isoformat(), e.astimezone(config.timezone_utc()).isoformat()


def classified_emails(conn, source_id: str, start: date | None = None, end: date | None = None) -> list[dict]:
    q = """SELECT e.*, c.category, c.project_ids, c.importance, c.needs_action, c.action_summary, c.action_due,
                  c.dates_mentioned, c.people_mentioned, c.one_line, c.model
           FROM emails e JOIN classifications c ON c.email_id = e.id
           WHERE e.source_id=? AND e.skip_reason IS NULL"""
    args: list = [source_id]
    if start and end:
        s, e = _bounds(start, end)
        q += " AND e.received_at >= ? AND e.received_at < ?"
        args += [s, e]
    q += " ORDER BY e.received_at"
    return [db.row_to_dict(r) for r in conn.execute(q, args)]


def _email_view(e: dict, full: bool) -> dict:
    v = {
        "id": e["id"],
        "received": config.to_date(e["received_at"]).isoformat(),
        "from": e["sender_name"],
        "subject": e["subject"],
        "category": e["category"],
        "importance": e["importance"],
        "one_line": e["one_line"],
        "needs_action": e["needs_action"],
        "action_summary": e["action_summary"],
        "action_due": e["action_due"],
        "dates_mentioned": e["dates_mentioned"],
        "people_mentioned": e["people_mentioned"],
    }
    if full:
        v["body"] = truncate(e["body_clean"], EMAIL_BODY_CAP)
        if e.get("attachment_text"):
            v["attachment_text"] = truncate(e["attachment_text"], ATTACH_CAP)
    return v


def period_data(conn, cfg: config.Config, source_id: str, start: date, end: date) -> dict:
    source = cfg.source(source_id)
    reg = Registry.load(source.projects_path)
    emails = classified_emails(conn, source_id, start, end)
    projects: dict[str, dict] = {}
    meetings, notices, other = [], [], []
    for e in emails:
        cat = e["category"]
        live_pids = [p for p in e["project_ids"] if (reg.get(p) is None or reg.get(p).status != "ignore")]
        if cat == "meeting_minutes":
            meetings.append(_email_view(e, full=True))
        elif cat in ("notice_social", "notice_bereavement"):
            notices.append(_email_view(e, full=True))
        if live_pids and cat not in ("notice_social", "notice_bereavement"):
            for pid in live_pids:
                p = reg.get(pid)
                g = projects.setdefault(
                    pid,
                    {
                        "project": p.to_dict() if p else {"id": pid, "name": pid, "status": "proposed"},
                        "max_importance": 0,
                        "emails": [],
                    },
                )
                # Minutes get their own Boardroom article, so on their own they only earn a project a
                # "Briefly" line; otherwise one set of minutes would spawn an article per project it mentions.
                weight = min(e["importance"], 2) if cat == "meeting_minutes" else e["importance"]
                g["max_importance"] = max(g["max_importance"], weight)
                g["emails"].append(_email_view(e, full=True))
        elif cat not in ("meeting_minutes", "notice_social", "notice_bereavement"):
            if e["project_ids"] and not live_pids:
                continue  # only touches ignored projects
            other.append(_email_view(e, full=e["importance"] >= 3))

    groups = sorted(projects.values(), key=lambda g: (-g["max_importance"], g["project"]["name"]))
    return {
        "source": {"id": source.id, "name": source.name},
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "period_display": f"{config.fmt_date(start)} to {config.fmt_date(end)}",
        "counts": {"emails": len(emails), "projects": len(groups), "meetings": len(meetings), "notices": len(notices)},
        "guidance": {
            "article_projects": [g["project"]["id"] for g in groups if g["max_importance"] >= 3],
            "briefly_projects": [g["project"]["id"] for g in groups if g["max_importance"] <= 2],
        },
        "projects": groups,
        "meetings": meetings,
        "notices": notices,
        "unassigned": other,
        "needs_your_attention": attention_items(conn, source_id, start, end),
        "dates_for_the_diary": diary(conn, source_id, end),
    }


def attention_items(conn, source_id: str, start: date, end: date) -> list[dict]:
    """needs_action items for the period, plus older ones whose due date has not passed."""
    items = []
    for e in classified_emails(conn, source_id):
        if not e["needs_action"]:
            continue
        received = config.to_date(e["received_at"])
        due = config.to_date(e["action_due"])
        in_period = start <= received <= end
        still_open = due is not None and due >= end and received < start
        if not (in_period or still_open):
            continue
        if due is not None and due < received:
            continue
        items.append(
            {
                "summary": e["action_summary"],
                "due": due.isoformat() if due else None,
                "due_display": config.fmt_short(due) if due else "",
                "email_id": e["id"],
                "link": e["gmail_link"],
                "overdue": bool(due and due < config.today()),
            }
        )
    items.sort(key=lambda x: (x["due"] is None, x["due"] or "", x["summary"]))
    # merge exact duplicates (same action forwarded twice)
    seen, out = set(), []
    for it in items:
        k = (it["due"], re.sub(r"\W+", " ", it["summary"].lower()).strip())
        if k not in seen:
            seen.add(k)
            out.append(it)
    return out


def diary(conn, source_id: str, from_date: date, limit: int = 30) -> list[dict]:
    """Every upcoming date mentioned in any classified email, de-duplicated."""
    entries: dict[tuple, dict] = {}
    for e in classified_emails(conn, source_id):
        for d in e["dates_mentioned"] or []:
            dd = config.to_date(d.get("date"))
            if not dd or dd < from_date:
                continue
            desc = d.get("description", "").strip()
            key_words = frozenset(w for w in re.findall(r"[a-z]{4,}", desc.lower()))
            dup = None
            for (kd, kw), v in entries.items():
                if kd == dd and (kw == key_words or (kw and key_words and len(kw & key_words) / min(len(kw), len(key_words)) >= 0.5)):
                    dup = v
                    break
            if dup:
                if e["id"] not in dup["email_ids"]:
                    dup["email_ids"].append(e["id"])
                if len(desc) < len(dup["description"]):
                    dup["description"] = desc
                continue
            entries[(dd, key_words)] = {
                "date": dd.isoformat(),
                "date_display": config.fmt_short(dd),
                "description": desc,
                "email_ids": [e["id"]],
                "link": e["gmail_link"],
            }
    out = sorted(entries.values(), key=lambda x: (x["date"], x["description"]))
    return out[:limit]
