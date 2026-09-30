import base64
import io
import json
from datetime import date, datetime, timedelta, timezone

import pytest


@pytest.fixture()
def home(tmp_path, monkeypatch):
    """An isolated LEDGER_HOME with config, prompts and an empty registry."""
    (tmp_path / "projects").mkdir()
    (tmp_path / "config.yaml").write_text(
        """
publication: {title: "The Lions Ledger", tagline: "News from Sea Point Lions Club", reader_name: "Azeem"}
sources:
  - {id: seapoint-lions, name: "Sea Point Lions Club", gmail_query: "from:x", lookback_days_first_run: 60, enabled: true}
edition: {period_days: 7, first_edition_days: 30, output_dir: "editions/"}
""",
        encoding="utf-8",
    )
    (tmp_path / "projects" / "seapoint-lions.yaml").write_text(
        "projects:\n  - {id: eye-screening, name: Eye Screening, aliases: [vision, spectacles, eye camp], status: active}\n",
        encoding="utf-8",
    )
    import importlib

    from ledger import config

    monkeypatch.setenv("LEDGER_HOME", str(tmp_path))
    importlib.reload(config)
    for mod in ("db", "ingest", "store", "period", "render", "cli", "schedule", "gmail_client"):
        importlib.reload(importlib.import_module(f"ledger.{mod}"))
    yield tmp_path
    monkeypatch.delenv("LEDGER_HOME")
    importlib.reload(config)


# ---------------- cleaning ----------------

def test_clean_strips_reply_chain_signature_and_iphone():
    from ledger.clean import clean_body

    plain = """Hi all,

The eye camp moves to Sat 17 Oct at the Sea Point Civic Centre.

Kind regards,
Jane Smith
Secretary
082 555 1234

Sent from my iPhone

On Mon, 28 Sep 2026 at 10:00, Bob <bob@example.com> wrote:
> Old text that should vanish
> more old text
"""
    out = clean_body(plain, None)
    assert "17 Oct" in out
    assert "Old text" not in out
    assert "iPhone" not in out
    assert "082 555" not in out
    assert "Jane Smith" in out


def test_clean_keeps_forwarded_content_and_drops_headers():
    from ledger.clean import clean_body

    plain = """Please note.

---------- Forwarded message ---------
From: District Office <d@lions.org>
Date: Tue, 15 Sep 2026
Subject: Convention survey
To: <club@x.org>

Please complete the convention survey by 30 September.

This email and any attachments are confidential and intended solely for the use of the addressee. If you are not the intended recipient please delete it.
"""
    out = clean_body(plain, None)
    assert "convention survey by 30 September" in out
    assert "From: District" not in out
    assert "confidential" not in out
    assert out.startswith("Please note.")


def test_clean_html_only_email():
    from ledger.clean import clean_body

    html = "<html><style>p{}</style><body><p>Braai at the <b>clubhouse</b> on Sat 3 Oct.</p><div class='gmail_quote'>On Mon wrote: old</div></body></html>"
    out = clean_body("", html)
    assert "Braai at the clubhouse on Sat 3 Oct." in out
    assert "old" not in out


def test_filters():
    from ledger.filters import skip_reason

    assert skip_reason("Automatic reply: Minutes", "I am out of the office") == "auto-reply"
    assert skip_reason("Re: Minutes", "Thanks all!") == "thanks-only reply"
    assert skip_reason("Re: Minutes", "Thanks all, I will bring 20 blankets on Saturday.") is None
    assert skip_reason("Budget", "Please approve the R5 000 budget.") is None


# ---------------- attachments ----------------

def _minimal_pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % i + o + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1))
    for off in offsets:
        out.write(b"%010d 00000 n \n" % off)
    out.write(b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref))
    return out.getvalue()


def test_attachment_extraction_pdf_docx_and_bad_file():
    import docx

    from ledger import attachments

    pdf = attachments.extract("minutes.pdf", "application/pdf", _minimal_pdf("Resolved to buy 40 blankets"))
    assert "Resolved to buy 40 blankets" in pdf
    d = docx.Document()
    d.add_paragraph("Treasurer reported R12 000 in the bank.")
    buf = io.BytesIO()
    d.save(buf)
    t = attachments.extract("report.docx", None, buf.getvalue())
    assert "R12 000" in t
    assert attachments.extract("broken.pdf", "application/pdf", b"not a pdf") == ""
    assert attachments.extract("photo.jpg", "image/jpeg", b"xx") == ""


