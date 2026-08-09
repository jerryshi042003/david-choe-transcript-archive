import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../tennis-culture/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tennis-culture/styles.css', import.meta.url), 'utf8');
const sources = readFileSync(new URL('../tennis-culture/SOURCES.md', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const ids = new Set(catalog.items.map(item => item.id));

for (const term of ['ball mower','Bellevue','daily job','Mike Cherman','Shingo Arai','One Hand Tony','Nothing is ready to send','Tom says he has a videographer friend']) {
  assert.ok(html.toLowerCase().includes(term.toLowerCase()), `missing meeting fact: ${term}`);
}

for (const id of [
  'saga1-episode-101-the-ranch-solo-series-part-one',
  'saga1-episode-119-the-ranch-solo-series-part-two',
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode',
  '3QecMMrcCCA', '-wZk4B1BB0c', 'OP1mXscTUnw', 'zHyvVajsqMw'
]) assert.ok(ids.has(id), `missing archive source ${id}`);

assert.ok((html.match(/class="choe"[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) || []).length >= 25, 'Choe accumulation must contain at least 25 timestamped items');
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

console.log('single-page tennis archive: content, citations, and no-UI checks passed');
