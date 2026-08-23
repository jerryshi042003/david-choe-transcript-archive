#!/usr/bin/env node

/* Build the quiet, route-specific layer used in every transcript reader. It is
   intentionally an index over human-reviewed subjects, not a topic model: each
   card names why this subject matters in this recording and how far it recurs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUTPUT = path.join(DATA, 'episode-subjects');
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const routes = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const subjects = JSON.parse(fs.readFileSync(path.join(DATA, 'subjects.json'), 'utf8'));
const presence = JSON.parse(fs.readFileSync(path.join(DATA, 'presence.json'), 'utf8'));
const presenceByRoute = new Map(presence.routes.map((route) => [route.id, route]));
const presenceByPerson = new Map(presence.people.map((person) => [person.name, person]));

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contextFor = (editorial, name, title = '') => {
  if (new RegExp(`\\b${escape(name)}\\b`, 'i').test(title)) return { source: 'reviewed route title', text: title };
  const chapter = (editorial.chapters || []).find((entry) =>
    new RegExp(`\\b${escape(name)}\\b`, 'i').test(entry.title || ''));
  if (chapter) return { source: `reviewed chapter at ${Math.round(chapter.t || 0)} seconds`, text: chapter.title };
  const sentences = `${editorial.summary || ''} ${editorial.description || ''}`.split(/(?<=[.!?])\s+/);
  const sentence = sentences.find((entry) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(entry));
  if (!sentence) return { source: 'reviewed route tags', text: `${name} is included in this route’s human-reviewed ${editorial.themes?.includes(name) ? 'themes' : 'places'} list.` };
  const compact = sentence.trim();
  if (compact.length <= 210) return { source: 'reviewed editorial summary', text: compact };
  const at = compact.search(new RegExp(`\\b${escape(name)}\\b`, 'i'));
  const start = Math.max(0, at - 72);
  const end = Math.min(compact.length, at + name.length + 122);
  return { source: 'reviewed editorial summary', text: `${start ? '…' : ''}${compact.slice(start, end).trim()}${end < compact.length ? '…' : ''}` };
};

const recurringByRoute = new Map(routes.map((route) => [route.id, []]));
for (const kind of ['people', 'places', 'themes']) {
  for (const subject of subjects.subjects?.[kind] || []) {
    for (const episode of subject.episodes || []) {
      recurringByRoute.get(episode.id)?.push({ kind, name: subject.name, recurring_routes: subject.count });
    }
  }
}

// A reviewed people list is intentionally conservative. If a recurring person
// is named in a reviewed title, summary, description, or chapter, retain that
// as context only—never as a guest or speaker claim.
const recurringPeople = subjects.subjects?.people || [];
for (const route of routes) {
  const record = JSON.parse(fs.readFileSync(path.join(DATA, `${route.id}.json`), 'utf8'));
  const existing = new Set((recurringByRoute.get(route.id) || [])
    .filter((subject) => subject.kind === 'people').map((subject) => subject.name));
  const reviewText = [route.t || route.title || '', record.editorial?.summary || '', record.editorial?.description || '',
    ...(record.editorial?.chapters || []).map((chapter) => chapter.title || '')].join(' ');
  for (const subject of recurringPeople) {
    if (!existing.has(subject.name) && new RegExp(`\\b${escape(subject.name)}\\b`, 'i').test(reviewText)) {
      recurringByRoute.get(route.id)?.push({ kind: 'people', name: subject.name, recurring_routes: subject.count });
    }
  }
}

const result = {
  schema: 'choe-corpus/episode-subjects@1',
  survey: {
    reader_routes: routes.length,
    coverage: `${routes.length} of ${routes.length} reader routes have a route-specific recurring-subject record.`,
    boundary: 'Only subjects appearing in at least three human-reviewed routes are shown. A person card distinguishes explicit on-show evidence from editorial context; places and themes describe reviewed route context, not speaker identity.',
  },
  routes: Object.fromEntries(routes.map((route) => {
    const record = JSON.parse(fs.readFileSync(path.join(DATA, `${route.id}.json`), 'utf8'));
    const routePresence = presenceByRoute.get(route.id) || {};
    const on_show = (routePresence.on_show || []).map((entry) => {
      const person = presenceByPerson.get(entry.name);
      return {
        name: entry.name,
        state: entry.state,
        source: entry.provenance,
        recurring_status: person?.evidence_state || 'explicit-on-show-participant',
        recurring_count: person?.explicitly_introduced_on_show || 1,
        reading: `${entry.name} is explicitly introduced on this recording${person?.explicitly_introduced_on_show > 1 ? ` and has the same evidence on ${person.explicitly_introduced_on_show} routes` : ''}.`,
      };
    });
    const items = (recurringByRoute.get(route.id) || []).map((subject) => {
      if (subject.kind === 'people') {
        const onShow = (routePresence.on_show || []).find((entry) => entry.name === subject.name);
        const context = (routePresence.editorial_context || []).find((entry) => entry.name === subject.name);
        const state = onShow ? 'explicitly-on-show' : 'editorial-context';
        const fallback = contextFor(record.editorial || {}, subject.name, route.t || route.title || '');
        const evidence = onShow || context || { provenance: fallback.source, context: fallback.text };
        return {
          ...subject,
          state,
          source: evidence.provenance,
          context: evidence.context || `${subject.name} is explicitly introduced on this recording.`,
          reading: onShow
            ? `${subject.name} recurs in ${subject.recurring_routes} reviewed routes and is explicitly introduced on this recording.`
            : `${subject.name} recurs in ${subject.recurring_routes} reviewed routes; this card records context, not an appearance or voice claim.`,
        };
      }
      const context = contextFor(record.editorial || {}, subject.name, route.t || route.title || '');
      return {
        ...subject,
        state: 'reviewed-recurring-subject',
        source: context.source,
        context: context.text,
        reading: `${subject.name} is a recurring ${subject.kind.slice(0, -1)} across ${subject.recurring_routes} reviewed routes and is marked in this episode’s editorial context.`,
      };
    }).sort((a, b) => a.kind.localeCompare(b.kind) || b.recurring_routes - a.recurring_routes || a.name.localeCompare(b.name));
    return [route.id, { title: route.t || route.title || route.id, on_show, items }];
  })),
};

fs.mkdirSync(OUTPUT, { recursive: true });
for (const file of fs.readdirSync(OUTPUT)) {
  if (file.endsWith('.json')) fs.unlinkSync(path.join(OUTPUT, file));
}
for (const [id, route] of Object.entries(result.routes)) {
  fs.writeFileSync(path.join(OUTPUT, `${id}.json`), `${JSON.stringify({ schema: result.schema, id, ...route }, null, 1)}\n`);
}
fs.writeFileSync(path.join(DATA, 'episode-subjects.json'), `${JSON.stringify({ schema: result.schema, survey: result.survey }, null, 1)}\n`);
console.log(`episode-subjects: ${routes.length} route records; ${Object.values(result.routes).reduce((total, route) => total + route.items.length, 0)} recurring-subject cards`);
