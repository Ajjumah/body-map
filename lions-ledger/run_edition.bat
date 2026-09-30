@echo off
REM One full run: fetch -> Claude Code (/edition) -> render. Safe to run at any time.
REM Usage: run_edition.bat [--scheduled]
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"
if not exist data\logs mkdir data\logs
if "%~1"=="--scheduled" set LEDGER_NO_OPEN=1

echo == %DATE% %TIME% Lions Ledger run ==
ledger fetch
if errorlevel 1 echo fetch failed (see data\logs\ledger.log). Continuing with mail already stored.

where claude >nul 2>nul
if errorlevel 1 (
  echo claude ^(Claude Code CLI^) not found on PATH; skipping classification and articles.
) else (
  claude -p "/edition" --permission-mode acceptEdits
  if errorlevel 1 echo Claude Code step failed; rendering what is stored.
)

ledger render
echo == done ==
endlocal
