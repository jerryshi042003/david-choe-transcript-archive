#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const MIN_EPISODES = 3;
const CAST = new Set(['David Choe', 'Asa Akira', 'Bobby Namba', 'Yoshi Obayashi',
  'Dave Choe', 'Choe', 'Asa', 'Bobby', 'Yoshi']);
const kinds = ['people', 'places', 'themes'];
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const titles = new Map(catalog.items.map((item) => [item.id, item.t || item.title || item.id]));
const ids = [...titles.keys()];
const index = Object.fromEntries(kinds.map((kind) => [kind, new Map()]));
const connections = [];
let withEntities = 0;

for (const id of ids) {
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${id}.json`), 'utf8'));
  const editorial = record.editorial || {};
  if (kinds.some((kind) => Array.isArray(editorial[kind]) && editorial[kind].length)) withEntities += 1;
  for (const kind of kinds) {
    for (const raw of editorial[kind] || []) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim();
      if (!name || (kind === 'people' && CAST.has(name))) continue;
      const episodes = index[kind].get(name) || [];
      episodes.push({ id, title: titles.get(id) });
      index[kind].set(name, episodes);
    }
  }
  for (const connection of editorial.connections || []) {
    if (!connection || typeof connection !== 'object' || !connection.label) continue;
    connections.push({ id, title: titles.get(id), label: connection.label, note: connection.note || '' });
  }
}

const subjects = {};
for (const kind of kinds) {
  subjects[kind] = [...index[kind]].filter(([, episodes]) => episodes.length >= MIN_EPISODES)
    .filter(([name]) => !(kind === 'themes' && name.toLowerCase() === 'trivia'))
    .map(([name, episodes]) => ({ name, episodes, count: episodes.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const result = {
  schema: 'choe-corpus/subjects@2',
  survey: {
    items_in_archive: ids.length,
    items_with_entities: withEntities,
    min_episodes: MIN_EPISODES,
    coverage: `Entities are human-curated per item across all ${withEntities} of ${ids.length} unique reader routes. Subjects shown here recur in at least three routes; one-off mentions are outside this recurrence index.`,
    excluded: 'Recurring hosts are omitted because their recurrence describes the show format rather than a subject.',
  },
  signals: (() => {
    const trivia = JSON.parse(fs.readFileSync(path.join(DATA, 'trivia-coverage.json'), 'utf8'));
    return [{
      name: 'trivia',
      method: trivia.boundary,
      routes: trivia.routes.filter((route) => route.status === 'literal-match' || route.status === 'reviewed-present-unlabeled')
        .map((route) => ({ id: route.id, title: route.title, status: route.status })),
      count: trivia.present,
      denominator: trivia.denominator,
      reviewed: trivia.reviewed,
      format_or_absence_count: trivia.denominator - trivia.present,
    }];
  })(),
  subjects,
  connections,
};

fs.writeFileSync(path.join(DATA, 'subjects.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(`${withEntities} of ${ids.length} routes carry curated entities; ${connections.length} context connections written.`);
