"""Gmail API access (read-only) and MIME parsing."""
from __future__ import annotations

import base64
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from email.utils import getaddresses, parseaddr, parsedate_to_datetime
from datetime import datetime, timezone

from . import config

log = logging.getLogger("ledger")

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


@dataclass
class Attachment:
    filename: str
    mime_type: str
    data: bytes = b""
    attachment_id: str | None = None


@dataclass
class RawMessage:
    """A source-neutral email, produced by the Gmail API client or the JSON importer."""

    id: str
    thread_id: str
    received_at: datetime
    sender_name: str
    sender_email: str
    subject: str
    text_body: str = ""
    html_body: str = ""
    attachments: list[Attachment] = field(default_factory=list)
    headers: dict = field(default_factory=dict)
    label_ids: list[str] = field(default_factory=list)
    extra_text: str = ""  # e.g. text of linked Drive documents


def scopes_for(cfg: config.Config) -> list[str]:
    scopes = list(SCOPES)
    if any(s.follow_drive_links for s in cfg.sources if s.enabled):
        scopes.append(DRIVE_SCOPE)
    if cfg.email_to_self:
        scopes.append(SEND_SCOPE)
    return scopes


def get_credentials(cfg: config.Config, interactive: bool = False):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    scopes = scopes_for(cfg)
    creds = None
    if config.TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(config.TOKEN_PATH), scopes)
        if creds and not set(scopes).issubset(set(creds.scopes or [])):
            creds = None  # scopes changed (e.g. Drive links turned on): re-consent
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            config.TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
            return creds
        except Exception as exc:
            log.warning("Token refresh failed: %s", exc)
    if not interactive:
        raise RuntimeError("Not signed in to Gmail (or token expired). Run: ledger auth")
    if not config.CREDENTIALS_PATH.exists():
        raise RuntimeError(
            f"Missing {config.CREDENTIALS_PATH}. Download the OAuth client file from Google Cloud "
            "(see README, 'One-off Google setup') and save it there."
        )
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(str(config.CREDENTIALS_PATH), scopes)
    creds = flow.run_local_server(port=0, prompt="consent", open_browser=True)
    config.TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    return creds


def service(cfg: config.Config, interactive: bool = False):
    from googleapiclient.discovery import build

    return build("gmail", "v1", credentials=get_credentials(cfg, interactive), cache_discovery=False)


def drive_service(cfg: config.Config):
    from googleapiclient.discovery import build

    return build("drive", "v3", credentials=get_credentials(cfg), cache_discovery=False)


def list_message_ids(svc, query: str, max_results: int | None = None) -> list[str]:
    ids, token = [], None
    while True:
        resp = svc.users().messages().list(userId="me", q=query, pageToken=token, maxResults=500).execute()
        ids.extend(m["id"] for m in resp.get("messages", []))
        token = resp.get("nextPageToken")
        if not token or (max_results and len(ids) >= max_results):
            break
    return ids[:max_results] if max_results else ids


def _b64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _walk(part, out_text, out_html, attachments):
    mime = part.get("mimeType", "")
    body = part.get("body", {})
    filename = part.get("filename") or ""
    if filename:
        attachments.append(Attachment(filename, mime, _b64(body["data"]) if body.get("data") else b"", body.get("attachmentId")))
        return
    if mime == "text/plain" and body.get("data"):
        out_text.append(_b64(body["data"]).decode("utf-8", errors="replace"))
    elif mime == "text/html" and body.get("data"):
        out_html.append(_b64(body["data"]).decode("utf-8", errors="replace"))
    for p in part.get("parts", []) or []:
        _walk(p, out_text, out_html, attachments)


