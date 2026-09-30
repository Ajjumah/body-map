"""Store fetched messages (clean, filter, dedupe) and export pending.json for Claude Code."""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone

from . import attachments, config, db
from .clean import body_hash, clean_body, truncate
from .filters import skip_reason
from .gmail_client import RawMessage
from .projects import Registry

log = logging.getLogger("ledger")

BODY_EXPORT_CAP = 8_000
ATTACH_EXPORT_CAP = 15_000
BATCH_SIZE = 20


def store_message(conn, cfg: config.Config, source: config.Source, raw: RawMessage, own_addresses: set[str]) -> str:
    """Clean and insert one message. Returns 'stored', 'skipped:<reason>', or 'exists'."""
    if conn.execute("SELECT 1 FROM emails WHERE id=?", (raw.id,)).fetchone():
        return "exists"

    body = clean_body(raw.text_body, raw.html_body, raw.subject)
    att_texts = []
    for att in raw.attachments:
        t = attachments.extract(att.filename, att.mime_type, att.data)
        if t:
            att_texts.append(t)
    if raw.extra_text:
        att_texts.append(raw.extra_text)
    attachment_text = "\n\n".join(att_texts)

    reason = None
    if "SENT" in raw.label_ids or raw.sender_email in own_addresses:
        reason = "own message"
    elif raw.sender_email in source.exclude_senders:
        reason = "excluded sender"
    else:
        reason = skip_reason(raw.subject, body, raw.headers)
    if not reason and not body and not attachment_text:
        reason = "empty"

    h = body_hash(raw.subject, body + attachment_text[:2000])
    if not reason:
        dup = conn.execute(
            "SELECT id FROM emails WHERE body_hash=? AND source_id=? AND skip_reason IS NULL", (h, source.id)
        ).fetchone()
        if dup:
            reason = f"duplicate of {dup['id']}"

    received = raw.received_at.astimezone(timezone.utc).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO emails(id, thread_id, source_id, received_at, sender_name, sender_email, subject,
           body_clean, attachment_text, gmail_link, processed_at, body_hash, skip_reason, fetched_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            raw.id, raw.thread_id, source.id, received, raw.sender_name, raw.sender_email, raw.subject,
            body, attachment_text, cfg.gmail_link(raw.id), now if reason else None, h, reason, now,
        ),
    )
    if reason:
        # Filtered mail still gets a classification row so everything is accounted for.
        conn.execute(
            """INSERT OR REPLACE INTO classifications(email_id, category, project_ids, importance, needs_action,
               action_summary, action_due, dates_mentioned, people_mentioned, one_line, model, created_at)
               VALUES(?, 'other', '[]', 1, 0, NULL, NULL, '[]', '[]', ?, 'python-filter', ?)""",
            (raw.id, f"Filtered before classification: {reason}.", now),
        )
        return f"skipped:{reason}"
    return "stored"


def reset_for_reprocess(conn, source_id: str, since_iso: str | None) -> int:
    q = "SELECT id FROM emails WHERE source_id=? AND skip_reason IS NULL"
    args = [source_id]
    if since_iso:
        q += " AND received_at >= ?"
        args.append(since_iso)
    ids = [r["id"] for r in conn.execute(q, args)]
    for i in ids:
        conn.execute("DELETE FROM classifications WHERE email_id=?", (i,))
        conn.execute("UPDATE emails SET processed_at=NULL WHERE id=?", (i,))
    return len(ids)


def export_pending(conn, cfg: config.Config) -> dict:
    """Write data/inbox/pending.json plus batch files of ~20 emails. Returns a summary."""
    config.ensure_dirs()
    for old in config.INBOX_DIR.glob("batch-*.json"):
        old.unlink()
    rows = conn.execute(
        "SELECT * FROM emails WHERE processed_at IS NULL AND skip_reason IS NULL ORDER BY source_id, thread_id, received_at"
    ).fetchall()

    registries = {}
    for s in cfg.sources:
        registries[s.id] = Registry.load(s.projects_path).as_prompt_list()

    # Collapse threads: each email carries a pointer to earlier messages in its thread
    # (one-line summaries if already classified) instead of repeating their text.
    by_thread = defaultdict(list)
    for r in rows:
        by_thread[r["thread_id"]].append(r)

    emails = []
    for thread_id, items in by_thread.items():
        earlier = conn.execute(
            """SELECT e.id, e.received_at, e.sender_name, c.one_line FROM emails e
               LEFT JOIN classifications c ON c.email_id=e.id
               WHERE e.thread_id=? AND e.processed_at IS NOT NULL AND e.skip_reason IS NULL ORDER BY e.received_at""",
            (thread_id,),
        ).fetchall()
        context = [
            {"id": e["id"], "date": config.fmt_short(e["received_at"]), "from": e["sender_name"], "summary": e["one_line"]}
            for e in earlier
        ]
        for i, r in enumerate(items):
            emails.append(
                {
                    "id": r["id"],
                    "source_id": r["source_id"],
                    "thread_id": thread_id,
                    "thread_position": f"{len(context) + i + 1} of {len(context) + len(items)}",
                    "earlier_in_thread": context,
                    "received": config.to_date(r["received_at"]).isoformat(),
                    "received_display": config.fmt_date(r["received_at"]),
                    "from": f'{r["sender_name"]} <{r["sender_email"]}>',
                    "subject": r["subject"],
                    "body": truncate(r["body_clean"], BODY_EXPORT_CAP),
                    "attachment_text": truncate(r["attachment_text"], ATTACH_EXPORT_CAP) or None,
                }
            )

    payload = {
        "generated_at": config.now().isoformat(timespec="seconds"),
        "today": config.today().isoformat(),
        "count": len(emails),
        "registries": registries,
        "emails": emails,
    }
    (config.INBOX_DIR / "pending.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    batches = []
    for n, start in enumerate(range(0, len(emails), BATCH_SIZE), 1):
        chunk = emails[start : start + BATCH_SIZE]
        path = config.INBOX_DIR / f"batch-{n:02d}.json"
        path.write_text(
            json.dumps({**payload, "count": len(chunk), "batch": n, "emails": chunk}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        batches.append(path.name)
    return {"pending": len(emails), "batches": batches}
