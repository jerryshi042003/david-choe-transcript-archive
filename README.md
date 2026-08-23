# David Choe transcript archive

Public David Choe / DVDASA source archive, transcript reader, and Jerry / Tom tennis-culture working record.

- Archive: https://jerryshi042003.github.io/david-choe-transcript-archive/
- Current YouTube era: https://jerryshi042003.github.io/david-choe-transcript-archive/#recent
- Verified web sources: https://jerryshi042003.github.io/david-choe-transcript-archive/sources/
- Jerry / Tom record: https://jerryshi042003.github.io/david-choe-transcript-archive/tennis-culture/

This repository is deliberately standalone. The public archive, its data, its UI,
and its release history live together here.

## Development and production

`main` publishes the GitHub Pages archive. Contributors may use a branch or a
fork when that makes collaboration easier; Jerry can also release directly to
`main`. Local checks and the browser pass document what was verified for a
release.

## Local preview

```bash
git clone https://github.com/<tom-account>/david-choe-transcript-archive.git
cd david-choe-transcript-archive
git remote add upstream https://github.com/jerryshi042003/david-choe-transcript-archive.git
git fetch upstream
git switch -c tom/short-description upstream/dev
python3 -m http.server 8000
```

Open:

- http://localhost:8000/
- http://localhost:8000/tennis-culture/

Before opening a pull request:

```bash
python3 scripts/check_site.py
node tests/completion-contract.test.mjs
node tests/web-sources.test.mjs
node tests/editorial-coverage.test.mjs
node scripts/build_reupload_editorial.mjs
node scripts/build_excerpt_editorial.mjs
node scripts/build_official_editorial.mjs
node scripts/build_external_editorial.mjs
node scripts/build_visual_editorial.mjs
node scripts/review_editorial_entities.mjs
node scripts/embed_editorial.mjs
node scripts/build_browse_index.mjs
node scripts/build_trivia_coverage.mjs
node scripts/build_corpus_analysis.mjs
node scripts/refresh_method_counts.mjs
node scripts/audit_editorial_coverage.mjs
```

With the local preview running, the release-level browser gate is:

```bash
node scripts/verify_browser.mjs http://127.0.0.1:8000/
```

It drives headless Chrome at both 1280px and 390px, checks for horizontal
overflow, proves the 434-recording and 119-video reveal paths, opens a real
reader route, and saves a disposable 390px screenshot outside the repository.

See [CONTRIBUTING.md](CONTRIBUTING.md) for content and source rules.

## Editorial coverage

The denominator is every unique reader route, not only the routes that already
have hand-curated entities. `data/editorial-coverage.json` records the current
summary, description, corrected-entity, chapter, and connection coverage and
keeps the missing route IDs explicit. `editorial/` is the human-reviewed source
layer; `node scripts/embed_editorial.mjs --write` embeds it into the public
transcript records, and `node scripts/build_subjects.mjs` rebuilds recurring
subjects without presenting review progress as corpus frequency.
`node scripts/build_reupload_editorial.mjs --write` handles only the 13
explicitly reviewed Archive Dump Truck routes that match canonical DVDASA
episodes by title, transcript shingles, and near-identical runtime. It preserves
each YouTube route while linking it to the canonical human-reviewed episode.
`node scripts/build_excerpt_editorial.mjs --write` handles a separate explicit
review map for excerpt uploads. Each excerpt has its own focus summary and
timeline; transcript overlap links it to a full source without pretending the
clip is an independent interview.
`node scripts/build_official_editorial.mjs --write` rebuilds the explicit
route-by-route review map for David Choe's official creative lessons. It keeps
art metaphors separate from medical advice and flags technique that still
depends on the source video.
The external and visual builders cover publisher commentary, performances,
trailers, and transcript-sparse footage. Sparse records say what cannot be
recovered instead of inventing speech or visual action. The entity-review pass
requires every route to have reviewed people, places, works, and themes; empty
place/work arrays mean the source was reviewed and did not support one.

Current completion contract: 434 catalog cards resolve to 421 unique reader
routes. All 421 have reviewed summaries, descriptions, chronological chapters,
people/entities, themes, connections, and reviewed place/work status. The
coverage manifest must have zero incomplete routes, the DVDASA trivia ledger
must remain 177/177 reviewed with 167 passages present, and the overall corpus
analysis must cover all 421 unique reader routes with summary, repeated topics,
normalized people, and screenplay development notes.

## Browse and transcript language

The browse screen is an orientation layer, not a wall of episode numbers.
`data/browse-index.json` deterministically projects the 421 reviewed editorial
records into every one of the 434 visible cards. Each row shows a one-line
description, up to four reviewed people names, collection, runtime, word count,
and one plain transcript label. Search includes those descriptions and names as
well as transcript words.

The default browse view uses four representative catalog images as entrances:
the DVDASA beginning, the Ranch solo sequence, a long interview, and the current
art-tutorial era. These are routes, not rankings. The first 24 rows remain visible
under the collection filters, followed by one explicit control to reveal the
complete collection; a search shows every matching row immediately. This keeps
all 434 cards reachable without loading a 434-row opening wall. Every visible
row has a compact 16:9 thumbnail: 329 reuse an existing generated cover or
source-linked YouTube image, while the 105 records without artwork receive an
original archive-made cover using only collection, title, and runtime metadata.
The visual principle comes from reviewing the old DVDASA site, Koreans Gone Bad,
and David Choe's current blog/gallery: larger images establish the entrances;
small images help identify records while the text does the indexing. No image
was copied from those reference sites.

The labels mean exactly this:

- **Human-checked transcript** — the record was reviewed against its video.
- **Edited computer transcript** — computer text received an explicit edited pass.
- **Uploader captions** — text supplied with the source upload.
- **YouTube auto-captions** — captions generated by YouTube.
- **Computer transcript** — speech-to-text output; exact wording can still be wrong.

Every route has a human-reviewed summary and people list. That does not prove
which person spoke an individual line. The public reader says “People named”
and leaves line-level voices unnamed unless directly verified, because attaching
the wrong person to a quote is worse than displaying an honest unknown.

## Current official-channel era

`data/recent-channel.json` separately covers all 119 official `@davidchoe`
uploads in the continuous November 5, 2022–August 7, 2026 run. This is an
audiovisual layer, not a transcript proxy: it records official metadata,
original orientation summaries, phase/mode classification, derived scene-change
rhythm, and measured silence/loudness. Full media, captions, transcripts,
uploader descriptions, and contact sheets are excluded. Five picture streams
and ten sound streams remain explicit measurement gaps rather than receiving
borrowed values from neighboring videos.

The page opens with the 24 newest videos and one explicit control for all 119.
Choosing a creative phase shows that complete phase immediately, so the visual
analysis remains comprehensive without beginning as another undifferentiated
row wall.

Rebuild from rights-cleared local metadata and ephemeral source-stream
measurements:

```bash
node scripts/build_recent_channel_analysis.mjs \
  --metadata /path/to/local/metadata \
  --metrics /path/to/derived-measurements.json \
  --output data/recent-channel.json
node tests/recent-channel.test.mjs
```

## Repository contents

The archive includes transcript JSON, cleaned Script editions, reader code,
source ledgers, citations, and the Jerry / Tom tennis-culture record. The
dedicated Pages site is the canonical public David Choe archive.
