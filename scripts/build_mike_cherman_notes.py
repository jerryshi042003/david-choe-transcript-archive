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


def render_page(record: dict, note: dict, previous: dict | None, following: dict | None) -> str:
    moments = "\n".join(
        f'''<li id="t{second}">
          <a class="time" href="{source_url(record['id'], second)}" target="_blank" rel="noopener">{clock(second)}</a>
          <div><h2>{html.escape(label)}</h2><p>{html.escape(body)}</p></div>
        </li>'''
        for second, label, body in note["moments"]
    )
    nav = []
    if previous:
        nav.append(f'<a href="{previous["id"]}.html">← {html.escape(previous["title"])}</a>')
    if following:
        nav.append(f'<a href="{following["id"]}.html">{html.escape(following["title"])} →</a>')
    note_text = record.get("note")
    source_note = f'<p class="source-note">{html.escape(note_text)}</p>' if note_text else ""
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(record['title'])} — Mike Cherman Interviews</title>
<meta name="description" content="Cleaned notes and Tom-specific takeaways from {html.escape(record['title'])}.">
<link rel="stylesheet" href="styles.css"></head>
<body><main>
  <nav class="top"><a href="./">← All Mike interviews</a><a href="../">Jerry / Tom board</a></nav>
  <header class="hero">
    <p class="eyebrow">{html.escape(record['format'])} · {record['date']} · {clock(record['duration'])}</p>
    <h1>{html.escape(record['title'])}</h1>
    <p class="byline">{html.escape(record['channel'])}</p>
    <p class="summary">{html.escape(note['summary'])}</p>
    <a class="watch" href="{source_url(record['id'])}" target="_blank" rel="noopener">Watch the original on YouTube ↗</a>
  </header>
  <section class="tom-card"><p class="eyebrow">What Tom should take from this</p><p>{html.escape(note['tom'])}</p></section>
  <section><p class="section-label">Cleaned interview notes</p><ol class="moments">{moments}</ol></section>
{source_note}
  <section class="method"><p><b>Editorial method.</b> These are source-faithful paraphrases made from public captions or local speech recognition, not a verbatim transcript. Timestamps open the original recording. Verify the source before quoting Mike.</p></section>
  <nav class="pager">{' '.join(nav)}</nav>
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
  <nav class="top"><a href="../">← Jerry / Tom board</a><a href="../../tom-handoff/" target="_blank" rel="noopener">Tom’s work ↗</a></nav>
  <header class="hero">
    <p class="eyebrow">Jerry / Tom · Interviews</p>
    <h1>Mike Cherman interviews</h1>
    <p class="summary">Twenty-eight public interviews and substantive appearances, organized into cleaned timestamped notes. Each page ends with the practical implication for Tom: what to make, ask, protect, or test.</p>
    <p class="scope">22 direct interviews, podcasts, and panels · 6 adjacent first-person appearances · searched 10 August 2026</p>
  </header>
  <label class="search-label" for="search">Search the interviews</label>
  <input id="search" class="search" type="search" placeholder="community, samples, tennis, failure…" autocomplete="off">
  <p id="result-count" class="scope" aria-live="polite"></p>
  <section><p class="section-label">Direct interviews, podcasts, and panels</p><ol class="interviews" id="core">{cards('core')}</ol></section>
  <section><p class="section-label">Adjacent first-person appearances</p><p class="scope">Included because Mike speaks substantively; kept separate so a workshop, tour, or campaign is not mislabeled as an interview.</p><ol class="interviews" id="adjacent">{cards('adjacent')}</ol></section>
  <section class="method"><p><b>Coverage.</b> “Every” means every qualifying result recovered by the documented twelve-query YouTube sweep. Ranked search is not a perfect global index. <a href="SOURCES.md">Read the inclusion rule, exclusions, and transcript method.</a></p></section>
</main><script src="search.js"></script></body></html>'''


def main() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    records = sorted(manifest["records"], key=lambda record: (record["date"], record["id"]), reverse=True)
    notes = json.loads((OUT / "notes.json").read_text(encoding="utf-8"))
    ids = {record["id"] for record in records}
    if set(notes) != ids:
        raise ValueError(f"notes/manifest mismatch: missing={sorted(ids-set(notes))}, extra={sorted(set(notes)-ids)}")
    for index, record in enumerate(records):
        previous = records[index - 1] if index else None
        following = records[index + 1] if index + 1 < len(records) else None
        (OUT / f"{record['id']}.html").write_text(
            render_page(record, notes[record["id"]], previous, following), encoding="utf-8"
        )
    (OUT / "index.html").write_text(render_index(records, notes), encoding="utf-8")
    print(f"Built {len(records)} cleaned interview-note pages")


if __name__ == "__main__":
    main()
