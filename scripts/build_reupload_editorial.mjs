#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const reviewedOn = '2026-08-13';

// Explicitly reviewed near-full-length YouTube re-uploads. `shared` is the
// number of sampled eight-word transcript shingles shared with the unique
// canonical match; the next-best match is at most 69 for every route.
const matches = {
  '4mPxYY6dL2o': { canonical: 'saga1-episode-045-with-david-choe-and-asa-akira', shared: 1222 },
  '6sdmY8WvNlw': { canonical: 'saga1-episode-019-with-david-choe-and-asa-akira', shared: 1179 },
  'C_Rw-0HyJXc': { canonical: 'saga1-episode-047-with-david-choe-and-asa-akira', shared: 978 },
  'HCQHVHJYQnQ': { canonical: 'saga1-episode-036-with-david-choe-and-asa-akira', shared: 1317 },
  'LdqB8988S2U': { canonical: 'saga1-episode-032-with-david-choe-and-asa-akira', shared: 2249 },
  'OuuSC5xoKVk': { canonical: 'saga1-episode-046-with-david-choe-and-asa-akira', shared: 1064 },
  'YgilTWmHJBg': { canonical: 'saga1-episode-026-with-david-choe-and-asa-akira', shared: 1510 },
  'cMcZRCgKgj4': { canonical: 'saga1-episode-048-with-david-choe-and-asa-akira', shared: 944 },
  'g1G_6-km8sU': { canonical: 'saga1-episode-044-with-david-choe-and-asa-akira', shared: 788 },
  'h12NAoaCY5k': { canonical: 'saga1-episode-041-with-david-choe-and-asa-akira', shared: 1371 },
  'k-wWvZu9xaA': { canonical: 'saga1-episode-029-with-david-choe-and-asa-akira', shared: 1596 },
  'mxfBPoDUJ80': { canonical: 'saga1-episode-039-with-david-choe-and-asa-akira', shared: 1161 },
  'wC3vettgNB0': { canonical: 'saga1-episode-043-with-david-choe-and-asa-akira', shared: 1619 }
};

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function duration(record) {
  return Number(record.segments?.at(-1)?.t || 0);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

let changed = 0;
for (const [id, match] of Object.entries(matches)) {
  const route = readJson(`data/${id}.json`);
  const canonicalRoute = readJson(`data/${match.canonical}.json`);
  const canonicalSource = readJson(`editorial/${match.canonical}.json`);
  const ratio = duration(route) / duration(canonicalRoute);
  if (ratio < 0.98 || ratio > 1.02) {
    throw new Error(`${id}: duration ratio ${ratio.toFixed(4)} is outside the reviewed re-upload range`);
  }

  const episodeNumber = route.title.match(/Episode\s+(\d+)/i)?.[1];
  if (!episodeNumber || !match.canonical.includes(`episode-${episodeNumber}`)) {
    throw new Error(`${id}: title does not agree with canonical episode ${match.canonical}`);
  }

  const people = uniq(['David Choe', 'Asa Akira', ...(canonicalSource.people || [])]);
  const connections = [
    {
      to: `DVDASA Episode ${episodeNumber} canonical archive route`,
      note: `This YouTube upload uniquely matches ${match.canonical} by ${match.shared.toLocaleString()} sampled eight-word transcript shingles and a ${ratio.toFixed(3)} runtime ratio. It is a re-upload route, not a separate episode.`
    },
    ...(canonicalSource.connections || [])
  ];
  const source = {
    episode_id: id,
    title: route.title,
    reviewed_on: reviewedOn,
    description: `A near-full-length Archive Dump Truck YouTube re-upload of DVDASA Episode ${episodeNumber}, linked to the canonical episode by transcript and runtime evidence.`,
    summary: `This Archive Dump Truck YouTube route is a near-full-length re-upload of DVDASA Episode ${episodeNumber}, not a distinct interview or lost episode. A sampled eight-word transcript comparison produced ${match.shared.toLocaleString()} shared shingles with the canonical route and no plausible competing episode; the two runtimes have a ${ratio.toFixed(3)} ratio. The human-reviewed subject summary follows. ${canonicalSource.summary}`,
    chapters: canonicalSource.chapters.map((chapter) => ({
      ...chapter,
      t: Number((Number(chapter.t ?? chapter.start) * ratio).toFixed(1))
    })),
    people,
    places: canonicalSource.places || [],
    works: canonicalSource.works || ['DVDASA'],
    themes: uniq([...(canonicalSource.themes || []), 'YouTube re-upload provenance']),
    connections,
    content_warnings: canonicalSource.content_warnings || [],
    publication_restrictions: canonicalSource.publication_restrictions || [],
    quality: {
      ...(canonicalSource.quality || {}),
      aggregate_segments: route.segments?.length || 0,
      duration_seconds: duration(route),
      canonical_route: match.canonical,
      canonical_duration_seconds: duration(canonicalRoute),
      duration_ratio: Number(ratio.toFixed(4)),
      sampled_shared_eight_word_shingles: match.shared,
      next_best_match_max: 69,
      named_turns: 0
    },
    source_notes: [
      `The upload title names Episode ${episodeNumber}; transcript-overlap and runtime checks independently agree.`,
      `Chapter timestamps are scaled by the reviewed ${ratio.toFixed(4)} runtime ratio from the canonical source route.`,
      'The route retains its own transcript and YouTube provenance while reusing the canonical human-reviewed interpretation.',
      ...(canonicalSource.source_notes || [])
    ],
    speaker_policy: canonicalSource.speaker_policy || 'Route-level public participants may be listed, but no line-level name is published without validated diarization.'
  };

  const target = path.join(ROOT, 'editorial', `${id}.json`);
  const serialized = `${JSON.stringify(source, null, 2)}\n`;
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === serialized) continue;
  changed += 1;
  if (write) fs.writeFileSync(target, serialized);
}

if (!write && changed) {
  console.error(`${changed} re-upload editorial records are out of sync; run node scripts/build_reupload_editorial.mjs --write`);
  process.exit(1);
}

console.log(`${Object.keys(matches).length} reviewed re-upload mappings validated; ${write ? changed : 0} editorial files written.`);
