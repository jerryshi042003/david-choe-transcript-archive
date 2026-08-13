#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

// Human-reviewed focus and timeline for videos published on the David Choe
// channel. These are route-specific records, not summaries inferred from titles.
const videos = {
  '1UA7PnoDiy8': {
    focus: "Choe argues that hiding weakness creates a false strong self, then uses crying, attachment to his mother, broken personal boundaries and repeated failure to frame vulnerability as usable strength.",
    works: [], themes: ['vulnerability', 'weakness', 'crying', 'personal boundaries', 'failure'], warnings: ['emotional distress', 'compulsive behavior'],
    beats: [[0, 'The strong self and the crying self'], [85, 'Checking whether anyone is all right'], [166, 'Breaking a bedroom electronics boundary'], [232, 'Entitlement and finger painting'], [282, 'Falling, stumbling and starting again']]
  },
  '6MIKuySAQTQ': {
    focus: "An art tutorial turns creative blockage into a chaotic letting-go exercise: Choe layers paint, prescribes play rather than a cure, struggles with the urge to protect valuable objects and ends amid jokes about damaged trading cards.",
    works: ['Pokémon', 'Michael Jordan and Stephen Curry trading cards'], themes: ['creative block', 'play', 'letting go', 'ego', 'material value'], warnings: ['mock mental-health diagnosis', 'destruction of possessions'],
    beats: [[0, 'A cured underpainting and creative blockage'], [106, 'Keep what you are willing to release'], [243, 'Fun as the joking prescription'], [365, 'Ego resists destroying value'], [520, 'Trading-card panic']]
  },
  '6y7_BT1kLKA': {
    focus: "While drawing with crayons, Choe asks who tells the truth, contrasts verbal refusal with compliance under pressure, layers dark and middle colors, and closes by admitting the painting does not provide a final answer.",
    works: [], themes: ['truth', 'refusal', 'crayon drawing', 'color layers', 'uncertainty'], warnings: ['coercion and trauma references', 'explicit language'],
    beats: [[0, 'Crayons and a missed lunch'], [112, 'Who tells you the truth?'], [267, 'Dark and middle colors'], [404, 'You should have said no'], [545, 'No final answer']]
  },
  'CXjukgkB1CY': {
    focus: "Choe uses scraping, collage and finger painting as metaphors for removing accumulated emotional dirt, moving through a *Titanic* joke, naming current emotions and treating the artist—not the tool—as the vehicle for change.",
    works: ['Titanic'], themes: ['scraping', 'collage', 'emotional inventory', 'tools', 'inner change'], warnings: ['explicit language', 'bodily and fecal metaphors'],
    beats: [[0, 'Scraping off gunk and darkness'], [132, 'Retconning the Titanic raft'], [259, 'Naming the emotions present today'], [412, 'The artist is the tool'], [535, 'Closer to the heart, not finished']]
  },
  'Gv_yyQBphVs': {
    focus: "A short underpainting lesson asks viewers to identify emotion through color instead of words, reject judgment, investigate a self-portrait and notice when an older angry DVDASA persona interrupts gratitude.",
    works: ['DVDASA'], themes: ['underpainting', 'emotional identification', 'self-portrait', 'non-judgment', 'gratitude'], warnings: ['body-based joking', 'explicit language'],
    beats: [[2, 'Paint the feeling instead of naming it'], [75, 'Thirty-seven seconds without judgment'], [129, 'A bald imagined self'], [194, 'Old DVDASA Dave appears'], [250, 'Change appearance safely on the page']]
  },
  'HgG805RV624': {
    focus: "Choe stages a mask-removal exercise around performance, exercise, scraping and gratitude, asking what remains after social presentation is peeled away and ending with the current painting as an intentionally temporary truth.",
    works: ['Since U Been Gone', 'Pitch Perfect', 'Mangchi'], themes: ['masks', 'performance', 'truth', 'scraping', 'gratitude'], warnings: ['explicit language', 'body-based joking'],
    beats: [[8, 'Dancing, exercise and stand-up masks'], [193, 'The scraper removes layers'], [346, 'Gratitude for ordinary abundance'], [484, 'A pre-stage Kelly Clarkson ritual'], [594, 'The truest expression right now']]
  },
  'IliUj9gs7oA': {
    focus: "Choe argues that comfort prevents artistic and personal growth, then demonstrates unstable spray-can control, deliberately creates difficulty and reminds viewers that paint can be revised rather than protected from every mistake.",
    works: [], themes: ['comfort', 'creative growth', 'spray paint', 'controlled difficulty', 'revision'], warnings: ['harsh insulting language'],
    beats: [[0, 'Comfort keeps a person stuck'], [77, 'Early graffiti and can control'], [155, 'Artificially creating difficulty'], [232, 'It is only paint and can be revised'], [289, 'Many versions of the self']]
  },
  'K82jh4XbjCg': {
    focus: "A compact tutorial pairs an honest conversation with an artist from Choe's old podcast with an ASMR-like bamboo drawing, asking what must be said plainly and who occupies the viewer's imagined forest.",
    works: ['DVDASA'], themes: ['honesty', 'bamboo drawing', 'ASMR', 'imagined space', 'being found'], warnings: ['explicit language'],
    beats: [[0, 'An old podcast guest calls'], [62, 'Drawing bamboo upward'], [146, 'What needs to come off your chest?'], [212, 'Who is in the bamboo forest?'], [275, 'Hidden or waiting to be found']]
  },
  'TBUXC2lXvCE': {
    focus: "Using a lobster molting its shell, Choe argues that artists can become trapped inside defenses built against pain; the tutorial removes layers until the exposed blue lobster becomes a metaphor for rare, vulnerable change.",
    works: [], themes: ['defense mechanisms', 'molting', 'vulnerability', 'letting go', 'growth'], warnings: ['emotional pain', 'explicit language'],
    beats: [[0, 'The shell built against hurt'], [99, 'Returning after a regulating break'], [225, 'Molting from hard to soft'], [354, 'Exposure is unsafe and open'], [475, 'The rare blue lobster']]
  },
  'TRex0Edzz1w': {
    focus: "Choe asks viewers to locate childhood wounds and repaint them from a new point of view, using household tools, a memory of being sent away and his son's sweater to turn inherited pain into a present-day emotional inventory.",
    works: [], themes: ['childhood wounds', 'point of view', 'household tools', 'memory', 'emotional inventory'], warnings: ['childhood trauma', 'family separation', 'emotional distress'],
    beats: [[0, 'No childhood is perfect'], [154, 'Changing point of view'], [339, 'Painting with household debris'], [491, "His son's sweater and an old wound"], [685, 'How are you feeling now?']]
  },
  'Z1fihPegvyk': {
    focus: "A tutorial about discomfort combines painting, a withdrawn apology, troll and halo self-images, attachment to a time-intensive work and a final decision to remain with fear instead of fleeing it.",
    works: [], themes: ['discomfort', 'amends', 'trolling', 'attachment', 'fear'], warnings: ['explicit language', 'conflict and revoked apology'],
    beats: [[4, 'Warming up through smoke and drawing'], [147, 'Taking back an apology'], [323, 'Troll and halo selves'], [458, 'Attachment to invested time'], [583, 'Stay with the discomfort']]
  },
  'amdLmZ5gO6w': {
    focus: "Choe offers a one-day survival routine for overwhelming problems: avoid the most damaging behavior for today, accept falls, bathe, check physical and emotional state, rest and ask more clearly for help tomorrow.",
    works: [], themes: ['one-day-at-a-time', 'self-care', 'body scan', 'rest', 'asking for help'], warnings: ['addiction references', 'overwhelming distress'],
    beats: [[0, 'Just for today'], [63, 'Falling within a pride'], [121, 'Bath, companionship and rest'], [174, 'Full-body self-check'], [244, 'Ask for what is needed tomorrow']]
  },
  'bxqo4zQWNA0': {
    focus: "An emotional art exercise moves from prayer and drawing toward grief for a friend who died by suicide, fear of honest dislike, food and cooking metaphors, and a final palette of shame, anger, jealousy and confusion.",
    works: [], themes: ['emotional painting', 'grief', 'honesty', 'food metaphor', 'named feelings'], warnings: ['suicide and bereavement', 'eating disorders', 'explicit language'],
    beats: [[0, 'A quiet start and blood-pressure ritual'], [125, 'Drawing toward a friend who died'], [242, 'False reciprocity and fear'], [338, 'Cooking and eating-disorder detour'], [442, 'A fuller emotional palette']]
  },
  'cifhF0mCouA': {
    focus: "Choe demonstrates curiosity-led image making by setting aside the final result, transforming sketchy marks into hybrid creatures and more finished forms, and arguing that curiosity turns posing into composing.",
    works: [], themes: ['curiosity', 'fear', 'process', 'hybrid creatures', 'composition'], warnings: ['explicit language'],
    beats: [[0, 'The Los Angeles hipster hat'], [183, 'Divorce process from result'], [422, 'A butterfly-bee-bunny hybrid'], [683, 'Turning scratch marks into fine art'], [891, 'From poser to composer']]
  },
  'cq3QBKbHUro': {
    focus: "To answer creative block, Choe accepts random color constraints, starts with a bowl-cut character, adapts composition to a cramped page and demonstrates hair and clothing while allowing the improvised figure to become a companion.",
    works: [], themes: ['creative block', 'constraints', 'character drawing', 'improvisation', 'composition'], warnings: ['explicit language'],
    beats: [[2, 'Nothing in the big dumb brain'], [161, 'Random color constraints'], [333, 'Working with too little headroom'], [520, 'Drawing hair step by step'], [700, 'The improvised best friend']]
  }
};

