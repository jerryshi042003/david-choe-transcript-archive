#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

// Each mapping was reviewed against the route transcript and the named full
// source. `beats` belong to the excerpt timeline; they are not copied from the
// full episode. Transcript overlap is supporting provenance, not the summary.
const excerpts = {
  '1DQLpKe3p-E': {
    canonical: 'BBArizQhDgk', shared: 204, coverage: 0.613,
    focus: "David Choe recounts proposing in-world graffiti to Jon Favreau for *The Mandalorian*, building a backstory for his brief alien role, and treating the opportunity as fan labor rather than a paycheck.",
    people: ['David Choe', 'Joe Rogan', 'Jon Favreau', 'Roy Choi'], places: [], works: ['The Mandalorian', 'The Chef Show', 'Star Wars'], themes: ['acting', 'graffiti', 'fan culture', 'character backstory'],
    beats: [[0, 'Meeting Jon Favreau'], [49, 'Rebel graffiti as world-building'], [115, 'Declining payment'], [178, 'A first acting role'], [230, 'Writing the character backstory']]
  },
  'yFFUaDk29pA': {
    canonical: 'BBArizQhDgk', shared: 258, coverage: 0.613,
    focus: "Choe and Joe Rogan compare leaving Los Angeles, the attractions and limits of Austin, homelessness and public policy, and Choe's continuing search for a place closer to nature.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Los Angeles', 'Austin', 'South America', 'Asia'], works: ['Joe Rogan Experience'], themes: ['relocation', 'cities', 'homelessness', 'public policy', 'nature'],
    beats: [[1, 'First impressions of Austin'], [91, 'Food and Asian community'], [178, 'Rogan as an audio portrait artist'], [268, 'Los Angeles governance critique'], [336, 'Looking beyond Austin']]
  },
  '0cp3orVR5lg': {
    canonical: 'BBArizQhDgk', shared: 214, coverage: 0.574,
    focus: "Choe describes a psychedelic experience as an encounter with a profane alien voice, then connects its blue-body imagery to the so-called Mongolian spot birthmark and ancient-alien speculation.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon', 'Genghis Khan'], places: [], works: ['Joe Rogan Experience', 'Avatar'], themes: ['psychedelics', 'alien imagery', 'birthmarks', 'mythmaking'],
    warnings: ['psychedelic drug discussion', 'explicit sexual language', 'unsupported ancient-alien speculation'],
    beats: [[0, 'A psychedelic voice'], [84, 'Profane spiritual comedy'], [171, 'Blue birthmark discussion'], [244, 'Alien-body interpretation'], [326, 'Ancient-text speculation']]
  },
  'kdIZ-X0dbM4': {
    canonical: 'BBArizQhDgk', shared: 152, coverage: 0.537,
    focus: "Choe and Rogan discuss why spirituality can stop a conversation, how ancient religious texts carry historical moral limits, whether belief in a larger purpose helps people live, and love amid war and suffering.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: [], works: ['Joe Rogan Experience'], themes: ['spirituality', 'religion', 'moral history', 'war', 'love'],
    warnings: ['war and suffering', 'discussion of slavery and misogyny in religious texts'],
    beats: [[0, 'Why spirituality is difficult to discuss'], [56, 'Ancient texts and moral limits'], [122, 'Belief as a way to live'], [193, 'Suffering and ordinary joy coexist'], [245, 'Affection in the studio']]
  },
  'JNXjG8n4pzE': {
    canonical: 'BBArizQhDgk', shared: 234, coverage: 0.479,
    focus: "Choe introduces footage of hunting with the Hadza, describes butchering and eating a baboon, and the conversation detours into historical cannibalism and a Japanese killer.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Tanzania'], works: ['Joe Rogan Experience', 'The Choe Show'], themes: ['Hadza hunting', 'subsistence', 'baboon butchering', 'cannibalism'],
    warnings: ['graphic animal killing and butchering', 'cannibalism', 'serial murder'],
    beats: [[0, 'Introducing the Hadza footage'], [89, 'What the camera shows'], [188, 'Burning fur from the carcass'], [264, 'Nutrition and cannibalism detour'], [344, 'A killer represented in manga']]
  },
  '1cEPqYMBlXA': {
    canonical: 'BBArizQhDgk', shared: 159, coverage: 0.466,
    focus: "Choe explains how an improvised pitch to Jon Favreau led to graffiti work and a tiny alien role in *The Mandalorian*, including prosthetics, research and a self-written gambling backstory.",
    people: ['David Choe', 'Joe Rogan', 'Jon Favreau'], places: ['Los Angeles', 'Africa'], works: ['The Mandalorian', 'Star Wars'], themes: ['acting', 'graffiti', 'prosthetics', 'character research'],
    beats: [[0, 'A valet-line pitch'], [63, 'Researching Star Wars-scale graffiti'], [123, 'Prosthetics and one-second screen time'], [195, 'A gambling backstory'], [243, 'Why a larger acting offer did not fit']]
  },
  '_IW6hQQdNys': {
    canonical: 'BBArizQhDgk', shared: 208, coverage: 0.409,
    focus: "An excerpt on Hadza subsistence combines a graphic cave and baboon-hunt account with discussion of cannibalism, survival knowledge and the shock of encountering abundant but undrinkable water.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Tanzania'], works: ['Joe Rogan Experience'], themes: ['Hadza', 'hunting', 'subsistence knowledge', 'cross-cultural encounter'],
    warnings: ['graphic animal killing and butchering', 'cannibalism', 'serial murder'],
    beats: [[0, 'A cave and animal brain'], [97, 'Dogs and a baboon hunt'], [201, 'Cannibalism and criminal history'], [310, 'Survival expertise'], [392, 'Undrinkable water as culture shock']]
  },
  'KOfsocdybBw': {
    canonical: 'BBArizQhDgk', shared: 182, coverage: 0.382,
    focus: "Choe describes paying an unusually expensive trainer for accountability, the trainer's use of physical blows, his desire to remain childlike, and a broader wish to live nearer nature; Rogan connects the discussion to Indigenous horsemanship and hunting.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Africa'], works: ['Joe Rogan Experience'], themes: ['training', 'accountability', 'wealth', 'nature', 'horsemanship'],
    warnings: ['trainer violence', 'broad claims about Indigenous peoples'],
    beats: [[0, 'What people say they would do with money'], [91, 'Paying for accountability'], [192, 'Looking for life closer to nature'], [298, 'Comanche horsemanship'], [390, 'Modern hunting technology']]
  },
  'V_v5tS3WRQ8': {
    canonical: 'BBArizQhDgk', shared: 306, coverage: 0.312,
    focus: "Choe frames sex, money and power as video-game objectives he tried to beat, explains rejecting conventional business logic and trying to give wealth away, then connects that reset to identity, friendship and a film made in Africa.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Africa'], works: ['Joe Rogan Experience'], themes: ['wealth', 'gamification', 'sex', 'power', 'giving', 'identity'],
    warnings: ['explicit sexual language', 'homophobic teasing quoted in personal history'],
    beats: [[1, 'Sex, money and power as game objectives'], [212, 'Rejecting conventional investment plans'], [400, 'Trying to reach zero'], [621, 'Identity and friends intervening'], [813, 'The Africa film']]
  },
  'MzfWgBgqBPs': {
    canonical: 'BBArizQhDgk', shared: 120, coverage: 0.265,
    focus: "A second edit of Choe's psychedelic-alien story begins with disillusionment about art and comedy, moves through a comic spirit encounter and blue-birthmark imagery, and ends by distinguishing an entertaining theory from a verified claim.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon', 'Genghis Khan'], places: [], works: ['Joe Rogan Experience', 'Avatar'], themes: ['psychedelics', 'creative disillusionment', 'alien imagery', 'epistemic uncertainty'],
    warnings: ['psychedelic drug discussion', 'explicit sexual language', 'unsupported ancient-alien speculation'],
    beats: [[0, 'Disillusionment and a psychedelic turn'], [103, 'The comic spirit voice'], [190, 'Mongolian spot imagery'], [289, 'Not the expected spiritual journey'], [389, 'Fun theory versus truth']]
  },
  '-I9ut9uikjY': {
    canonical: 'j7T6__UbhBI', shared: 640, coverage: 0.544,
    focus: "A long JRE excerpt examines Choe's fear of ruining his life by speaking publicly, the appeal and burden of being seen as authentic, an intense relationship with a sculpture, self-hatred and whether rule-breaking art can still transcend its maker.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: [], works: ['Joe Rogan Experience'], themes: ['public speech', 'authenticity', 'sculpture', 'self-hatred', 'artistic transcendence'],
    warnings: ['self-hatred', 'explicit language', 'racialized and homophobic self-description'],
    beats: [[1, 'Fear of torpedoing a public life'], [249, 'Authenticity and being lovable'], [499, 'Talking to a sculpture'], [751, 'Self-hatred and identity labels'], [972, 'Can art transcend the artist?']]
  },
  'rN5_qjTyu8M': {
    canonical: 'j7T6__UbhBI', shared: 212, coverage: 0.526,
    focus: "Choe recalls *Warcraft II* overtaking his relationships and attention, compares his behavior with addiction, describes attending recovery meetings, and admits lying to friends so he could keep playing.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['China'], works: ['Warcraft II', 'Warcraft III', 'Web Junkie'], themes: ['video-game addiction', 'recovery meetings', 'lying', 'attention'],
    warnings: ['behavioral addiction', 'pornography and gambling addiction'],
    beats: [[1, 'Waiting for Warcraft III'], [65, 'A relationship displaced by play'], [163, 'Recovery meetings across addictions'], [248, 'Speed, mastery and trash talk'], [313, 'Lying to keep playing']]
  },
  'M_jPqv3NvUI': {
    canonical: 'j7T6__UbhBI', shared: 910, coverage: 0.458,
    focus: "Choe tells the extended story of entering the Congo to look for a reported dinosaur, moving from *Thumbs Up* and early Vice history through jungle scale, dwindling food, conflict with companions and the impossibility of controlling the forest.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon', 'Gavin McInnes', 'Shane Smith'], places: ['Republic of the Congo', 'Los Angeles', 'New York City'], works: ['Joe Rogan Experience', 'Thumbs Up', 'Vice'], themes: ['Congo expedition', 'cryptozoology', 'jungle survival', 'group conflict', 'media history'],
    warnings: ['dangerous expedition', 'food scarcity', 'animal and insect encounters'],
    beats: [[1, 'From Thumbs Up to the Congo'], [442, 'Why the jungle made the story plausible'], [889, 'Rations run out'], [1349, 'Vice moves from print to digital'], [1739, 'The jungle defeats settlement plans']]
  },
  'HrBhuzHHlhQ': {
    canonical: 'j7T6__UbhBI', shared: 386, coverage: 0.455,
    focus: "Choe recalls being quiet as a child and then tells a hitchhiking story about a cowboy who revealed a hidden relationship and fear of homophobia, ending with regret about the lasting effects of humiliating people for entertainment.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Los Angeles', 'New York City', 'the American South'], works: ['Joe Rogan Experience'], themes: ['hitchhiking', 'sexual identity', 'humiliation', 'regret', 'documentary ethics'],
    warnings: ['homophobic language', 'outing and humiliation', 'sexual discussion'],
    beats: [[1, 'The quiet child'], [186, 'A cowboy offers a ride'], [376, 'Staying overnight'], [542, 'A hidden relationship and workplace homophobia'], [718, 'Harm outlasts the joke']]
  },
  'FRrbjiOs4no': {
    canonical: 'j7T6__UbhBI', shared: 456, coverage: 0.364,
    focus: "Choe gives a longer account of living and hunting with the Hadza: elders' stories, children handling animals, endurance, scarce water, injured hunting dogs and his own collapse after trying to prove useful on a baboon hunt.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Tanzania'], works: ['Joe Rogan Experience'], themes: ['Hadza', 'hunting', 'endurance', 'subsistence', 'cross-cultural encounter'],
    warnings: ['graphic animal killing and eating', 'injured animals', 'dehydration and physical collapse'],
    beats: [[1, 'Living on a rock above the village'], [290, 'Children and local animal knowledge'], [559, 'Endurance and muddy water'], [830, 'Injured dogs continue hunting'], [1061, 'Collapse and eating baboon']]
  },
  'cGENqgCM_hI': {
    canonical: 'j7T6__UbhBI', shared: 149, coverage: 0.334,
    focus: "Choe tells a childhood story about scrambled television pornography, stealing an adult VHS tape while wearing his father's coat, hiding it at home and being interrupted by his brother.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon'], places: ['Los Angeles'], works: ['Joe Rogan Experience'], themes: ['childhood', 'shoplifting', 'pornography', 'family embarrassment'],
    warnings: ['minors and pornography', 'shoplifting', 'explicit sexual language and masturbation'],
    beats: [[1, 'Scrambled television pornography'], [90, 'The adult-store theft'], [194, 'Hiding the tape at dinner'], [286, 'Watching in secret'], [368, 'A brother interrupts']]
  },
  'qVPlWFKUBCI': {
    canonical: 'j7T6__UbhBI', shared: 78, coverage: 0.213,
    focus: "Choe connects anger, anxiety and addiction to suicide risk, then remembers Anthony Bourdain asking him for help and reflects on the limits of a partial request when someone is in deep distress.",
    people: ['David Choe', 'Joe Rogan', 'Jamie Vernon', 'Anthony Bourdain'], places: ['Las Vegas'], works: ['Joe Rogan Experience'], themes: ['grief', 'suicide', 'help-seeking', 'addiction', 'regret'],
    warnings: ['suicide and suicide statistics', 'grief', 'gambling addiction', 'mental distress'],
    beats: [[1, 'Anger, anxiety and physical state'], [77, 'Gambling addiction and suicide risk'], [155, 'Bourdain asks for help'], [223, 'Grief and many losses'], [333, 'The limits of half-asking']]
  },
  'mOj5JGBZ4dM': {
    canonical: 'i8cDwucTSbo', shared: 240, coverage: 0.505,
    focus: "Choe tells Joe Rogan an explicit Koreatown massage story involving a late-night appointment, a customer waiting outside, improvised plastic wrap and a sexual act that leaves him embarrassed.",
    people: ['David Choe', 'Joe Rogan'], places: ['Koreatown, Los Angeles'], works: ['Joe Rogan Experience #392'], themes: ['massage business', 'sexual services', 'shame', 'comic storytelling'],
    warnings: ['explicit sexual content', 'commercial sex', 'racialized language'],
    beats: [[0, 'A long-used Koreatown massage business'], [83, 'Arriving near closing'], [185, 'Another customer waits'], [260, 'Improvised plastic wrap'], [348, 'Shame after the sexual act']]
  },
  'FA3orUaXhD4': {
    canonical: 'i8cDwucTSbo', shared: 190, coverage: 0.250,
    focus: "This longer massage-parlor excerpt begins with Rogan's Santa Monica experience, discusses prostate massage, and then includes Choe's full Koreatown story about a late appointment, another waiting customer and an unexpected sexual service.",
    people: ['David Choe', 'Joe Rogan'], places: ['Santa Monica', 'Koreatown, Los Angeles'], works: ['Joe Rogan Experience #392'], themes: ['massage business', 'sexual services', 'boundaries', 'shame'],
    warnings: ['explicit sexual content', 'commercial sex', 'racialized language'],
    beats: [[0, "Rogan's recent massage experience"], [138, 'Prostate-massage discussion'], [276, 'Choe arrives near closing'], [421, 'The waiting customer leaves'], [558, 'Plastic wrap and the embarrassed aftermath']]
  },
  'O3e1iZowlv8': {
    canonical: '2Xw5EgZdNvQ', shared: 160, coverage: 0.349,
    focus: "Choe recounts abandoning a proposed year of fight training, making Steve Lee's job depend on a wrestling match, and then being pinned despite a size advantage before recognizing the discipline required by professional fighters.",
    people: ['David Choe', 'Joe Rogan', 'Steve Lee', 'Bobby Lee'], places: [], works: ['Joe Rogan Experience #563', 'DVDASA'], themes: ['wrestling', 'employment pressure', 'combat-sport training', 'humility'],
    warnings: ['workplace power imbalance', 'physical fighting and injury risk', 'explicit language'],
    beats: [[0, 'The abandoned UFC plan'], [82, "Steve Lee's job becomes the stake"], [190, 'Rules of the wrestling match'], [276, 'Steve gets the pin'], [349, 'Respect for professional training']]
  },
  'bRnQXElR0xE': {
    canonical: '2Xw5EgZdNvQ', shared: 96, coverage: 0.179,
    focus: "Choe traces his choice between safe advertising illustration and personal comics, describing film-poster work, a dismissive boss and the decision to take a creative risk before he had money.",
    people: ['David Choe', 'Joe Rogan', 'Drew Struzan', 'Sandra Bullock'], places: [], works: ['Joe Rogan Experience #563', 'Star Wars', '28 Days'], themes: ['art school', 'advertising', 'illustration', 'creative risk', 'financial independence'],
    beats: [[1, 'Leaving art school'], [94, 'The uniform movie-poster style'], [196, 'Safe advertising assignments'], [283, 'Declining the job'], [371, 'Taking risk before having money']]
  },
  'X0z3caRdZTg': {
    canonical: 'reW-p9ds4g4', shared: 148, coverage: 0.377,
    focus: "In a Steve-O interview excerpt, Choe separates money from adventure, recalls hitchhiking and stunts before wealth, explains accepting Facebook stock as a gamble, and emphasizes the practice hidden behind apparently spontaneous painting.",
    people: ['David Choe', 'Steve-O'], places: [], works: ["Steve-O's Wild Ride!", 'Facebook', 'Myspace'], themes: ['wealth', 'Facebook stock', 'gambling', 'hitchhiking', 'artistic practice'],
    warnings: ['dangerous stunts', 'gambling', 'explicit language'],
    beats: [[3, 'Food and the first paycheck'], [80, 'Adventure before money'], [164, 'Facebook overtakes Myspace'], [251, 'Practice behind spontaneous painting'], [336, "Steve-O's show promotion"]]
  },
  'KPnyiFx2O0w': {
    canonical: 'uJXhtxBl3OM', shared: 223, coverage: 0.264,
    focus: "Part two of a Steebee Weebee conversation reconstructs Steve Lee's daily routine: waking, preparing for guests, anxiety about cancellations, gaming late while his partner sleeps, and the relief after a live or recorded performance ends.",
    people: ['David Choe', 'Steve Lee'], places: [], works: ['The Steebee Weebee Show', 'Mangchi', 'Destiny'], themes: ['daily routine', 'anxiety', 'podcast preparation', 'gaming', 'post-show relief'],
    warnings: ['explicit sexual and bodily language'],
    beats: [[1, 'Recapping the day-in-the-life premise'], [205, 'Being forced awake'], [393, 'Guest-cancellation anxiety'], [571, 'Late-night Destiny sessions'], [725, 'Relief when everyone leaves']]
  },
  'yWAYOdJVY_o': {
    canonical: 'hicb0ZqmzzM', shared: 344, coverage: 0.260,
    focus: "David Choe and Steven Yeun explain to Bobby Lee why they wanted to honor him, moving from awkward resistance to accounts of Bobby's importance for young Asian American performers and Khalyla's emotional testimony about loving him.",
    people: ['David Choe', 'Steven Yeun', 'Bobby Lee', 'Khalyla'], places: [], works: ['TigerBelly', 'MADtv'], themes: ['tribute', 'Asian American representation', 'friendship', 'comedy career', 'emotional vulnerability'],
    warnings: ['explicit language', 'emotional distress'],
    beats: [[0, 'Why Steven Yeun came'], [297, 'Bobby resists the tribute'], [626, 'MADtv as evidence of possibility'], [928, 'Difficulty entering comedy'], [1210, "Khalyla's love changes the room"]]
  },
  '1YUK34XsNiY': {
    canonical: 'hicb0ZqmzzM', shared: 268, coverage: 0.247,
    focus: "A TigerBelly compilation excerpt uses *The Lord of the Rings* reunion as a friendship metaphor, then examines pandemic distance, a remembered Mangchi show, unanswered questions and Korean fathers' difficulty expressing affection.",
    people: ['David Choe', 'Steven Yeun', 'Bobby Lee', 'Khalyla'], places: ['Korea'], works: ['TigerBelly', 'The Lord of the Rings', 'Mangchi'], themes: ['friendship', 'pandemic separation', 'live music', 'Korean family culture', 'emotional expression'],
    warnings: ['explicit language', 'family emotional neglect'],
    beats: [[0, 'A Lord of the Rings reunion metaphor'], [230, 'Friendship after pandemic distance'], [455, 'Remembering the packed Mangchi show'], [626, 'A question Bobby may not answer'], [859, 'Fathers and emotional expression']]
  },
  'YOiHuk2iUpA': {
    canonical: 'hicb0ZqmzzM', shared: 46, coverage: 0.113,
    focus: "Choe pushes Bobby Lee to take TigerBelly more seriously, arguing that the show could become much larger with focused work; Bobby answers with his desire to keep trying stand-up, acting, radio and animation.",
    people: ['David Choe', 'Bobby Lee', 'Steven Yeun'], places: [], works: ['TigerBelly'], themes: ['podcast potential', 'work ethic', 'creative ambition', 'friendship pressure'],
    warnings: ['explicit language', 'coercive joking between friends'],
    beats: [[1, 'Bobby promises to believe the advice'], [64, 'A comparison with Steven Yeun'], [161, 'TigerBelly could be much larger'], [248, "Bobby's many creative ambitions"], [317, 'A surprise arrives']]
  },
  'xS7wfeeeM8I': {
    canonical: 'vimeo-dirty-hands-laff', shared: 52, coverage: 0.201,
    focus: "An unofficial *Dirty Hands* trailer introduces Choe through spray paint, graffiti, paid drawing and the label ‘dirty style,’ then previews Japan, illegality, exhaustion with his way of living and friends' belief that unresolved struggle feeds the work.",
    people: ['David Choe', 'Harry Kim'], places: ['Japan', 'Tokyo'], works: ['Dirty Hands: The Art and Crimes of David Choe'], themes: ['graffiti', 'dirty style', 'illegality', 'Japan', 'artistic conflict'],
    warnings: ['crime and graffiti', 'explicit language'],
    beats: [[2, 'Spray paint and changing the environment'], [98, 'A renegade street-artist introduction'], [186, 'Tokyo and the urge to steal'], [249, 'An illegal life becomes unsustainable'], [300, 'Inner struggle and artistic value']]
  },
  'AYAAfmzspis': {
    canonical: 'vimeo-dirty-hands-laff', shared: 11, coverage: 0.056,
    focus: "A short *Dirty Hands* upload concentrates on the Congo material: tension within Choe's group, joking searches for pygmies and ninjas, a remote doctor and missionary story, and local reports of a large unidentified animal framed as a dinosaur search.",
    people: ['David Choe', 'Harry Kim'], places: ['Republic of the Congo'], works: ['Dirty Hands: The Art and Crimes of David Choe'], themes: ['Congo travel', 'group conflict', 'missionaries', 'cryptozoology', 'artistic audience'],
    warnings: ['racialized and colonial language', 'dangerous travel', 'explicit language'],
    beats: [[2, 'Returning to Congo with a divided group'], [55, 'Pygmy and ninja jokes'], [141, 'A remote doctor'], [232, 'Missionary story of a large animal'], [324, 'No one is formally searching for a dinosaur']]
  },
  'nSWSXRUm3l8': {
    canonical: 'XS6awjpIimw', shared: 84, coverage: 0.133,
    focus: "An edited Howard Stern excerpt presents Choe's progressive betting system, his account of gambling as a substitute for drinking or drugs, the path from small gallery sales to a million-dollar stake and the danger of repeatedly returning to Las Vegas.",
    people: ['David Choe', 'Howard Stern'], places: ['Las Vegas'], works: ['The Howard Stern Show'], themes: ['gambling strategy', 'progressive betting', 'art sales', 'addiction', 'risk'],
    warnings: ['gambling addiction', 'high-stakes betting', 'explicit language'],
    beats: [[0, 'A doubling system and first million'], [130, 'Gambling as the chosen vice'], [249, 'Progressive and hit-and-run strategy'], [351, 'Frequent Las Vegas trips'], [456, 'Casino maximums and escalation']]
  }
};

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function writeRecord(id, spec) {
  const route = readJson(`data/${id}.json`);
  const canonical = readJson(`data/${spec.canonical}.json`);
  if (!canonical.editorial?.summary) throw new Error(`${id}: canonical route lacks editorial`);
  const duration = Number(route.segments?.at(-1)?.t || 0);
  const source = {
    episode_id: id,
    title: route.title,
    reviewed_on: '2026-08-13',
    description: spec.focus,
    summary: `${spec.focus} This is an edited excerpt of “${canonical.title},” not a separate full interview. Its transcript shares ${spec.shared.toLocaleString()} sampled eight-word shingles with that reviewed source (${(spec.coverage * 100).toFixed(1)}% of the excerpt sample), while the custom chapter map below follows this upload's own timeline. Statements remain attributed conversation rather than independently verified fact.`,
    chapters: spec.beats.map(([t, title]) => ({ t, title })),
    people: spec.people,
    places: spec.places,
    works: spec.works,
    themes: [...spec.themes, 'excerpt provenance'],
    connections: [{
      to: spec.canonical,
      note: `Canonical full-interview route: “${canonical.title}.” This excerpt has ${spec.shared.toLocaleString()} sampled shared eight-word transcript shingles and ${(spec.coverage * 100).toFixed(1)}% excerpt coverage.`
    }],
    content_warnings: spec.warnings || ['explicit language'],
    publication_restrictions: [{
      t: 0,
      rule: 'Keep this route labeled as an excerpt; do not present its edited topic arc as the complete interview or independent corroboration.'
    }],
    quality: {
      aggregate_segments: route.segments?.length || 0,
      duration_seconds: duration,
      canonical_route: spec.canonical,
      sampled_shared_eight_word_shingles: spec.shared,
      excerpt_sample_coverage: spec.coverage,
      chapters: spec.beats.length,
      named_turns: 0
    },
    source_notes: [
      'The title, transcript sequence and sampled shingle overlap agree on the full source.',
      'The chapter timestamps and focus summary were reviewed on the excerpt itself; full-episode chapter times were not copied.',
      'An excerpt can omit qualifications before or after the cut, so the canonical route remains the primary context record.'
    ],
    speaker_policy: 'Public participants are listed at route level. The automatic transcript has no validated diarized turns, so line-level speaker labels remain withheld.'
  };
  const target = path.join(ROOT, 'editorial', `${id}.json`);
  const serialized = `${JSON.stringify(source, null, 2)}\n`;
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === serialized) return false;
  if (write) fs.writeFileSync(target, serialized);
  return true;
}

let changed = 0;
for (const [id, spec] of Object.entries(excerpts)) if (writeRecord(id, spec)) changed += 1;
if (!write && changed) {
  console.error(`${changed} excerpt editorial records are out of sync; run node scripts/build_excerpt_editorial.mjs --write`);
  process.exit(1);
}
console.log(`${Object.keys(excerpts).length} reviewed excerpt mappings validated; ${write ? changed : 0} editorial files written.`);
