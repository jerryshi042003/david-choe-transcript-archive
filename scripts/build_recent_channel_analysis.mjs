#!/usr/bin/env node
/** Build a rights-safe analysis of the official channel's current era.
 *
 * Inputs are local yt-dlp metadata and derived audiovisual measurements. Full
 * descriptions, captions, audio and video are deliberately excluded from the
 * tracked artifact.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) =>
  value.startsWith('--') ? [value.slice(2), all[index + 1] ?? true] : null).filter(Boolean));
const metadataDir = args.metadata;
const metricsFile = args.metrics;
const longFile = args.long;
const extraFile = args.extra;
const outFile = args.output || 'data/recent-channel.json';
if (!metadataDir || !metricsFile) {
  console.error('Usage: node scripts/build_recent_channel_analysis.mjs --metadata DIR --metrics FILE [--long FILE] [--extra FILE] --output FILE');
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const metricSets = [metricsFile, longFile, extraFile].filter(Boolean)
  .filter((file) => fs.existsSync(file)).map(readJson);
const byIndex = new Map();
for (const set of metricSets) {
  for (const row of set.videos || []) {
    const prior = byIndex.get(row.playlist_index) || {};
    byIndex.set(row.playlist_index, {
      ...prior, ...row,
      edit_metrics: row.edit_metrics || prior.edit_metrics || null,
      sound_metrics: row.sound_metrics || prior.sound_metrics || null,
    });
  }
}

const files = fs.readdirSync(metadataDir).filter((name) => /^\d{3}-.*\.info\.json$/.test(name));
const metadata = files.map((name) => {
  const index = Number(name.slice(0, 3));
  return { index, info: readJson(path.join(metadataDir, name)) };
}).filter(({ index }) => index >= 1 && index <= 119).sort((a, b) => a.index - b.index);
if (metadata.length !== 119) throw new Error(`Expected 119 metadata rows, found ${metadata.length}`);

const phases = [
  {
    id: 'focused-studio-essays', label: 'Focused studio essays', from: '20250805', to: '20260807',
    description: 'Short weekly films make one emotional or creative proposition, keep returning to the artwork, and use archive fragments or jokes as punctuation rather than the main event.',
  },
  {
    id: 'process-essay-synthesis', label: 'Process and essay converge', from: '20241007', to: '20250731',
    description: 'Painting, drawing, travel and confession begin sharing one structure: a concrete activity carries a larger argument about pain, play, attention or identity.',
  },
  {
    id: 'art-tutorial-workshop', label: 'Art-tutorial workshop', from: '20240130', to: '20240930',
    description: 'The camera settles into the studio and the edit increasingly follows hands, tools, surfaces and stages of a work, while the monologue still wanders through therapy, jokes and autobiography.',
  },
  {
    id: 'confessional-color-rants', label: 'Confessional color rants', from: '20221105', to: '20231213',
    description: 'Direct address, color motifs, self-help, family and identity arrive as a rapid collage of talking head, performance, symbolic inserts and archive material.',
  },
];

const phaseFor = (date) => phases.find((phase) => date >= phase.from && date <= phase.to);
const cleanSubject = (title) => title.replace(/\s*[-|—:]\s*(Art|Life) Tutorial.*$/i, '')
  .replace(/^How (?:to|Can You)\s+/i, '').replace(/^Why\s+/i, '').replace(/^David Choe(?:'s)?\s+/i, '')
  .replace(/\s+/g, ' ').trim();

function modeFor(title) {
  const text = title.toLowerCase();
  if (/conversation|interview/.test(text)) return 'conversation';
  if (/short film|teaser|halloween kid/.test(text)) return 'short film / presentation';
  if (/philippines|thumbs up|fashion district|thrift|crenshaw|portugal|friends in one hour|sizzler/.test(text)) return 'field story';
  if (/tutorial|how to (draw|paint|make|use)|painting through|underpaint|canvas|art technique/.test(text)) return 'studio lesson';
  if (/mom|dad|bourdain|kilmer|jet li|heroes|meatballs/.test(text)) return 'personal story / portrait';
  return 'confessional essay';
}

function summaryFor(title, mode) {
  const subject = cleanSubject(title);
  const endings = {
    'studio lesson': 'using visible art-making as both demonstration and emotional argument.',
    'field story': 'letting place, encounter and movement carry the reflection.',
    'conversation': 'through an edited exchange rather than a single studio monologue.',
    'short film / presentation': 'as a made piece or presentation rather than a conventional lesson.',
    'personal story / portrait': 'through memory, relationship and associated images.',
    'confessional essay': 'through direct address, self-interruption, metaphor and visual collage.',
  };
  return `An official-channel ${mode} centered on ${subject}, ${endings[mode]}`;
}

function editRead(metrics) {
  if (!metrics) return 'Audiovisual measurement unavailable; no neighboring video is used as a substitute.';
  const rate = metrics.cuts_per_minute;
  const label = rate >= 45 ? 'rapid associative montage'
    : rate >= 30 ? 'high-density collage'
      : rate >= 18 ? 'guided process montage' : 'patient process/story edit';
  return `${label}: ${rate.toFixed(1)} detected scene changes per minute, with a ${metrics.median_shot_seconds.toFixed(1)}-second median interval.`;
}

function soundRead(metrics) {
  if (!metrics) return 'Sound measurement unavailable; music and effects are not inferred from the title or neighboring uploads.';
  const silence = metrics.silence_ratio < 0.02 ? 'nearly continuous mixed track'
    : metrics.silence_ratio < 0.06 ? 'brief breathing gaps' : 'substantial quiet passages';
  const dynamics = metrics.loudness_range_lu >= 9 ? 'wide dynamics'
    : metrics.loudness_range_lu >= 5 ? 'moderate dynamics' : 'compressed dynamics';
  return `${silence}; ${dynamics} (${metrics.integrated_lufs} LUFS integrated, ${metrics.loudness_range_lu} LU range).`;
}

const videos = metadata.map(({ index, info }) => {
  const measured = byIndex.get(index) || {};
  const mode = modeFor(info.title);
  const phase = phaseFor(info.upload_date);
  if (!phase) throw new Error(`No phase for ${info.upload_date}: ${info.title}`);
  return {
    playlist_index: index,
    id: info.id,
    title: info.title,
    upload_date: info.upload_date,
    duration_seconds: info.duration,
    url: info.webpage_url,
    mode,
    phase: phase.id,
    summary: summaryFor(info.title, mode),
    edit_metrics: measured.edit_metrics || null,
    sound_metrics: measured.sound_metrics || null,
    edit_read: editRead(measured.edit_metrics),
    sound_read: soundRead(measured.sound_metrics),
    review_status: measured.edit_metrics ? 'metadata + audiovisual measurement' : 'metadata; audiovisual measurement unavailable',
  };
});

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const phaseRows = phases.map((phase) => {
  const rows = videos.filter((video) => video.phase === phase.id);
  const cuts = rows.map((video) => video.edit_metrics?.cuts_per_minute).filter(Number.isFinite);
  return {
    ...phase,
    videos: rows.length,
    from_date: [...rows].sort((a, b) => a.upload_date.localeCompare(b.upload_date))[0]?.upload_date,
    to_date: [...rows].sort((a, b) => b.upload_date.localeCompare(a.upload_date))[0]?.upload_date,
    measured_edits: cuts.length,
    median_cuts_per_minute: Number(median(cuts)?.toFixed(1)),
  };
});
const measuredEdits = videos.filter((video) => video.edit_metrics).length;
const measuredSound = videos.filter((video) => video.sound_metrics).length;

const output = {
  generated: '2026-08-13',
  survey: {
    channel: 'David Choe', channel_id: 'UC8nsCoikuQdKJflLAOEwlTw',
    channel_url: 'https://www.youtube.com/@davidchoe/videos',
    boundary: 'Every official-channel upload from 2022-11-05 through 2026-08-07: the continuous current-era run after the prior 2022 gap.',
    videos: videos.length,
    date_from: '20221105', date_to: '20260807',
    hours: Number((videos.reduce((sum, video) => sum + video.duration_seconds, 0) / 3600).toFixed(1)),
    edit_measurements: measuredEdits, sound_measurements: measuredSound,
    explicit_edit_gaps: videos.length - measuredEdits,
    explicit_sound_gaps: videos.length - measuredSound,
    rights: 'Tracked data contains official metadata, original paraphrase and derived measurements. No video, audio, captions, transcripts, descriptions or contact sheets are published.',
    method: 'Scene-change rate is an FFmpeg scdet measurement at a fixed 10% threshold; sound uses silence detection and EBU R128 loudness. These describe rhythm and density, not editorial intent by themselves.',
  },
  thesis: {
    name: 'Confessional process collage',
    shorthand: 'Bob Ross with a hyperactive associative editor—but the process is emotional rather than instructional in the television-painting sense.',
    reading: 'The channel does not simply become faster. Its early films cut more aggressively across talking head, performance, memory, jokes and symbols. The later work often slows down and disciplines the same restless energy around a canvas: hands, tools and changes to the image become the spine, while autobiography and sound design orbit the act of making.',
    speaking: 'Choe talks in recursive bursts: command, confession, joke, image, self-correction, then a return to the command. The edit makes those detours feel purposeful by attaching them to visible progress in the artwork.',
    sound: 'The soundtrack is usually nearly continuous rather than contemplatively quiet. Dynamic shifts, hard transitions and dense mixing keep the studio process energized; silence is an accent, not the default. Per-video sound fields report only measurable loudness and quiet—not invented music or effect labels.',
  },
  editing_grammar: [
    {
      name: 'Process spine',
      reading: 'A recurring studio wide shot, a speaking close-up, and hand/canvas detail keep proving that something is being made while the monologue wanders.',
    },
    {
      name: 'Associative smash cut',
      reading: 'A spoken image can trigger a jump to family footage, travel, television, animation, food, performance, or an intentionally ridiculous literal illustration.',
    },
    {
      name: 'Graphic intervention',
      reading: 'Oversized captions, chromatic outlines, scrawls, drawn circles, cutout figures and saturated text treat the frame like another paint surface.',
    },
    {
      name: 'Return with evidence',
      reading: 'After a joke or memory detour, the edit returns to the same artwork at a later stage. Visible change makes the tangent feel like part of a lesson rather than an abandoned thought.',
    },
    {
      name: 'Texture collision',
      reading: 'Clean studio footage, phone video, archival clips, animation, film excerpts and vertical material keep their different aspect ratios and image textures instead of being smoothed into one visual world.',
    },
    {
      name: 'Quiet as punctuation',
      reading: 'Measured tracks are usually continuous and fairly dense; silence appears as a brief break around emphasis, not as the sustained calm of a conventional painting program.',
    },
  ],
  phases: phaseRows,
  videos,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${outFile}: ${videos.length} videos, ${measuredEdits} edit measurements, ${measuredSound} sound measurements`);
