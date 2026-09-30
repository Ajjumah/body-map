#!/usr/bin/env bash
# One full run: fetch -> Claude Code (/edition) -> render. Safe to run at any time.
# Usage: ./run_edition.sh [--scheduled]
set -uo pipefail
cd "$(dirname "$0")"

# cron has a minimal PATH; add the usual places for claude and a local venv.
export PATH="$PWD/.venv/bin:$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p data/logs
[ "${1:-}" = "--scheduled" ] && export LEDGER_NO_OPEN=1

echo "== $(date '+%Y-%m-%d %H:%M') Lions Ledger run =="
if ! ledger fetch; then
  echo "fetch failed (see data/logs/ledger.log). Continuing with mail already stored."
fi

if command -v claude >/dev/null 2>&1; then
  claude -p "/edition" --permission-mode acceptEdits || echo "Claude Code step failed; rendering what is stored."
else
  echo "claude (Claude Code CLI) not found on PATH; skipping classification and articles."
fi

ledger render
echo "== done =="