def parse_message(msg: dict) -> RawMessage:
    payload = msg.get("payload", {})
    headers = {h["name"]: h["value"] for h in payload.get("headers", [])}
    name, addr = parseaddr(headers.get("From", ""))
    try:
        received = parsedate_to_datetime(headers["Date"])
    except Exception:
        received = datetime.fromtimestamp(int(msg.get("internalDate", "0")) / 1000, tz=timezone.utc)
    # internalDate is when Gmail received it, which is what we want for ordering
    if msg.get("internalDate"):
        received = datetime.fromtimestamp(int(msg["internalDate"]) / 1000, tz=timezone.utc)
    texts, htmls, atts = [], [], []
    _walk(payload, texts, htmls, atts)
    return RawMessage(
        id=msg["id"],
        thread_id=msg.get("threadId", msg["id"]),
        received_at=received,
        sender_name=name or addr,
        sender_email=addr.lower(),
        subject=headers.get("Subject", "(no subject)"),
        text_body="\n".join(texts),
        html_body="\n".join(htmls),
        attachments=atts,
        headers=headers,
        label_ids=msg.get("labelIds", []),
    )


def fetch_message(svc, msg_id: str, want_attachment=lambda a: True) -> RawMessage:
    msg = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
    raw = parse_message(msg)
    for att in raw.attachments:
        if not att.data and att.attachment_id and want_attachment(att):
            resp = svc.users().messages().attachments().get(userId="me", messageId=msg_id, id=att.attachment_id).execute()
            att.data = _b64(resp.get("data", ""))
    return raw


DRIVE_LINK = re.compile(r"https://(?:docs|drive)\.google\.com/(?:document|file|spreadsheets|presentation)/d/([A-Za-z0-9_-]{20,})")


def drive_ids_in(text: str) -> list[str]:
    seen = []
    for m in DRIVE_LINK.finditer(text or ""):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


def fetch_drive_text(drive, file_id: str) -> tuple[str, str]:
    """Return (name, text) for a Google Doc or PDF/DOCX file in Drive."""
    from . import attachments

    meta = drive.files().get(fileId=file_id, fields="name,mimeType").execute()
    name, mime = meta.get("name", file_id), meta.get("mimeType", "")
    if mime == "application/vnd.google-apps.document":
        data = drive.files().export(fileId=file_id, mimeType="text/plain").execute()
        text = data.decode("utf-8", errors="replace") if isinstance(data, bytes) else str(data)
        from .clean import normalise_whitespace, truncate

        return name, f"=== Linked document: {name} ===\n" + truncate(normalise_whitespace(text), attachments.MAX_CHARS)
    if attachments.kind_of(name, mime):
        data = drive.files().get_media(fileId=file_id).execute()
        return name, attachments.extract(name, mime, data).replace("=== Attachment:", "=== Linked document:")
    return name, ""


def discover(svc, query: str, limit: int = 300) -> dict:
    """Summarise senders, subjects and labels for a broad search."""
    ids = list_message_ids(svc, query, max_results=limit)
    senders, subjects, labels = Counter(), Counter(), Counter()
    label_names = {l["id"]: l["name"] for l in svc.users().labels().list(userId="me").execute().get("labels", [])}
    for mid in ids:
        try:
            m = svc.users().messages().get(
                userId="me", id=mid, format="metadata", metadataHeaders=["From", "Subject", "List-Id"]
            ).execute()
        except Exception as exc:
            log.warning("discover: skip %s: %s", mid, exc)
            continue
        h = {x["name"]: x["value"] for x in m.get("payload", {}).get("headers", [])}
        senders[h.get("From", "?")] += 1
        subj = re.sub(r"^\s*((re|fwd?|fw)\s*:\s*)+", "", h.get("Subject", ""), flags=re.I)
        subjects[re.sub(r"\d", "#", subj)[:70]] += 1
        for lid in m.get("labelIds", []):
            labels[label_names.get(lid, lid)] += 1
        if h.get("List-Id"):
            labels["list:" + h["List-Id"]] += 1
    return {"total": len(ids), "senders": senders.most_common(25), "subjects": subjects.most_common(25), "labels": labels.most_common(20)}


def recipients(headers: dict) -> list[str]:
    vals = [headers.get(k, "") for k in ("To", "Cc")]
    return [a.lower() for _, a in getaddresses(vals) if a]
