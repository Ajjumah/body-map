"""Project registry (projects/<source_id>.yaml) with fuzzy matching and discovery."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

import yaml

STATUSES = ("active", "proposed", "ignore")
_STOP = {"project", "projects", "the", "lions", "lion", "club", "sea", "point", "initiative", "programme", "program", "drive", "campaign", "of", "for", "and", "&"}

HEADER = """# Project registry for this source.
# status: active   -> normal articles
#         proposed -> found automatically; shows a "New on the desk" badge until you decide
#         ignore   -> left out of editions (emails are still stored)
# aliases: other names the emails use for the same project.
"""


@dataclass
class Project:
    id: str
    name: str
    aliases: list[str] = field(default_factory=list)
    status: str = "proposed"

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "aliases": list(self.aliases), "status": self.status}


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "project"


def _norm(name: str) -> str:
    words = re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", name.lower()))
    core = [w for w in words if w not in _STOP]
    return " ".join(core or words)


class Registry:
    def __init__(self, path: Path, projects: list[Project] | None = None):
        self.path = path
        self.projects = projects or []

    @classmethod
    def load(cls, path: Path) -> "Registry":
        if not path.exists():
            return cls(path, [])
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        items = raw.get("projects") or []
        projects = [
            Project(
                id=str(p["id"]),
                name=str(p.get("name", p["id"])),
                aliases=[str(a) for a in (p.get("aliases") or [])],
                status=p.get("status", "proposed") if p.get("status") in STATUSES else "proposed",
            )
            for p in items
        ]
        return cls(path, projects)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        body = yaml.safe_dump({"projects": [p.to_dict() for p in self.projects]}, sort_keys=False, allow_unicode=True, width=120)
        self.path.write_text(HEADER + body, encoding="utf-8")

    def get(self, pid: str) -> Project | None:
        return next((p for p in self.projects if p.id == pid), None)

    def match(self, ref: str, threshold: float = 0.86) -> Project | None:
        """Resolve an id, name or alias (exact, normalised, then fuzzy)."""
        if not ref:
            return None
        ref_s = ref.strip()
        for p in self.projects:
            if ref_s == p.id or ref_s.lower() == p.name.lower() or ref_s.lower() in (a.lower() for a in p.aliases):
                return p
        nref = _norm(ref_s)
        if not nref:
            return None
        best, best_score = None, 0.0
        for p in self.projects:
            for cand in [p.name, p.id.replace("-", " "), *p.aliases]:
                nc = _norm(cand)
                if not nc:
                    continue
                if nc == nref:
                    return p
                score = SequenceMatcher(None, nref, nc).ratio()
                # "eye camp" vs "eye screening camp": all words of the shorter contained in the longer
                a, b = set(nref.split()), set(nc.split())
                if min(len(a), len(b)) >= 2 and (a <= b or b <= a):
                    score = max(score, 0.9)
                if score > best_score:
                    best, best_score = p, score
        return best if best_score >= threshold else None

    def resolve_or_propose(self, ref: str) -> tuple[Project, bool]:
        """Return (project, created). New names are added with status 'proposed'."""
        found = self.match(ref)
        if found:
            return found, False
        name = ref.strip()
        if re.fullmatch(r"[a-z0-9-]+", name):
            name = name.replace("-", " ").title()
        pid = base = slugify(name)
        n = 2
        while self.get(pid):
            pid = f"{base}-{n}"
            n += 1
        proj = Project(id=pid, name=name, aliases=[], status="proposed")
        self.projects.append(proj)
        return proj, True

    def as_prompt_list(self) -> list[dict]:
        return [p.to_dict() for p in self.projects]
