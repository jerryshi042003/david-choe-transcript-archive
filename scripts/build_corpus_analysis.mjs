#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const items = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const titleById = new Map(items.map((item) => [item.id, item.t]));

const records = items.map((item) => {
  const source = JSON.parse(fs.readFileSync(path.join(DATA, `${item.id}.json`), 'utf8'));
  const editorial = source.editorial || {};
  return {
    id: item.id,
    title: item.t,
    kind: item.k,
    collection: item.c,
    duration: item.d,
    words: item.w,
    editorial,
    // Frequency is intentionally based only on the completed human-reviewed
    // theme tags. Summaries contain generic words such as “show”, “work”, and
    // “public” in almost every route; counting those made a topic look common
    // because of editorial prose rather than because the route was tagged as
    // substantially about it. Connections and summaries support the reading,
    // but they do not inflate the occurrence number.
    topicText: (editorial.themes || []).filter((value) => typeof value === 'string').join(' ').toLowerCase(),
  };
});

const route = (id, note) => {
  if (!titleById.has(id)) throw new Error(`corpus analysis points to missing route: ${id}`);
  return { id, title: titleById.get(id), note };
};

const topicDefinitions = [
  {
    name: 'Art as work, compulsion, and identity',
    pattern: /\b(art|artist|paint|painting|graffiti|drawing|creative|creativity|mural|illustrat|comic|self-publish|composition)\b/,
    reading: 'Making art is presented at once as vocation, survival tactic, practiced craft, social access, and compulsive escape. The corpus is strongest when it shows the labor underneath the myth of spontaneous talent.',
    tension: 'freedom through making ↔ another activity that can become impossible to stop',
    evidence: [
      route('vimeo-dirty-hands-laff', 'The feature-length early-career record.'),
      route('saga1-episode-119-the-ranch-solo-series-part-two', 'A long first-person blueprint about practice, pricing, failure, and stopping.'),
      route('CvHFWwVZKoI', 'Later reflection on suffering, workaholism, and whether destruction is necessary for art.'),
    ],
  },
  {
    name: 'Addiction, gambling, and recovery',
    pattern: /\b(addict|addiction|compulsion|compulsive|gambl|casino|recovery|rehab|sobriet|relapse|twelve-step|12-step)\b/,
    reading: 'Gambling is not an isolated anecdote. It becomes the clearest model for a wider pattern: risk, sex, work, food, attention, travel, and storytelling can all function as wagers that postpone stillness.',
    tension: 'the thrill of risk ↔ the wish to become trustworthy and present',
    evidence: [
      route('XS6awjpIimw', 'A long public account linking gambling, money, art, and the Facebook story.'),
      route('zHyvVajsqMw', 'The most explicit later account of many addictions as forms of running.'),
      route('reW-p9ds4g4', 'Recovery, shame, medical shortcuts, service, and difficulty saying no.'),
    ],
  },
  {
    name: 'Money, Facebook, and the burden of the lucky break',
    pattern: /\b(money|wealth|rich|millionaire|million|facebook|stock|shares|equity|payday|financial|pricing|patronage)\b/,
    reading: 'The archive repeatedly resists the one-line legend that a starving artist randomly became rich from Facebook. Choe alternately accepts the luck, defends the work and relationships that preceded it, and describes what sudden public wealth distorted.',
    tension: 'money as proof of freedom ↔ money as a story that erases the rest of the life',
    evidence: [
      route('i8cDwucTSbo', 'A compact telling of choosing Facebook shares over cash.'),
      route('saga1-episode-101-the-ranch-solo-series-part-one', 'A direct rebuttal to the luck-only version and a Sean Parker counter-story.'),
      route('saga1-episode-068-david-s-announcement', 'Wealth and Facebook proceeds described as accelerants in a downward spiral.'),
    ],
  },
  {
    name: 'Sex, intimacy, consent, and performance',
    pattern: /\b(sex|sexual|porn|pornography|intimacy|relationship|dating|marriage|consent|boundary|partner|love|jealous|monogam)\b/,
    reading: 'DVDASA makes sexuality a recurring game, confession, workplace, and power test. The editorial record has to preserve direct refusals and asymmetries because the room often converts private boundaries into entertainment.',
    tension: 'radical disclosure and experimentation ↔ privacy, consent, and unequal power',
    evidence: [
      route('saga1-episode-009-with-david-choe-and-asa-akira', 'A public-guest conversation that moves from reporting and risk into sex, relationships, and boundaries.'),
      route('saga1-episode-065-saelee-oh-seeks-double-vag-double-anal-dates', 'Friendship, dating, privacy, employment, and a coercive trivia penalty collide.'),
      route('saga2-saga-02-chapter-018-the-marriage-proposal-the-critter-conundrum', 'A clear proposal acceptance is followed by pressure that does not inherit that consent.'),
    ],
  },
  {
    name: 'Friendship, collaboration, and workplace power',
    pattern: /\b(friend|friendship|collaborat|crew|employee|employment|workplace|boss|assistant|producer|loyalty|apology|conflict)\b/,
    reading: 'Friends repeatedly become employees, subjects, collaborators, caretakers, or cast. The same intimacy that produces unusually alive work also makes pay, refusal, firing, credit, and privacy harder to separate.',
    tension: 'chosen family ↔ a workplace whose authority is intentionally blurry',
    evidence: [
      route('saga1-episode-010-with-david-choe-and-asa-akira', 'The potato-chip conflict expands into ownership, trust, apology, and employer power.'),
      route('saga1-episode-058-the-reporter', 'A press encounter exposes friendship, informal labor, sudden fame, and consent problems.'),
      route('saga2-saga-02-chapter-030-the-trial-of-poon', 'Production conflict becomes an improvised trial and pressured reconciliation.'),
    ],
  },
  {
    name: 'Family, Korean American identity, and inherited survival',
    pattern: /\b(family|mother|father|parent|korean|korea|asian american|immigrant|childhood|upbringing|heritage|race|racial)\b/,
    reading: 'Family stories supply the emotional and economic grammar behind later behavior: immigrant survival, the Los Angeles riots, parental work, secrecy, shame, obligation, racialization, and competing ways of showing love.',
    tension: 'loyalty to family history ↔ the need to author a self outside it',
    evidence: [
      route('zHyvVajsqMw', 'A long account of childhood, poverty, family war memory, shame, and later success.'),
      route('saga1-episode-103-parental-relations', 'An episode organized around disclosure, parents, and adult family boundaries.'),
      route('BBArizQhDgk', 'Later reflection on money, spirituality, family, and what remains after success.'),
    ],
  },
  {
    name: 'Fame, publicity, privacy, and self-mythology',
    pattern: /\b(fame|famous|celebrity|publicity|press|reporter|media|privacy|private|public persona|myth|mythology|attention|audience|fan)\b/,
    reading: 'Choe seeks direct, unedited speech because profiles flatten him, yet the same no-take-back format exposes guests, partners, workers, and himself. Across later interviews he also argues with the simplified mythology produced by his own repetition.',
    tension: 'control through saying everything ↔ loss of control once everything is public',
    evidence: [
      route('saga1-episode-057-never-been-dumped-n-b-d', 'The clearest surviving origin argument for DVDASA as an answer to edited interviews.'),
      route('2Xw5EgZdNvQ', 'Public controversy, speech, work, money, and the consequences of broadcasting provocation.'),
      route('j7T6__UbhBI', 'A later long-form appearance organized around shame, retreat, and resisting the public “Facebook guy” identity.'),
    ],
  },
  {
    name: 'Travel, danger, incarceration, and escape',
    pattern: /\b(travel|hitchhik|freight|train hopping|road|journey|danger|prison|jail|incarcerat|arrest|escape|adventure|hadza|congo|japan)\b/,
    reading: 'Road stories, prison stories, and dangerous encounters are both biography and a recurring dramatic technology: motion creates strangers, tests identity, and prevents the stillness Choe later says he feared.',
    tension: 'the road as freedom and contact ↔ danger as compulsion and avoidance',
    evidence: [
      route('vimeo-dirty-hands-laff', 'Congo travel, graffiti, detention, Japan imprisonment, and success are intercut rather than told linearly.'),
      route('saga1-episode-026-with-david-choe-and-asa-akira', 'A Kabul return episode about fear, security, ordinary life, and danger-shaped expectations.'),
      route('zHyvVajsqMw', 'Later reinterpretation of literal running as a way not to sit with himself.'),
    ],
  },
  {
    name: 'Shame, depression, vulnerability, and repair',
    pattern: /\b(shame|depress|suicid|self-harm|vulnerab|trauma|therapy|therapist|mental health|grief|fear|healing|repair|forgiv|regret)\b/,
    reading: 'The later corpus increasingly turns the spectacle inward. Shame is described as punishment, attention, defense, and sometimes an opening toward repair; disclosures can be useful without becoming diagnosis or universal advice.',
    tension: 'confession as relief ↔ confession as another performance that may harm somebody else',
    evidence: [
      route('saga1-episode-118-2-depressed-artists', 'David Choe and David Chang discuss depression, labor, rage, family, and help-seeking.'),
      route('CvHFWwVZKoI', 'A later recovery-focused rejection of the destructive-bottom mythology.'),
      route('zHyvVajsqMw', 'A sustained attempt to connect pain, shame, compulsion, and creative expression.'),
    ],
  },
  {
    name: 'Storytelling, performance, and unreliable memory',
    pattern: /\b(story|storytelling|performance|perform|podcast|broadcast|television|film|show|improvis|memory|retell|narrative|fiction|truth)\b/,
    reading: 'The archive is not a single authoritative autobiography. It is a record of a practiced storyteller adapting to rooms, formats, audiences, and changing self-understanding. Repetition is evidence of importance, not automatic proof of literal accuracy.',
    tension: 'a vivid story that creates meaning ↔ a story polished enough to replace uncertain memory',
    evidence: [
      route('XS6awjpIimw', 'A long interview mixing self-report, jokes, exaggeration, and disputed press framing.'),
      route('saga1-episode-057-never-been-dumped-n-b-d', 'The show’s own argument for unedited speech.'),
      route('zHyvVajsqMw', 'Explicit memory disclaimers coexist with another long reconstruction of the life.'),
    ],
  },
];

