#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const videos = {
  'x0o0pC5mJfI': {
    focus: "SciFiReuben's eighth DVDASA recap is a fan-made, long-form retrospective that mixes clips, commentary and host discussion about the show's recurring cast, explicit humor, drinks, later disengagement and the recap project's own production backlog.",
    people: ['David Choe', 'Asa Akira', 'SciFiReuben'], works: ['DVDASA', 'DVDASA Recap Show'], themes: ['fan recap', 'podcast history', 'explicit humor', 'production retrospective'], warnings: ['explicit sexual discussion', 'slurs and offensive humor', 'alcohol'],
    beats: [[0, 'Opening clip montage'], [1777, 'Hygiene and explicit anatomy jokes'], [3214, 'Old Fashioneds and social stories'], [4746, 'Disengagement from DVDASA'], [6337, 'The recap production backlog']]
  },
  'zmvu9oUDi7I': {
    focus: "A Rio painting record pairs Herbert Baglione and David Choe footage with a long inserted guided-relaxation track, then returns to sparse studio reactions; the transcript cannot describe the mural's visual evolution.",
    people: ['David Choe', 'Herbert Baglione'], places: ['Rio de Janeiro', 'Brazil'], works: [], themes: ['mural painting', 'collaboration', 'guided relaxation', 'visual record'], warnings: ['transcript dominated by unrelated relaxation audio'],
    beats: [[17, 'The painting action begins'], [431, 'Inserted body-relaxation instructions'], [624, 'Breath visualization'], [862, 'Imagined ascent and release'], [1278, 'Painters react to the result']]
  },
  'WjVbmnTZqf4': {
    focus: "Choe considers truth, fiction, placebo and faith as forces that can change bodies and behavior, contrasting his blunt style with trickster methods before arguing that creativity and mind-body effects exceed tidy logical explanation.",
    people: ['David Choe'], places: [], works: [], themes: ['placebo effect', 'faith', 'truth and fiction', 'mind-body connection', 'creativity'], warnings: ['medical and pain discussion', 'violent fictional examples'],
    beats: [[3, 'Truth, lies and useful fiction'], [344, 'Blunt speech versus trickster chaos'], [681, 'Pain and a violent fictional contrast'], [1020, 'Every child begins as an artist'], [1313, 'Logic inside a chaotic world']]
  },
  '6IeVPOLdIEs': {
    focus: "A broad Mangchi compilation moves among a first-show introduction, music and crowd footage, Choe's reflection on productive periods without internet, Eddie Kim's album help, masks and Avatar-like imagery, and a deliberately crude closing performance.",
    people: ['David Choe', 'Steve Lee', 'Bobby Lee', 'Eddie Kim'], places: ['China', 'Japan', 'Mexico'], works: ['Mangchi'], themes: ['live music', 'band history', 'album production', 'masks', 'performance montage'], warnings: ['explicit sexual lyrics and language', 'rough automatic lyric transcript'],
    beats: [[8, 'First Mangchi-show montage'], [173, 'Productivity without internet'], [359, 'Eddie Kim and album work'], [508, 'Masks and blue Avatar imagery'], [748, 'Crude closing performance']]
  },
  'awmakgVOgs0': {
    focus: "Choe responds to viewers who miss his singing and gratitude, explains being social without alcohol, explores the niche market for nonalcoholic beer and links mocktails to his affection for mockumentaries and documentaries that bend truth toward happiness.",
    people: ['David Choe'], places: [], works: ['The King of Kong'], themes: ['mocktails', 'sobriety', 'mockumentary', 'documentary truth', 'gratitude'], warnings: ['alcohol discussion', 'explicit language'],
    beats: [[2, 'A request for more singing and gratitude'], [174, 'Being social without alcohol'], [366, 'The nonalcoholic-beer market'], [537, 'Documentaries about apparently minor subjects'], [694, 'Truth mixed with a little fiction']]
  },
  'oRWi-tZyotE': {
    focus: "An *Indisputable* segment discusses resurfaced DVDASA audio in which Choe described an alleged sexual assault, criticizes the entertainment industry's response around *Beef*, reviews low prosecution rates and debates whether continued acting work is a privilege; it is commentary, not an adjudication of the allegation.",
    people: ['David Choe', 'Rashad Richey'], places: ['United States'], works: ['DVDASA', 'Beef', 'Indisputable'], themes: ['sexual-assault allegation', 'media accountability', 'prosecution', 'employment consequences'], warnings: ['graphic sexual-assault discussion', 'victimization', 'racial and gender inequity'],
    restrictions: [{ t: 0, rule: 'Keep allegation, commentary, apology/denial and established fact distinct; do not state that the segment legally proves an assault.' }],
    beats: [[0, 'Why the resurfaced audio matters'], [177, 'Commentary on the recorded account'], [337, 'Low investigation and prosecution rates'], [506, 'Survival and unequal punishment'], [660, 'Work as privilege rather than right']]
  },
  '1x2N5-aYYl4': {
    focus: "The 2013 myFinBec documentary follows Choe painting wooden wine crates and labels, beginning with travel-ban jokes, adapting imagery to bottles viewed sideways, embracing paint-warped wood and ending with the producer's account of packing artist-designed wine.",
    people: ['David Choe'], places: ['Kansas City', 'Canada', 'Japan', 'Afghanistan'], works: ['myFinBec'], themes: ['wine-label art', 'painted crates', 'commission process', 'material warping', 'documentary'], warnings: ['alcohol', 'travel and legal references'],
    beats: [[4, 'Travel-ban introduction'], [146, 'Designing for a sideways bottle'], [289, 'Paint warps the crate'], [441, 'Applying the final labels'], [590, 'Wine, art and connoisseurship']]
  },
  'StlQDvxDtq0': {
    focus: "Choe uses *Dirty Hands*, Banksy and *Exit Through the Gift Shop* to argue for filming behind the behind-the-scenes, then detours through BTS, Psy and Instagram-boyfriend labor before asking documentarians to look past the obvious artist-at-work image.",
    people: ['David Choe', 'Harry Kim', 'Banksy', 'Psy'], places: [], works: ['Dirty Hands', 'Exit Through the Gift Shop', 'BTS', 'Gangnam Style'], themes: ['documentary layers', 'behind the scenes', 'K-pop', 'invisible labor', 'media framing'], warnings: ['explicit language', 'body-based ridicule'],
    beats: [[1, "Dirty Hands and a child's graffiti question"], [134, 'Banksy turns the camera around'], [264, 'BTS versus Psy'], [394, 'The boyfriends behind Instagram images'], [523, 'Go deeper than filming graffiti']]
  },
  'yMw73rpJPRA': {
    focus: "An early-*Dirty Hands* excerpt combines music, whales, Choe's habit of putting Bible verses and flipped lyrics on walls, a two-handed spray technique, joking police-evasion performance and the claim that ugly and beautiful marks are human signatures on territory.",
    people: ['David Choe', 'Harry Kim'], places: ['Los Angeles'], works: ['Dirty Hands'], themes: ['early graffiti', 'whales', 'Bible verses', 'spray technique', 'territory'], warnings: ['graffiti and police evasion jokes', 'explicit language'],
    beats: [[3, 'Music and whale imagery'], [124, 'Bible verses and flipped lyrics'], [207, 'Two-handed spray technique'], [381, 'Joking response to police'], [524, 'Ugly-beautiful human signature']]
  },
  'jWMi6WOa56k': {
    focus: "VICE's Congo excerpt follows Choe's childish sense of adventure into a search for the reported Mokele-mbembe, through expert and local testimony, disorienting jungle travel with guides and paranoid jokes about sorcerers reading his mind.",
    people: ['David Choe', 'Harry Kim'], places: ['Republic of the Congo'], works: ['Thumbs Up', 'VICE'], themes: ['Mokele-mbembe', 'cryptozoology', 'jungle expedition', 'Pygmy guides', 'adventure'], warnings: ['dangerous jungle travel', 'racialized and colonial language', 'explicit language'],
    beats: [[12, 'Childhood travel and wonder'], [111, 'Experts, scientists and local reports'], [234, 'Lost in the jungle with guides'], [378, "A guide's unsettling look"], [512, 'Sorcerer paranoia joke']]
  },
  'vTaS3XK3rgI': {
    focus: "A narrated mini-documentary compresses Choe's biography from Los Angeles graffiti and magazine illustration through Congo travel, Japanese imprisonment, Facebook murals and international art recognition, relying heavily on familiar interview clips rather than new reporting.",
    people: ['David Choe', 'Sean Parker'], places: ['Los Angeles', 'Europe', 'Republic of the Congo', 'Japan'], works: ['Facebook office murals'], themes: ['biography', 'graffiti', 'travel', 'incarceration', 'Facebook wealth'], warnings: ['crime and incarceration', 'biographical claims require source attribution'],
    beats: [[0, 'From Los Angeles streets to Facebook'], [121, 'Travel and early illustration work'], [235, 'The Japan arrest account'], [352, 'Sean Parker and Facebook'], [449, 'International-art legacy claim']]
  },
  'm-5ofpeuOYc': {
    focus: "A rough live recording captures Mangchi's ‘Hammer’ performance, audience exchanges, long music-dominated passages, damaged lyric transcription and a closing thank-you that celebrates taking over a Monday-night bill.",
    people: ['David Choe', 'Steve Lee'], places: [], works: ['Mangchi', 'Hammer'], themes: ['live performance', 'audience banter', 'concert recording'], warnings: ['explicit sexual stage banter', 'rough and unreliable lyric transcript'],
    beats: [[0, 'Audience introduction'], [120, 'I love you and music break'], [267, 'Band cue'], [352, 'Damaged Hammer lyric passage'], [413, 'Closing thanks and giveaway joke']]
  },
  'h4fE_LwuTC0': {
    focus: "Choe recounts how young tattooed musicians invited him to drum for what became Crazy Town, why he dismissed them, and how *Butterfly* later turned the missed chance into a lesson about opportunities that look uncool or inconvenient in the moment.",
    people: ['David Choe'], places: [], works: ['Crazy Town', 'Butterfly', 'Ozzfest'], themes: ['missed opportunity', 'music', 'appearance bias', 'regret', 'audience reflection'], warnings: ['drug stereotypes', 'explicit language'],
    beats: [[3, 'A familiar story for new viewers'], [117, 'Face tattoos before they were normal'], [231, 'The future band arrives'], [325, 'Imagining the lost band life'], [402, 'Asking viewers for missed opportunities']]
  },
  '5iUX02mRsGc': {
    focus: "A Vancouver fan recounts discovering Choe and DVDASA, meeting Money Mark and members of the crew, freezing into fangirl behavior and later treating the encounter as one influence on his hustle and willingness to challenge artist stereotypes.",
    people: ['David Choe', 'Money Mark'], places: ['Vancouver'], works: ['DVDASA'], themes: ['fandom', 'chance encounter', 'creative influence', 'hustle', 'artist stereotype'], warnings: ['explicit language'],
    beats: [[0, 'Introducing the Vancouver story'], [124, 'Why Choe challenged artist stereotypes'], [223, 'Meeting Money Mark and asking for a photo'], [308, 'A mentor encountered in public'], [374, 'Influence on hustle and perspective']]
  },
  'lqmqqvFV7Ec': {
    focus: "A *Dithers* interview excerpt explains Choe's doofy whale character as a mouthpiece, traces his family's post-riot Diet Magic business and his entry into adult-magazine illustration, then introduces recurring mutated-whale and hostile-twin characters.",
    people: ['David Choe'], places: ['Los Angeles'], works: ['Dithers', 'Diet Magic'], themes: ['whale character', 'family business', 'adult-magazine illustration', 'character design'], warnings: ['explicit sexual language', 'adult-magazine discussion'],
    beats: [[1, 'The doofy whale as mouthpiece'], [116, 'Diet Magic after the Los Angeles riots'], [162, 'Writing to the Larry Flynt building'], [225, 'The mutated whale character'], [358, 'The hostile hot-twin characters']]
  },
  '9AzEpY7H5Ac': {
    focus: "A Facebook-headquarters painting upload is almost entirely raw visual footage; the speech decoder loops on ‘having’ and captures only brief movement, equipment and vehicle remarks, so mural actions and participants cannot be reconstructed from text alone.",
    people: ['David Choe'], places: ['Facebook headquarters'], works: ['Facebook office murals'], themes: ['raw footage', 'mural painting', 'visual record', 'decoder failure'], warnings: ['severe repeated-transcript corruption'],
    beats: [[2, 'Raw footage begins'], [112, 'Brief equipment exchange'], [142, 'Closing a vehicle'], [278, 'Decoder repetition resumes'], [342, 'Visual-only closing passage']]
  },
  '1VEq7pdtbHM': {
    focus: "The Hundreds' studio feature mixes Choe's artwork and guests with explicit object jokes, frustration over online abuse, a painful physical demonstration and a coercive role-play that should not be treated as relationship advice or consent.",
    people: ['David Choe'], places: [], works: ['The Hundreds'], themes: ['studio visit', 'online abuse', 'physical endurance', 'role-play', 'boundary failure'], warnings: ['explicit sexual content', 'coercive role-play', 'pain and physical pressure', 'online harassment'],
    beats: [[3, 'Studio-show introduction'], [68, 'Disputed intimate image'], [135, 'Online abuse reaches a boiling point'], [180, 'A painful keep-going demonstration'], [254, 'Coercive domestic role-play']]
  },
  'u5sqxKpVJYw': {
    focus: "A commentary upload republishes the resurfaced DVDASA sexual-assault account, identifies the online cancellation campaign around *Beef*, then reads Choe's later statement describing the story as false, apologizing for making sexual assault into a joke and discussing recovery and self-hatred.",
    people: ['David Choe', 'Ali Wong'], places: [], works: ['DVDASA', 'Beef'], themes: ['sexual-assault allegation', 'media cancellation', 'apology', 'denial', 'recovery'], warnings: ['graphic sexual-assault language', 'self-hatred and mental illness', 'online harassment'],
    restrictions: [{ t: 0, rule: 'Do not convert either the old story or later denial into a legal finding; preserve chronology and attribution.' }],
    beats: [[0, 'The resurfaced recorded account'], [47, 'Online campaign and media circulation'], [126, 'Reading the apology'], [181, 'Denial and rejection of the joke'], [227, 'Recovery and self-forgiveness claim']]
  }
};

