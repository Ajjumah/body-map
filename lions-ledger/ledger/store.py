"""Validate and store what Claude Code produces (classifications and articles)."""
from __future__ import annotations

import html
import json
import re
from datetime import date, datetime, timezone

from bs4 import BeautifulSoup

from . import config
from .projects import Registry

CATEGORIES = (
    "project_update", "meeting_minutes", "meeting_notice", "notice_social",
    "notice_bereavement", "admin_finance", "fundraising_ask", "other",
)
SECTIONS = ("front", "project", "meetings", "briefly", "notices")
NOTICE_KINDS = ("birthday", "bereavement", "social", "other")
BULLET = re.compile(r"^\s*[-•*]\s+")
ALLOWED_TAGS = {"p", "strong", "em", "b", "i", "ul", "ol", "li", "a", "br"}


class ValidationError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("\n".join(errors))
        self.errors = errors


def _load_list(data, key: str) -> list:
    if isinstance(data, dict):
        data = data.get(key, data.get("items"))
    if not isinstance(data, list):
        raise ValidationError([f"Expected a JSON list (or an object with a '{key}' list)."])
    return data


def _iso_date(v, where: str, errors: list[str], required=False):
    if v in (None, ""):
        if required:
            errors.append(f"{where}: date is required (YYYY-MM-DD)")
        return None
    try:
        return date.fromisoformat(str(v)).isoformat()
    except ValueError:
        errors.append(f"{where}: '{v}' is not a YYYY-MM-DD date")
        return None


# ---------------- classifications ----------------

def validate_classifications(conn, data) -> list[dict]:
    items = _load_list(data, "classifications")
    errors, clean = [], []
    seen = set()
    for i, it in enumerate(items):
        w = f"item {i}"
        if not isinstance(it, dict):
            errors.append(f"{w}: must be an object")
            continue
        eid = it.get("email_id")
        w = f"item {i} ({eid})"
        row = conn.execute("SELECT source_id FROM emails WHERE id=?", (eid,)).fetchone() if eid else None
        if not row:
            errors.append(f"{w}: email_id not found in the database")
            continue
        if eid in seen:
            errors.append(f"{w}: duplicate email_id in this file")
        seen.add(eid)
        cat = it.get("category")
        if cat not in CATEGORIES:
            errors.append(f"{w}: category '{cat}' must be one of {', '.join(CATEGORIES)}")
        pids = it.get("project_ids", [])
        if not isinstance(pids, list) or not all(isinstance(p, str) and p.strip() for p in pids):
            errors.append(f"{w}: project_ids must be a list of project ids or names")
            pids = []
        imp = it.get("importance")
        if not isinstance(imp, int) or isinstance(imp, bool) or not 1 <= imp <= 5:
            errors.append(f"{w}: importance must be an integer 1-5")
        na = it.get("needs_action")
        if not isinstance(na, bool):
            errors.append(f"{w}: needs_action must be true or false")
        summ = it.get("action_summary")
        if na is True and not (isinstance(summ, str) and summ.strip()):
            errors.append(f"{w}: action_summary is required when needs_action is true")
        if na is False:
            summ = None
        due = _iso_date(it.get("action_due"), f"{w} action_due", errors) if na else None
        dates = []
        for j, d in enumerate(it.get("dates_mentioned") or []):
            if not isinstance(d, dict) or not d.get("description"):
                errors.append(f"{w}: dates_mentioned[{j}] needs {{date, description}}")
                continue
            iso = _iso_date(d.get("date"), f"{w} dates_mentioned[{j}]", errors, required=True)
            if iso:
                dates.append({"date": iso, "description": str(d["description"]).strip()})
        people = it.get("people_mentioned") or []
        if not isinstance(people, list) or not all(isinstance(p, str) for p in people):
            errors.append(f"{w}: people_mentioned must be a list of names")
            people = []
        one = it.get("one_line")
        if not isinstance(one, str) or not one.strip():
            errors.append(f"{w}: one_line summary is required")
        clean.append(
            {
                "email_id": eid, "source_id": row["source_id"], "category": cat, "project_refs": pids,
                "importance": imp, "needs_action": bool(na), "action_summary": summ, "action_due": due,
                "dates_mentioned": dates, "people_mentioned": people, "one_line": (one or "").strip(),
            }
        )
    if errors:
        raise ValidationError(errors)
    return clean