const repeatedTopics = topicDefinitions.map((topic) => {
  const matches = records.filter((record) => topic.pattern.test(record.topicText));
  return {
    name: topic.name,
    route_count: matches.length,
    denominator: records.length,
    share: Number((matches.length / records.length).toFixed(3)),
    reading: topic.reading,
    tension: topic.tension,
    evidence: topic.evidence,
  };
}).sort((a, b) => b.route_count - a.route_count || a.name.localeCompare(b.name));

const peopleDefinitions = [
  { name: 'David Choe', aliases: [/^David Choe(?:\s|$|\()/i, /^Dave Choe$/i, /^Choe$/i], role: 'central artist, host, traveler, gambler, and self-narrator', note: 'The archive follows how he repeatedly constructs, rejects, and revises his own public mythology.' },
  { name: 'Asa Akira', aliases: [/^Asa Akira$/i, /^Asa$/i], role: 'DVDASA co-host, author, performer, and frequent countervoice', note: 'She often supplies the clearest boundary, production, relationship, and adult-work distinctions in the room.' },
  { name: 'Critter Fleming', aliases: [/^Critter$/i, /^Critter Fleming$/i, /^Christopher Fleming$/i], role: 'friend, assistant, producer, cast member, and informal caretaker', note: 'His changing labor and friendship position makes the show’s blurred workplace structure visible.' },
  { name: 'Steve Lee', aliases: [/^Steve Lee$/i], role: 'musician, comedian, Mangchi collaborator, and recurring friend', note: 'He connects family, music, comedy, dependence, aspiration, and the show’s late ensemble.' },
  { name: 'Money Mark', aliases: [/^Money Mark$/i, /^Mark Nishita$/i], role: 'musician, collaborator, and recurring early cast member', note: 'He broadens the archive beyond autobiography into music-making, friendship, and a working artist’s long view.' },
  { name: 'Bobby Namba (Bobby Trivia)', aliases: [/^Bobby Namba$/i, /^Bobby Trivia$/i, /^Bobby NAMBLA$/i], role: 'friend, trivia host, recurring cast member, and audience surrogate', note: 'Trivia, humiliation, loyalty, sport, and the cost of being material repeatedly converge around him.' },
  { name: 'Harry Kim', aliases: [/^Harry Kim$/i], role: 'filmmaker, friend, collaborator, and keeper of early visual history', note: 'Dirty Hands and later production stories make him essential to the archive’s tension between documentation and friendship.' },
  { name: 'Bobby Lee', aliases: [/^Bobby Lee$/i], role: 'comedian, friend, recurring guest, and family bridge through Steve Lee', note: 'His appearances connect comedy, shame, sex, family, career insecurity, and long-running friendship.' },
  { name: 'Yoshi Obayashi', aliases: [/^Yoshi Obayashi$/i, /^Yoshi$/i], role: 'friend, employee, performer, and host of Yoshi Didn’t', note: 'His conflicts make apology, cultural memory, friendship, ownership, and employer power unusually concrete.' },
  { name: 'Joe Rogan', aliases: [/^Joe Rogan$/i], role: 'recurring long-form interviewer and public-story counterparty', note: 'The Rogan appearances preserve several major versions of the money, speech, art, controversy, and later-life stories.' },
  { name: 'Anthony Bourdain', aliases: [/^Anthony Bourdain$/i], role: 'friend, travel-television influence, collaborator, and moral reference point', note: 'He represents a model of curiosity and access while later grief gives the relationship a different weight.' },
  { name: 'David Chang', aliases: [/^David Chang$/i], role: 'chef, friend, fellow compulsive creator, and recurring mirror', note: 'Their conversations compare restaurant and art careers, immigrant family pressure, depression, rage, labor, and success.' },
  { name: 'Howard Stern', aliases: [/^Howard Stern$/i], role: 'formative interviewer and model for expansive, direct broadcasting', note: 'Choe repeatedly cites the Stern appearance when explaining what edited profiles could not hold.' },
  { name: 'Bill Poon', aliases: [/^Bill Poon$/i, /^Poon$/i, /^The Pooner$/i], role: 'friend, driver, production participant, and recurring Saga 2 subject', note: 'Negotiations around labor, sex, filming, compensation, and consent concentrate around his role.' },
  { name: 'Sean Parker', aliases: [/^Sean Parker$/i], role: 'early patron, technology-world connection, and counterweight to the “random Facebook luck” story', note: 'Choe frames the relationship as years of attention and patronage preceding the famous equity decision.' },
  { name: 'Jane Choe', aliases: [/^Jane Choe$/i], summary_pattern: /\bJane Choe\b/i, role: 'mother, artist, family witness, and Happiness Symposium participant', note: 'She provides a family perspective that cannot be replaced by Choe narrating the family alone.' },
];

const people = peopleDefinitions.map((person) => {
  const appearances = [];
  for (const record of records) {
    const names = (record.editorial.people || []).filter((value) => typeof value === 'string');
    const named = names.some((name) => person.aliases.some((pattern) => pattern.test(name.trim())));
    const reviewedSummaryNamesHer = person.summary_pattern?.test(record.editorial.summary || '') || false;
    if (named || reviewedSummaryNamesHer) {
      appearances.push({ id: record.id, title: record.title });
    }
  }
  return { name: person.name, route_count: appearances.length, role: person.role, note: person.note, routes: appearances };
}).sort((a, b) => b.route_count - a.route_count || a.name.localeCompare(b.name));

const analysis = {
  schema: 'choe-corpus/corpus-analysis@1',
  generated_from: '421 unique reader routes and their completed human-reviewed editorial records',
  survey: {
    routes: records.length,
    catalog_cards: catalog.items.length,
    hours: Number((records.reduce((sum, record) => sum + record.duration, 0) / 3600).toFixed(1)),
    words: records.reduce((sum, record) => sum + record.words, 0),
    collections: Object.fromEntries([...records.reduce((map, record) => map.set(record.collection, (map.get(record.collection) || 0) + 1), new Map())]),
    boundary: 'Counts are unique reader routes, not catalog cards. Topics overlap and are matched only against the completed human-reviewed theme tags; summaries and connections inform the written synthesis but do not inflate frequency. Counts describe tagged archive coverage, not importance, truth, or time spent.',
  },
  summary: {
    thesis: 'Across 421 routes, the corpus is less a success story than a long argument about what happens when the strategies that helped a person survive—risk, motion, performance, work, sex, humor, money, and refusal—keep operating after survival is no longer the immediate problem.',
    paragraphs: [
      'The archive has three interlocking bodies. DVDASA is the largest sustained social record: friends, guests, workers, performers, artists, and fans turn an unedited room into comedy, confession, trivia, production meeting, and power struggle. The interviews retell a more portable public life—Los Angeles, graffiti, self-publishing, travel, Japanese imprisonment, gambling, Sean Parker, Facebook, fame, addiction, retreat, recovery, television, and later acting. The films, clips, music, and art footage show what speech alone cannot, while often carrying weaker transcripts and therefore narrower claims.',
      'The central pattern is conversion. Pain becomes art; strangers become collaborators; friends become employees and characters; danger becomes story; shame becomes attention; money becomes freedom and then burden; private life becomes material. Each conversion creates something real and also creates a debt that returns later as a boundary, consent, privacy, health, labor, or relationship problem.',
      'The corpus also documents a changing narrator. Earlier accounts often reward velocity, extremity, and the clean punch line. Later accounts revisit the same legends with more resistance: luck did not erase work, wealth did not end compulsion, confession did not guarantee honesty, and a destructive bottom was not required for creative change. These are revisions in emphasis, not a clean redemption chronology.',
      'No single route settles the biography. Memory disclaimers, jokes, provocation, damaged captions, reuploads, edited excerpts, and repeated stories all matter. The responsible overall reading is therefore relational: compare versions, preserve direct boundaries, distinguish participant testimony from verification, and let contradiction remain visible instead of forcing one final David Choe persona.',
    ],
    corpus_shape: [
      { label: 'DVDASA', count: 177, note: 'The numbered ensemble spine: comedy, guests, trivia, intimacy, production, and recurring workplace power.' },
      { label: 'Interviews', count: 40, note: 'Long-form public retellings and later reinterpretations of the career and private life.' },
      { label: 'His channel', count: 82, note: 'Official creative lessons, reflections, performance, artwork, and transcript-limited visual records.' },
      { label: 'Clips', count: 121, note: 'Excerpts, third-party uploads, reuploads, biographies, and narrow moments that require provenance context.' },
      { label: 'Film', count: 1, note: 'Dirty Hands, held and described as a film-scale source rather than reduced to searchable dialogue.' },
    ],
  },
  repeated_topics: repeatedTopics,
  people,
  screenplay_notes: {
    status: 'Development notes derived from the corpus, not a factual screenplay, chronology, or endorsement of every narrated claim.',
    logline: 'A Korean American artist turns movement, risk, and radical self-exposure into a life without ordinary limits; after a legendary windfall makes that life public, he has to decide whether the same appetites that made the work can be transformed before they consume every relationship around it.',
    central_question: 'Can he keep the creative force without continuing to require danger, secrecy, humiliation, or self-destruction to activate it?',
    structure: [
      {
        heading: 'Act I — Build an exit from the ordinary life',
        purpose: 'Establish family survival, the Los Angeles riots, drawing and graffiti, self-publication, early patrons, restless travel, gambling, and Japan. The dramatic engine is not “talent discovered”; it is a person repeatedly making an exit before any institution grants permission.',
        evidence: [
          route('vimeo-dirty-hands-laff', 'The strongest visual spine for the early life, travel, detention, art, and family testimony.'),
          route('zHyvVajsqMw', 'Later first-person reconstruction with explicit uncertainty and family context.'),
          route('saga1-episode-119-the-ranch-solo-series-part-two', 'The artist’s own blueprint for risk, self-publishing, patrons, pricing, and failure.'),
        ],
      },
      {
        heading: 'Act II — The break becomes the identity',
        purpose: 'Sean Parker, the Facebook murals, shares instead of cash, and sudden public wealth should arrive as both victory and narrative theft. Everybody now believes they know the story; the protagonist begins defending the invisible work before the lucky break while money removes external limits.',
        evidence: [
          route('i8cDwucTSbo', 'The famous decision told in a compact public-interview form.'),
          route('saga1-episode-101-the-ranch-solo-series-part-one', 'The counter-story about Parker, prior work, and why “lucky” feels incomplete.'),
          route('saga1-episode-068-david-s-announcement', 'The cost: money and Facebook proceeds magnify an existing spiral.'),
        ],
      },
      {
        heading: 'Act III — Build a room with no edits',
        purpose: 'DVDASA begins as the answer to being flattened by profiles. The warehouse initially feels like total authorship: friends, sex, art, music, guests, trivia, and any subject without broadcast restraint. Gradually the same room reveals the problem—people are simultaneously friends, employees, material, and audience.',
        evidence: [
          route('saga1-episode-057-never-been-dumped-n-b-d', 'The clearest internal account of why the show exists.'),
          route('saga1-episode-010-with-david-choe-and-asa-akira', 'A small object opens the show’s deepest friendship/employment fault line.'),
          route('saga1-episode-058-the-reporter', 'Press control, fame, labor, humiliation, and consent converge.'),
        ],
      },
      {
        heading: 'Act IV — Refuse the clean redemption ending',
        purpose: 'Retreat, recovery, service, The Choe Show, Beef, renewed interviews, and friendship do not erase prior harm or compulsion. The ending should show practice rather than cure: saying no, tolerating stillness, helping someone without turning them into material, and making work without requiring catastrophe.',
        evidence: [
          route('CvHFWwVZKoI', 'Recovery, relapse, workaholism, and rejection of the destructive-bottom myth.'),
          route('zHyvVajsqMw', 'A late sustained reinterpretation of running, shame, Facebook, family, and creative expression.'),
          route('BBArizQhDgk', 'What remains after winning the games of money, sex, power, television, and public success.'),
        ],
      },
    ],
    recurring_images: [
      { image: 'Walls', use: 'Graffiti surface, Facebook office, prison boundary, gallery object, and the literal thing that can be painted over.' },
      { image: 'Roads and rides', use: 'Hitchhiking and freight travel make freedom social: survival depends on asking strangers and accepting uncertainty.' },
      { image: 'Cards, chips, and bets', use: 'A visual grammar for the way money, danger, sex, career, and disclosure repeatedly become wagers.' },
      { image: 'The warehouse table and microphones', use: 'A stage that looks democratic while employment, ownership, editing control, and exposure remain unequal.' },
      { image: 'Food', use: 'Family care, hospitality, compulsion, restaurant labor, bodily shame, gifts, and conflict repeatedly become visible through eating.' },
      { image: 'Hands', use: 'Drawing, painting, gambling, fighting, touching, making, and helping all pass through the same instrument.' },
    ],
    character_function: [
      { name: 'Family', function: 'The survival history and emotional stakes; they complicate every “self-made” version.' },
      { name: 'Harry Kim', function: 'The witness with a camera; friendship and documentation cannot be cleanly separated.' },
      { name: 'Sean Parker', function: 'The patron who turns years of attention into the break the public later treats as random.' },
      { name: 'Asa Akira', function: 'The co-author and countervoice inside the unedited experiment, frequently making distinctions the room wants to collapse.' },
      { name: 'Critter, Bobby Namba, Yoshi, Money Mark, Steve Lee, and Bill Poon', function: 'The ensemble through which chosen family, loyalty, labor, humiliation, and creative community acquire consequences.' },
      { name: 'Bobby Lee, David Chang, Anthony Bourdain, Joe Rogan, and Howard Stern', function: 'Different mirrors: comedy and shame, work and depression, curiosity and grief, long-form challenge, and the fantasy of being heard without compression.' },
    ],
    cautions: [
      'Do not make Facebook the inciting incident; it arrives after a substantial art, publishing, travel, relationship, and gambling life.',
      'Do not let a recovery structure imply adjudication, absolution, diagnosis, or a final cured state.',
      'Do not combine separate people into composites when their distinct consent, labor, or relationship position changes the meaning of a scene.',
      'Treat repeated anecdotes as performed memory. A scene needs source attribution and independent verification before being presented as settled fact.',
      'The screenplay should not recreate private sexual, medical, family, or workplace detail merely because an unedited podcast exposed it.',
      'Keep comedy and charisma, but never use them to make a direct refusal or power imbalance disappear from the scene.'
    ],
  },
};

if (analysis.survey.routes !== 421) throw new Error(`expected 421 reader routes, found ${analysis.survey.routes}`);
if (analysis.survey.catalog_cards !== 434) throw new Error(`expected 434 catalog cards, found ${analysis.survey.catalog_cards}`);
if (analysis.repeated_topics.some((topic) => topic.route_count < 3)) throw new Error('every repeated topic must appear in at least three routes');
if (analysis.people.some((person) => !person.route_count)) throw new Error('every named corpus person must resolve to at least one reviewed route');

fs.writeFileSync(path.join(DATA, 'corpus-analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
console.log(`wrote corpus analysis: ${analysis.repeated_topics.length} topics, ${analysis.people.length} normalized people, ${analysis.screenplay_notes.structure.length} screenplay movements`);
