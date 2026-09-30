"""Configuration loading, paths and date helpers."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

TZ = ZoneInfo("Africa/Johannesburg")

ROOT = Path(os.environ.get("LEDGER_HOME", Path(__file__).resolve().parent.parent))
DATA_DIR = ROOT / "data"
INBOX_DIR = DATA_DIR / "inbox"
WORK_DIR = DATA_DIR / "work"
LOG_DIR = DATA_DIR / "logs"
DB_PATH = DATA_DIR / "ledger.db"
PROMPTS_DIR = ROOT / "prompts"
PROJECTS_DIR = ROOT / "projects"
CREDENTIALS_PATH = ROOT / "credentials.json"
TOKEN_PATH = ROOT / "token.json"

DEFAULT_LINK_TEMPLATE = "https://mail.google.com/mail/u/0/#inbox/{id}"


@dataclass
class Source:
    id: str
    name: str
    gmail_query: str
    lookback_days_first_run: int = 60
    enabled: bool = True
    follow_drive_links: bool = False
    exclude_senders: list[str] = field(default_factory=list)

    @property
    def projects_path(self) -> Path:
        return PROJECTS_DIR / f"{self.id}.yaml"


@dataclass
class Config:
    title: str
    tagline: str
    reader_name: str
    sources: list[Source]
    cadence: str = "weekly"
    period_days: int = 7
    first_edition_days: int = 30
    output_dir: Path = ROOT / "editions"
    email_to_self: bool = False
    gmail_link_template: str = DEFAULT_LINK_TEMPLATE
    raw: dict = field(default_factory=dict)

    def source(self, source_id: str | None) -> Source:
        if source_id is None:
            return self.enabled_sources()[0]
        for s in self.sources:
            if s.id == source_id:
                return s
        raise KeyError(f"Unknown source '{source_id}'. Known: {', '.join(s.id for s in self.sources)}")

    def enabled_sources(self) -> list[Source]:
        enabled = [s for s in self.sources if s.enabled]
        if not enabled:
            raise RuntimeError("No enabled sources in config.yaml")
        return enabled

    def gmail_link(self, message_id: str) -> str:
        return self.gmail_link_template.format(id=message_id)


def load_config(path: Path | None = None) -> Config:
    path = path or ROOT / "config.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    pub = raw.get("publication", {})
    ed = raw.get("edition", {})
    sources = [
        Source(
            id=s["id"],
            name=s.get("name", s["id"]),
            gmail_query=s["gmail_query"],
            lookback_days_first_run=int(s.get("lookback_days_first_run", 60)),
            enabled=bool(s.get("enabled", True)),
            follow_drive_links=bool(s.get("follow_drive_links", False)),
            exclude_senders=[x.lower() for x in s.get("exclude_senders", [])],
        )
        for s in raw.get("sources", [])
    ]
    out = ed.get("output_dir", "editions/")
    return Config(
        title=pub.get("title", "The Ledger"),
        tagline=pub.get("tagline", ""),
        reader_name=pub.get("reader_name", ""),
        sources=sources,
        cadence=ed.get("cadence", "weekly"),
        period_days=int(ed.get("period_days", 7)),
        first_edition_days=int(ed.get("first_edition_days", 30)),
        output_dir=(ROOT / out) if not Path(out).is_absolute() else Path(out),
        email_to_self=bool(ed.get("email_to_self", False)),
        gmail_link_template=raw.get("gmail_link_template", DEFAULT_LINK_TEMPLATE),
        raw=raw,
    )


def ensure_dirs() -> None:
    for d in (DATA_DIR, INBOX_DIR, WORK_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)


def setup_logging() -> logging.Logger:
    ensure_dirs()
    logger = logging.getLogger("ledger")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        fh = logging.FileHandler(LOG_DIR / "ledger.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(fh)
    return logger


# ---------- dates ----------

def now() -> datetime:
    return datetime.now(TZ)


def today() -> date:
    return now().date()


def fmt_date(d: date | datetime | str | None) -> str:
    """Wed 30 Sep 2026"""
    d = to_date(d)
    if d is None:
        return ""
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b %Y')}"


def fmt_short(d: date | datetime | str | None) -> str:
    """Wed 30 Sep (the year is added when it is not the current year)"""
    d = to_date(d)
    if d is None:
        return ""
    year = f" {d.year}" if d.year != today().year else ""
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}{year}"


def fmt_day_month(d: date | datetime | str | None) -> str:
    """28 Sep"""
    d = to_date(d)
    if d is None:
        return ""
    return f"{d.day} {d.strftime('%b')}"


def to_date(d) -> date | None:
    if d is None or d == "":
        return None
    if isinstance(d, datetime):
        return d.astimezone(TZ).date() if d.tzinfo else d.date()
    if isinstance(d, date):
        return d
    s = str(d)
    if "T" in s or len(s) > 10:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(TZ).date() if dt.tzinfo else dt.date()
    return date.fromisoformat(s)


def timezone_utc():
    from datetime import timezone

    return timezone.utc
