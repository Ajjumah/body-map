# Classifying emails

Read `prompts/system.md` first. Then, for **each email** in the batch file, produce one JSON object. Output a
single JSON **list** of these objects and save it to `data/work/classifications-NN.json`.

```json
{
  "email_id": "1a0aa864d1777bf8",
  "category": "meeting_minutes",
  "project_ids": ["carepacks", "Sleeping Bags"],
  "importance": 4,
  "needs_action": true,
  "action_summary": "Send corrections to the minutes to the secretary",
  "action_due": "2026-10-05",
  "dates_mentioned": [{"date": "2026-10-05", "description": "Projects meeting, Clubhouse, 19:00"}],
  "people_mentioned": ["Melissa Marcus"],
  "one_line": "Minutes of the 7 Sep projects meeting: carepacks packed on 12 Oct, sleeping bags drive extended."
}
```

## Fields

- **category**, exactly one of:
  - `project_update`: news about a club service project or activity
  - `meeting_minutes`: minutes of a club meeting (in the body or an attachment)
  - `meeting_notice`: agenda, invitation or reminder for a meeting, zoom session or event
  - `notice_social`: birthdays, socials, lunches, congratulations
  - `notice_bereavement`: deaths, condolences, funerals, memorials
  - `admin_finance`: subs, budgets, banking, club admin, surveys, governance, district admin
  - `fundraising_ask`: a request for money or donations (including LCIF appeals)
  - `other`: anything else (general Lions newsletters, thank-you letters with no project)
- **project_ids**: the club projects the email is about. Use an `id` from the registry in the batch file
  (`registries.<source_id>`) when it matches, including via `aliases`. If it is a new project, write its
  **plain name** (e.g. `"Fidget Mats"`); `ledger save-classifications` fuzzy-matches it against the registry and adds
  genuinely new ones as `proposed`. Use a stable, general name for a project ("Carepacks", not "Carepacks October
  packing night"). An email can touch several projects; minutes usually do. Use `[]` for general news that is
  not a club project. District/international programmes the club takes part in (e.g. Lions BrightSight frame
  collection) count as projects; pure newsletters do not.
- **importance** (1-5):
  - **5**: asks Azeem directly, a decision or vote, money owed or requested from him, or a deadline within 14 days
    of the email's date
  - **4**: significant project development, change of date or venue, new commitments
  - **3**: normal progress updates
  - **2**: FYI and routine admin
  - **1**: newsletters he has already seen, auto-replies, "thanks all" replies
- **needs_action**: `true` only if Azeem (as a member) is asked to do something: RSVP, vote, pay, register,
  send, bring, attend a meeting he is expected at, reply with corrections. A general "all welcome" district webinar
  is not an action unless the club asks members to attend.
- **action_summary**: imperative and specific, ≤ 15 words, with the key date: "RSVP for Carepacks packing by Fri 9 Oct".
  `null` when `needs_action` is false.
- **action_due**: `YYYY-MM-DD` or `null`. For a meeting or event, the due date is the event date unless an RSVP date is given.
- **dates_mentioned**: every specific future-relevant date in the email and its attachments, each with a short
  description including time and venue if given (≤ 12 words). Resolve to full `YYYY-MM-DD` dates. Leave out
  dates you cannot pin down.
- **people_mentioned**: names of people who matter to the content (not every recipient).
- **one_line**: one plain sentence (≤ 30 words) saying what the email tells Azeem. Specifics beat adjectives.

## Tips

- Calendar invitations: category `meeting_notice` (or `notice_social` for a lunch/social), put the event in
  `dates_mentioned`, and link it to a project if the event is for one (e.g. "Project: Carepacks").
- Google Drive "Item shared with you" emails for minutes: `meeting_minutes`; if only the link is present, say so
  in `one_line` ("GBM minutes of 22 Sep shared on Drive; content not in the email").
- Superseded dates: if another email (same batch, or `earlier_in_thread`) moves an event, leave the old date out of
  `dates_mentioned` and say it moved in `one_line`, so the diary never shows a cancelled date.
- Duplicates the filter missed: classify normally but give importance 1 and say "Duplicate of …" in `one_line`.
- `thread_position` and `earlier_in_thread` show where an email sits in a conversation; do not repeat what earlier
  messages already said.
