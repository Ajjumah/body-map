---
description: Classify pending club email, write the articles and render this week's Lions Ledger edition.
allowed-tools: Bash(ledger:*), Bash(.venv/bin/ledger:*), Bash(python -m ledger:*), Read, Write(data/work/**), Edit(data/work/**), Glob
---

You are producing an edition of **The Lions Ledger**. Work in this directory. Use `ledger` (or `.venv/bin/ledger`
if `ledger` is not on PATH). Do not call any external API, and do not install anything.

Read these first and follow them exactly:
- `prompts/system.md` (context and house rules)
- `prompts/classify.md` (step 1)
- `prompts/articles.md` (step 3)

## Step 1: classify

1. List `data/inbox/batch-*.json`. If there are none, or `ledger status` shows 0 pending, skip to step 2.
2. For each batch file (about 20 emails each), in order:
   - Read it and classify every email in `emails` per `prompts/classify.md`, using `registries` for project ids.
   - Write the JSON list to `data/work/classifications-NN.json` (NN = the batch number).
   - Run `ledger save-classifications data/work/classifications-NN.json`.
   - If it prints `REJECTED`, fix exactly the listed problems in that file and run it again. Nothing is saved
     until the whole file is valid.
3. Run `ledger status` and confirm 0 pending. If some remain (for example a batch file was stale),
   read `data/inbox/pending.json` for the remaining ids and classify them the same way.

## Step 2: gather the period

Run `ledger period-data` (it also saves `data/work/period-<source_id>.json`; read that file if the output is long).
It prints one object per source (or a list if there are several sources). Use its `period_start` and `period_end`.

## Step 3: write the articles

For each source, write the articles per `prompts/articles.md` to `data/work/articles-<source_id>.json` and run
`ledger save-articles data/work/articles-<source_id>.json`. Fix and retry on `REJECTED`. Warnings are advisory.

If the period has no classified emails, save nothing and go to step 4 (an empty edition still shows the
attention box and diary).

## Step 4: render

Run `ledger render --open`.

## Finish

Reply with at most 8 lines: the edition file, how many emails were classified, new `proposed` projects (so the
reader can mark them `active` or `ignore` in `projects/<source_id>.yaml`), and the items in Needs Your Attention.