# ---------------- projects ----------------

def test_registry_fuzzy_match_and_propose(tmp_path):
    from ledger.projects import Registry

    reg = Registry.load(tmp_path / "p.yaml")
    reg.projects.clear()
    p, new = reg.resolve_or_propose("Fidget Mats")
    assert new and p.status == "proposed" and p.id == "fidget-mats"
    p2, new2 = reg.resolve_or_propose("fidget mats project")
    assert not new2 and p2.id == "fidget-mats"
    p3, new3 = reg.resolve_or_propose("Fidget Mat")
    assert not new3
    p4, new4 = reg.resolve_or_propose("Carepacks")
    assert new4
    reg.save()
    again = Registry.load(tmp_path / "p.yaml")
    assert [x.id for x in again.projects] == ["fidget-mats", "carepacks"]


# ---------------- gmail parsing ----------------

def test_parse_gmail_message():
    from ledger.gmail_client import parse_message

    enc = lambda s: base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")
    msg = {
        "id": "abc", "threadId": "t1", "internalDate": "1790000000000", "labelIds": ["INBOX"],
        "payload": {
            "mimeType": "multipart/mixed",
            "headers": [{"name": "From", "value": "Sea Point Lions Club <lions.club.sea.point@gmail.com>"},
                        {"name": "Subject", "value": "MINUTES"}, {"name": "Date", "value": "Tue, 22 Sep 2026 20:00:00 +0200"}],
            "parts": [
                {"mimeType": "multipart/alternative", "parts": [
                    {"mimeType": "text/plain", "body": {"data": enc("Plain body")}},
                    {"mimeType": "text/html", "body": {"data": enc("<p>Html body</p>")}},
                ]},
                {"mimeType": "application/pdf", "filename": "m.pdf", "body": {"attachmentId": "att1", "size": 10}},
            ],
        },
    }
    r = parse_message(msg)
    assert r.sender_email == "lions.club.sea.point@gmail.com"
    assert r.sender_name == "Sea Point Lions Club"
    assert r.text_body == "Plain body" and "Html body" in r.html_body
    assert r.attachments[0].attachment_id == "att1"


# ---------------- end to end ----------------

def _msgs(today):
    d = lambda n: (datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=n) + timedelta(hours=10)).isoformat()
    return [
        {"id": "m1", "thread_id": "t1", "date": d(3), "from": "Jane Smith <jane@x.org>", "subject": "Eye camp venue",
         "text_body": "The eye camp moves to the Sea Point Civic Centre on 17 October. Please RSVP by 9 October."},
        {"id": "m2", "thread_id": "t1", "date": d(2), "from": "Bob <bob@x.org>", "subject": "Re: Eye camp venue",
         "text_body": "Thanks all!\n\nOn Mon, Jane wrote:\n> The eye camp moves"},
        {"id": "m3", "thread_id": "t3", "date": d(2), "from": "Sea Point Lions Club <club@x.org>", "subject": "MINUTES: GBM",
         "text_body": "Minutes attached.", "attachments": [{"filename": "min.pdf", "text": "Resolved: buy 40 blankets for R6 000. Next GBM 20 Oct."}]},
        {"id": "m4", "thread_id": "t4", "date": d(1), "from": "Sea Point Lions Club <club@x.org>", "subject": "Fwd: Eye camp venue",
         "text_body": "The eye camp moves to the Sea Point Civic Centre on 17 October. Please RSVP by 9 October."},
        {"id": "m5", "thread_id": "t5", "date": d(1), "from": "Club <club@x.org>", "subject": "Condolences",
         "text_body": "With sadness we share that Lion Peter passed away. Funeral Fri 2 Oct, 10:00, St John's."},
    ]


