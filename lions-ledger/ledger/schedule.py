"""Install the weekly run (Monday 07:00 SAST) with cron or Windows Task Scheduler."""
from __future__ import annotations

import platform
import subprocess
from datetime import date, datetime, time, timedelta

from . import config

MARK = "# lions-ledger weekly edition"
TASK_NAME = "LionsLedgerWeekly"


def local_run_time(hour: int = 7, minute: int = 0) -> tuple[int, int, int]:
    """Monday 07:00 SAST as (weekday 0=Mon, hour, minute) in this machine's local time."""
    d = date.today()
    d += timedelta(days=(7 - d.weekday()) % 7)
    sast = datetime.combine(d, time(hour, minute), tzinfo=config.TZ)
    local = sast.astimezone()  # system local zone
    return local.weekday(), local.hour, local.minute


def cron_line() -> str:
    wd, h, m = local_run_time()
    cron_dow = (wd + 1) % 7  # cron: 0=Sunday, 1=Monday
    script = config.ROOT / "run_edition.sh"
    log = config.ROOT / "data" / "logs" / "scheduled.log"
    return f'{m} {h} * * {cron_dow} "{script}" --scheduled >> "{log}" 2>&1 {MARK}'


def windows_command() -> list[str]:
    wd, h, m = local_run_time()
    day = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][wd]
    bat = config.ROOT / "run_edition.bat"
    return [
        "schtasks", "/Create", "/F", "/SC", "WEEKLY", "/D", day, "/ST", f"{h:02d}:{m:02d}",
        "/TN", TASK_NAME, "/TR", f'"{bat}" --scheduled',
    ]


def describe() -> str:
    system = platform.system()
    if system == "Windows":
        return " ".join(windows_command())
    return cron_line()


def install(dry_run: bool = False) -> str:
    system = platform.system()
    if system == "Windows":
        cmd = windows_command()
        if dry_run:
            return "Would run: " + " ".join(cmd)
        subprocess.run(cmd, check=True)
        return f"Installed Task Scheduler task '{TASK_NAME}': " + " ".join(cmd)
    line = cron_line()
    if dry_run:
        return "Would add to crontab:\n" + line
    existing = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    lines = [l for l in (existing.stdout.splitlines() if existing.returncode == 0 else []) if MARK not in l]
    lines.append(line)
    subprocess.run(["crontab", "-"], input="\n".join(lines) + "\n", text=True, check=True)
    note = ""
    if system == "Darwin":
        note = ("\nmacOS: if the job does not run, give 'cron' Full Disk Access in System Settings > "
                "Privacy & Security, or keep the Mac awake at 07:00 on Mondays.")
    return "Installed crontab entry:\n" + line + note


def remove() -> str:
    if platform.system() == "Windows":
        subprocess.run(["schtasks", "/Delete", "/F", "/TN", TASK_NAME], check=False)
        return f"Removed task '{TASK_NAME}'."
    existing = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    if existing.returncode != 0:
        return "No crontab installed."
    lines = [l for l in existing.stdout.splitlines() if MARK not in l]
    subprocess.run(["crontab", "-"], input="\n".join(lines) + ("\n" if lines else ""), text=True, check=True)
    return "Removed the Lions Ledger crontab entry."
