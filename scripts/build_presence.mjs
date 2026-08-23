#!/usr/bin/env node

/* Build route-level on-show and speaker-evidence records. This deliberately
   separates an introduction that places somebody on the recording from a
   name that merely appears in its text, and from an acoustic voice match. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const routes = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const PEOPLE = [
  ['David Choe', ['David Choe', 'Dave Choe']],
  ['Asa Akira', ['Asa Akira']],
  ['Bobby Lee', ['Bobby Lee']],
  ['Yoshi Obayashi', ['Yoshi Obayashi']],
  ['Critter', ['Critter']],
  ['Steve Lee', ['Steve Lee']],
  ['Money Mark', ['Money Mark']],
  ['Bill Poon', ['Bill Poon', 'Poon']],
  ['Valentin', ['Valentin']],
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isIntroduced = (opening, aliases) => aliases.some((alias) => {
  const name = escape(alias);
  return new RegExp(`(?:with|hosts?|co-hosts?|guest|guests|featuring|joined by|joining|welcome)\\s+[^.]{0,100}\\b${name}\\b`, 'i').test(opening)
    || new RegExp(`\\b${name}\\b[^.]{0,100}(?:hosts?|co-hosts?|guest|guests|is here|joins)`, 'i').test(opening);
});

const compactContext = (text, name) => {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).map((part) => part.trim());
  const match = sentences.find((sentence) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(sentence));
  if (!match) return '';
  if (match.length <= 220) return match;
  const position = match.search(new RegExp(`\\b${escape(name)}\\b`, 'i'));
  const start = Math.max(0, position - 80);
  const end = Math.min(match.length, position + name.length + 125);
  return `${start ? '…' : ''}${match.slice(start, end).trim()}${end < match.length ? '…' : ''}`;
};

const editorialContext = (record, name) => {
  const chapters = record.editorial?.chapters || [];
  const chapter = chapters.find((entry) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(entry.title || ''));
  const summary = compactContext(record.editorial?.summary, name)
    || compactContext(record.editorial?.description, name);
  if (summary) return {
    name,
    state: 'mentioned-in-reviewed-context',
    confidence: 'reviewed-context',
    provenance: 'human-reviewed editorial summary',
    context: summary,
  };
  if (chapter) return {
    name,
    state: 'mentioned-in-reviewed-context',
    confidence: 'reviewed-context',
    provenance: `human-reviewed chapter heading at ${Math.round(chapter.t || 0)} seconds`,
    context: chapter.title,
  };
  return {
    name,
    state: 'named-in-reviewed-editorial',
    confidence: 'reviewed-context',
    provenance: 'human-reviewed editorial people list',
    context: 'Listed by the reviewed route editorial; no on-show or voice claim follows from that listing alone.',
  };
};

const records = routes.map((item) => {
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${item.id}.json`), 'utf8'));
  const opening = (record.segments || [])
    .filter((segment) => Number(segment.t) <= 180)
    .map((segment) => segment.x || '')
    .join(' ');
  const named = [...new Set(record.editorial?.people || [])];
  const onShow = PEOPLE
    .filter(([, aliases]) => isIntroduced(opening, aliases))
    .map(([name]) => ({
      name,
      state: 'explicitly-introduced-on-show',
      confidence: 'high',
      provenance: 'opening transcript introduction (first three minutes)',
    }));
  // Some DVDASA reuploads preserve the original "with David Choe and Asa
  // Akira" route title even when their opening transcript is truncated. That
  // title is on-show framing, unlike a title that merely discusses Asa.
  if (/\bdvdasa\b.*\bwith david choe and asa akira\b/i.test(item.t || record.title || '')) {
    const existing = onShow.find((entry) => entry.name === 'Asa Akira');
    if (existing) existing.provenance += '; publisher route title';
    else onShow.push({
      name: 'Asa Akira',
      state: 'explicitly-introduced-on-show',
      confidence: 'high',
      provenance: 'publisher route title identifies David Choe and Asa Akira as the on-show pair',
    });
  }
  return {
    id: item.id,
    title: item.t || item.title || item.id,
    collection: item.g || item.group || '',
    editorial_context: named.map((name) => editorialContext(record, name)),
    on_show: onShow,
    speaker_identity: {
      state: 'not-audio-attributed',
      confidence: 'none',
      provenance: 'Timed transcript and route metadata are available; no validated voice model or source-audio comparison has yet been run for this route.',
    },
  };
});

const personNames = [...new Set(records.flatMap((record) => [
  ...record.editorial_context.map((entry) => entry.name),
  ...record.on_show.map((entry) => entry.name),
]))].sort((a, b) => a.localeCompare(b));

const people = personNames.map((name) => {
  const onShowRoutes = records.filter((record) => record.on_show.some((entry) => entry.name === name));
  const contextRoutes = records.filter((record) => record.editorial_context.some((entry) => entry.name === name));
  const explicitlyIntroduced = onShowRoutes.length;
  const evidenceState = explicitlyIntroduced >= 3
    ? 'recurring-on-show-participant'
    : explicitlyIntroduced ? 'explicit-on-show-participant' : 'editorial-context-reference';
  return {
    name,
    evidence_state: evidenceState,
    explicitly_introduced_on_show: explicitlyIntroduced,
    editorial_context_routes: contextRoutes.length,
    voice_attributed: 0,
  };
});

const result = {
  schema: 'choe-corpus/presence@2',
  survey: {
    reader_routes: records.length,
    coverage: `${records.length} of ${records.length} reader routes carry a presence and speaker-evidence record.`,
    distinction: 'An explicit opening introduction establishes on-show presence. A reviewed summary, chapter, or people list establishes only route context. Voice attribution requires source audio plus a validated held-out comparison and is not inferred from either form of name evidence.',
  },
  people,
  routes: records,
};

fs.writeFileSync(path.join(DATA, 'presence.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(`presence records: ${records.length} routes; ${people.filter((person) => person.explicitly_introduced_on_show).length} people with explicit opening-introduction evidence`);
