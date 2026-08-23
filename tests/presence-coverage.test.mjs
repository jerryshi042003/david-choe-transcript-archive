import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['scripts/build_presence.mjs'], { cwd: root, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const expected = new Set(catalog.items.map((item) => item.id));
const presence = JSON.parse(fs.readFileSync(path.join(root, 'data/presence.json'), 'utf8'));

assert.equal(presence.survey.reader_routes, 421);
assert.equal(presence.routes.length, 421);
assert.deepEqual(new Set(presence.routes.map((route) => route.id)), expected);
assert.ok(presence.routes.every((route) =>
  Array.isArray(route.editorial_context)
  && Array.isArray(route.on_show)
  && route.speaker_identity?.state === 'not-audio-attributed'
  && route.speaker_identity?.confidence === 'none'
  && route.speaker_identity?.provenance), 'every route needs explicit speaker-evidence state');
assert.ok(presence.routes.flatMap((route) => route.on_show).every((entry) =>
  entry.state === 'explicitly-introduced-on-show'
  && entry.confidence === 'high'
  && entry.provenance), 'on-show entries need confidence and provenance');

const asa = presence.people.find((person) => person.name === 'Asa Akira');
assert.ok(asa, 'Asa needs explicit on-show evidence');
assert.equal(asa.explicitly_introduced_on_show, 92);
assert.equal(asa.voice_attributed, 0);
assert.equal(presence.routes.filter((route) => route.on_show.some((entry) =>
  entry.name === 'Asa Akira')).length, 92);

const bourdain = presence.people.find((person) => person.name === 'Anthony Bourdain');
assert.ok(bourdain, 'Bourdain needs a reviewed-context record');
assert.equal(bourdain.explicitly_introduced_on_show, 0, 'a context reference is not an on-show credit');
assert.equal(bourdain.editorial_context_routes, 30);
const bourdainEvidence = presence.routes.flatMap((route) => route.editorial_context
  .filter((entry) => entry.name === 'Anthony Bourdain'));
assert.equal(bourdainEvidence.length, 30);
assert.ok(bourdainEvidence.every((entry) =>
  entry.state === 'mentioned-in-reviewed-context' || entry.state === 'named-in-reviewed-editorial'),
  'every Bourdain route must explain the reviewed context instead of implying presence');
assert.ok(bourdainEvidence.some((entry) => entry.context.includes('Anthony Bourdain')),
  'at least one Bourdain route needs human-readable context');

console.log('presence coverage: 421 route records, explicit/on-show vs reviewed-context evidence, and speaker-attribution state passed');
