import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const script of ['build_subjects.mjs', 'build_presence.mjs', 'build_episode_subjects.mjs']) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const ids = new Set(catalog.items.map((item) => item.id));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/episode-subjects.json'), 'utf8'));
const directory = path.join(root, 'data/episode-subjects');
const routeData = Object.fromEntries(fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => {
  const route = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  return [route.id, route];
}));

assert.equal(manifest.survey.reader_routes, 421);
assert.deepEqual(new Set(Object.keys(routeData)), ids);
assert.ok(Object.values(routeData).every((route) => Array.isArray(route.items) && Array.isArray(route.on_show)));
assert.ok(Object.values(routeData).flatMap((route) => route.items).every((item) =>
  item.name && item.recurring_routes >= 3 && item.context && item.reading && item.source));

const fifteen = routeData['saga1-episode-015-with-david-choe-and-asa-akira'];
assert.ok(fifteen.on_show.some((item) => item.name === 'Asa Akira' && item.recurring_status === 'recurring-on-show-participant'));
const bourdain = fifteen.items.find((item) => item.name === 'Anthony Bourdain');
assert.ok(bourdain, 'Episode 015 needs its Bourdain recurring-subject card');
assert.equal(bourdain.kind, 'people');
assert.equal(bourdain.state, 'editorial-context');
assert.match(bourdain.reading, /not an appearance or voice claim/);

const remembrance = routeData.QpCd4BetnoQ.items.find((item) => item.name === 'Anthony Bourdain');
assert.ok(remembrance, 'a recurring person named in a reviewed title still needs route context');
assert.equal(remembrance.state, 'editorial-context');

console.log('episode subjects: 421 route-specific recurring-subject records passed');