def test_end_to_end(home):
    from typer.testing import CliRunner

    from ledger import cli, config, db

    runner = CliRunner()
    today = config.today()
    f = home / "msgs.json"
    f.write_text(json.dumps(_msgs(today)))

    r = runner.invoke(cli.app, ["import-json", str(f)])
    assert r.exit_code == 0, r.output
    assert "'stored': 3" in r.output and "'skipped': 2" in r.output  # thanks-only + duplicate
    r = runner.invoke(cli.app, ["import-json", str(f)])
    assert "'stored': 0" in r.output and "'exists': 5" in r.output  # idempotent

    pending = json.loads((config.INBOX_DIR / "pending.json").read_text())
    assert [e["id"] for e in pending["emails"]] == ["m1", "m3", "m5"]
    assert "Resolved: buy 40 blankets" in pending["emails"][1]["attachment_text"]
    assert (config.INBOX_DIR / "batch-01.json").exists()

    rsvp = (today + timedelta(days=6)).isoformat()
    camp = (today + timedelta(days=14)).isoformat()
    bad = [{"email_id": "m1", "category": "nope", "importance": 9, "needs_action": True, "one_line": ""}]
    (home / "bad.json").write_text(json.dumps(bad))
    r = runner.invoke(cli.app, ["save-classifications", str(home / "bad.json")])
    assert r.exit_code == 1
    for frag in ("category 'nope'", "importance must be", "action_summary is required", "one_line"):
        assert frag in r.output

    good = [
        {"email_id": "m1", "category": "project_update", "project_ids": ["eye camp"], "importance": 5, "needs_action": True,
         "action_summary": "RSVP for the eye camp", "action_due": rsvp,
         "dates_mentioned": [{"date": camp, "description": "Eye camp, Sea Point Civic Centre"}], "people_mentioned": ["Jane Smith"],
         "one_line": "Eye camp moves to the Civic Centre."},
        {"email_id": "m3", "category": "meeting_minutes", "project_ids": ["Blanket Drive"], "importance": 4, "needs_action": False,
         "action_summary": None, "action_due": None,
         "dates_mentioned": [{"date": camp, "description": "Eye camp at the Sea Point Civic Centre"}],
         "people_mentioned": [], "one_line": "GBM approved R6 000 for blankets."},
        {"email_id": "m5", "category": "notice_bereavement", "project_ids": [], "importance": 3, "needs_action": False,
         "action_summary": None, "action_due": None, "dates_mentioned": [], "people_mentioned": ["Peter"], "one_line": "Lion Peter died."},
    ]
    (home / "good.json").write_text(json.dumps(good))
    r = runner.invoke(cli.app, ["save-classifications", str(home / "good.json")])
    assert r.exit_code == 0, r.output
    assert "Blanket Drive (blanket-drive)" in r.output and "Still unclassified: 0" in r.output

    r = runner.invoke(cli.app, ["projects"])
    assert "active     1 email " in r.output and "proposed   1 email " in r.output

    r = runner.invoke(cli.app, ["period-data"])
    assert r.exit_code == 0, r.output
    pdata = json.loads(r.output)
    assert pdata["guidance"]["article_projects"] == ["eye-screening"]
    assert pdata["guidance"]["briefly_projects"] == ["blanket-drive"]  # only mentioned in minutes
    assert len(pdata["meetings"]) == 1 and len(pdata["notices"]) == 1
    assert len(pdata["dates_for_the_diary"]) == 1  # the two descriptions of the eye camp merge
    assert pdata["needs_your_attention"][0]["summary"] == "RSVP for the eye camp"

    long_head = {"source_id": "seapoint-lions", "period_start": pdata["period_start"], "period_end": pdata["period_end"],
                 "articles": [{"section": "project", "headline": " ".join(["word"] * 11), "standfirst": "x", "body": "y",
                               "source_email_ids": ["nope"]}]}
    (home / "a_bad.json").write_text(json.dumps(long_head))
    r = runner.invoke(cli.app, ["save-articles", str(home / "a_bad.json")])
    assert r.exit_code == 1 and "limit is 10" in r.output and "not found" in r.output

    body = " ".join(["The eye camp moves to the Sea Point Civic Centre on 17 October."] * 8)
    arts = {
        "source_id": "seapoint-lions", "period_start": pdata["period_start"], "period_end": pdata["period_end"],
        "articles": [
            {"section": "front", "project_id": "eye-screening", "headline": "Eye camp moves to Sea Point Civic Centre",
             "standfirst": "New venue for October.", "body": body + "\n\nSecond <para> & more.",
             "what_it_means": "What it means for you: RSVP by 9 October.", "source_email_ids": ["m1", "m4"], "rank": 1},
            {"section": "meetings", "headline": "GBM approves R6 000 for blankets", "standfirst": "Decisions from the GBM.",
             "body": "- Buy 40 blankets (R6 000)\n- Next GBM 20 Oct", "source_email_ids": ["m3"]},
            {"section": "briefly", "project_id": "Blanket Drive", "headline": "Blankets", "body": "40 blankets to buy.", "source_email_ids": ["m3"]},
            {"section": "notices", "kind": "bereavement", "headline": "Lion Peter", "body": "Funeral Fri 2 Oct, 10:00, St John's.",
             "source_email_ids": ["m5"]},
        ],
    }
    (home / "a.json").write_text(json.dumps(arts))
    r = runner.invoke(cli.app, ["save-articles", str(home / "a.json")])
    assert r.exit_code == 0, r.output

    r = runner.invoke(cli.app, ["render"])
    assert r.exit_code == 0, r.output
    out = home / "editions" / f"{today.isoformat()}-seapoint-lions.html"
    html = out.read_text()
    assert "THE LIONS LEDGER" in html.upper()
    assert "Eye camp moves to Sea Point Civic Centre" in html
    assert "Second &lt;para&gt; &amp; more." in html  # escaped, not injected
    assert "What it means for you:</strong> RSVP by 9 October." in html
    assert "Needs Your Attention" in html and "Dates for the Diary" in html
    assert "From the Boardroom" in html and "In Memoriam" in html
    assert "New" in html and 'id="projects"' not in html  # lead took the only project; empty section omitted
    assert "https://mail.google.com/mail/u/0/#inbox/m4" in html
    assert (home / "editions" / "latest.html").read_text() == html
    idx = (home / "editions" / "index.html").read_text()
    assert out.name in idx and "Edition 1" in idx

    # Re-rendering the same period updates the same edition rather than creating a new one
    r = runner.invoke(cli.app, ["render"])
    conn = db.connect()
    assert conn.execute("SELECT COUNT(*) FROM editions").fetchone()[0] == 1


