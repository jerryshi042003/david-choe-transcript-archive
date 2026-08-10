import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
const ledger = JSON.parse(readFileSync(new URL('../data/web-sources.json', import.meta.url)));
const sourcePage = readFileSync(new URL('../sources/index.html', import.meta.url), 'utf8');
const routes = new Set(catalog.items.map(item => item.id));

assert.equal(ledger.schema, 'choe-corpus/web-sources@1');
assert.ok(ledger.sources.length >= 12, 'source ledger unexpectedly small');
assert.equal(new Set(ledger.sources.map(source => source.id)).size, ledger.sources.length, 'duplicate source ids');

for (const source of ledger.sources) {
  assert.ok(source.title && source.group && source.status && source.relation && source.coverage, `incomplete source: ${source.id}`);
  assert.match(source.url, /^https:\/\//, `non-HTTPS source URL: ${source.id}`);
  assert.match(source.archive_url, /^https:\/\/web\.archive\.org\/web\/\*/, `missing Wayback browser URL: ${source.id}`);
  for (const record of source.records) {
    assert.ok(routes.has(record.id), `source ${source.id} points to missing reader route ${record.id}`);
  }
}

const dirtyHands = ledger.sources.find(source => source.id === 'dirty-hands');
assert.ok(dirtyHands, 'Dirty Hands must be a first-class source');
assert.equal(dirtyHands.records[0].id, 'vimeo-dirty-hands-laff');
assert.ok(dirtyHands.records.length >= 6, 'Dirty Hands related records missing');
assert.match(sourcePage, /Dirty Hands is here in full/);
assert.match(sourcePage, /\.\.\/#\/vimeo-dirty-hands-laff/);
assert.ok(ledger.sources.some(source => source.id === 'yumyumcha'), 'YumYumCha missing');
assert.ok(ledger.sources.some(source => source.id === 'poon-report'), 'Poon Report missing');
assert.ok(ledger.sources.some(source => source.id === 'david-choe-blog'), 'official blog missing');
assert.ok(ledger.unverified.some(item => /Blogspot/.test(item.claim)), 'Blogspot non-finding must be explicit');

console.log(`web source ledger: ${ledger.sources.length} verified sources, all reader routes resolve`);
