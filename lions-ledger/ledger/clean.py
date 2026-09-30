"""Turn raw email bodies into clean readable text.

Removes quoted reply chains, signatures, legal disclaimers, mobile sign-offs and
newsletter/notification footers, while keeping the content of forwarded mail
(the club forwards most district news, so the forwarded part is the story).
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

from bs4 import BeautifulSoup

# Invisible characters that newsletters use as preheader padding.
_INVISIBLE = re.compile("[͏​‌‍⁠﻿­  ]")

FORWARD_MARKERS = re.compile(
    r"^\s*(-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,}\s*$(?=[\s\S]*^Subject:))",
    re.I | re.M,
)
FORWARD_HEADER_LINE = re.compile(r"^\s*\*?(From|Date|Sent|Subject|To|Cc|Reply-To)\*?:\s.*$", re.I)

REPLY_CUTS = [
    re.compile(r"^\s*On\s.{5,200}?\bwrote:\s*$", re.I | re.M),
    re.compile(r"^\s*On\s.{5,120}\n.{0,120}\bwrote:\s*$", re.I | re.M),
    re.compile(r"^\s*-{2,}\s*Original Message\s*-{2,}\s*$", re.I | re.M),
    re.compile(r"^\s*_{8,}\s*\n\s*From:\s", re.I | re.M),
    re.compile(r"^\s*From:\s.*\n\s*(Sent|Date):\s.*\n", re.I | re.M),
]

MOBILE_SIGNOFF = re.compile(
    r"^\s*(Sent from my (iPhone|iPad|Android|Samsung|Galaxy|Huawei|mobile|phone)[^\n]*|"
    r"Sent from (Outlook|Mail|Yahoo Mail|Gmail)( for (iOS|Android))?[^\n]*|Get Outlook for (iOS|Android)[^\n]*|"
    r"Sent via .{0,40}(mobile|phone)[^\n]*)\s*$",
    re.I | re.M,
)

DISCLAIMER_HINTS = re.compile(
    r"(disclaimer|this (e-?mail|message) (and any attachments? )?(is|are|may be) (confidential|privileged)|"
    r"intended (solely|only) for the (use of the )?(addressee|recipient|individual)|"
    r"if you (are not|have received this) .{0,40}(intended recipient|in error)|"
    r"POPI(A)? ?Act|protection of personal information act|views expressed .{0,40} are (those|not))",
    re.I,
)

FOOTER_CUTS = [
    re.compile(r"^\s*You received this message because you are subscribed to the Google Groups", re.I | re.M),
    re.compile(r"^\s*Google LLC,? 1600 Amphitheatre", re.I | re.M),
    re.compile(r"^\s*Invitation from Google Calendar", re.I | re.M),
    re.compile(r"^\s*~~//~~\s*$", re.M),
    re.compile(r"^\s*You are receiving this (email|message) because", re.I | re.M),
    re.compile(r"^\s*(To )?unsubscribe (from|at|here)\b", re.I | re.M),
    re.compile(r"^\s*Forwarding this invitation could allow", re.I | re.M),
]

SIGNOFF = re.compile(
    r"^\s*(kind(est)? regards|warm(est)? regards|best regards|regards|many thanks|thanks and regards|"
    r"best wishes|with (lionistic )?greetings|yours (sincerely|faithfully|in lionism)|in service|cheers|"
    r"lion regards|lionistic regards)[,.!]?\s*$",
    re.I | re.M,
)


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "head", "title", "meta", "img"]):
        tag.decompose()
    # Remove quoted reply chains, but keep Gmail's quote block when it holds a forward.
    for q in soup.select(".gmail_quote, blockquote, #appendonsend, #divRplyFwdMsg"):
        if "forwarded message" in q.get_text(" ", strip=True).lower()[:300]:
            continue
        q.decompose()
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for block in soup.find_all(["p", "div", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table"]):
        block.insert_before("\n")
        block.insert_after("\n")
    for li in soup.find_all("li"):
        li.insert(0, "• ")
    for a in soup.find_all("a"):
        href = a.get("href", "")
        text = a.get_text(" ", strip=True)
        if href.startswith("http") and text and text not in href and len(href) < 200 and "unsubscribe" not in href.lower():
            a.replace_with(f"{text} ({href})")
    return soup.get_text()


# Plain-text parts of HTML newsletters: "<https://tracking...>" links and "[image: x]" placeholders.
_BRACKET_URL = re.compile(r"<https?://[^>\s]{60,}>")
_IMAGE_TAG = re.compile(r"\[image:[^\]]*\]", re.I)
_LONG_URL = re.compile(r"https?://\S{120,}")


def normalise_whitespace(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _BRACKET_URL.sub("", text)
    text = _IMAGE_TAG.sub("", text)
    text = _LONG_URL.sub("[link]", text)
    text = _INVISIBLE.sub(" ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_forward_headers(block: str) -> str:
    """Remove the From/Date/Subject/To header lines that open a forwarded message."""
    lines = block.split("\n")
    out, in_header = [], True
    for ln in lines:
        if in_header and (FORWARD_HEADER_LINE.match(ln) or not ln.strip()):
            continue
        in_header = False
        out.append(ln)
    return "\n".join(out)


def _cut_at_first(text: str, patterns) -> str:
    cut = len(text)
    for p in patterns:
        m = p.search(text)
        if m and m.start() < cut:
            cut = m.start()
    return text[:cut]


def _strip_quote_lines(text: str) -> str:
    return "\n".join(ln for ln in text.split("\n") if not ln.lstrip().startswith(">"))


def _strip_signature(text: str) -> str:
    # RFC 3676 signature delimiter
    parts = re.split(r"^-- ?$", text, flags=re.M)
    if len(parts) > 1 and len(parts[-1].strip().split("\n")) <= 12:
        text = "--".join(parts[:-1]) if len(parts) > 2 else parts[0]
    # Sign-off followed by a short block (name, title, phone): keep the sign-off line
    # and the first name line, drop the rest.
    matches = list(SIGNOFF.finditer(text))
    if matches:
        m = matches[-1]
        tail = text[m.end():].strip("\n")
        tail_lines = [ln for ln in tail.split("\n") if ln.strip()]
        if len(tail_lines) <= 10:
            keep = tail_lines[:1]
            text = text[: m.end()] + ("\n" + keep[0] if keep else "")
    return text


def _strip_disclaimers(text: str) -> str:
    paras = text.split("\n\n")
    kept = [p for p in paras if not (DISCLAIMER_HINTS.search(p) and len(p) > 80)]
    return "\n\n".join(kept)


def clean_body(plain: str | None, html: str | None, subject: str = "") -> str:
    """Return a cleaned text body from the plain and/or HTML parts."""
    text = plain or ""
    if (not text.strip() or len(text.strip()) < 20) and html:
        text = html_to_text(html)
    elif html and "<" in text[:50] and ">" in text[:200]:
        text = html_to_text(text)
    text = normalise_whitespace(text)
    if not text:
        return ""

    fwd = FORWARD_MARKERS.search(text)
    if fwd:
        preamble = text[: fwd.start()]
        forwarded = _strip_forward_headers(text[fwd.end():].lstrip("-\n "))
        preamble = _cut_at_first(preamble, REPLY_CUTS)
        forwarded = _cut_at_first(forwarded, REPLY_CUTS + FOOTER_CUTS)
        preamble = _strip_signature(preamble).strip()
        forwarded = _strip_signature(forwarded).strip()
        text = (preamble + "\n\n[Forwarded]\n" + forwarded) if preamble else forwarded
    else:
        text = _cut_at_first(text, REPLY_CUTS + FOOTER_CUTS)
        text = _strip_signature(text)

    text = _strip_quote_lines(text)
    text = MOBILE_SIGNOFF.sub("", text)
    text = _cut_at_first(text, FOOTER_CUTS)
    text = _strip_disclaimers(text)
    return normalise_whitespace(text)


def body_hash(subject: str, body: str) -> str:
    subj = re.sub(r"^\s*((re|fwd?|fw|aw)\s*:\s*)+", "", subject or "", flags=re.I).strip().lower()
    # URLs are ignored: re-shares of the same document carry different share links
    norm = re.sub(r"https?://\S+", " ", (body or "").lower())
    norm = re.sub(r"\W+", " ", norm).strip()[:4000]
    return hashlib.sha256(f"{subj}\n{norm}".encode()).hexdigest()[:24]


def truncate(text: str, limit: int) -> str:
    if text is None or len(text) <= limit:
        return text or ""
    return text[:limit].rsplit(" ", 1)[0] + " …[truncated]"