def test_reprocess_requeues(home):
    from ledger import config, db, ingest

    conn = db.connect()
    conn.execute(
        "INSERT INTO emails(id, thread_id, source_id, received_at, subject, body_clean, processed_at) VALUES('a','a','seapoint-lions',?, 's','b', 'x')",
        (datetime.now(timezone.utc).isoformat(),),
    )
    conn.execute("INSERT INTO classifications(email_id, category) VALUES('a','other')")
    assert ingest.reset_for_reprocess(conn, "seapoint-lions", None) == 1
    assert conn.execute("SELECT processed_at FROM emails WHERE id='a'").fetchone()[0] is None


def test_default_period_catches_up(home):
    from ledger import config, db, period

    cfg = config.load_config()
    conn = db.connect()
    s, e = period.default_period(conn, cfg, "seapoint-lions")
    assert (e - s).days == 29
    conn.execute("INSERT INTO editions(source_id, number, period_start, period_end) VALUES('seapoint-lions', 1, ?, ?)",
                 ((e - timedelta(days=30)).isoformat(), (e - timedelta(days=21)).isoformat()))
    s2, e2 = period.default_period(conn, cfg, "seapoint-lions")
    assert s2 == e - timedelta(days=20) and e2 == e


def test_schedule_line():
    from ledger import schedule

    line = schedule.cron_line()
    assert "run_edition.sh" in line and schedule.MARK in line


# ---------------- fetch via a fake Gmail API ----------------

class _Exec:
    def __init__(self, v):
        self.v = v

    def execute(self):
        return self.v


