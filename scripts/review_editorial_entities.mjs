#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITORIAL = path.join(ROOT, 'editorial');
const DATA = path.join(ROOT, 'data');
const write = process.argv.includes('--write');
const files = fs.readdirSync(EDITORIAL).filter((name) => name.endsWith('.json')).sort();
const sources = files.map((name) => ({ name, value: JSON.parse(fs.readFileSync(path.join(EDITORIAL, name), 'utf8')) }));

function roster(field) {
  return [...new Set(sources.flatMap(({ value }) => Array.isArray(value[field]) ? value[field] : []))]
    .filter((value) => String(value).trim()).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

const rosters = { people: roster('people'), places: roster('places'), works: roster('works') };
const allowedOneWordPeople = new Set(['Khalyla', 'Critter', 'Saber', 'Ninja']);

function mentioned(text, value, field) {
  if (field === 'people' && !String(value).includes(' ') && !allowedOneWordPeople.has(value)) return false;
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(text);
}

function fallbackThemes(record) {
  if (record.kind === 'dvdasa') return ['DVDASA episode context', 'long-form conversation'];
  if (record.kind === 'film') return ['documentary film', 'David Choe biography'];
  if (/mangchi/i.test(record.group || '')) return ['Mangchi', 'music performance'];
  return ['David Choe interview or visual archive'];
}

function shortDescription(summary) {
  const text = String(summary || '').trim();
  return (text.match(/^.*?[.!?](?=\s|$)/s)?.[0] || text).trim();
}

let changed = 0;
for (const source of sources) {
  const id = source.value.episode_id || source.name.slice(0, -5);
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${id}.json`), 'utf8'));
  const text = [source.value.title, source.value.description, source.value.summary].filter(Boolean).join(' ');
  let dirty = false;

  if (!String(source.value.description || '').trim()) {
    source.value.description = shortDescription(source.value.summary);
    source.value.description_source = 'Opening of the human-reviewed summary.';
    dirty = true;
  }

  if (!Array.isArray(source.value.people) || source.value.people.length === 0) {
    source.value.people = [...new Set(['David Choe', ...rosters.people.filter((name) => name !== 'David Choe' && mentioned(text, name, 'people'))])];
    dirty = true;
  }
  for (const field of ['places', 'works']) {
    if (!Array.isArray(source.value[field])) {
      source.value[field] = rosters[field].filter((value) => mentioned(text, value, field));
      dirty = true;
    }
  }
  if (!Array.isArray(source.value.themes)) {
    source.value.themes = fallbackThemes(record);
    dirty = true;
  }

  if (!dirty) continue;
  changed += 1;
  if (write) fs.writeFileSync(path.join(EDITORIAL, source.name), `${JSON.stringify(source.value, null, 2)}\n`);
}

if (!write && changed) {
  console.error(`${changed} editorial entity records are out of sync; run node scripts/review_editorial_entities.mjs --write`);
  process.exit(1);
}
console.log(`${files.length} editorial entity records checked; ${write ? changed : 0} source files written.`);
