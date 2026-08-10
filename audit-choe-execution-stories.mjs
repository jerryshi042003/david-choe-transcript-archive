import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = new URL('./data/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));

// These deliberately use concrete anchors, not broad words such as “work,”
// “give,” “commission,” or “go for it.” The broad pass produced 914 mostly
// irrelevant windows. This pass is the finite review queue for stories about
// making, publishing, sending, gifting, travelling, or accepting an opening.
const firstPerson = /\b(?:i|i'm|i've|i'd|me|my|we|we're|we've|our)\b/i;
const artAction = /\b(?:art|artist|artwork|book|comic|draw|drawing|gallery|illustrat|magazine|mural|paint|painting|publish|show|work|zine)\b/i;
const rules = [
  ['self_publish', /self[- ]publish|self publishing|mini.?comic|\bzines?\b|no editors?|no publishers?|watercolou?r book/i,
    text => firstPerson.test(text) && artAction.test(text)],
  ['outreach_rejection', /kinko|portfolio day|rejection letters?|magazine mastheads?|art[- ]director(?:s| addresses)?|rejected by (?:every|all|the) gall|galler(?:y|ies).{0,35}(?:reject|refus|wouldn|didn)/i,
    text => firstPerson.test(text) && artAction.test(text)],
  ['before_permission', /without (?:asking|permission)|didn.?t ask (?:for )?permission|never asked (?:for )?permission|fuck waiting|already got (?:the )?permission|make (?:the|an?) .{0,45}before (?:you|they|anybody)|deal with (?:the|their) objection afterward/i,
    text => firstPerson.test(text) && artAction.test(text)],
  ['specific_opening', /double rainbow|ice.?cream shop|sean parker|\bnapster\b|facebook (?:office|mural)|jay[- ]z.{0,25}linkin park|linkin park.{0,25}jay[- ]z|\bx[- ]men\b.{0,30}(?:marvel|project)|banksy.{0,35}(?:show|painting|bought|buy)/i,
    text => firstPerson.test(text) && /\b(?:art|artist|artwork|book|bought|comic|email|gallery|job|mural|offer|paint|painting|publish|share|show|stock|work)\b/i.test(text)],
  ['resource_constraint', /no internet|no cell (?:phone )?service|restrictive nature|(?:china|mexico|beijing|jail|prison).{0,90}(?:cold|dark)|(?:cold|dark).{0,90}(?:china|mexico|beijing|jail|prison)|(?:couldn.?t afford|didn.?t have (?:any )?money|no money).{0,180}(?:freight trains?|hitchhik)|(?:freight trains?|hitchhik).{0,180}(?:couldn.?t afford|didn.?t have (?:any )?money|no money)/i,
    text => firstPerson.test(text) && artAction.test(text)],
  ['gift_or_trade_art', /(?:gave|give|giving|gifted|trade|traded).{0,55}(?:painting|paintings|artwork|my art|best work)|(?:painting|paintings|artwork|best work).{0,55}(?:for free|away|gift|trade|traded)/i,
    text => firstPerson.test(text)],
  ['first_person_job', /(?:\bi\b|\bmy\b).{0,80}(?:album cover|advertising agency|commissioned|painted (?:the|a|an|their|his|her).{0,25}(?:wall|office|mural)|gallery show)/i],
];

const catalogIds = catalog.items.map(item => item.id);
const uniqueCatalogIds = new Set(catalogIds);
const files = readdirSync(dataDir).filter(name => name.endsWith('.json'));
const transcriptById = new Map();

for (const file of files) {
  const record = JSON.parse(readFileSync(join(dataDir.pathname, file), 'utf8'));
  if (record?.id && Array.isArray(record.segments)) transcriptById.set(record.id, record);
}

const hits = [];
for (const id of uniqueCatalogIds) {
  const record = transcriptById.get(id);
  if (!record) continue;
  record.segments.forEach((segment, index) => {
    const text = typeof segment.x === 'string' ? segment.x : '';
    const neighborhood = record.segments.slice(Math.max(0, index - 1), index + 2)
      .map(candidate => candidate.x)
      .join(' ');
    const matchedRules = rules
      .filter(([, pattern, gate]) => pattern.test(neighborhood) && (!gate || gate(neighborhood)))
      .map(([name]) => name);
    if (!matchedRules.length) return;
    hits.push({ id, title: record.title ?? id, t: Number(segment.t), index, matchedRules, text });
  });
}

const windows = [];
for (const hit of hits.sort((a, b) => a.id.localeCompare(b.id) || a.t - b.t)) {
  const last = windows.at(-1);
  if (last && last.id === hit.id && hit.t - last.end <= 180) {
    last.end = hit.t;
    last.hitCount += 1;
    last.rules = [...new Set([...last.rules, ...hit.matchedRules])];
    last.hitIndexes.push(hit.index);
  } else {
    windows.push({
      id: hit.id,
      title: hit.title,
      start: hit.t,
      end: hit.t,
      hitCount: 1,
      rules: [...hit.matchedRules],
      hitIndexes: [hit.index],
    });
  }
}

for (const window of windows) {
  const record = transcriptById.get(window.id);
  const first = Math.max(0, Math.min(...window.hitIndexes) - 2);
  const last = Math.min(record.segments.length - 1, Math.max(...window.hitIndexes) + 2);
  window.context = record.segments.slice(first, last + 1).map(segment => segment.x).join(' ');
  delete window.hitIndexes;
}

// Human review completed 9 August 2026. Keys are stable record/start pairs.
// Every other high-signal window was read and rejected because it was another
// speaker, a generic mention, a trailer/recap, or not a discrete execution act.
const retained = new Map(Object.entries({
  '-wZk4B1BB0c@2976.8': 'DIY work without editors or publishers',
  '-wZk4B1BB0c@5229.4': 'make the Frank Miller zine before asking',
  '2Xw5EgZdNvQ@2249.5': 'publisher cuts refused; watercolor book self-published',
  '2Xw5EgZdNvQ@3447.9': 'portfolio-day line bypassed; agency job won and left',
  '2Xw5EgZdNvQ@7607.6': 'manufactured constraint and creative output',
  '3QecMMrcCCA@2699.6': 'Slow Jams carried through Comic-Con and toward Marvel',
  '3QecMMrcCCA@3692.9': 'Jim Lee portrait made after jail',
  '3QecMMrcCCA@6335.7': 'best work tied to restricted periods',
  'bRnQXElR0xE@145.6': 'movie-poster agency job and commercial constraint',
  'j7T6__UbhBI@4939': 'existing hitchhiking practice became Thumbs Up',
  'OP1mXscTUnw@87.4': 'no-permission career account in KQED profile',
  'saga1-episode-031-with-david-choe-and-asa-akira@4107.3': 'self-fund, own rights, distribute after making',
  'saga1-episode-042-with-david-choe-and-asa-akira@3900.8': 'early free work later helped its holders',
  'saga1-episode-047-with-david-choe-and-asa-akira@1603.1': 'counterfeit credential tactic for access',
  'saga1-episode-088-david-chang@1358.4': 'prison productivity and removal of distractions',
  'saga1-episode-101-the-ranch-solo-series-part-one@1170.9': 'China, Mexico, prison and the no-phone ranch test',
  'saga1-episode-101-the-ranch-solo-series-part-one@4376.9': 'make the job before permission; give strong work',
  'saga1-episode-119-the-ranch-solo-series-part-two@239.4': 'third no-phone ranch trip',
  'saga1-episode-119-the-ranch-solo-series-part-two@1460': 'painting binge and process at the ranch',
  'saga1-episode-119-the-ranch-solo-series-part-two@3244.1': 'ice-cream-shop commission and failed delivery',
  'saga1-episode-119-the-ranch-solo-series-part-two@4373.5': 'Facebook, Banksy, and early supporters',
  'saga1-episode-119-the-ranch-solo-series-part-two@5198.1': 'work without inspiration; learn when to stop',
  'saga2-book-02-chapter-001@1889.7': 'applied science fiction: define the impossible result first',
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode@2477.8': 'take jobs, remove desperation, give best work for a bounded period',
  'saga2-saga-02-chapter-021-the-ranch-solo-series-3-the-lost-episode@2929.6': 'hold price; add a second work rather than discounting',
  'saga2-saga-02-chapter-025-american-whoreror-story@2677.3': 'Momofuku Ko murals and placement of friends’ work',
  'tk923yF0TXA@2360.9': 'adult-magazine outreach, car barter, agency exit, and ice-cream-shop survival period',
  'tk923yF0TXA@3959.3': 'podcast without ads; comics outside normal distribution; work given away',
  'XS6awjpIimw@601.6': 'Sean Parker correspondence before Facebook',
  'XS6awjpIimw@4893.8': 'Howard/Barbara Walters appearance converted into live painting',
  'zHyvVajsqMw@2361.4': 'graffiti pursued despite family opposition',
  'zHyvVajsqMw@4605.1': 'Jay-Z/Linkin Park cover fee and rights lesson',
  'zHyvVajsqMw@5297.9': 'Kinko’s packets, rejection letters, and Marvel opening',
  'zHyvVajsqMw@6441': 'Double Rainbow, small sales, car barter, and adult-magazine work',
  'zHyvVajsqMw@7491': 'Butt Man rejection followed by direct Hustler visit',
  'zHyvVajsqMw@9456.5': 'self-published writing created the Channing Tatum opening',
  'zHyvVajsqMw@11053.8': 'existing Pee-wee Herman relationship used for The Choe Show; corporate-note tradeoff',
}));

for (const window of windows) {
  const key = `${window.id}@${window.start}`;
  window.review = retained.has(key)
    ? { decision: 'retain', why: retained.get(key) }
    : { decision: 'reject', why: 'not a discrete first-person Choe execution story after context review' };
}

const retainedWindows = windows.filter(window => window.review.decision === 'retain').length;

const payload = {
  catalogRecords: catalogIds.length,
  uniqueCatalogIds: uniqueCatalogIds.size,
  transcriptFilesFound: [...uniqueCatalogIds].filter(id => transcriptById.has(id)).length,
  missingTranscriptIds: [...uniqueCatalogIds].filter(id => !transcriptById.has(id)),
  rules: Object.fromEntries(rules.map(([name, pattern]) => [name, pattern.source])),
  rawHits: hits.length,
  reviewWindows: windows.length,
  retainedWindows,
  rejectedWindows: windows.length - retainedWindows,
  windows,
};

if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({ ...payload, windows: undefined }, null, 2));
} else {
  console.log(JSON.stringify(payload, null, 2));
}