class FakeGmail:
    """Just enough of googleapiclient's Gmail resource for `ledger fetch`."""

    def __init__(self, messages, attachments):
        self.messages_by_id = {m["id"]: m for m in messages}
        self.attachments_by_id = attachments
        self.queries = []

    def users(self):
        return self

    def getProfile(self, userId):
        return _Exec({"emailAddress": "azeem@example.com"})

    def messages(self):
        return self

    def list(self, userId, q, pageToken=None, maxResults=None):
        self.queries.append(q)
        return _Exec({"messages": [{"id": i} for i in self.messages_by_id]})

    def get(self, userId, id, format=None, **kw):
        return _Exec(self.messages_by_id[id])

    def attachments(self):
        outer = self

        class A:
            def get(self, userId, messageId, id):
                return _Exec({"data": outer.attachments_by_id[id]})

        return A()


def test_fetch_with_fake_gmail(home, monkeypatch):
    from typer.testing import CliRunner

    from ledger import cli, gmail_client

    enc = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
    now_ms = str(int(datetime.now(timezone.utc).timestamp() * 1000) - 3600_000)

    def msg(mid, frm, subject, body, parts=(), labels=("INBOX",)):
        return {
            "id": mid, "threadId": mid, "internalDate": now_ms, "labelIds": list(labels),
            "payload": {"mimeType": "multipart/mixed",
                        "headers": [{"name": "From", "value": frm}, {"name": "Subject", "value": subject}],
                        "parts": [{"mimeType": "text/plain", "body": {"data": enc(body.encode())}}, *parts]},
        }

    pdf_part = {"mimeType": "application/pdf", "filename": "minutes.pdf", "body": {"attachmentId": "A1"}}
    fake = FakeGmail(
        [
            msg("g1", "Club <club@x.org>", "MINUTES: GBM", "Minutes attached.", [pdf_part]),
            msg("g2", "Me <azeem@example.com>", "Re: MINUTES", "My reply", labels=("SENT",)),
            msg("g3", "Club <club@x.org>", "Automatic reply: away", "I am out of the office"),
        ],
        {"A1": enc(_minimal_pdf("Resolved to fund 30 shoeboxes"))},
    )
    monkeypatch.setattr(gmail_client, "service", lambda cfg, interactive=False: fake)
    runner = CliRunner()
    r = runner.invoke(cli.app, ["fetch"])
    assert r.exit_code == 0, r.output
    assert "3 matched, 3 new -> 1 stored, 2 filtered, 0 failed" in r.output
    assert "-in:sent" in fake.queries[0] and "after:" in fake.queries[0] and "(from:x)" in fake.queries[0]
    pending = json.loads((home / "data" / "inbox" / "pending.json").read_text())
    assert pending["emails"][0]["id"] == "g1"
    assert "Resolved to fund 30 shoeboxes" in pending["emails"][0]["attachment_text"]
    r = runner.invoke(cli.app, ["fetch"])  # second run: nothing new
    assert "3 matched, 0 new" in r.output


def test_reshare_with_readable_drive_doc_is_not_dropped_as_duplicate(home):
    """The club shared the Sep GBM minutes twice; only the second link opened. Keep that one."""
    from typer.testing import CliRunner

    from ledger import cli

    body = "I've shared an item with you:\n\nGBM Minutes\nhttps://drive.google.com/file/d/{}/view\n\nMinutes attached."
    msgs = [
        {"id": "s1", "date": "2026-09-22T19:48:00Z", "from": "Club <drive@x.org>", "subject": "Item shared: GBM Minutes",
         "text_body": body.format("A" * 25)},
        {"id": "s2", "date": "2026-09-22T20:49:00Z", "from": "Club <drive@x.org>", "subject": "Item shared: GBM Minutes",
         "text_body": body.format("B" * 25), "attachments": [{"filename": "GBM Minutes", "text": "Rent is R3,000 behind."}]},
        {"id": "s3", "date": "2026-09-22T21:00:00Z", "from": "Club <drive@x.org>", "subject": "Item shared: GBM Minutes",
         "text_body": body.format("C" * 25), "attachments": [{"filename": "GBM Minutes", "text": "Rent is R3,000 behind."}]},
    ]
    f = home / "shares.json"
    f.write_text(json.dumps(msgs))
    r = CliRunner().invoke(cli.app, ["import-json", str(f)])
    assert "'stored': 2" in r.output and "'skipped': 1" in r.output  # s3 is a true duplicate of s2
