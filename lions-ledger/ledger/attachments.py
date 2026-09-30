"""Extract text from PDF and DOCX attachments."""
from __future__ import annotations

import io
import logging

from .clean import normalise_whitespace, truncate

log = logging.getLogger("ledger")

MAX_CHARS = 15_000

PDF_TYPES = {"application/pdf"}
DOCX_TYPES = {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def kind_of(filename: str, mime: str | None) -> str | None:
    name = (filename or "").lower()
    mime = (mime or "").lower()
    if mime in PDF_TYPES or name.endswith(".pdf"):
        return "pdf"
    if mime in DOCX_TYPES or name.endswith(".docx"):
        return "docx"
    return None


def pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    out = []
    total = 0
    for page in reader.pages:
        t = page.extract_text() or ""
        out.append(t)
        total += len(t)
        if total > MAX_CHARS * 1.2:
            break
    return "\n".join(out)


def docx_text(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs]
    for table in d.tables:
        for row in table.rows:
            cells = []
            for c in row.cells:
                if c.text not in cells:
                    cells.append(c.text)
            parts.append(" | ".join(cells))
    return "\n".join(parts)


def extract(filename: str, mime: str | None, data: bytes) -> str:
    """Return capped text for a supported attachment, or '' (never raises)."""
    k = kind_of(filename, mime)
    if not k or not data:
        return ""
    try:
        text = pdf_text(data) if k == "pdf" else docx_text(data)
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException as exc:  # corrupt/encrypted files (or a crashing parser) must not kill the run
        log.warning("Could not read attachment %s: %s", filename, exc)
        return ""
    text = normalise_whitespace(text)
    if not text:
        return ""
    return f"=== Attachment: {filename} ===\n" + truncate(text, MAX_CHARS)