def save_classifications(conn, cfg: config.Config, data, model: str = "claude-code") -> dict:
    items = validate_classifications(conn, data)
    registries: dict[str, Registry] = {}
    created, now = [], datetime.now(timezone.utc).isoformat()
    for it in items:
        reg = registries.setdefault(it["source_id"], Registry.load(cfg.source(it["source_id"]).projects_path))
        pids = []
        for ref in it["project_refs"]:
            proj, new = reg.resolve_or_propose(ref)
            if new:
                created.append(f"{proj.name} ({proj.id})")
            if proj.id not in pids:
                pids.append(proj.id)
        conn.execute(
            """INSERT OR REPLACE INTO classifications(email_id, category, project_ids, importance, needs_action,
               action_summary, action_due, dates_mentioned, people_mentioned, one_line, model, created_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                it["email_id"], it["category"], json.dumps(pids), it["importance"], int(it["needs_action"]),
                it["action_summary"], it["action_due"], json.dumps(it["dates_mentioned"], ensure_ascii=False),
                json.dumps(it["people_mentioned"], ensure_ascii=False), it["one_line"], model, now,
            ),
        )
        conn.execute("UPDATE emails SET processed_at=? WHERE id=?", (now, it["email_id"]))
    for reg in registries.values():
        reg.save()
    conn.commit()
    return {"saved": len(items), "new_projects": created}


# ---------------- articles ----------------

def sanitise_html(fragment: str) -> str:
    soup = BeautifulSoup(fragment, "html.parser")
    for tag in soup.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
            continue
        href = tag.get("href") if tag.name == "a" else None
        tag.attrs = {}
        if href and re.match(r"^(https?:|mailto:)", href):
            tag.attrs = {"href": href, "rel": "noopener", "target": "_blank"}
    return str(soup).strip()


def text_to_html(text: str) -> str:
    """Plain text with blank-line paragraphs and **bold** / *italic* to safe HTML."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    out = []
    for p in paras:
        lines = p.split("\n")
        if all(BULLET.match(ln) for ln in lines):
            items = "".join("<li>" + _inline(BULLET.sub("", ln)) + "</li>" for ln in lines)
            out.append(f"<ul>{items}</ul>")
        else:
            out.append(f"<p>{_inline(' '.join(lines))}</p>")
    return "".join(out)


def _inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", s)
    return s


def word_count(html_or_text: str) -> int:
    return len(BeautifulSoup(html_or_text or "", "html.parser").get_text(" ").split())


def validate_articles(conn, cfg: config.Config, data) -> tuple[dict, list[str]]:
    if not isinstance(data, dict):
        raise ValidationError(["Expected an object: {source_id, period_start, period_end, articles: [...]}"])
    errors, warnings = [], []
    source_id = data.get("source_id") or cfg.enabled_sources()[0].id
    try:
        source = cfg.source(source_id)
    except KeyError as e:
        raise ValidationError([str(e)])
    ps = _iso_date(data.get("period_start"), "period_start", errors, required=True)
    pe = _iso_date(data.get("period_end"), "period_end", errors, required=True)
    reg = Registry.load(source.projects_path)
    items = data.get("articles")
    if not isinstance(items, list) or not items:
        errors.append("articles must be a non-empty list")
        items = []
    clean = []
    fronts = 0
    for i, a in enumerate(items):
        w = f"article {i} ({(a or {}).get('headline', '')[:40]!r})" if isinstance(a, dict) else f"article {i}"
        if not isinstance(a, dict):
            errors.append(f"{w}: must be an object")
            continue
        sec = a.get("section")
        if sec not in SECTIONS:
            errors.append(f"{w}: section must be one of {', '.join(SECTIONS)}")
            continue
        fronts += sec == "front"
        headline = (a.get("headline") or "").strip()
        standfirst = (a.get("standfirst") or "").strip()
        body_raw = a.get("body_html") or a.get("body") or ""
        body = sanitise_html(body_raw) if a.get("body_html") else text_to_html(body_raw)
        ids = a.get("source_email_ids")
        if not isinstance(ids, list) or not ids:
            errors.append(f"{w}: source_email_ids must list at least one email id (every fact must trace to a source)")
            ids = []
        for eid in ids:
            if not conn.execute("SELECT 1 FROM emails WHERE id=? AND source_id=?", (eid, source.id)).fetchone():
                errors.append(f"{w}: source email '{eid}' not found for source {source.id}")
        pid = a.get("project_id")
        if pid:
            p = reg.match(pid)
            if not p:
                errors.append(f"{w}: project_id '{pid}' is not in the registry (classify first so it gets registered)")
            else:
                pid = p.id
        kind = a.get("kind")
        if sec in ("front", "project", "meetings"):
            if not headline:
                errors.append(f"{w}: headline is required")
            elif len(headline.split()) > 10:
                errors.append(f"{w}: headline has {len(headline.split())} words; the limit is 10")
            if not standfirst:
                errors.append(f"{w}: standfirst (one sentence) is required")
            wc = word_count(body)
            if wc > 250:
                errors.append(f"{w}: body is {wc} words; the limit is 250")
            elif wc < 80 and sec != "meetings":
                warnings.append(f"{w}: body is {wc} words (target 80-250); fine if the emails hold no more")
            elif wc == 0:
                errors.append(f"{w}: body is empty")
        else:
            if not (headline or body):
                errors.append(f"{w}: a {sec} item needs a headline or a one-line body")
            if sec == "notices" and kind not in NOTICE_KINDS:
                errors.append(f"{w}: notices need kind: {', '.join(NOTICE_KINDS)}")
        wim = (a.get("what_it_means") or "").strip() or None
        if wim and wim.lower().startswith("what it means for you:"):
            wim = wim.split(":", 1)[1].strip()
        clean.append(
            {
                "section": sec, "kind": kind, "project_id": pid, "headline": headline, "standfirst": standfirst,
                "body_html": body, "what_it_means": wim, "source_email_ids": ids,
                "rank": int(a.get("rank") or (i + 1)),
            }
        )
    if fronts > 1:
        errors.append("only one article may have section 'front' (the lead story)")
    if errors:
        raise ValidationError(errors)
    return {"source_id": source.id, "period_start": ps, "period_end": pe, "articles": clean}, warnings


def save_articles(conn, cfg: config.Config, data) -> dict:
    parsed, warnings = validate_articles(conn, cfg, data)
    sid, ps, pe = parsed["source_id"], parsed["period_start"], parsed["period_end"]
    ed = conn.execute("SELECT id, number FROM editions WHERE source_id=? AND period_end=?", (sid, pe)).fetchone()
    if ed:
        edition_id = ed["id"]
        conn.execute("UPDATE editions SET period_start=? WHERE id=?", (ps, edition_id))
        conn.execute("DELETE FROM articles WHERE edition_id=?", (edition_id,))
    else:
        num = (conn.execute("SELECT COALESCE(MAX(number), 0) n FROM editions WHERE source_id=?", (sid,)).fetchone()["n"]) + 1
        cur = conn.execute(
            "INSERT INTO editions(source_id, number, period_start, period_end) VALUES(?,?,?,?)", (sid, num, ps, pe)
        )
        edition_id = cur.lastrowid
    for a in parsed["articles"]:
        conn.execute(
            """INSERT INTO articles(edition_id, section, kind, project_id, headline, standfirst, body_html,
               what_it_means, source_email_ids, rank) VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                edition_id, a["section"], a["kind"], a["project_id"], a["headline"], a["standfirst"], a["body_html"],
                a["what_it_means"], json.dumps(a["source_email_ids"]), a["rank"],
            ),
        )
    conn.commit()
    return {"edition_id": edition_id, "articles": len(parsed["articles"]), "warnings": warnings}
