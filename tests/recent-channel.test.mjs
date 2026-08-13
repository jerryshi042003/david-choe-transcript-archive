import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/recent-channel.json', 'utf8'));
const videos = data.videos || [];
assert.equal(videos.length, 119, 'current-era denominator must remain 119');
assert.equal(new Set(videos.map((video) => video.id)).size, 119, 'video IDs must be unique');
assert.equal(data.survey.date_from, '20221105');
assert.equal(data.survey.date_to, '20260807');
assert.equal(data.phases.reduce((sum, phase) => sum + phase.videos, 0), 119);
assert.equal(data.editing_grammar.length, 6);
assert.equal(videos.filter((video) => video.edit_metrics).length, data.survey.edit_measurements);
assert.equal(videos.filter((video) => video.sound_metrics).length, data.survey.sound_measurements);
assert.equal(videos.filter((video) => !video.edit_metrics).length, data.survey.explicit_edit_gaps);
assert.equal(videos.filter((video) => !video.sound_metrics).length, data.survey.explicit_sound_gaps);
for (const video of videos) {
  assert.match(video.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
  assert.ok(video.summary.length > 80, `${video.id} needs an original orientation summary`);
  assert.ok(video.edit_read.length > 30);
  assert.ok(video.sound_read.length > 30);
  assert.ok(!('source_description' in video), `${video.id} must not publish the uploader description`);
  assert.ok(data.phases.some((phase) => phase.id === video.phase));
}
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
assert.match(index, /href="#recent"/);
assert.match(app, /data\/recent-channel\.json/);
assert.match(app, /renderRecentChannel/);
console.log(`recent channel: ${videos.length} videos · ${data.survey.edit_measurements} picture · ${data.survey.sound_measurements} sound`);
