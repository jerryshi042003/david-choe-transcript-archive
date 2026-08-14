#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));
const items = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const write = process.argv.includes('--write');

function transcriptLabel(item, record) {
  if (record.verification?.reviewed_against_video) return 'Human-checked transcript';
  if (item.s === 'edited whisper') return 'Edited computer transcript';
  if (item.s === 'manual') return 'Uploader captions';
  if (item.s === 'auto') return 'YouTube auto-captions';
  return 'Computer transcript';
}

const routes = {};
const errors = [];
for (const item of items) {
  const editorialPath = path.join(ROOT, 'editorial', `${item.id}.json`);
  const recordPath = path.join(ROOT, 'data', `${item.id}.json`);
  if (!fs.existsSync(editorialPath) || !fs.existsSync(recordPath)) {
    errors.push(`${item.id}: missing editorial or reader record`);
    continue;
  }
  const editorial = JSON.parse(fs.readFileSync(editorialPath, 'utf8'));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const description = String(editorial.description || '').trim();
  const people = Array.isArray(editorial.people)
    ? [...new Set(editorial.people.map((name) => String(name).trim()).filter(Boolean))]
    : [];
  if (!description) errors.push(`${item.id}: missing one-line description`);
  if (!people.length) errors.push(`${item.id}: missing reviewed people`);
  routes[item.id] = {
    description,
    people,
    transcript_label: transcriptLabel(item, record),
  };
}

if (errors.length) {
  console.error(`Browse index failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const result = {
  schema: 'choe-corpus/browse-index@1',
  generated_from: '421 human-reviewed editorial records plus reader provenance',
  coverage: {
    unique_routes: items.length,
    descriptions: Object.values(routes).filter((route) => route.description).length,
    reviewed_people: Object.values(routes).filter((route) => route.people.length).length,
  },
  speaker_note: 'People are reviewed at episode level. Individual transcript lines are not assigned to a voice unless directly verified.',
  routes,
};

const target = path.join(ROOT, 'data/browse-index.json');
const serialized = `${JSON.stringify(result, null, 1)}\n`;
if (write) fs.writeFileSync(target, serialized);
else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== serialized) {
  console.error('Browse index is stale; run node scripts/build_browse_index.mjs --write');
  process.exit(1);
}

console.log(`Browse index: ${result.coverage.descriptions}/${items.length} descriptions and ${result.coverage.reviewed_people}/${items.length} people lists.`);
