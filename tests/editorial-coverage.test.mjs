import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (script, args = []) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
  cwd: root,
  encoding: 'utf8',
});

for (const script of [
  'build_reupload_editorial.mjs',
  'build_excerpt_editorial.mjs',
  'build_official_editorial.mjs',
  'build_external_editorial.mjs',
  'build_visual_editorial.mjs',
  'review_editorial_entities.mjs',
  'embed_editorial.mjs',
  'build_trivia_coverage.mjs',
]) {
  const result = run(script);
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
}
const completeAudit = run('audit_editorial_coverage.mjs', ['--require-complete']);
assert.equal(completeAudit.status, 0, `complete audit failed:\n${completeAudit.stdout}\n${completeAudit.stderr}`);

const report = JSON.parse(fs.readFileSync(path.join(root, 'data/editorial-coverage.json'), 'utf8'));
assert.equal(report.denominator.unique_reader_routes, 421);
assert.equal(report.denominator.catalog_cards, 434);
for (const field of ['editorial', 'summary', 'description', 'context', 'chapters', 'people', 'themes', 'connections']) {
  assert.equal(report.coverage[field], 421, `${field} must cover every unique route`);
}
for (const field of ['summary', 'description', 'chapters', 'people', 'places', 'works', 'themes', 'connections']) {
  assert.equal(report.reviewed_coverage[field], 421, `${field} review status must cover every unique route`);
}
assert.deepEqual(report.incomplete, []);
assert.equal(report.known_signal_checks.exact_word_trivia.dvdasa_routes, 166);
assert.equal(report.known_signal_checks.exact_word_trivia.dvdasa_denominator, 177);

const subjects = JSON.parse(fs.readFileSync(path.join(root, 'data/subjects.json'), 'utf8'));
assert.equal(subjects.survey.items_with_entities, 421);
assert.equal(subjects.signals[0].name, 'trivia');
assert.equal(subjects.signals[0].count, 167);
assert.equal(subjects.signals[0].denominator, 177);
assert.equal(subjects.signals[0].reviewed, 177);
assert.ok(!subjects.subjects.themes.some((theme) => theme.name.toLowerCase() === 'trivia'),
  'trivia must use the transcript-signal denominator, not the smaller curated-theme denominator');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.ok(!app.includes('of ${base} curated episodes'));
assert.ok(app.includes('review progress, not an occurrence count'));

const trivia = JSON.parse(fs.readFileSync(path.join(root, 'data/trivia-coverage.json'), 'utf8'));
assert.equal(trivia.reviewed, 177);
assert.equal(trivia.denominator, 177);
assert.equal(trivia.present, 167);
assert.equal(trivia.routes.filter((route) => route.status === 'reviewed-present-unlabeled').length, 1);
assert.equal(trivia.routes.filter((route) => route.status === 'reviewed-format-exception').length, 3);

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const ids = [...new Set(catalog.items.map((item) => item.id))];
assert.equal(ids.length, 421);
for (const id of ids) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'editorial', `${id}.json`), 'utf8'));
  assert.ok(source.summary?.trim(), `${id}: summary missing`);
  assert.ok(source.description?.trim(), `${id}: description missing`);
  assert.ok(Array.isArray(source.people) && source.people.length, `${id}: reviewed people missing`);
  for (const field of ['places', 'works', 'themes']) assert.ok(Array.isArray(source[field]), `${id}: ${field} review missing`);
  assert.ok(Array.isArray(source.connections) && source.connections.length, `${id}: connections missing`);
  assert.ok(Array.isArray(source.chapters) && source.chapters.length, `${id}: chapters missing`);
  let previous = -Infinity;
  for (const chapter of source.chapters) {
    const timestamp = Number(chapter.t ?? chapter.start);
    assert.ok(Number.isFinite(timestamp) && timestamp >= previous, `${id}: chapters out of order`);
    previous = timestamp;
  }
}

const sample = (id) => JSON.parse(fs.readFileSync(path.join(root, 'editorial', `${id}.json`), 'utf8'));
const liveRoom = sample('saga2-november-2nd-a-naked-starfish-and-the-most-dangerous-show-on-earth');
assert.ok(liveRoom.summary.includes('Reddit AMA'));
assert.ok(liveRoom.people.includes('Veruca James'));
assert.ok(!liveRoom.people.includes('Lucy Liu'));
const dirtyHands = sample('vimeo-dirty-hands-laff');
assert.equal(dirtyHands.chapters.length, 36);
assert.ok(dirtyHands.source_notes.some((note) => note.includes('human-reviewed scene notes')));
assert.ok(sample('T5Bc_q5FHCQ').summary.includes('Snapchat compilation'));
assert.equal(sample('LdqB8988S2U').quality.canonical_route, 'saga1-episode-032-with-david-choe-and-asa-akira');
assert.ok(sample('qVPlWFKUBCI').content_warnings.some((warning) => warning.includes('suicide')));
assert.ok(sample('oRWi-tZyotE').summary.includes('not an adjudication'));
assert.equal(sample('TzEI4nsKhx4').quality.transcript_limited, true);

console.log('editorial coverage: 421-route completion, entity review, samples, and trivia regressions passed');
