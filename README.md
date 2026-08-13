# David Choe transcript archive

Public David Choe / DVDASA source archive, transcript reader, and Jerry / Tom tennis-culture working record.

- Archive: https://jerryshi042003.github.io/david-choe-transcript-archive/
- Current YouTube era: https://jerryshi042003.github.io/david-choe-transcript-archive/#recent
- Verified web sources: https://jerryshi042003.github.io/david-choe-transcript-archive/sources/
- Jerry / Tom record: https://jerryshi042003.github.io/david-choe-transcript-archive/tennis-culture/

This repository is deliberately standalone. A contributor needs only this repository. Jerry's private personal workspace, notes, credentials, and unpublished media are not dependencies and must never be copied here.

## Development and production

| Branch | Purpose | Publishes |
| --- | --- | --- |
| `main` | Production. Jerry-reviewed releases only. | GitHub Pages public site |
| `dev` | Shared integration and review. Tom's pull requests target this branch. | Nothing public |
| `tom/<change>` | One isolated contribution in Tom's fork. | Nothing public |

GitHub Pages deploys only production `main`. Development work is previewed and validated locally before review. A change reaches the public site only through this path:

```text
Tom's fork → tom/<change> → pull request to dev → Jerry review → dev → main → public site
```

Tom does not need collaborator access. He can fork this public repository and open pull requests. That prevents accidental access to, or coupling with, any private Jerry repository.

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
node tests/web-sources.test.mjs
node tests/editorial-coverage.test.mjs
node scripts/build_reupload_editorial.mjs
node scripts/build_excerpt_editorial.mjs
node scripts/build_official_editorial.mjs
node scripts/build_external_editorial.mjs
node scripts/build_visual_editorial.mjs
node scripts/review_editorial_entities.mjs
node scripts/embed_editorial.mjs
node scripts/build_trivia_coverage.mjs
node scripts/build_corpus_analysis.mjs
node scripts/refresh_method_counts.mjs
node scripts/audit_editorial_coverage.mjs
```

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

## Current official-channel era

`data/recent-channel.json` separately covers all 119 official `@davidchoe`
uploads in the continuous November 5, 2022–August 7, 2026 run. This is an
audiovisual layer, not a transcript proxy: it records official metadata,
original orientation summaries, phase/mode classification, derived scene-change
rhythm, and measured silence/loudness. Full media, captions, transcripts,
uploader descriptions, and contact sheets are excluded. Five picture streams
and ten sound streams remain explicit measurement gaps rather than receiving
borrowed values from neighboring videos.

Rebuild from rights-cleared local metadata and ephemeral source-stream
measurements:

```bash
node scripts/build_recent_channel_analysis.mjs \
  --metadata /path/to/local/metadata \
  --metrics /path/to/derived-measurements.json \
  --output data/recent-channel.json
node tests/recent-channel.test.mjs
```

## Repository boundary

Belongs here:

- public transcript JSON and reader code;
- public source ledgers and citations;
- the public Jerry / Tom tennis-culture record;
- small, lawful, source-attributed images needed by the reader.

Does not belong here:

- private personal notes or whole private-repository exports;
- credentials, email, private chats, contact databases, or unpublished recordings;
- downloaded podcast/video/audio files;
- unlicensed book scans or other copyrighted source dumps;
- generated build folders or machine-specific paths.

The tennis-culture record stays in this repository because it directly uses the DVDASA transcript archive and citations. A separate repository would add syncing and deployment work without creating a useful permission boundary: everything here is already public.
