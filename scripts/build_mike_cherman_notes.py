#!/usr/bin/env python3
"""Build rights-safe Mike Cherman interview notes from a reviewed notes manifest."""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tennis-culture" / "mike-cherman"


def clock(seconds: int) -> str:
    hours, rest = divmod(max(0, int(seconds)), 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def source_url(video_id: str, seconds: int | None = None) -> str:
    url = f"https://www.youtube.com/watch?v={video_id}"
    return f"{url}&amp;t={seconds}s" if seconds is not None else url


def render_page(record: dict, note: dict) -> str:
    moments = "\n".join(
        f'''<li id="t{second}">
          <a class="time" href="{source_url(record['id'], second)}" target="_blank" rel="noopener">{clock(second)}</a>
          <div><h2>{html.escape(label)}</h2><p>{html.escape(body)}</p></div>
        </li>'''
        for second, label, body in note["moments"]
    )
    note_text = record.get("note")
    source_note = f'<p class="source-note">{html.escape(note_text)}</p>' if note_text else ""
    if record["transcript_source"].casefold() == "youtube captions":
        transcript_access = (
            f'<p>This recording has a publisher-served YouTube caption track. '
            f'<a href="{source_url(record["id"])}" target="_blank" rel="noopener">Open the video</a>, '
            "then use YouTube’s <b>Show transcript</b> control to read the raw caption sequence.</p>"
        )
    else:
        transcript_access = (
            f'<p>The source does not expose a usable public English transcript. '
            f'<a href="{source_url(record["id"])}" target="_blank" rel="noopener">Open the recording</a>. '
            "The local machine transcript was used for these notes but is not republished as an authoritative source text.</p>"
        )
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(record['title'])} — Mike Cherman Interviews</title>
<meta name="description" content="Cleaned notes and Tom-specific takeaways from {html.escape(record['title'])}.">
<link rel="stylesheet" href="styles.css"></head>
<body><main>
  <p class="top"><a href="./">← All Mike interviews</a></p>
  <header class="hero">
    <p class="eyebrow">{html.escape(record['format'])} · {record['date']} · {clock(record['duration'])}</p>
    <h1>{html.escape(record['title'])}</h1>
    <p class="byline">{html.escape(record['channel'])}</p>
    <p class="summary">{html.escape(note['summary'])}</p>
    <p><a href="{source_url(record['id'])}" target="_blank" rel="noopener">Watch the original on YouTube ↗</a></p>
  </header>
  <blockquote><p>“{html.escape(note['quote'])}”</p><cite><a href="{source_url(record['id'], note['quote_t'])}" target="_blank" rel="noopener">Caption excerpt · {clock(note['quote_t'])}</a></cite></blockquote>
  <section class="tom-card"><p class="eyebrow">What Tom should take from this</p><p>{html.escape(note['tom'])}</p></section>
  <section><p class="section-label">Interview details and stories</p><ol class="moments">{moments}</ol></section>
{source_note}
  <details class="transcript-access"><summary>Raw transcript access</summary>{transcript_access}</details>
  <section class="method"><p><b>Editorial method.</b> These are source-faithful paraphrases made from public captions or local speech recognition, not a verbatim transcript. Timestamps open the exact recording position. Verify the source before quoting Mike.</p></section>
</main></body></html>'''


def render_index(records: list[dict], notes: dict) -> str:
    def cards(tier: str) -> str:
        def searchable(record: dict) -> str:
            note = notes[record["id"]]
            moment_text = " ".join(f"{label} {body}" for _, label, body in note["moments"])
            return " ".join((record["title"], record["channel"], note["summary"], note["tom"], moment_text)).lower()

        return "\n".join(
            f'''<li data-search="{html.escape(searchable(r))}">
              <p class="eyebrow">{r['date']} · {html.escape(r['format'])} · {clock(r['duration'])}</p>
              <h2><a href="{r['id']}.html">{html.escape(r['title'])}</a></h2>
              <p>{html.escape(notes[r['id']]['summary'])}</p>
              <a class="detail" href="{r['id']}.html">Notes + Tom insight →</a>
            </li>'''
            for r in records if r["tier"] == tier
        )

    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mike Cherman Interviews — Jerry / Tom</title>
<meta name="description" content="Twenty-eight Mike Cherman interviews and appearances, cleaned into timestamped notes and practical insights for Tom.">
<link rel="stylesheet" href="styles.css"></head>
<body><main>
  <p class="top"><a href="../">← Jerry / Tom board</a></p>
  <header class="hero">
    <p class="eyebrow">Jerry / Tom · Interviews</p>
    <h1>Mike Cherman interviews</h1>
    <p class="summary">Twenty-eight public interviews and substantive appearances. Together they trace Mike from homemade school shirts and ICNY through Chinatown Market, MARKET, teams, collaborations, physical retail, sports objects, community, and the responsibilities that came with growth.</p>
    <p class="scope">22 direct interviews, podcasts, and panels · 6 adjacent first-person appearances · searched 10 August 2026</p>
  </header>
  <section class="corpus-summary">
    <p class="section-label">What the full set says</p>
    <p>Mike’s recurring method is simple: make one thing, put it in front of people, learn the operational work behind it, and use the response to make the next thing. The interviews repeatedly return to five tensions: access versus exclusivity; fast cultural response versus legal and ethical responsibility; founder control versus giving a team room; collaboration excitement versus contracts and ownership; and a product’s image versus the community and physical work that make it real.</p>
    <p>For Tom, the useful pattern is not “start a streetwear brand.” It is to arrive with a finished tennis object, document how it was made, know who it serves, invite a real participant into the process, and ask Mike for one concrete criticism. The archive also argues for boundaries: keep authorship clear, define the pilot, and do not let enthusiasm become unlimited unpaid development.</p>
  </section>
  <section><p class="section-label">Direct interviews, podcasts, and panels</p><ol class="interviews" id="core">{cards('core')}</ol></section>
  <section><p class="section-label">Adjacent first-person appearances</p><p class="scope">Included because Mike speaks substantively; kept separate so a workshop, tour, or campaign is not mislabeled as an interview.</p><ol class="interviews" id="adjacent">{cards('adjacent')}</ol></section>
  <section class="method"><p><b>Coverage.</b> “Every” means every qualifying result recovered by the documented twelve-query YouTube sweep. Ranked search is not a perfect global index. <a href="SOURCES.md">Read the inclusion rule, exclusions, and transcript method.</a></p></section>
</main></body></html>'''


def main() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    records = sorted(manifest["records"], key=lambda record: (record["date"], record["id"]), reverse=True)
    notes = json.loads((OUT / "notes.json").read_text(encoding="utf-8"))
    ids = {record["id"] for record in records}
    if set(notes) != ids:
        raise ValueError(f"notes/manifest mismatch: missing={sorted(ids-set(notes))}, extra={sorted(set(notes)-ids)}")
    oversized = {video_id: len(note["quote"].split()) for video_id, note in notes.items() if len(note["quote"].split()) > 24}
    if oversized:
        raise ValueError(f"caption excerpts exceed 24 words: {oversized}")
    for index, record in enumerate(records):
        (OUT / f"{record['id']}.html").write_text(
            render_page(record, notes[record["id"]]), encoding="utf-8"
        )
    (OUT / "index.html").write_text(render_index(records, notes), encoding="utf-8")
    print(f"Built {len(records)} cleaned interview-note pages")


if __name__ == "__main__":
    main()
