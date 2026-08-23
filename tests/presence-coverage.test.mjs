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
  Array.isArray(route.named_in_editorial)
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
assert.equal(asa.routes.length, 92);

console.log('presence coverage: 421 route records, explicit on-show evidence, and speaker-attribution state passed');
