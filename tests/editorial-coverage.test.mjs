import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (script) => spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
  cwd: root,
  encoding: 'utf8',
});

for (const script of ['embed_editorial.mjs', 'audit_editorial_coverage.mjs']) {
  const result = run(script);
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
}

const report = JSON.parse(fs.readFileSync(path.join(root, 'data/editorial-coverage.json'), 'utf8'));
assert.equal(report.denominator.unique_reader_routes, 421);
assert.equal(report.denominator.catalog_cards, 434);
for (const field of ['editorial', 'summary', 'description', 'context', 'chapters', 'connections']) {
  assert.ok(report.coverage[field] >= 287, `${field} coverage regressed below the recovered human-reviewed base`);
}
assert.equal(report.known_signal_checks.exact_word_trivia.dvdasa_routes, 166);
assert.equal(report.known_signal_checks.exact_word_trivia.dvdasa_denominator, 177);

const subjects = JSON.parse(fs.readFileSync(path.join(root, 'data/subjects.json'), 'utf8'));
assert.ok(subjects.survey.items_with_entities >= 146);
assert.equal(subjects.signals[0].name, 'trivia');
assert.equal(subjects.signals[0].count, 166);
assert.equal(subjects.signals[0].denominator, 177);
assert.ok(!subjects.subjects.themes.some((theme) => theme.name.toLowerCase() === 'trivia'),
  'trivia must use the transcript-signal denominator, not the smaller curated-theme denominator');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.ok(!app.includes('of ${base} curated episodes'));
assert.ok(app.includes('review progress, not an occurrence count'));

console.log('editorial coverage: recovered base, denominator, and trivia regression checks passed');