function readRoute(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${id}.json`), 'utf8'));
}

function build(id, spec) {
  const route = readRoute(id);
  const duration = Number(route.segments?.at(-1)?.t || 0);
  return {
    episode_id: id,
    title: route.title,
    reviewed_on: '2026-08-13',
    description: spec.focus,
    summary: `${spec.focus} This is an official-channel creative lesson or reflection, not clinical treatment or a universal formula. Its chronological map follows the route's own transcript and distinguishes art-making instructions from autobiographical claims, jokes and metaphors. Visually dependent technique still requires the source video.`,
    chapters: spec.beats.map(([t, title]) => ({ t, title })),
    people: ['David Choe'],
    places: [],
    works: spec.works,
    themes: spec.themes,
    connections: [
      { to: 'David Choe official art-tutorial series', note: 'The route uses a studio art process to organize autobiographical reflection; metaphor is part of the exercise and is not medical advice.' },
      { to: 'process over finished object', note: 'The video treats revision, imperfection and emotional attention as more important than copying a polished Choe image.' }
    ],
    content_warnings: spec.warnings,
    publication_restrictions: [{ t: 0, rule: 'Do not present mental-health, addiction or trauma metaphors as diagnosis or treatment; preserve them as the artist’s framing.' }],
    quality: { aggregate_segments: route.segments?.length || 0, duration_seconds: duration, chapters: spec.beats.length, named_turns: 0, publisher_context: 'David Choe official YouTube channel' },
    source_notes: ['Focus and chapter beats were reviewed against this route transcript.', 'The transcript cannot fully encode tools, color changes, gestures or the developing canvas; use the source video for technique replication.', 'Claims about personal history remain attributed to Choe.'],
    speaker_policy: 'David Choe is the public route-level presenter. Off-camera voices remain unnamed without validated diarization.'
  };
}

let changed = 0;
for (const [id, spec] of Object.entries(videos)) {
  const target = path.join(ROOT, 'editorial', `${id}.json`);
  const serialized = `${JSON.stringify(build(id, spec), null, 2)}\n`;
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === serialized) continue;
  changed += 1;
  if (write) fs.writeFileSync(target, serialized);
}
if (!write && changed) {
  console.error(`${changed} official-video editorial records are out of sync; run node scripts/build_official_editorial.mjs --write`);
  process.exit(1);
}
console.log(`${Object.keys(videos).length} official-video records validated; ${write ? changed : 0} editorial files written.`);
