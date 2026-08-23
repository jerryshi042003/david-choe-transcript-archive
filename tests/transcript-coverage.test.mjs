import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).items;

assert.equal(catalog.length, 434, 'catalog-card denominator changed');
assert.equal(new Set(catalog.map((item) => item.id)).size, 421, 'unique reader-route denominator changed');

let fullTranscripts = 0;
let cleanedScripts = 0;
for (const item of catalog) {
  const transcriptPath = path.join(root, 'data', `${item.id}.json`);
  assert.ok(fs.existsSync(transcriptPath), `${item.id}: full transcript file missing`);
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
  assert.ok(segments.some((segment) => String(segment.x || segment.text || '').trim()),
    `${item.id}: transcript has no readable lines`);
  fullTranscripts += 1;
  if (fs.existsSync(path.join(root, 'data', `${item.id}.script.json`))) cleanedScripts += 1;
}

assert.equal(fullTranscripts, 434, 'every catalog card needs its complete transcript');
assert.ok(cleanedScripts > 0, 'cleaned Script editions should supplement the full transcript corpus');
console.log(`transcript coverage: ${fullTranscripts} full transcripts, ${cleanedScripts} cleaned Script editions, ${fullTranscripts - cleanedScripts} Script fallbacks passed`);
