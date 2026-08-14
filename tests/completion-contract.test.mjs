import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const catalog = read('data/catalog.json');
const browse = read('data/browse-index.json');
const recent = read('data/recent-channel.json');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(catalog.items.length, 434, 'catalog-card denominator changed');
const ids = [...new Set(catalog.items.map((item) => item.id))];
assert.equal(ids.length, 421, 'unique reader-route denominator changed');
assert.equal(Object.keys(browse.routes).length, 421, 'browse index must cover every route');

const plainLabels = new Set([
  'Human-checked transcript',
  'Edited computer transcript',
  'Uploader captions',
  'YouTube auto-captions',
  'Computer transcript',
]);

for (const id of ids) {
  const readerPath = path.join(root, 'data', `${id}.json`);
  const editorialPath = path.join(root, 'editorial', `${id}.json`);
  assert.ok(fs.existsSync(readerPath), `${id}: reader route is missing`);
  assert.ok(fs.existsSync(editorialPath), `${id}: editorial record is missing`);
  const reader = JSON.parse(fs.readFileSync(readerPath, 'utf8'));
  const editorial = JSON.parse(fs.readFileSync(editorialPath, 'utf8'));
  const route = browse.routes[id];
  assert.equal(reader.id, id, `${id}: reader record ID mismatch`);
  assert.ok(Array.isArray(reader.segments), `${id}: transcript/scene record is missing`);
  assert.ok(reader.segments.every((segment) => !('speaker' in segment) && !('speaker_name' in segment) && !('voice' in segment)),
    `${id}: line-level speaker names are not acoustically verified`);
  assert.ok(reader.provenance && (reader.provenance.url || reader.provenance.archive || reader.provenance.file),
    `${id}: source provenance is missing`);
  assert.ok(editorial.description?.trim(), `${id}: human-written description is missing`);
  assert.ok(!editorial.description.includes('\n'), `${id}: browse description must remain one line`);
  assert.ok(Array.isArray(editorial.people) && editorial.people.length, `${id}: reviewed people are missing`);
  assert.equal(route.description, editorial.description.trim(), `${id}: browse description is stale`);
  assert.deepEqual(route.people, [...new Set(editorial.people.map((name) => String(name).trim()).filter(Boolean))],
    `${id}: browse people list is stale`);
  assert.ok(plainLabels.has(route.transcript_label), `${id}: transcript status is not plain language`);
}

for (const item of catalog.items) {
  if (!item.th) continue;
  if (item.th.startsWith('thumbs/')) {
    assert.ok(fs.existsSync(path.join(root, item.th)), `${item.id}: local catalog image is missing`);
  } else {
    assert.match(item.th, /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/mqdefault\.jpg$/,
      `${item.id}: external image is not a source-linked YouTube thumbnail`);
  }
}

assert.equal(recent.videos.length, 119, 'official-channel denominator changed');
assert.equal(new Set(recent.videos.map((video) => video.id)).size, 119, 'official-channel IDs must be unique');
assert.match(recent.survey.rights, /No video, audio, captions, transcripts, descriptions or contact sheets are published/);
for (const video of recent.videos) {
  assert.ok(video.summary.length > 80, `${video.id}: orientation summary is incomplete`);
  assert.ok(video.edit_read.length > 30 && video.sound_read.length > 30, `${video.id}: audiovisual context is incomplete`);
  assert.match(video.url, new RegExp(`^https://www\\.youtube\\.com/watch\\?v=${video.id}$`));
  for (const forbidden of ['source_description', 'captions', 'transcript', 'contact_sheet_url']) {
    assert.ok(!(forbidden in video), `${video.id}: third-party ${forbidden} must not be published`);
  }
}

const startIds = [...app.matchAll(/id: '([^']+)', href: '#(?:\/[^']+|ranch)'/g)].map((match) => match[1]);
assert.deepEqual(startIds, [
  'saga1-episode-001-with-david-choe-and-asa-akira',
  'saga1-episode-101-the-ranch-solo-series-part-one',
  '2Xw5EgZdNvQ',
  '01HBjlMmqCQ',
], 'visual starting paths changed without an explicit review');
assert.ok(startIds.every((id) => ids.includes(id) && catalog.items.some((item) => item.id === id && item.th)),
  'every visual starting path needs a valid reader route and catalog image');
assert.match(app, /const DEFAULT_VISIBLE = 24/);
assert.match(app, /const source = item\.th \|\| generatedThumb\(item\)/,
  'every recording row needs an existing or archive-generated thumbnail');
assert.match(app, /Show all \$\{idx\.length\} recordings/);
assert.match(app, /Show all \$\{sv\.videos\} current videos/);
assert.match(html, /aria-live="polite"/);

console.log('completion contract: 434 cards, 421 routes, 119 current videos, rights, images, status, and visual entry paths passed');
