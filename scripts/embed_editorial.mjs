#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITORIAL = path.join(ROOT, 'editorial');
const DATA = path.join(ROOT, 'data');
const write = process.argv.includes('--write');

const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const routeIds = new Set(catalog.items.map((item) => item.id));
const sourceFiles = fs.readdirSync(EDITORIAL).filter((name) => name.endsWith('.json')).sort();
const errors = [];
const writes = [];
let changed = 0;

function shortDescription(summary) {
  const text = String(summary || '').trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/s)?.[0];
  return (sentence || text).trim();
}

function normalizedEditorial(source) {
  const editorial = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'episode_id' || key === 'title') continue;
    editorial[key] = value;
  }
  if (!editorial.description) {
    editorial.description = shortDescription(editorial.summary);
    editorial.description_source = 'Opening of the human-reviewed summary.';
  }
  return editorial;
}

for (const name of sourceFiles) {
  const source = JSON.parse(fs.readFileSync(path.join(EDITORIAL, name), 'utf8'));
  const stem = name.slice(0, -5);
  const id = source.episode_id || stem;
  if (id !== stem) errors.push(`${name}: episode_id does not match filename`);
  if (!routeIds.has(id)) errors.push(`${name}: no matching reader route`);
  if (!String(source.summary || '').trim()) errors.push(`${name}: missing summary`);
  if (!Array.isArray(source.chapters) || !source.chapters.length) errors.push(`${name}: missing chapters`);
  if (!Array.isArray(source.connections) || !source.connections.length) errors.push(`${name}: missing connections`);

  let previous = -Infinity;
  for (const chapter of source.chapters || []) {
    const timestamp = Number(chapter.t ?? chapter.start);
    if (!Number.isFinite(timestamp) || timestamp < previous) {
      errors.push(`${name}: chapters are not in chronological order`);
      break;
    }
    previous = timestamp;
  }

  const dataPath = path.join(DATA, `${id}.json`);
  if (!fs.existsSync(dataPath)) continue;
  const record = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const editorial = normalizedEditorial(source);
  if (JSON.stringify(record.editorial) === JSON.stringify(editorial)) continue;
  changed += 1;
  record.editorial = editorial;
  writes.push([dataPath, `${JSON.stringify(record)}\n`]);
}

if (errors.length) {
  console.error('Editorial embedding failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (write) {
  for (const [dataPath, serialized] of writes) fs.writeFileSync(dataPath, serialized);
}

if (!write && changed) {
  console.error(`${changed} transcript records are out of sync; run node scripts/embed_editorial.mjs --write`);
  process.exit(1);
}

console.log(`${sourceFiles.length} editorial records validated; ${write ? changed : 0} transcript records written.`);
