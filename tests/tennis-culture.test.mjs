import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = readFileSync(new URL('../tennis-culture/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tennis-culture/styles.css', import.meta.url), 'utf8');
const sources = readFileSync(new URL('../tennis-culture/SOURCES.md', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const ids = new Set(catalog.items.map(item => item.id));

for (const term of ['ball mower','Bellevue','daily job','Mike Cherman','Shingo Arai','One Hand Tony','Nothing is ready to send','videographer friend','TOM HAS NOT REVIEWED','NEXT PROOF — NOT AGREED','one finished object']) {
  assert.ok(html.toLowerCase().includes(term.toLowerCase()), `missing meeting fact: ${term}`);
}

for (const id of [
  'saga1-episode-101-the-ranch-solo-series-part-one',
  'saga1-episode-119-the-ranch-solo-series-part-two',
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode',
  '3QecMMrcCCA', '-wZk4B1BB0c', 'OP1mXscTUnw', 'zHyvVajsqMw'
]) assert.ok(ids.has(id), `missing archive source ${id}`);

assert.ok((html.match(/class="choe"[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) || []).length >= 38, 'Choe accumulation must contain at least 38 timestamped items');
assert.ok((html.match(/<figure>/g) || []).length >= 8, 'moodboard needs at least eight cited pictures');
assert.ok((html.match(/<figcaption>/g) || []).length === (html.match(/<figure>/g) || []).length, 'every picture needs a citation caption');

for (const forbidden of ['<header', '<nav', '<aside', '<section', '<table', '<details', '<button', 'class="card', 'FACT +', 'LEAD', 'OPEN', 'PROPOSED', 'useful work']) {
  assert.ok(!html.includes(forbidden), `forbidden site structure or status language: ${forbidden}`);
}
assert.doesNotMatch(html, /<h[1-6][^>]*>/i);
assert.match(css, /font-size:\s*15px/);
assert.equal((css.match(/font-size:/g) || []).length, 1, 'use one type size throughout');
assert.doesNotMatch(css, /--[a-z-]+:|position:\s*sticky|border:|box-shadow|background:\s*#[^f]|color:\s*#[^0]/i);
assert.match(sources, /San Jose is not part of either exact claim/i);
assert.match(sources, /421 unique record IDs/i);
assert.match(sources, /all 169 windows read/i);
assert.match(html, /github\.com\/jerryshi042003\/david-choe-transcript-archive\/blob\/main\/tennis-culture\/SOURCES\.md/);

const auditPath = fileURLToPath(new URL('../audit-choe-execution-stories.mjs', import.meta.url));
const auditRun = spawnSync(process.execPath, [auditPath, '--summary'], { encoding: 'utf8' });
assert.equal(auditRun.status, 0, auditRun.stderr);
const audit = JSON.parse(auditRun.stdout);
assert.deepEqual({
  catalogRecords: audit.catalogRecords,
  uniqueCatalogIds: audit.uniqueCatalogIds,
  transcriptFilesFound: audit.transcriptFilesFound,
  reviewWindows: audit.reviewWindows,
  retainedWindows: audit.retainedWindows,
  rejectedWindows: audit.rejectedWindows,
}, {
  catalogRecords: 434,
  uniqueCatalogIds: 421,
  transcriptFilesFound: 421,
  reviewWindows: 169,
  retainedWindows: 37,
  rejectedWindows: 132,
});
assert.deepEqual(audit.missingTranscriptIds, []);

console.log('single-page tennis archive: content, citations, and no-UI checks passed');