function route(id) { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${id}.json`), 'utf8')); }
function record(id, spec) {
  const d = route(id); const duration = Number(d.segments?.at(-1)?.t || 0);
  return {
    episode_id: id, title: d.title, reviewed_on: '2026-08-13', description: spec.focus,
    summary: `${spec.focus} The archive treats publisher framing and participant speech as attributed source material, not automatic verification. The chapter map follows this upload's own transcript; visually dependent passages and damaged lyrics remain explicitly limited.`,
    chapters: spec.beats.map(([t,title])=>({t,title})), people: spec.people, places: spec.places || [], works: spec.works || [], themes: spec.themes || [],
    connections: [{to:'David Choe public-source network',note:`This route is preserved under its original publisher group and title; it is contextual evidence about Choe, not necessarily an original Choe publication.`}],
    content_warnings: spec.warnings, publication_restrictions: spec.restrictions || [{t:0,rule:'Keep publisher commentary, quoted speech and independently established fact distinct.'}],
    quality:{aggregate_segments:d.segments?.length||0,duration_seconds:duration,chapters:spec.beats.length,named_turns:0,publisher_group:d.group},
    source_notes:['Focus and chapter beats were reviewed against this route transcript.','Publisher title and framing may be partial, sensational or retrospective and are not silently adopted as archive voice.','Video-dependent actions require the source upload.'],
    speaker_policy:'Public people are listed at route level. Automatic transcript lines remain unnamed without validated diarization.'
  };
}
let changed=0;
for(const [id,spec] of Object.entries(videos)){const target=path.join(ROOT,'editorial',`${id}.json`),serialized=`${JSON.stringify(record(id,spec),null,2)}\n`;if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===serialized)continue;changed++;if(write)fs.writeFileSync(target,serialized);}
if(!write&&changed){console.error(`${changed} external-video editorial records are out of sync; run node scripts/build_external_editorial.mjs --write`);process.exit(1);}
console.log(`${Object.keys(videos).length} external-video records validated; ${write?changed:0} editorial files written.`);
