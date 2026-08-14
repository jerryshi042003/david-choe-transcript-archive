import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

const primary = [...html.matchAll(/data-primary="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(primary, ['recordings', 'corpus', 'recent'], 'primary navigation must express exactly three user jobs');
assert.match(html, />Recordings<\/a>/);
assert.match(html, />The corpus<\/a>/);
assert.match(html, />Current YouTube<\/a>/);

const browse = html.match(/<section id="browse">([\s\S]*?)<\/section>/)?.[1] || '';
assert.doesNotMatch(browse, /tennis-culture|tom-handoff|sources\//, 'project/admin links must stay out of the recording path');
assert.match(html, /class="footlinks"/);
assert.match(html, /Every episode has a human-written summary and reviewed names/);
assert.doesNotMatch(html, /Most entries remain uncorrected/);

assert.match(app, /const COLLECTIONS = \['All', 'DVDASA', 'Interviews', 'His channel', 'Clips'\]/);
assert.doesNotMatch(app.match(/function renderFilters\(\) \{([\s\S]*?)\n\}/)?.[1] || '', /data-(hub|retold|stories|subjects)/,
  'recording filters must not contain navigation actions');

for (const label of ['Reading the corpus', 'Stories & patterns', 'People & subjects']) assert.ok(app.includes(label));
for (const label of ['Corpus overview', 'Route map', 'Method', 'Verified stories', 'Similar passages', 'Arcs', 'Cast', 'Recurring subjects']) {
  assert.ok(app.includes(label), `missing grouped corpus destination: ${label}`);
}
assert.match(app, /analysisSelect/);
assert.match(app, /data\/browse-index\.json/);
assert.match(app, /record-summary/);
assert.match(app, /People named/);
assert.match(app, /individual lines are left unnamed unless directly verified/);
assert.match(app, /The summary and people list were checked by a person/);
assert.match(app, /What happens — human-written context, separate from the transcript/);
assert.doesNotMatch(app, /Cleaning removed \$\{c\.segments_dropped\}/);
assert.match(css, /\.analysis-view/);
assert.match(css, /@media \(max-width: 760px\)/);

console.log('navigation organization: three primary jobs, true filters, grouped corpus views, and mobile selector passed');
