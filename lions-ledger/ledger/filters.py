"""Cheap, deterministic pre-filters so Claude Code only reads mail that matters."""
from __future__ import annotations

import re

AUTO_REPLY_SUBJECT = re.compile(
    r"^\s*(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|autoreply|away from (the )?office|"
    r"undeliverable|delivery status notification|mail delivery (failed|subsystem)|read:|accepted:|declined:|tentative:)",
    re.I,
)
AUTO_REPLY_BODY = re.compile(
    r"^(i am|i'm|i will be) (currently )?(out of (the )?office|away|on leave)|this is an automatic reply",
    re.I,
)
THANKS_ONLY = re.compile(
    r"^\W*((many |big |huge )?thank(s| you)( so much| very much)?( all| everyone| to all| guys| lions| fellow lions)?|"
    r"noted( with thanks)?|well done( all| everyone)?|received,? thanks?|great,? thanks?|shukran|baie dankie|"
    r"congratulations( all)?|amazing|fantastic|brilliant|wonderful|ok(ay)?,? thanks?)\W*$",
    re.I,
)


def skip_reason(subject: str, body: str, headers: dict | None = None) -> str | None:
    """Return why an email should be skipped, or None to keep it."""
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    if AUTO_REPLY_SUBJECT.search(subject or ""):
        return "auto-reply"
    if headers.get("auto-submitted", "no").lower() not in ("no", ""):
        return "auto-reply"
    if headers.get("x-autoreply") or headers.get("x-autorespond"):
        return "auto-reply"
    text = (body or "").strip()
    if AUTO_REPLY_BODY.search(text[:200]):
        return "auto-reply"
    # "Thanks all" style replies: very short, gratitude only
    short = re.sub(r"\s+", " ", text)
    if len(short) < 140:
        first = re.split(r"(?<=[.!?])\s|\n", text.strip(), maxsplit=1)[0] if text else ""
        rest = text[len(first):].strip()
        if THANKS_ONLY.match(first) and len(rest) < 60 and not re.search(r"\d", short):
            return "thanks-only reply"
    if not text:
        return None  # attachment-only mail is kept; the caller checks attachment text
    return None
