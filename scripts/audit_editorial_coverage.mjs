#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const items = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const fields = ['summary', 'description', 'chapters', 'people', 'places', 'works', 'themes', 'connections'];
const coverage = Object.fromEntries(fields.map((field) => [field, 0]));
const missing = [];
const byGroup = {};
let editorial = 0;
let context = 0;
let triviaAll = 0;
let triviaDvdasa = 0;
let dvdasa = 0;

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value != null && String(value).trim().length > 0;
}

for (const item of items) {
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${item.id}.json`), 'utf8'));
  const ed = record.editorial || null;
  const group = record.group || item.g || 'Unknown';
  byGroup[group] ||= { routes: 0, editorial: 0 };
  byGroup[group].routes += 1;
  if (record.kind === 'dvdasa') dvdasa += 1;
  const hasTrivia = record.segments.some((segment) => /\btrivia\b/i.test(segment.x || ''));
  if (hasTrivia) triviaAll += 1;
  if (hasTrivia && record.kind === 'dvdasa') triviaDvdasa += 1;
  if (!ed) {
    missing.push({ id: item.id, title: item.t || record.title, group, missing: ['editorial'] });
    continue;
  }
  editorial += 1;
  byGroup[group].editorial += 1;
  const missingFields = [];
  for (const field of fields) {
    if (present(ed[field])) coverage[field] += 1;
    else missingFields.push(field);
  }
  if (present(ed.chapters) && present(ed.connections)) context += 1;
  if (missingFields.length) missing.push({ id: item.id, title: item.t || record.title, group, missing: missingFields });
}

const report = {
  schema: 'choe-corpus/editorial-coverage@1',
  generated_from: 'data/catalog.json plus the 421 unique reader-route records',
  denominator: { catalog_cards: catalog.items.length, unique_reader_routes: items.length },
  coverage: { editorial, context, ...coverage },
  known_signal_checks: {
    exact_word_trivia: {
      all_routes: triviaAll,
      dvdasa_routes: triviaDvdasa,
      dvdasa_denominator: dvdasa,
      note: 'Literal transcript evidence only. This does not infer unlabeled trivia segments, but it proves that 37 curated entity records is not a valid trivia-occurrence denominator.',
    },
  },
  by_group: Object.entries(byGroup).map(([group, value]) => ({ group, ...value }))
    .sort((a, b) => b.routes - a.routes || a.group.localeCompare(b.group)),
  incomplete: missing,
};

const manifestPath = path.join(DATA, 'editorial-coverage.json');
const serialized = `${JSON.stringify(report, null, 1)}\n`;
if (process.argv.includes('--write')) fs.writeFileSync(manifestPath, serialized);
else if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== serialized) {
  console.error('Editorial coverage manifest is stale; run node scripts/audit_editorial_coverage.mjs --write');
  process.exit(1);
}

console.log(`Editorial ${editorial}/${items.length}; summaries ${coverage.summary}/${items.length}; descriptions ${coverage.description}/${items.length}; people ${coverage.people}/${items.length}; context ${context}/${items.length}.`);
console.log(`Literal “trivia” appears in ${triviaDvdasa}/${dvdasa} DVDASA routes and ${triviaAll}/${items.length} routes overall.`);
if (process.argv.includes('--require-complete') && (editorial !== items.length || missing.length)) process.exit(1);
