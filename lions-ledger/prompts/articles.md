# Writing the edition

Read `prompts/system.md` first. Input: the JSON printed by `ledger period-data` (also saved at
`data/work/period-<source_id>.json`). Output: one JSON object saved to `data/work/articles-<source_id>.json`:

```json
{
  "source_id": "seapoint-lions",
  "period_start": "2026-09-01",
  "period_end": "2026-09-30",
  "articles": [
    {
      "section": "front",
      "project_id": "carepacks",
      "headline": "Carepacks packing night set for Mon 12 Oct",
      "standfirst": "The club will pack carepacks an hour before the October projects meeting.",
      "body": "First paragraph with the most important fact.\n\nSecond paragraph…",
      "what_it_means": "Put 12 Oct, 18:00 in your diary and bring items on the list.",
      "source_email_ids": ["1a0ca918b43c9853"],
      "rank": 1
    }
  ]
}
```

`body` is plain text: paragraphs separated by a blank line, `**bold**` allowed, lines starting with `- ` become a
list. (Alternatively `body_html` with only `<p> <strong> <em> <ul> <li> <a>`.)

## Sections

1. **project**: one article per project listed in `guidance.article_projects` (any email at importance ≥ 3;
   minutes count as 2 here because they get their own Boardroom article), written from **all** of that
   project's emails in the period, including what the minutes say about it.
   - `headline`: **at most 10 words**, active voice, specific. "Eye camp moves to 17 October at Sea Point Civic
     Centre", never "Eye Screening Update".
   - `standfirst`: one sentence.
   - `body`: **80–250 words**, inverted pyramid: the most important fact first, then detail, then background.
   - Keep specifics: names, dates, venues, amounts in **R**, quantities.
   - `what_it_means`: a single line, **only** if there is an action or decision for Azeem; otherwise omit it.
   - `project_id`: the registry id. `source_email_ids`: **every** email the article draws on.
2. **front**: the lead story. Pick the most important article (highest importance; prefer ones with a decision,
   deadline or money for Azeem) and give it `section: "front"` **instead of** `project`. Exactly one.
   It may run to the top of the word range. The "Needs Your Attention" box and "Dates for the Diary" are built
   automatically from the classifications; do not write them.
3. **meetings**: one article per set of minutes (`meetings` in the input). Cover **decisions made**, **actions with
   owners**, and the **next meeting date**. No attendance or apologies lists. Headline ≤ 10 words, standfirst,
   body up to 250 words (a short list of decisions/actions is fine). If only a Drive link was shared and the minutes
   themselves are not in the data, write one line in `briefly` instead ("GBM minutes of 22 Sep are on Drive").
4. **briefly**: one line each (`headline` = 2–5 word label, `body` = one sentence) for projects in
   `guidance.briefly_projects`, and for `unassigned` items worth knowing (district news, surveys, webinars, admin).
   Skip importance-1 items entirely.
5. **notices**: one short line each for social, birthday and bereavement items, with `kind` set to `birthday`,
   `bereavement`, `social` or `other`. Bereavements: plain, respectful tone; include funeral or memorial details
   (date, time, place) when given. No jokes, no exclamation marks.

Rules that `ledger save-articles` enforces: every article lists `source_email_ids` that exist; headlines of
front/project/meetings articles ≤ 10 words; bodies ≤ 250 words; exactly zero or one `front`. If it rejects the file,
read the errors, fix the JSON and save again.

## Accuracy check before saving

For each article, re-read the source emails and confirm every name, date, venue and amount appears in them.
Remove anything you cannot trace. Mark uncertainty explicitly. Do not merge two different events into one.
Use `rank` to order articles within a section (1 = first).
