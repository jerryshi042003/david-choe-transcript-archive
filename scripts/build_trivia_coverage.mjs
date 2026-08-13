#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const items = [...new Map(catalog.items.map((item) => [item.id, item])).values()];

// Every DVDASA route without a literal whole-word match was read against its
// human-reviewed summary, chapter map, and transcript candidates. An explicit
// exception is required: silence is never converted into absence.
const REVIEWED_WITHOUT_LITERAL_MATCH = {
  'saga1-episode-091-insatiable-2-commentary': {
    status: 'reviewed-no-formal-segment',
    evidence: 'The complete available episode is a synchronized Insatiable 2 commentary followed by fan-archive and schedule discussion; no formal trivia round occurs.',
  },
  'saga1-episode-099-pack-hunting': {
    status: 'reviewed-no-formal-segment',
    evidence: 'The full chapter map runs from Ranch re-entry through Pack Hunting, relationships, gambling, and the Poon Job proposal; question-shaped dialogue is conversational rather than a scored trivia round.',
  },
  'saga1-episode-113-vegas-part-01': {
    status: 'reviewed-no-formal-segment-in-available-capture',
    evidence: 'The available Vegas Part 1 capture is explicitly truncated and contains no formal trivia round before its cutoff.',
  },
  'saga1-episode-117-vegas-part-05-no-newdes': {
    status: 'reviewed-no-formal-segment',
    evidence: 'The complete reviewed chapter map covers gambling recovery, discrimination, private-room conflict, the No New Dudes sequence, and Critter’s poem; no formal trivia round occurs.',
  },
  'saga1-episode-119-the-ranch-solo-series-part-two': {
    status: 'reviewed-format-exception',
    evidence: 'Ranch Solo II is a single-voice blueprint recording without the ensemble game format.',
  },
  'saga1-episode-128-hawaii-happiness-symposium-part-2-with-jane-choe': {
    status: 'reviewed-present-unlabeled',
    evidence: 'Questions about Warhol’s wigs and Leonardo’s surviving paintings form an unscored trivia passage around 00:10:42–00:14:54; the transcript never says the word trivia.',
    spans: [{ start: 642.6, end: 894, label: 'Warhol and Leonardo art-history questions' }],
  },
  'saga1-episode-132-dave-in-love-part-two': {
    status: 'reviewed-no-formal-segment',
    evidence: 'Part Two remains a continuous catfishing, trust, therapy, and relationship narrative through the production handoff; no formal trivia round occurs.',
  },
  'saga2-book-02-chapter-001': {
    status: 'reviewed-format-exception',
    evidence: 'Ranch Solo IV is a single-voice recording without the ensemble game format.',
  },
  'saga2-saga-02-chapter-003-the-window': {
    status: 'reviewed-no-formal-segment',
    evidence: 'The complete chapter map is framed by Mangchi performances and covers guests, fan contact, opportunity, adolescent memory, and rumor; no formal trivia round occurs.',
  },
  'saga2-saga-02-chapter-013-the-perfect-woman-a-proposition': {
    status: 'reviewed-no-formal-segment',
    evidence: 'The complete chapter map covers Charm Killings, health claims, public recognition, relationship boundaries, and the title proposition; no formal trivia round occurs.',
  },
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode': {
    status: 'reviewed-format-exception',
    evidence: 'Ranch Solo III is a single-voice blueprint recording without the ensemble game format.',
  },
};

const routes = [];
const errors = [];
for (const item of items) {
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${item.id}.json`), 'utf8'));
  if (record.kind !== 'dvdasa') continue;
  const literalSpans = record.segments.filter((segment) => /\btrivia\b/i.test(segment.x || ''))
    .map((segment) => ({ start: segment.t, text: segment.x }));
  if (literalSpans.length) {
    routes.push({ id: item.id, title: record.title, status: 'literal-match', literal_spans: literalSpans });
    continue;
  }
  const review = REVIEWED_WITHOUT_LITERAL_MATCH[item.id];
  if (!review) errors.push(`${item.id}: no literal match and no explicit semantic review`);
  else routes.push({ id: item.id, title: record.title, ...review });
}

for (const id of Object.keys(REVIEWED_WITHOUT_LITERAL_MATCH)) {
  if (!routes.some((route) => route.id === id)) errors.push(`${id}: review entry does not map to a DVDASA route`);
}
if (errors.length) {
  console.error('Trivia coverage build failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = routes.reduce((out, route) => {
  out[route.status] = (out[route.status] || 0) + 1;
  return out;
}, {});
const present = routes.filter((route) => route.status === 'literal-match' || route.status === 'reviewed-present-unlabeled').length;
const result = {
  schema: 'choe-corpus/trivia-coverage@1',
  denominator: routes.length,
  reviewed: routes.length,
  present,
  counts,
  boundary: 'Literal matching is a lower bound. Every no-match DVDASA route has an explicit semantic review; format exceptions and truncated captures are not mislabeled as missing curation.',
  routes,
};
fs.writeFileSync(path.join(DATA, 'trivia-coverage.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(`Trivia review ${result.reviewed}/${result.denominator}: ${present} present, ${routes.length - present} reviewed without a formal segment.`);
