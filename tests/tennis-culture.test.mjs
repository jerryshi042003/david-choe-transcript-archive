import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../tennis-culture/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tennis-culture/styles.css', import.meta.url), 'utf8');
const sources = readFileSync(new URL('../tennis-culture/SOURCES.md', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const ids = new Set(catalog.items.map(item => item.id));

for (const id of ['position','record','people','offers','commitments','travel','choe','sources']) {
  assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
}
for (const term of ['ball mower','Bellevue','daily job','Mike Cherman','Shingo Arai','One Hand Tony','Nothing ready to show','No deliverable','Wilson was not found']) {
  assert.ok(html.toLowerCase().includes(term.toLowerCase()), `missing meeting or evidence term: ${term}`);
}
for (const id of [
  'saga1-episode-101-the-ranch-solo-series-part-one',
  'saga1-episode-119-the-ranch-solo-series-part-two',
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode',
  '3QecMMrcCCA'
]) assert.ok(ids.has(id), `missing archive source ${id}`);

assert.match(html, /one bounded test/i);
assert.match(html, /one test only/i);
assert.match(html, /Tom has not reviewed/i);
assert.match(html, /Mutual-follow information is deliberately not published/i);
assert.match(sources, /San Jose is not part of either exact claim/i);
assert.match(css, /background:var\(--paper\)/);
assert.match(css, /@media \(max-width:820px\)/);
assert.doesNotMatch(css, /#e8ff00|#ff4a32|text-stroke/i);
assert.doesNotMatch(html, /Make the proof|OPEN COURT|Bourdain-shaped|review reel/i);

console.log('Jerry / Tom working notes: structural and evidence checks passed');
