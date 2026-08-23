/* Two-tier search, per the generator's design:
   tier 1 -- the small term->item index in catalog.json answers WHICH items.
   tier 2 -- that item's transcript is fetched on demand to answer WHERE.
   This keeps first paint to one small download instead of tens of megabytes. */

const $ = (id) => document.getElementById(id);
// Every data request carries the build stamp, so a deploy is a new URL and a
// reader cannot be served the previous build's catalog or retelling index from
// cache. Versioning the code alone left exactly that hole.
const BUILD_STAMP = (typeof window !== 'undefined' && window.__BUILD) || '';
const dataURL = (p) => p + (BUILD_STAMP ? (p.includes('?') ? '&' : '?') + 'v=' + BUILD_STAMP : '');
const state = { cat: null, browse: {}, items: [], group: 'All', q: '', cache: new Map(),
                showAll: false, mode: localStorage.getItem('choeMode') || 'reader' };

const hms = (s) => {
  s = Math.max(0, Math.round(s));
  const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
           : `${m}:${String(x).padStart(2, '0')}`;
};
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = (q) => q.toLowerCase().match(/[a-z][a-z'&-]{1,}/g) || [];

// Caption event markers ([Music], [Laughter], [—] for a bleep) are real
// information about the recording, so they are never deleted -- but at full
// weight they interrupt the prose. Reader mode de-emphasises them; Transcript
// mode leaves them plain, because there the job is fidelity to the source.
function markers(html) {
  return html.replace(/\[[^\]<>]{1,24}\]/g, (m) => `<span class="cue">${m}</span>`);
}

/* Script mode renders the cleaned transcript when this recording has one. The
   cleaned text keeps all dialogue and only adds bracketed delivery/context cues.
   When an item has not been cleaned yet, Script remains useful by rendering the
   source segments in the same reading layout. */
const ELONG = /([A-Za-z])\1{2,}/g;
const CUE = /\[[^\]<>]{1,24}\]/g;
const CAPTOK = /^[A-Z][A-Z'’]{1,}$/;
const ACRONYMS = new Set(['DVDASA','AMA','KGB','TV','DVD','CD','USA','US','UK','LA',
  'NYC','SF','FBI','CIA','LSD','MDMA','UFC','NBA','NFL','MMA','PJ','OG','BJ','IG',
  'DM','AA','NA','ID','OK','PC','AI','UFO','WTF','LOL','ASMR','POV','AF']);

function scriptLine(text) {
  const cues = (text.match(CUE) || []).length;
  const bangs = (text.match(/[!?]/g) || []).length;
  const stacked = /[!?]{2,}/.test(text) ? 1 : 0;
  const elong = (text.match(ELONG) || []).length;
  const loudTokens = new Set();
  const toks = text.split(/(\s+)/);
  let run = [];
  const flush = () => {
    if (run.length >= 2) run.forEach((i) => loudTokens.add(i));
    else if (run.length === 1) {
      const w = toks[run[0]].replace(/[^A-Za-z'’]/g, '');
      if (!ACRONYMS.has(w) && bangs > 0 && w.length >= 2) loudTokens.add(run[0]);
    }
    run = [];
  };
  toks.forEach((tk, i) => {
    if (/\S/.test(tk)) {
      const w = tk.replace(/[^A-Za-z'’]/g, '');
      if (w.length >= 2 && CAPTOK.test(w) && !ACRONYMS.has(w)) run.push(i);
      else flush();
    }
  });
  flush();
  const score = loudTokens.size * 2 + stacked * 2 + bangs + elong;
  const intensity = loudTokens.size >= 2 || score >= 6 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0;
  const html = toks.map((tk, i) => loudTokens.has(i)
    ? `<b class="loud">${esc(tk)}</b>`
    : esc(tk).replace(CUE, (m) => `<em class="stage">${m.slice(1, -1)}</em>`)
      .replace(ELONG, (m) => `<span class="stretch">${m}</span>`)).join('');
  return { html, intensity, allCue: cues > 0 && text.replace(CUE, '').trim() === '' };
}

const CUE_HI = /\[(?:[^\]]*\b(?:shouting|yelling|screaming|screams|yells)\b[^\]]*)\]/i;
const CUE_MED = /\[(?:[^\]]*\b(?:laugh|laughs|laughing|laughter|sarcastic|sarcastically|mock|mocking|imitating|excited|shouts|singing|sings|angry|crying)\b[^\]]*)\]/i;
const CAPRUN = /\b[A-Z][A-Z'’]{1,}(?:\s+[A-Z][A-Z'’]{1,})+\b/g;

function cleanedLine(text) {
  const allCue = /^\s*\[[^\]<>]{1,40}\]\s*$/.test(text);
  let intensity = 0;
  if (CUE_HI.test(text)) intensity = 3;
  else if (CUE_MED.test(text)) intensity = 2;
  else {
    const caps = (text.match(CAPRUN) || []).length;
    const bangs = (text.match(/[!?]/g) || []).length;
    intensity = caps >= 1 || bangs >= 3 ? 3 : bangs >= 1 ? 2 : /[!?]/.test(text) ? 1 : 0;
  }
  const html = esc(text).replace(CUE, (m) => `<em class="stage">${m.slice(1, -1)}</em>`)
    .replace(CAPRUN, (m) => `<b class="loud">${m}</b>`)
    .replace(ELONG, (m) => `<span class="stretch">${m}</span>`);
  return { html, intensity, allCue };
}

function highlight(text, terms) {
  if (!terms.length) return esc(text);
  const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
  return esc(text).replace(re, '<mark>$1</mark>');
}

/* Tier 1: intersect postings lists. A term the index dropped (too common, or
   never seen) falls back to matching titles so the query never dead-ends. */
function searchItems(q) {
  const ts = words(q).filter((w) => w.length >= 3);
  if (!ts.length) return state.items.map((_, i) => i);
  let acc = null;
  for (const t of ts) {
    let hits = state.cat.index[t];
    if (!hits) {
      const pre = Object.keys(state.cat.index).filter((k) => k.startsWith(t));
      hits = pre.length ? [...new Set(pre.flatMap((k) => state.cat.index[k]))] : null;
    }
    const editorialHits = state.items.map((it, i) => {
      const browse = state.browse[it.id] || {};
      const haystack = [it.t, browse.description, ...(browse.people || [])].join(' ').toLowerCase();
      return haystack.includes(t) ? i : -1;
    }).filter((i) => i >= 0);
    hits = [...new Set([...(hits || []), ...editorialHits])];
    const set = new Set(hits);
    acc = acc === null ? set : new Set([...acc].filter((x) => set.has(x)));
    if (!acc.size) break;
  }
  return [...(acc || [])];
}

/* These are filters only. Research destinations and featured series used to be
   mixed into the same row, making buttons that looked identical do unrelated
   things. Navigation now lives in the site header and corpus section. */
const COLLECTIONS = ['All', 'DVDASA', 'Interviews', 'His channel', 'Clips'];
const DEFAULT_VISIBLE = 24;
const START_PATHS = [
  {
    id: 'saga1-episode-001-with-david-choe-and-asa-akira', href: '#/saga1-episode-001-with-david-choe-and-asa-akira',
    label: 'Start at the beginning', title: 'DVDASA Episode 001'
  },
  {
    id: 'saga1-episode-101-the-ranch-solo-series-part-one', href: '#ranch',
    label: 'A quieter side', title: 'The Ranch solo recordings'
  },
  {
    id: '2Xw5EgZdNvQ', href: '#/2Xw5EgZdNvQ',
    label: 'A long-form conversation', title: 'Joe Rogan Experience #563'
  },
  {
    id: '01HBjlMmqCQ', href: '#/01HBjlMmqCQ',
    label: 'The current art mode', title: 'Embrace Fearlessness'
  }
];
// A separate entrance rather than a filter: it is not a subset of the
// transcripts, it is a different question asked of them.
const inGroup = (it, g) => g === 'All' || it.c === g;

function renderFilters() {
  const n = {};
  state.items.forEach((i) => { n[i.c] = (n[i.c] || 0) + 1; });
  const chips = COLLECTIONS
    .filter((g) => g === 'All' || n[g])
    .map((g) => `<button type="button" data-g="${esc(g)}" aria-pressed="${g === state.group}">`
      + `${esc(g)}<b>${g === 'All' ? state.items.length : n[g]}</b></button>`);
  $('filters').innerHTML = chips.join('');
  $('filters').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      state.group = b.dataset.g; state.showAll = false; renderFilters(); renderList();
    };
  });
}

/* Four larger entrances orient the archive. Compact row thumbnails then make
   individual recordings recognizable without returning to an endless image
   wall. Existing art stays attached to its catalog record; missing art gets an
   original metadata cover generated from collection, title and runtime. */
function renderStart() {
  const byId = new Map(state.items.map((item) => [item.id, item]));
  $('startCards').innerHTML = START_PATHS.map((path) => {
    const item = byId.get(path.id);
    if (!item) return '';
    const browse = state.browse[item.id] || {};
    return `<a class="start-card" href="${esc(path.href)}">
      <span class="start-image"><img src="${esc(item.th || '')}" alt="" loading="eager"></span>
      <span class="start-copy">
        <span class="start-label">${esc(path.label)}</span>
        <strong>${esc(path.title)}</strong>
        <span>${esc(browse.description || item.t)}</span>
      </span>
    </a>`;
  }).join('');
}

function generatedThumb(item) {
  const colors = {
    DVDASA: '#ffd42a', Interviews: '#8ed1fc', 'His channel': '#ff6b96',
    Clips: '#d6ff6b', Films: '#c4b5fd'
  };
  const accent = colors[item.c] || '#d8d4cc';
  const serial = String(item.t).match(/\b(?:Episode|Chapter)\s+\d+/i)?.[0];
  const title = serial || String(item.t).slice(0, 28);
  const minutes = `${Math.max(1, Math.round(item.d / 60))} min`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <rect width="320" height="180" fill="#161616"/><rect width="12" height="180" fill="${accent}"/>
    <text x="30" y="42" fill="${accent}" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">${esc(String(item.c).toUpperCase())}</text>
    <text x="30" y="102" fill="#f5f1e8" font-family="Arial,sans-serif" font-size="25" font-weight="700">${esc(title)}</text>
    <text x="30" y="145" fill="#a8a49d" font-family="Arial,sans-serif" font-size="15">${esc(minutes)} · ARCHIVE RECORD</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function rowThumb(item) {
  const source = item.th || generatedThumb(item);
  const loading = source.startsWith('data:') ? '' : ' loading="lazy"';
  return `<img class="record-thumb" src="${esc(source)}" alt=""${loading} decoding="async">`;
}

/* Coverage. The archive being 15% transcribed was invisible before -- a partial
   corpus silently read as the complete one. */
function renderProgress() {
  // The historical catalog coverage object counted alternate cards and an old
  // source target, eventually producing the impossible “433 of 430”. The real
  // public denominator is the set of reader route IDs. Every one now has a
  // transcript record and completed editorial, so derive this line from the
  // same IDs the reader and corpus analysis actually use.
  const routes = [...new Map(state.items.map((item) => [item.id, item])).values()];
  if (!routes.length) return;
  const dvdasa = routes.filter((item) => item.k === 'dvdasa').length;
  const other = routes.length - dvdasa;
  $('barDone').style.width = '100%';
  $('barPart').style.width = '0%';
  $('progressLbl').textContent =
    `${routes.length} of ${routes.length} reader routes available · DVDASA ${dvdasa}/${dvdasa}`
    + ` · other sources ${other}/${other} · editorial ${routes.length}/${routes.length}`;
  $('progress').hidden = false;
}

function renderList() {
  const terms = words(state.q).filter((w) => w.length >= 3);
  let idx = searchItems(state.q);
  if (state.group !== 'All') idx = idx.filter((i) => inGroup(state.items[i], state.group));
  // DVDASA is a numbered serial: episode order is the order it was made and
  // the order it reads in, so sorting it by duration scrambled the series
  // (033, 032, 010, 025...). YouTube has no inherent sequence, so longest-first
  // still serves there -- it surfaces real conversations over clips.
  const epNum = (t) => {
    const m = String(t).match(/\b(?:Episode|Chapter)\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  idx.sort((x, y) => {
    const A = state.items[x], B = state.items[y];
    if (A.k === 'dvdasa' && B.k === 'dvdasa') {
      if (A.g !== B.g) return A.g.localeCompare(B.g);      // Saga 1 before Saga 2
      const na = epNum(A.t), nb = epNum(B.t);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return A.t.localeCompare(B.t);
    }
    if (A.k !== B.k) return A.k === 'dvdasa' ? -1 : 1;      // the unique source first
    return B.d - A.d;
  });

  const hasQuery = Boolean(state.q);
  const isLimited = !hasQuery && !state.showAll && idx.length > DEFAULT_VISIBLE;
  const shown = isLimited ? idx.slice(0, DEFAULT_VISIBLE) : idx;
  $('startHere').hidden = hasQuery || state.group !== 'All';

  $('count').textContent = state.q
    ? `${idx.length} transcript${idx.length === 1 ? '' : 's'} mention “${state.q}”`
    : isLimited ? `Showing ${shown.length} of ${idx.length} transcripts` : `${idx.length} transcripts`;

  $('cards').innerHTML = shown.length
      ? shown.map((i) => {
        const it = state.items[i];
        const browse = state.browse[it.id] || {};
        const names = browse.people || [];
        const shownNames = names.slice(0, 4);
        const moreNames = names.length > shownNames.length ? ` +${names.length - shownNames.length} more` : '';
        return `<li><button type="button" data-id="${esc(it.id)}">
          ${rowThumb(it)}
          <span class="record-main">
            <span class="ct">${highlight(it.t, terms)}</span>
            <span class="record-summary">${highlight(browse.description || 'Summary unavailable.', terms)}</span>
            <span class="record-people"><b>People</b> ${shownNames.map(esc).join(', ')}${esc(moreNames)}</span>
          </span>
          <span class="record-collection">${esc(it.c)}</span>
          <span class="record-runtime">${hms(it.d)}</span>
          <span class="record-text">${esc(browse.transcript_label || 'Transcript')}<small>${it.w.toLocaleString()} words</small></span>
        </button></li>`;
      }).join('')
    : `<li><p class="empty">Nothing matches “${esc(state.q)}”.</p></li>`;

  $('listReveal').innerHTML = isLimited
    ? `<button type="button" aria-controls="cards">Show all ${idx.length} recordings</button>`
    : '';
  const reveal = $('listReveal').querySelector('button');
  if (reveal) reveal.onclick = () => { state.showAll = true; renderList(); };

  $('cards').querySelectorAll('button').forEach((b) =>
    b.onclick = () => { location.hash = '#/' + b.dataset.id; });
}

async function loadItem(id) {
  if (state.cache.has(id)) return state.cache.get(id);
  // Stamped like the rest: this is the transcript itself, so a stale copy means
  // a reader sees uncorrected text long after a correction shipped.
  const r = await fetch(dataURL(`data/${encodeURIComponent(id)}.json`));
  if (!r.ok) throw new Error('missing transcript');
  const d = await r.json();
  state.cache.set(id, d);
  return d;
}

function renderTranscript(d, q) {
  const terms = words(q).filter((w) => w.length >= 2);
  const reader = state.mode === 'reader' && !terms.length;
  const script = state.mode === 'script' && !terms.length;
  $('body').className = 'transcript' + (reader ? ' reader' : '') + (script ? ' script' : '');

  // In reader mode, editorial chapter marks become inline headings so a long
  // interview reads as sections instead of an undifferentiated wall. Searching
  // drops back to the timestamped view, because then the job is locating a
  // line, not reading. Chapters are Codex's editorial data -- absent for most
  // items, and the view degrades to plain prose without them.
  const chaps = (reader || script) && d.editorial && Array.isArray(d.editorial.chapters)
    ? [...d.editorial.chapters].map((c) => ({ t: Number(c.t ?? c.start ?? 0),
        title: String(c.title || c.label || '') })).sort((a, b) => a.t - b.t)
    : [];
  let ci = 0;

  const srcSegs = (script && Array.isArray(d._scriptLines) && d._scriptLines.length)
    ? d._scriptLines.map((line) => ({ t: Number(line.t) || 0, x: String(line.text || '') }))
    : d.segments;
  const cleaned = script && srcSegs !== d.segments;
  const rows = srcSegs.map((s, i) => {
    let head = '';
    while (ci < chaps.length && s.t >= chaps[ci].t) {
      // Marked as editorial in the DOM and to screen readers, not only in CSS.
      // A chapter title is Codex READING a passage, not the recording stating
      // something -- "David admits to X" is a characterisation, and rendered as
      // a bare section heading inside the transcript it would read as fact the
      // audio settles. The transcript and the markers are audio-grounded; this
      // is not, and the reader is entitled to know which is which.
      head += `<h3 class="chap" data-editorial="1">` +
              `<span class="chaptag" aria-hidden="true">editorial</span>` +
              `<span class="sr">Editorial chapter title: </span>` +
              `${esc(chaps[ci].title)}</h3>`;
      ci++;
    }
    if (script && !d.text_withheld) {
      const line = cleaned ? cleanedLine(s.x) : scriptLine(s.x);
      return head + (line.allCue
        ? `<p class="sline stage-only" data-intensity="0">${line.html}</p>`
        : `<p class="sline" data-intensity="${line.intensity}" id="l${i}">${line.html}</p>`);
    }
    const r = row(d, s, i, terms);
    return head + (reader ? markers(r) : r);
  }).join('');
  $('body').innerHTML = rows || `<p class="empty">No line matches “${esc(q)}”.</p>`;
  if (terms.length) {
    const n = d.segments.filter((s) => terms.some((t) => s.x.toLowerCase().includes(t))).length;
    $('fhint').textContent = `${n} matching line${n === 1 ? '' : 's'}`;
  } else {
    $('fhint').textContent = script
      ? (cleaned
          ? `${srcSegs.length.toLocaleString()} lines · cleaned, with bracketed context cues`
          : `${srcSegs.length.toLocaleString()} lines · script view, intensity inferred from text`)
      : reader
      ? `${d.segments.length.toLocaleString()} paragraphs`
      : `${d.segments.length.toLocaleString()} lines`;
  }
}


/* ---------- retellings ----------
   The one view the corpus enables and listening does not: the same story told
   twice, side by side, ordered so the direction of drift is visible.

   Deliberately NOT summarised. Each side shows the episode, the timestamp and
   the words as transcribed; the only computed element is which distinctive
   names appear in one telling and not the other, which is a set difference a
   reader can check against the quotes. Characterising WHY a version changed
   would be inventing a reading the recordings do not contain -- the same line
   the redaction and editorial layers hold. */
async function renderRetellings() {
  const box = $('body');
  let data;
  try { data = await (await fetch(dataURL('data/retellings.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No retelling index built yet.</p>'; return; }
  // Chains, not pairs: a story told in three episodes is ONE story with three
  // tellings, and showing it as three disconnected pairs hides the arc, which is
  // the thing the corpus uniquely reveals.
  const chains = data.chains || [];
  const n3 = chains.filter((c) => c.times_told > 2).length;
  const sv = data.survey || {};
  // The denominator travels with the number. "13 stories" is meaningless until
  // the reader knows it came from 177 episodes, and which 177.
  $('fhint').textContent = `${chains.length} candidate passage chains`
    + (n3 ? ` · ${n3} appear in three or more episodes` : '')
    + (sv.episodes_swept ? ` · from ${sv.passages_indexed.toLocaleString()} passages`
       + ` across ${sv.episodes_swept} DVDASA episodes` : '');
  box.innerHTML = chains.map((c) => {
    const label = (i) => i === 0 ? 'first told'
      : i === c.tellings.length - 1 ? 'last told' : 'again';
    const side = (x, when) => `
      <div class="tell">
        <p class="tellhead">${esc(when)} · <a href="#/${esc(x.id)}">${esc(x.title)}</a>
          <span class="dim">${hms(x.t)}</span></p>
        <p class="tellq">${esc(x.quote)}</p>
        ${x.only_here && x.only_here.length
          ? `<p class="only"><span>only here</span> ${x.only_here.map(esc).join(' · ')}</p>` : ''}
      </div>`;
    return `<section class="retell">
      <p class="shared">${c.shared_names.map(esc).join(' · ')}
        <span class="times">appears in ${c.times_told} of ${sv.episodes_swept || '?'} episodes</span></p>
      <div class="tells">${c.tellings.map((t, i) => side(t, label(i))).join('')}</div>
    </section>`;
  }).join('') || '<p class="empty">No candidates.</p>';
}


/* Corpus-level analysis navigation. Episode-specific presence and recurring
   context live on each recording now, not as another global control surface. */
const ANALYSIS_GROUPS = [
  ['Reading the corpus', [['overview', 'Corpus overview'], ['corpus', 'Route map'], ['method', 'Method']]],
  ['Stories & patterns', [['stories', 'Verified stories'], ['retold', 'Similar passages'], ['arcs', 'Arcs']]],
  ['People & subjects', [['cast', 'Cast'], ['subjects', 'Recurring subjects']]],
];
const ANALYSES = [['recent', 'Current YouTube'], ...ANALYSIS_GROUPS.flatMap(([, rows]) => rows)];

function renderPrimary(active) {
  document.querySelectorAll('[data-primary]').forEach((link) => {
    if (link.dataset.primary === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderTabs(active) {
  const el = $('atabs');
  if (!el) return;
  if (active === 'recent') { el.hidden = true; el.innerHTML = ''; return; }
  const options = ANALYSIS_GROUPS.map(([label, rows]) =>
    `<optgroup label="${esc(label)}">${rows.map(([k, text]) =>
      `<option value="${esc(k)}"${k === active ? ' selected' : ''}>${esc(text)}</option>`).join('')}</optgroup>`).join('');
  el.innerHTML = `<label class="analysis-select-label" for="analysisSelect">Corpus section</label>
    <select id="analysisSelect" class="analysis-select">${options}</select>
    <div class="analysis-groups">${ANALYSIS_GROUPS.map(([label, rows]) =>
      `<section><h3>${esc(label)}</h3>${rows.map(([k, text]) =>
        `<a href="#${k}" class="atab${k === active ? ' on' : ''}"${k === active ? ' aria-current="page"' : ''}>${esc(text)}</a>`).join('')}</section>`).join('')}</div>`;
  $('analysisSelect').onchange = (event) => { location.hash = `#${event.target.value}`; };
  el.hidden = false;
}

/* The editorial answer the archive previously lacked. Per-route summaries and
   a lexical route map do not add up to a corpus interpretation by themselves.
   This view is deliberately built from a separate, validated artifact so the
   thesis, topic denominator, people normalization, and screenplay cautions can
   be audited without scraping prose back out of the DOM. */
async function renderOverview() {
  const box = $('body');
  let d;
  try { d = await (await fetch(dataURL('data/corpus-analysis.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No overall corpus analysis built yet.</p>'; return; }
  const sv = d.survey || {};
  const evidence = (routes) => `<p class="analysis-evidence">${(routes || []).map((r) =>
    `<a href="#/${esc(r.id)}">${esc(r.title)}</a><span>${esc(r.note || '')}</span>`).join('')}</p>`;
  $('fhint').textContent = `${sv.routes} unique reader routes · ${sv.hours} hours · `
    + `${(sv.words || 0).toLocaleString()} words · all route editorials included`;

  const shape = (d.summary?.corpus_shape || []).map((row) => `
    <li><b>${esc(row.label)}</b><strong>${row.count}</strong><span>${esc(row.note)}</span></li>`).join('');
  const topics = (d.repeated_topics || []).map((topic) => `
    <section class="analysis-card topic-card">
      <p class="analysis-title">${esc(topic.name)}
        <span>${topic.route_count} / ${topic.denominator} tagged routes</span></p>
      <p>${esc(topic.reading)}</p>
      <p class="analysis-tension">${esc(topic.tension)}</p>
      ${evidence(topic.evidence)}
    </section>`).join('');
  const people = (d.people || []).map((person) => `
    <section class="analysis-card person-card">
      <p class="analysis-title">${esc(person.name)}<span>${person.route_count} reviewed routes</span></p>
      <p class="person-role">${esc(person.role)}</p>
      <p>${esc(person.note)}</p>
      <details><summary>Show all ${person.route_count} routes</summary>
        <p class="person-routes">${(person.routes || []).map((r) =>
          `<a href="#/${esc(r.id)}">${esc(r.title)}</a>`).join('')}</p>
      </details>
    </section>`).join('');
  const screenplay = d.screenplay_notes || {};
  const movements = (screenplay.structure || []).map((part) => `
    <section class="analysis-card movement">
      <p class="analysis-title">${esc(part.heading)}</p>
      <p>${esc(part.purpose)}</p>${evidence(part.evidence)}
    </section>`).join('');
  const pairs = (rows, left, right) => `<dl class="analysis-pairs">${(rows || []).map((row) =>
    `<div><dt>${esc(row[left])}</dt><dd>${esc(row[right])}</dd></div>`).join('')}</dl>`;

  box.innerHTML = `
    <section class="analysis-lede">
      <p class="analysis-kicker">Corpus thesis</p>
      <p class="analysis-thesis">${esc(d.summary?.thesis || '')}</p>
      ${(d.summary?.paragraphs || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
    </section>
    <h3 class="analysis-heading">What is in the archive</h3>
    <ul class="corpus-shape">${shape}</ul>
    <p class="analysis-boundary">${esc(sv.boundary || '')}</p>
    <h3 id="repeated-topics" class="analysis-heading">Repeated topics</h3>
    <p class="analysis-intro">These are editorial families, not mutually exclusive categories. The number says how many unique routes carry a matching human-reviewed theme tag; the prose explains what changes when the theme recurs.</p>
    ${topics}
    <h3 id="people" class="analysis-heading">People across the corpus</h3>
    <p class="analysis-intro">Aliases are combined here—Critter with Critter Fleming, and Bobby Namba with Bobby Trivia. Counts are reviewed route appearances, not claims about who spoke an individual line.</p>
    ${people}
    <h3 id="screenplay-notes" class="analysis-heading">Screenplay notes</h3>
    <p class="analysis-status">${esc(screenplay.status || '')}</p>
    <p class="screenplay-logline">${esc(screenplay.logline || '')}</p>
    <p class="screenplay-question"><b>Central dramatic question</b>${esc(screenplay.central_question || '')}</p>
    ${movements}
    <h4 class="analysis-subheading">Recurring images</h4>
    ${pairs(screenplay.recurring_images, 'image', 'use')}
    <h4 class="analysis-subheading">Character functions</h4>
    ${pairs(screenplay.character_function, 'name', 'function')}
    <h4 class="analysis-subheading">Adaptation cautions</h4>
    <ol class="analysis-cautions">${(screenplay.cautions || []).map((row) => `<li>${esc(row)}</li>`).join('')}</ol>`;
}

/* The transcript archive previously treated a video as if its words were the
   whole work. This current-era view keeps three evidence layers separate:
   official metadata, derived picture/sound measurements, and editorial
   interpretation. No copied media, captions or source descriptions ship. */
async function renderRecentChannel() {
  const box = $('body');
  let d;
  try { d = await (await fetch(dataURL('data/recent-channel.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No current-channel analysis built yet.</p>'; return; }
  const sv = d.survey || {};
  $('fhint').textContent = `${sv.videos} official uploads · ${sv.hours} hours · `
    + `${sv.edit_measurements} picture measurements · ${sv.sound_measurements} sound measurements`;
  const date = (value) => value ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : '—';
  const metric = (video) => video.edit_metrics
    ? `<b>${video.edit_metrics.cuts_per_minute.toFixed(1)}</b><span>cuts/min</span>`
    : `<b>—</b><span>visual gap</span>`;
  const phaseCards = (d.phases || []).slice().reverse().map((phase) => `
    <section class="phase-card">
      <p class="phase-dates">${date(phase.from_date)} → ${date(phase.to_date)}</p>
      <h3>${esc(phase.label)}</h3>
      <p>${esc(phase.description)}</p>
      <p class="phase-metric"><b>${phase.videos}</b> videos · median <b>${phase.median_cuts_per_minute}</b> cuts/min
        · ${phase.measured_edits}/${phase.videos} picture-measured</p>
    </section>`).join('');
  const grammar = (d.editing_grammar || []).map((item) => `
    <section class="grammar-item"><h3>${esc(item.name)}</h3><p>${esc(item.reading)}</p></section>`).join('');
  const rows = (d.videos || []).map((video) => `
    <article class="recent-video" data-phase="${esc(video.phase)}" data-mode="${esc(video.mode)}">
      <div class="recent-rate">${metric(video)}</div>
      <div>
        <p class="recent-title"><a href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">${esc(video.title)}</a></p>
        <p class="recent-meta">${date(video.upload_date)} · ${hms(video.duration_seconds)} · ${esc(video.mode)}</p>
        <p class="recent-summary">${esc(video.summary)}</p>
        <details><summary>Editing and sound evidence</summary>
          <p><b>Picture:</b> ${esc(video.edit_read)}</p>
          <p><b>Sound:</b> ${esc(video.sound_read)}</p>
          <p class="recent-status">${esc(video.review_status)}</p>
        </details>
      </div>
    </article>`).join('');
  box.innerHTML = `
    <section class="analysis-lede recent-lede">
      <p class="analysis-kicker">Working name</p>
      <p class="analysis-thesis">${esc(d.thesis.name)}</p>
      <p>${esc(d.thesis.shorthand)}</p>
      <p>${esc(d.thesis.reading)}</p>
      <p><b>Talking:</b> ${esc(d.thesis.speaking)}</p>
      <p><b>Sound:</b> ${esc(d.thesis.sound)}</p>
    </section>
    <p class="analysis-boundary"><b>Scope:</b> ${esc(sv.boundary)} ${esc(sv.rights)}</p>
    <h3 class="analysis-heading">The editing grammar</h3>
    <div class="grammar-grid">${grammar}</div>
    <h3 class="analysis-heading">How the form changes</h3>
    <div class="phase-grid">${phaseCards}</div>
    <h3 class="analysis-heading">Every video in the era</h3>
    <p class="analysis-intro">The short summary is original metadata-based orientation. Picture and sound claims come only from the measured source stream. Open any row for its evidence; explicit gaps remain gaps.</p>
    <div class="recent-controls" role="group" aria-label="Filter current YouTube videos">
      <button type="button" data-recent-filter="all" aria-pressed="true">All ${sv.videos}</button>
      ${(d.phases || []).map((phase) => `<button type="button" data-recent-filter="${esc(phase.id)}" aria-pressed="false">${esc(phase.label)} ${phase.videos}</button>`).join('')}
    </div>
    <p id="recentCount" class="count">Showing ${Math.min(DEFAULT_VISIBLE, sv.videos)} of ${sv.videos} videos</p>
    <div id="recentRows" class="recent-rows">${rows}</div>
    <div class="list-reveal" id="recentReveal"><button type="button">Show all ${sv.videos} current videos</button></div>
    <p class="analysis-boundary"><b>Measurement boundary:</b> ${esc(sv.method)} Picture gaps: ${sv.explicit_edit_gaps}; sound gaps: ${sv.explicit_sound_gaps}.</p>`;
  let recentExpanded = false;
  const applyRecentFilter = (filter) => {
    let matching = 0, shown = 0;
    box.querySelectorAll('.recent-video').forEach((row) => {
      const matches = filter === 'all' || row.dataset.phase === filter;
      if (matches) matching++;
      const visible = matches && (filter !== 'all' || recentExpanded || shown < DEFAULT_VISIBLE);
      row.hidden = !visible;
      if (visible) shown++;
    });
    const limited = filter === 'all' && !recentExpanded && matching > DEFAULT_VISIBLE;
    $('recentCount').textContent = limited ? `Showing ${shown} of ${matching} videos` : `${shown} video${shown === 1 ? '' : 's'}`;
    $('recentReveal').hidden = !limited;
  };
  applyRecentFilter('all');
  box.querySelectorAll('[data-recent-filter]').forEach((button) => {
    button.onclick = () => {
      const filter = button.dataset.recentFilter;
      box.querySelectorAll('[data-recent-filter]').forEach((peer) =>
        peer.setAttribute('aria-pressed', String(peer === button)));
      recentExpanded = false;
      applyRecentFilter(filter);
    };
  });
  $('recentReveal').querySelector('button').onclick = () => {
    recentExpanded = true;
    applyRecentFilter('all');
  };
}

/* This is an episode-description index, not a presence or voice index. Its
   smaller denominator is intentionally named so a co-host's documented count
   cannot be mistaken for every recording in which they appeared or spoke. */
async function renderCastGraph() {
  const box = $('body');
  let d;
  try { d = await (await fetch(dataURL('data/cast-graph.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No cast graph built yet.</p>'; return; }
  const sv = d.survey || {};
  $('fhint').textContent = `${(d.people || []).length} people across ${sv.episodes} description-backed DVDASA routes`
    + ` · names in source descriptions, not an on-show or voice count`;
  const ep = (x) => `saga ${x.saga} · ep ${String(x.number).padStart(3, '0')}`;
  const rows = (d.people || []).map((p) => `
    <tr><td>${esc(p.name)}</td><td class="num">${p.episodes}</td>
        <td>${esc(ep(p.first))}</td><td>${esc(ep(p.last))}</td>
        <td class="num">${Math.round(p.span * 100)}%</td></tr>`).join('');
  const pairs = (d.pairs || []).slice(0, 14).map((e) => `
    <tr><td>${esc(e.a)} + ${esc(e.b)}</td><td class="num">${e.together}</td>
        <td class="num">${Math.round(e.a_with_b * 100)}%</td>
        <td class="num">${Math.round(e.b_with_a * 100)}%</td></tr>`).join('');
  box.innerHTML = `
    <h3 class="skind">Who source descriptions explicitly name</h3>
    <table class="ctab"><thead><tr><th>Name</th><th class="num">Description-backed routes</th>
      <th>First named</th><th>Last named</th><th class="num">Span</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <h3 class="skind">Who source descriptions name together</h3>
    <p class="same">Read asymmetrically: the last two columns are the share of
      each person's own description-backed routes that also name the other. This
      is context from source descriptions, not a speaker or presence inference.</p>
    <table class="ctab"><thead><tr><th>Pair</th><th class="num">Together</th>
      <th class="num">First with second</th><th class="num">Second with first</th></tr></thead>
      <tbody>${pairs}</tbody></table>
    <p class="same">${esc(sv.order || '')} ${esc(sv.provenance || '')}</p>`;
}

async function renderPresence() {
  const box = $('body');
  let data;
  try { data = await (await fetch(dataURL('data/presence.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No presence evidence is available yet.</p>'; return; }
  const survey = data.survey || {};
  const people = data.people || [];
  $('fhint').textContent = survey.coverage || '';
  const routesByPerson = new Map();
  (data.routes || []).forEach((route) => {
    [...(route.on_show || []), ...(route.editorial_context || [])].forEach((entry) => {
      const routes = routesByPerson.get(entry.name) || [];
      let match = routes.find((candidate) => candidate.id === route.id);
      if (!match) {
        match = { id: route.id, title: route.title, evidence: [] };
        routes.push(match);
      }
      match.evidence.push(entry);
      routesByPerson.set(entry.name, routes);
    });
  });
  const asa = people.find((person) => person.name === 'Asa Akira');
  const bourdain = people.find((person) => person.name === 'Anthony Bourdain');
  const badge = (label, detail, tone = 'context', count = '') => `<span class="evidence-badge ${tone}" tabindex="0"
    data-tooltip="${esc(detail)}" aria-label="${esc(`${label}${count === '' ? '' : `: ${count}`}. ${detail}`)}">${esc(label)}${count === '' ? '' : `<b>${count}</b>`}<span class="vh">. ${esc(detail)}</span></span>`;
  const personKind = (person) => {
    if (person.evidence_state === 'recurring-on-show-participant') {
      return badge('Recurring on-show', `Explicit opening-introduction evidence on ${person.explicitly_introduced_on_show} routes. This is not a claim about every appearance or every spoken line.`, 'onshow');
    }
    if (person.evidence_state === 'explicit-on-show-participant') {
      return badge('On show', `An explicit opening introduction identifies this person on ${person.explicitly_introduced_on_show} route${person.explicitly_introduced_on_show === 1 ? '' : 's'}.`, 'onshow');
    }
    return badge('Context only', 'Named by human-reviewed editorial context, not evidence that the person appeared or spoke on this recording.', 'context');
  };
  const routeEvidence = (entry) => {
    if (entry.state === 'explicitly-introduced-on-show') {
      return badge('On show', `${entry.provenance}. This establishes presence, not an individual voice attribution.`, 'onshow');
    }
    return badge('Context mention', `${entry.provenance}: ${entry.context}`, 'context');
  };
  const personCard = (person) => {
    const personRoutes = routesByPerson.get(person.name) || [];
    const routes = personRoutes.map((route) => `<li>
      <a href="#/${esc(route.id)}">${esc(route.title)}</a>
      <span class="route-evidence">${(route.evidence || []).map(routeEvidence).join('')}</span>
    </li>`).join('');
    const onShowDetail = person.explicitly_introduced_on_show
      ? `${person.explicitly_introduced_on_show} route${person.explicitly_introduced_on_show === 1 ? '' : 's'} explicitly introduce ${person.name}.`
      : 'No route in this archive currently has an explicit opening introduction for this person.';
    return `<article class="presence-person">
      <div class="presence-person-head"><h4>${esc(person.name)}</h4>${personKind(person)}</div>
      <div class="presence-counts">
        ${badge('On show', onShowDetail, 'onshow', person.explicitly_introduced_on_show)}
        ${badge('Editorial context', `${person.editorial_context_routes} reviewed route${person.editorial_context_routes === 1 ? '' : 's'} name this person. A context reference does not establish presence.`, 'context', person.editorial_context_routes)}
        ${badge('Voice match', 'No validated source-audio voice match is published for this person.', 'voice', person.voice_attributed)}
      </div>
      <details><summary>Inspect ${personRoutes.length} supporting route${personRoutes.length === 1 ? '' : 's'}</summary>
        <ul class="presence-routes">${routes}</ul>
      </details>
    </article>`;
  };
  const featured = people.filter((person) => person.explicitly_introduced_on_show > 0 || person.name === 'Anthony Bourdain')
    .sort((a, b) => b.explicitly_introduced_on_show - a.explicitly_introduced_on_show || a.name.localeCompare(b.name));
  box.innerHTML = `
    <section class="presence-lede">
      <p class="analysis-kicker">Evidence, not a guess</p>
      <h3 class="skind">Being named is different from being on the show</h3>
      <p>${esc(survey.distinction || '')}</p>
      ${asa ? `<p><b>Asa Akira:</b> ${asa.explicitly_introduced_on_show} routes explicitly introduce her as on-show; ${asa.voice_attributed} have a validated voice attribution. The first number is a defensible floor, not a claim that she spoke in only those recordings.</p>` : ''}
    </section>
    <section class="presence-key" aria-labelledby="presenceKeyTitle">
      <h3 id="presenceKeyTitle" class="analysis-heading">Hover or focus a label to see why it is there</h3>
      <div class="presence-key-grid">
        <p>${badge('Recurring on-show', 'Multiple explicit opening introductions. This is the archive’s strongest current participant category; it does not assign individual lines.', 'onshow')}<span>Repeated explicit openings identify a regular participant.</span></p>
        <p>${badge('On show', 'An explicit opening introduction or publisher title identifies a participant on this specific recording.', 'onshow')}<span>Evidence for this episode, not a recurring-role assumption.</span></p>
        <p>${badge('Context mention', 'A reviewed summary, chapter, or people list refers to someone. This does not establish presence or speech.', 'context')}<span>A person can matter to the conversation without being in the room.</span></p>
        <p>${badge('Voice match', 'Only a validated comparison against source audio can assign an individual voice. None are published here yet.', 'voice')}<span>No name is inferred from text alone.</span></p>
      </div>
    </section>
    ${bourdain ? `<section class="presence-example">
      <p class="analysis-kicker">The Bourdain check</p>
      <h3 class="skind">A reference is not a guest credit</h3>
      <p><b>Anthony Bourdain</b> has ${bourdain.editorial_context_routes} reviewed route references and ${bourdain.explicitly_introduced_on_show} explicit on-show introductions. His route chips therefore stay <span class="inline-badge">Context mention</span> unless a route provides actual presence evidence.</p>
      <details><summary>Inspect Bourdain’s route context</summary><ul class="presence-routes">${(routesByPerson.get(bourdain.name) || []).map((route) => `<li><a href="#/${esc(route.id)}">${esc(route.title)}</a><span class="route-evidence">${route.evidence.map(routeEvidence).join('')}</span></li>`).join('')}</ul></details>
    </section>` : ''}
    <section class="presence-browser" aria-labelledby="presenceBrowseTitle">
      <div><p class="analysis-kicker">Person evidence</p><h3 id="presenceBrowseTitle" class="skind">Find a person, then inspect the routes</h3></div>
      <label class="vh" for="presencePeopleSearch">Find a person in reviewed editorial</label>
      <input id="presencePeopleSearch" type="search" placeholder="Search people, e.g. Bourdain" autocomplete="off">
      <p id="presencePeopleHint" class="same">Showing regular participants plus the Bourdain context example. Search reveals any named person.</p>
      <div id="presencePeople" class="presence-people">${featured.map(personCard).join('')}</div>
    </section>`;
  const search = $('presencePeopleSearch');
  const results = $('presencePeople');
  const hint = $('presencePeopleHint');
  const renderPeople = () => {
    const query = search.value.trim().toLowerCase();
    const matching = query ? people.filter((person) => person.name.toLowerCase().includes(query)) : featured;
    hint.textContent = query
      ? `${matching.length} person${matching.length === 1 ? '' : 's'} match “${search.value.trim()}”.`
      : 'Showing regular participants plus the Bourdain context example. Search reveals any named person.';
    results.innerHTML = matching.length ? matching.map(personCard).join('') : '<p class="empty">No reviewed person name matches that search.</p>';
  };
  search.addEventListener('input', renderPeople);
}

/* Works this archive links but will not transcribe. Stated plainly, because an
   archive that silently omits the film work reads as though the film work does
   not exist. */
async function renderExternal() {
  let d;
  try { d = await (await fetch(dataURL('data/external.json'))).json(); }
  catch { return ''; }
  const sv = d.survey || {};
  return `<h3 class="skind">Indexed, not transcribed</h3>
    <p class="same">${esc(sv.policy || '')}</p>
    ${(d.works || []).map((w) => `
      <section class="finding">
        <p class="fhead"><a href="${esc(w.url)}" target="_blank"
           rel="noopener noreferrer">${esc(w.title || w.url)}</a></p>
        <p class="fres">${esc(w.host)} · ${w.minutes} min · ${esc(w.policy)}</p>
        <p class="fbody">${esc(w.why_here)} ${esc(w.reason)}</p>
      </section>`).join('')}`;
}

/* Method: what was measured, what it showed, and what was withdrawn. An archive
   that publishes only its successes is asking to be trusted; the corrections are
   why the rest is worth believing. */
async function renderMethod() {
  const box = $('body');
  let d;
  try { d = await (await fetch(dataURL('data/method.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No method page built yet.</p>'; return; }
  const c = d.counts || {};
  $('fhint').textContent = `${c.items} transcripts · ${c.hours} hours · `
    + `${(c.words || 0).toLocaleString()} words · ${c.episodes_with_cast} episodes with a named cast`;
  box.innerHTML = (d.findings || []).map((f) => `
    <section class="finding">
      <p class="fhead">${esc(f.heading)}</p>
      <p class="fres">${esc(f.result)}</p>
      <p class="fbody">${esc(f.body)}</p>
    </section>`).join('');
  box.innerHTML += await renderExternal();
}

/* Every real reader route gets a compact documentation card. The related links
   are corpus-wide lexical leads, deliberately separate from verified stories. */
async function renderCorpusMap() {
  const box = $('body');
  let data;
  try { data = await (await fetch(dataURL('data/corpus-map.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No corpus map built yet.</p>'; return; }
  const sv = data.survey || {};
  const byId = new Map((data.documents || []).map((d) => [d.id, d]));
  const docs = data.documents || [];
  $('fhint').textContent = `${sv.reader_routes || docs.length} reader routes documented · every full transcript scanned`;
  const card = (d) => `<section class="subj corpusdoc">
    <p class="subjname"><a href="#/${esc(d.id)}">${esc(d.title)}</a>
      <span class="times">${hms(d.duration)} · ${d.words.toLocaleString()} words</span></p>
    <p class="same">${esc(d.kind)} · ${esc(d.group)} · ${d.segments.toLocaleString()} timestamped passages</p>
    <p class="subjeps"><span class="label">distinctive terms</span>${d.anchors.map(esc).join(' · ') || '—'}</p>
    ${d.related.length ? `<p class="subjeps"><span class="label">related full transcripts</span>${d.related.map((r) => {
      const peer = byId.get(r.id); return peer ? `<a href="#/${esc(r.id)}">${esc(peer.title)}</a><span class="dim">${r.terms.map(esc).join(', ')}</span>` : '';
    }).join('')}</p>` : '<p class="same">No multi-term corpus lead met the threshold.</p>'}
  </section>`;
  box.innerHTML = `<p class="same">${esc(sv.boundary || '')}</p><p class="same">${esc(sv.method || '')}</p>`
    + `<input id="corpusq" class="corpusq" type="search" placeholder="Filter all documented transcripts…" autocomplete="off">`
    + `<div id="corpusrows">${docs.map(card).join('')}</div>`;
  $('corpusq').oninput = (event) => {
    const query = event.target.value.trim().toLowerCase();
    const shown = !query ? docs : docs.filter((d) => [d.title, d.group, ...d.anchors].join(' ').toLowerCase().includes(query));
    $('corpusrows').innerHTML = shown.map(card).join('') || '<p class="empty">No documented transcript matches.</p>';
  };
}

/* Arcs: where one telling runs across several episodes. */
async function renderArcs() {
  const box = $('body');
  let d;
  try { d = await (await fetch(dataURL('data/arcs.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No arc index built yet.</p>'; return; }
  const sv = d.survey || {};
  $('fhint').textContent = `${(d.arcs || []).length} arcs the show titles as`
    + ` multi-part · ${sv.continuations_found ?? 0} unmarked continuations found`
    + ` across ${sv.consecutive_pairs_checked ?? 0} consecutive episode pairs`;
  box.innerHTML = (d.arcs || []).map((a) => `
    <section class="retell">
      <p class="shared">${esc(a.name)}
        <span class="times">${a.parts.length} parts</span></p>
      <p class="subjeps">${a.parts.map((p) =>
        `<a href="#/${esc(p.id)}">${esc(p.title)}</a>`).join('')}</p>
    </section>`).join('')
    + `<p class="same">Measured across ${sv.consecutive_pairs_checked ?? 0}
        consecutive episode pairs, ${sv.continuations_found ?? 0} story runs into the
        next episode without the title saying so. The show closes its subjects
        within an episode; the continuity it has, it names.</p>`;
}


/* Mark the differing value inside the quote. The divergence was already on the
   page with both quotes, and a reader still had to hunt for the word that
   differs — which is the whole claim. Escaped FIRST, then the escaped needle is
   wrapped, so nothing from the data can become markup. */
function markValue(quote, value) {
  const q = esc(quote || '');
  const v = esc(String(value || ''));
  if (!v) return q;
  const re = new RegExp('(\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b)');
  return q.replace(re, '<mark class="dvmark">$1</mark>');
}

/* The curated story shelf.

   Distinct from "Told more than once" in one way that matters to a reader: a
   person read every telling here before it was listed. The automatic index
   proposes candidates and cannot tell a story from a conversation about a film,
   so this shelf says plainly that it was reviewed, and shows how many
   candidates were rejected by hand — a curation claim with no rejection count
   is just an assertion. */
async function renderStories() {
  const box = $('body');
  let data;
  try { data = await (await fetch(dataURL('data/stories.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No story shelf built yet.</p>'; return; }
  const stories = data.stories || [];
  const sv = data.survey || {};
  const tellings = stories.reduce((n, s) => n + s.tellings.length, 0);
  $('fhint').textContent = `${stories.length} stories · ${tellings} tellings, each read`
    + ` and verified` + (sv.hand_rejected
      ? ` · ${sv.hand_rejected} candidate${sv.hand_rejected === 1 ? '' : 's'} rejected by hand` : '');
  box.innerHTML = stories.map((s) => {
    const side = (x) => `
      <div class="tell">
        <p class="tellhead">${esc(x.when)} · <a href="#/${esc(x.id)}">${esc(x.title)}</a>
          <span class="dim">${hms(x.t)}</span>${x.format && x.format !== 'studio'
            ? `<span class="badge">${esc(x.format)}</span>` : ''}</p>
        <p class="tellq">${esc(x.quote)}</p>
      </div>`;
    // A comparison that crosses recording formats is still valid, but the reader
    // has to know: a story told to a live audience or during a twelve-hour
    // marathon differs from one told across a studio table, so some of what
    // looks like drift may be the room rather than the man. Naming the confound
    // is the difference between showing a change and attributing one.
    // A cross-show story has no known order: episode numbers sequence his own
    // show, nothing sequences a Stern appearance against a Rogan one, and the
    // recordings carry no dates. Saying so is the difference between comparing
    // versions and inventing a chronology.
    const orderNote = s.unordered
      ? `<p class="fmt">Told on different shows. The archive has no air dates, so
           these are not in any known order — they are versions, not a sequence.</p>`
      : '';
    const fmtNote = s.mixed_format
      ? `<p class="fmt">Tellings cross formats — ${(s.formats || []).map(esc).join(' and ')}.
           Some of the difference may be the setting rather than the telling.</p>`
      : '';
    return `<section class="retell">
      <p class="shared">${esc(s.title)}
        <span class="times">told in ${s.times_told} episodes</span></p>
      <p class="swhy">${esc(s.why)}</p>
      ${orderNote}${s.unordered ? '' : fmtNote}
      ${(s.divergences || []).map((dv) => `
        <div class="diverge">
          <p class="dvwhat">${esc(dv.what)}</p>
          <div class="dvcols">${dv.sides.map((sd) => `
            <div class="dvcol">
              <p class="dvwho">${esc(sd.format)}</p>
              <p class="dvbig">${esc(sd.value)}</p>
              <p class="dvq">${markValue(sd.quote, sd.value)}</p>
            </div>`).join('')}</div>
        </div>`).join('')}
      ${(s.divergences || []).length ? '' :
        `<p class="same">Told ${s.times_told} times; no difference found that can be
          shown side by side. Materially the same account each time.</p>`}
      <div class="tells">${s.tellings.map(side).join('')}</div>
    </section>`;
  }).join('') || '<p class="empty">No stories on the shelf yet.</p>';

  // Withdrawn entries are NAMED, not deleted. A story that silently disappears
  // leaves a reader unable to tell a retraction from something that was never
  // here, and the only claim this shelf makes is that a person stands behind
  // each entry -- which has to include the ones a person took back.
  const gone = data.dropped || [];
  if (gone.length) {
    box.innerHTML += `<section class="withdrawn">
      <h3>Withdrawn</h3>
      ${gone.map((g) => `<p class="wdrow"><b>${esc(g.title)}</b> — ${esc(g.why)}</p>`).join('')}
    </section>`;
  }
}

/* Recurring subjects: people, places and themes repeated across the complete
   421-route reader corpus. The three-route threshold makes this a recurrence
   index rather than a list of every one-off mention. */
async function renderSubjects() {
  const box = $('body');
  let data;
  try { data = await (await fetch(dataURL('data/subjects.json'))).json(); }
  catch { box.innerHTML = '<p class="empty">No subject index built yet.</p>'; return; }
  const sv = data.survey || {};
  const base = sv.items_with_entities || 0;
  const archiveBase = sv.items_in_archive || base;
  const kinds = data.subjects || {};
  const total = Object.values(kinds).reduce((n, r) => n + r.length, 0);
  $('fhint').textContent = `${total} subjects appearing in ${sv.min_episodes || 3}`
    + ` or more routes · ${base} of ${archiveBase} reader routes indexed`;
  const section = (kind) => {
    const rows = kinds[kind] || [];
    if (!rows.length) return '';
    return `<h3 class="skind">${esc(kind)}</h3>` + rows.map((r) => `
      <section class="subj">
        <p class="subjname">${esc(r.name)}
          <span class="times">${r.count} reviewed routes</span></p>
        <p class="subjeps">${r.episodes.map((e) =>
          `<a href="#/${esc(e.id)}">${esc(e.title || e.id)}</a>`).join('')}</p>
      </section>`).join('');
  };
  const signals = (data.signals || []).map((signal) => `<section class="subj signal">
    <p class="subjname">${esc(signal.name)}
      <span class="times">${signal.count} of ${signal.denominator} DVDASA routes contain a reviewed trivia passage</span></p>
    <p class="same">${esc(signal.method)} All ${signal.reviewed} DVDASA routes have an explicit status; ${signal.format_or_absence_count} are reviewed format exceptions, captures without a formal segment, or an available-source truncation.</p>
    <p class="subjeps">${(signal.routes || []).map((episode) =>
      `<a href="#/${esc(episode.id)}">${esc(episode.title || episode.id)}</a>`).join('')}</p>
  </section>`).join('');
  box.innerHTML = (signals ? `<h3 class="skind">Transcript signals</h3>${signals}` : '')
    + ['people', 'places', 'themes'].map(section).join('')
    || '<p class="empty">No recurring subjects yet.</p>';
}

/* Scene guide for a withheld film: what each stretch covers, written here, with
   a link that opens the film at that second. Interpretation, and labelled so. */
async function renderScenes(itemId) {
  const box = $('editorial');
  let d;
  try { d = await (await fetch(dataURL('data/scenes.json'))).json(); }
  catch { return; }
  if (!d || d.item !== itemId) return;
  const sv = d.survey || {};
  box.innerHTML = `<p class="edlabel">Scene guide — written by this archive, not
      a record of what was said. The film's dialogue is not published.</p>
    <p class="same">${esc(sv.why || '')}</p>
    <table class="ctab"><thead><tr><th>Time</th><th>Scene</th><th>What happens</th></tr></thead>
    <tbody>${(d.scenes || []).map((s) => `
      <tr><td class="num"><a href="${esc(s.watch)}" target="_blank"
            rel="noopener noreferrer">${hms(s.t)}</a></td>
          <td>${esc(s.title)}</td>
          <td>${esc(s.description)}</td></tr>`).join('')}</tbody></table>`;
  box.hidden = false;
}

function row(d, s, i, terms) {
  // A withheld item ships timestamps and no words. Render the timing only, so
  // the shape of the film is visible without its dialogue.
  if (d.text_withheld) {
    return `<p class="line"><span class="ts">${hms(s.t)}</span>
      <span class="withheldline">—</span></p>`;
  }
  {
    if (s.scene) {
      const hit = terms.length && terms.some((t) => s.x.toLowerCase().includes(t));
      if (terms.length && !hit) return '';
      return `<p class="line scene-note${hit ? ' hit' : ''}" id="l${i}">` +
        `<span class="ts">${hms(s.t)}</span><span>${highlight(s.x, terms)}</span></p>`;
    }
    const hit = terms.length && terms.some((t) => s.x.toLowerCase().includes(t));
    if (terms.length && !hit) return '';
    const ts = d.kind === 'youtube'
      ? `<a class="ts" href="https://www.youtube.com/watch?v=${d.id}&t=${Math.floor(s.t)}s"
            target="_blank" rel="noopener noreferrer">${hms(s.t)}</a>`
      : `<span class="ts">${hms(s.t)}</span>`;
    return `<p class="line${hit ? ' hit' : ''}" id="l${i}">${ts}<span>${highlight(s.x, terms)}</span></p>`;
  }
}

/* Editorial layer, rendered GENERICALLY. Nothing about Codex's prose is
   hard-coded here: known field shapes get a nice presentation, anything else is
   rendered by its own key, so a new field needs no change to this file. It is
   boxed and labelled because the contract requires editorial writing to stay
   visibly separate from the faithful transcript -- a reader must never mistake
   a summary for something that was said. */
function renderCast(record) {
  // People are human-reviewed at the route level. That is useful orientation,
  // but it is not a voiceprint and must never become a guessed line label.
  const el = $('castline');
  if (!el) return;
  const people = record.editorial?.people || [];
  if (!people || !people.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.innerHTML = `<span class="castlbl">People in reviewed context</span> ${people.map(esc).join(' · ')}
    <span class="castsrc"><b>Not a cast list:</b> individual lines are left unnamed unless directly verified.</span>`;
  el.hidden = false;
}

/* Every reader route gets the same quiet orientation layer. The content is
   route-specific: it never upgrades a reviewed mention into presence, and it
   avoids hiding recurring subjects behind a global dashboard or interaction. */
async function renderEpisodeThreads(id) {
  const box = $('episodeThreads');
  box.hidden = true;
  box.innerHTML = '';
  let route;
  try {
    route = await (await fetch(dataURL(`data/episode-subjects/${encodeURIComponent(id)}.json`))).json();
  } catch { return; }
  if (!route?.id) return;
  const status = (label, detail, tone = 'context') => `<span class="thread-status ${tone}" tabindex="0"
    data-tooltip="${esc(detail)}" aria-label="${esc(`${label}. ${detail}`)}">${esc(label)}</span>`;
  const onShow = route.on_show || [];
  const onShowNames = new Set(onShow.map((entry) => entry.name));
  const onShowRows = onShow.length ? `<ul class="thread-onshow">${onShow.map((entry) => `<li>
    <p><b>${esc(entry.name)}</b> ${status(entry.recurring_status === 'recurring-on-show-participant' ? 'regular participant' : 'introduced here', `${entry.source}. ${entry.reading}`, 'onshow')}</p>
    <span>${esc(entry.reading)}</span>
  </li>`).join('')}</ul>`
    : `<p class="thread-absence">No participant is explicitly introduced in the opening transcript. That is not evidence that nobody was on the recording.</p>`;
  const groups = [['people', 'People discussed here'], ['places', 'Places that recur'], ['themes', 'Recurring themes']]
    .map(([kind, title]) => {
      const items = (route.items || []).filter((item) => item.kind === kind
        && !(kind === 'people' && onShowNames.has(item.name)));
      if (!items.length) return '';
      return `<section class="thread-group"><h4>${title}</h4><ul>${items.map((item) => {
        const isPerson = item.kind === 'people';
        const label = isPerson ? 'discussed here, not credited as on-show' : `reviewed recurring ${item.kind.slice(0, -1)}`;
        const detail = `${item.source}. ${item.context}`;
        return `<li class="thread-item">
          <p><b>${esc(item.name)}</b> <span class="thread-count">${item.recurring_routes} reviewed routes</span>
            ${status(label, detail, isPerson ? 'context' : 'subject')}</p>
          <p class="thread-reading">${esc(item.reading)}</p>
          <p class="thread-context">${esc(item.context)}</p>
        </li>`;
      }).join('')}</ul></section>`;
    }).join('');
  box.innerHTML = `<p class="thread-kicker">In this recording</p>
    <h3>On show, and what carries forward</h3>
    <p class="thread-intro">Explicit introductions and recurring editorial context are shown separately. Hover or focus a status to see the source.</p>
    <section class="thread-show"><h4>Explicitly introduced on this recording</h4>${onShowRows}</section>
    <div class="thread-groups">${groups || '<p class="thread-absence">This recording has no subject that recurs in three or more reviewed routes.</p>'}</div>`;
  box.hidden = false;
}

function renderEditorial(ed, kind, vid) {
  const box = $('editorial');
  if (!ed) { box.hidden = true; box.innerHTML = ''; return; }
  const label = (k) => k.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const chips = (a) => `<p class="chips">${a.map((x) =>
    `<span class="chip">${esc(typeof x === 'string' ? x : x.name || JSON.stringify(x))}</span>`).join('')}</p>`;
  const parts = [];
  const INTERNAL_FIELDS = new Set([
    'reviewed_on', 'description', 'description_source', 'people', 'quality',
    'source_notes', 'speaker_policy', 'publication_restrictions',
  ]);

  // Content warnings render FIRST and visually distinct. This archive is public
  // and contains material a reader may reasonably want flagged before reading;
  // burying that in an alphabetical chip row alongside "themes" would be a
  // choice, not an oversight.
  // Codex has been putting sensitive subject matter in `themes` rather than a
  // dedicated field, so a reader would meet it as an ordinary chip row below
  // the summary. Promote the themes that are plainly warnings, so the placement
  // matches the weight, without asking for a dozen episodes to be re-authored.
  const SENSITIVE = /\b(assault|rape|abuse|suicide|self-harm|slur|derogatory|racis|misogyn|homophob|transphob|paedo|pedo|minors?|child(ren)?\b|overdose|addiction|violence|death|grief|incest|traffick)/i;
  const flagged = (ed.themes || []).filter((t) => typeof t === 'string' && SENSITIVE.test(t));
  const cw = ed.content_warnings || ed.content_warning
    || (flagged.length ? flagged : null);
  if (cw && (Array.isArray(cw) ? cw.length : String(cw).trim())) {
    const list = Array.isArray(cw) ? cw : [cw];
    parts.push(`<p class="cw"><b>Content note</b> — ${list.map((x) =>
      esc(typeof x === 'string' ? x : x.note || x.label || '')).join('; ')}</p>`);
  }

  for (const [k, v] of Object.entries(ed)) {
    if (k === 'content_warnings' || k === 'content_warning' || INTERNAL_FIELDS.has(k)) continue;
    if (v == null || (Array.isArray(v) && !v.length)) continue;
    if (k === 'chapters' && Array.isArray(v)) {
      parts.push(`<h4>${label(k)}</h4><ol class="chapters">` + v.map((c) => {
        const t = Number(c.t ?? c.start ?? 0);
        const jump = kind === 'youtube'
          ? `<a href="https://www.youtube.com/watch?v=${vid}&t=${Math.floor(t)}s" target="_blank" rel="noopener noreferrer">${hms(t)}</a>`
          : `<span>${hms(t)}</span>`;
        return `<li>${jump} ${esc(c.title || c.label || '')}</li>`;
      }).join('') + '</ol>');
    } else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      parts.push(`<h4>${label(k)}</h4>${chips(v)}`);
    } else if (Array.isArray(v)) {
      parts.push(`<h4>${label(k)}</h4><ul>` + v.map((x) =>
        `<li>${esc(x.label || x.title || x.name || '')}${x.note ? ' — ' + esc(x.note) : ''}</li>`).join('') + '</ul>');
    } else if (v && typeof v === 'object') {
      // Plain objects had NO branch here, so they rendered nothing at all --
      // silently. Codex writes `quality` as an object on 57 episodes, holding
      // exactly the caveats a reader deserves ("strong-searchable-draft-needs-
      // correction-bake", "six-person episode with rapid overlap"), plus
      // `sensitivity` and `speaker_policy` on others. All of it was published
      // and invisible. Rendered as labelled rows, in the editorial register.
      const rows = Object.entries(v)
        .filter(([, x]) => x != null && String(x).trim())
        .map(([kk, x]) => `<li><b>${esc(label(kk))}</b> — ${esc(
          Array.isArray(x) ? x.join('; ') : String(x))}</li>`).join('');
      if (rows) parts.push(`<h4>${label(k)}</h4><ul class="kv">${rows}</ul>`);
    } else if (typeof v === 'string') {
      parts.push(k === 'summary' ? `<p>${esc(v)}</p>` : `<h4>${label(k)}</h4><p>${esc(v)}</p>`);
    }
  }
  if (!parts.length) { box.hidden = true; return; }
  box.innerHTML = `<p class="edlabel">What happens — human-written context, separate from the transcript</p>${parts.join('')}`;
  box.hidden = false;
}

// Cleaned script files are optional and loaded only for the recording being
// read. A missing file is normal; Script view falls back to source segments.
async function ensureScript(d) {
  if (d._scriptLines !== undefined) return;
  d._scriptLines = null;
  try {
    const r = await fetch(dataURL(`data/${d.id}.script.json`));
    if (!r.ok) return;
    const j = await r.json();
    if (j && Array.isArray(j.lines)) d._scriptLines = j.lines;
  } catch { /* Script view keeps the source transcript available. */ }
}

async function openItem(id) {
  $('browse').hidden = true;
  $('reader').hidden = false;
  window.scrollTo(0, 0);
  $('body').innerHTML = '<p class="empty">Loading transcript…</p>';
  let d;
  try { d = await loadItem(id); }
  catch { $('body').innerHTML = '<p class="empty">That transcript could not be loaded.</p>'; return; }

  const meta = state.items.find((i) => i.id === id);
  $('rtitle').textContent = d.title;
  $('rmeta').textContent = [d.group, meta && hms(meta.d), meta && `${meta.w.toLocaleString()} words`]
    .filter(Boolean).join(' · ');
  // Name the source plainly. Archive filenames, cleaning thresholds and decoder
  // counts remain in the record, but they are implementation evidence rather
  // than useful orientation for a reader deciding whether to open an episode.
  const link = $('rlink');
  const srcEl = $('srcline');
  link.hidden = d.kind !== 'youtube';
  if (d.kind === 'youtube') link.href = `https://www.youtube.com/watch?v=${d.id}`;
  const wh = d.text_withheld;
  if (wh) renderScenes(d.id);
  if (wh) {
    // The film is findable and not readable. Say why, on the page, rather than
    // letting an item with no words look like a failed transcription.
    link.href = wh.source_url || '#';
    link.hidden = !wh.source_url;
    link.textContent = 'Watch at the source ↗';
  }
  if (srcEl) {
    const prov = d.provenance || {};
    const where = wh ? `${esc(wh.uploader || 'Vimeo')} — Vimeo`
      : d.kind === 'film' ? 'Owner-supplied local film copy'
      : d.kind === 'youtube' ? 'YouTube'
      : prov.archive || 'DVDASA archive';
    const whNote = wh
      ? ` · <b>transcript not published</b> — ${esc(wh.reason)} ${esc(wh.note || '')}`
      : '';
    srcEl.innerHTML = `<span class="castlbl">Source</span> ${esc(where)}${whNote}`;
    srcEl.hidden = false;
  }

  // One status in ordinary language replaces “uncorrected,” Whisper/ASR jargon,
  // and the old wall of cleaning statistics. Human review applies to the
  // summary and names; the transcript origin remains visible and honest.
  const browse = state.browse[d.id] || {};
  const bits = [];
  bits.push(`<b>Transcript</b> ${esc(browse.transcript_label || 'Transcript available')}.`);
  bits.push('The summary and people list were checked by a person; exact transcript wording can still be wrong.');
  if (d.kind === 'youtube') bits.push('A timestamp opens the original video at that moment.');
  else bits.push('The original audio is not hosted here, so verify exact quotes against the source recording.');
  $('prov').innerHTML = bits.join(' ');

  renderCast(d);
  await renderEpisodeThreads(d.id);
  renderEditorial(d.editorial, d.kind, d.id);
  $('fq').value = state.q || '';
  if (state.mode === 'script') await ensureScript(d);
  renderTranscript(d, $('fq').value);
  $('fq').oninput = () => renderTranscript(d, $('fq').value);
  $('modes').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
    b.onclick = async () => {
      state.mode = b.dataset.mode;
      localStorage.setItem('choeMode', state.mode);
      $('modes').querySelectorAll('button').forEach((x) =>
        x.setAttribute('aria-pressed', String(x.dataset.mode === state.mode)));
      if (state.mode === 'script') await ensureScript(d);
      renderTranscript(d, $('fq').value);
    };
  });
}

/* The Ranch series as its own page. Four solo recordings scattered across two
   archives read as unrelated episodes in a 230-item list; together they are the
   spine of the corpus. Themes come from Codex's editorial records, so this is a
   view over real data rather than authored prose. */
async function renderHub() {
  $('browse').hidden = true; $('reader').hidden = true;
  const hub = $('hub'); hub.hidden = false; window.scrollTo(0, 0);
  const ids = state.cat.ranch || [];
  hub.innerHTML = `<button class="back" id="hback" type="button">← All recordings</button>
    <h2>The Ranch — solo series</h2>
    <p class="lede">Four recordings made alone, away from the studio and the
    regular cast. They are the only sustained single-voice material in the
    archive, which is also why they are the reference used to test speaker
    identification. Part IV carries no “Ranch” in its title and sits in the
    archive as an untitled chapter; the recording identifies itself.</p>
    <p class="empty">Loading…</p>`;
  $('hback').onclick = () => { location.hash = ''; };

  const rows = await Promise.all(ids.map(async (id) => {
    const meta = state.items.find((x) => x.id === id) || {};
    let ed = null;
    try { ed = (await loadItem(id)).editorial; } catch { /* not fatal */ }
    return { id, meta, ed };
  }));
  rows.sort((a, b) => (a.meta.t || '').localeCompare(b.meta.t || ''));

  hub.querySelector('.empty').outerHTML = `<table>
    <thead><tr><th>Recording</th><th>Length</th><th>Words</th><th>Themes</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><a class="ep" href="#/${esc(r.id)}">${esc(r.meta.t || r.id)}</a></td>
      <td class="num">${r.meta.d ? hms(r.meta.d) : '—'}</td>
      <td class="num">${r.meta.w ? r.meta.w.toLocaleString() : '—'}</td>
      <td class="themes">${r.ed && r.ed.themes ? esc(r.ed.themes.slice(0, 6).join(', ')) : '—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

function route() {
  const raw = location.hash.replace(/^#/, '');
  $('episodeThreads').hidden = true;
  $('episodeThreads').innerHTML = '';
  const corpusRoute = ANALYSIS_GROUPS.some(([, rows]) => rows.some(([key]) => key === raw));
  $('reader').classList.toggle('analysis-view', corpusRoute);
  $('main').classList.toggle('wide', corpusRoute || raw === '');
  renderPrimary(raw === 'recent' ? 'recent' : raw === 'subjects' ? 'subjects' : corpusRoute ? 'corpus' : 'recordings');
  if (raw === 'ranch') return renderHub();
  if (raw === 'overview') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Corpus overview';
    $('rmeta').textContent = 'What the complete archive adds up to: a corpus thesis, repeated topics with explicit route counts, normalized people and relationships, and screenplay development notes grounded in supporting recordings.';
    $('prov').textContent = 'Editorial synthesis. Route counts are generated from the completed 421-route review layer; interpretations and screenplay notes are labeled analysis, not transcript or settled biography.';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('overview');
    return renderOverview();
  }
  if (raw === 'recent') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Current YouTube era — audiovisual analysis';
    $('rmeta').textContent = 'Every official-channel upload in the continuous November 2022–August 2026 run, read as edited video: picture rhythm, sound density, visible art process, and the move from confessional rant collage toward focused studio essays.';
    $('prov').textContent = 'Official metadata plus derived scene-change, silence and loudness measurements. Full video, audio, captions, transcripts, source descriptions and contact sheets are not published.';
    $('rlink').href = 'https://www.youtube.com/@davidchoe/videos';
    $('rlink').textContent = 'Open the official channel ↗'; $('rlink').hidden = false;
    $('modes').hidden = true; $('fq').hidden = true; $('editorial').innerHTML = '';
    renderTabs('recent');
    return renderRecentChannel();
  }
  if (raw === 'retold') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    // IDs verified against index.html. An earlier version targeted title/meta/
    // src/yt, none of which exist, so setting a property on null threw and the
    // view rendered nothing while the page chrome still appeared -- a blank
    // section that looked like "no data" rather than a crash.
    $('rtitle').textContent = 'Similar passages — DVDASA';
    // The ordering basis is stated because "first told" and "last told" would
    // otherwise imply calendar dates the archive does not have. The recordings
    // carry no air dates in any source reachable here -- not in the files, the
    // titles, or a podcast feed, the show having been delisted years ago. Saga
    // and episode number is a true sequence, so drift has a direction; it just
    // has no years attached, and saying so is cheaper than a reader assuming.
    $('rmeta').textContent = 'Lexically related passages in more than one episode, '
      + 'ordered by the show sequence. These are discovery leads, not verified '
      + 'claims that the passages are the same story. '
      + 'Ordered by saga and episode number \u2014 the sequence the show released '
      + 'in. The recordings carry no air dates, so the order is real but the '
      + 'years are not known. DVDASA only \u2014 interviews and clips elsewhere '
      + 'are not searched, so a story he also told on another podcast will not '
      + 'appear here.';
    $('prov').textContent = '';
    $('rlink').hidden = true;
    $('modes').hidden = true;
    $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('retold');
    return renderRetellings();
  }
  if (raw === 'corpus') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Corpus map';
    $('rmeta').textContent = 'A documentation card for every transcript reader route, built from its complete text. Related links are leads with shared distinctive terms across the full corpus, not claims that two recordings tell the same story.';
    $('prov').textContent = ''; $('rlink').hidden = true; $('modes').hidden = true;
    $('fq').hidden = true; $('editorial').innerHTML = '';
    renderTabs('corpus');
    return renderCorpusMap();
  }
  if (raw === 'cast') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Cast';
    $('rmeta').textContent = 'Who appears with whom across the whole run — who '
      + 'arrives late, who stops appearing, and who is never named without '
      + 'somebody else. Every name is stated by the show\'s own episode '
      + 'descriptions, never identified from the audio.';
    $('prov').textContent = '';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('cast');
    return renderCastGraph();
  }
  if (raw === 'presence') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'On-show presence & speaker evidence';
    $('rmeta').textContent = 'A route-level record that separates people named in reviewed route context from people explicitly introduced on the recording, and from voices validated against source audio.';
    $('prov').textContent = 'Presence evidence is attached to each route. Voice identity remains unassigned until a source-audio comparison passes validation.';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    $('atabs').hidden = true;
    return renderPresence();
  }
  if (raw === 'method') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Method';
    $('rmeta').textContent = 'What was measured, what it showed, and what was '
      + 'withdrawn. Every number here is read from the build, so a stale figure '
      + 'is a build error rather than a claim that quietly outlived its evidence.';
    $('prov').textContent = '';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('method');
    return renderMethod();
  }
  if (raw === 'arcs') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Arcs';
    $('rmeta').textContent = 'Where one telling runs across several episodes. '
      + 'DVDASA is a numbered serial, so continuity is a real structure in the '
      + 'corpus — but only the arcs the show names are substantial.';
    $('prov').textContent = '';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('arcs');
    return renderArcs();
  }
  if (raw === 'stories') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Verified stories';
    $('rmeta').textContent = 'Stories he tells more than once, each telling quoted '
      + 'in the order it was told. Every telling here was read and verified by a '
      + 'person before it was listed — the corpus proposes candidates, and it '
      + 'cannot tell a story from a conversation about a film, so nothing '
      + 'reaches this shelf unread. Ordered by saga and episode number, the '
      + 'sequence the show released in; the recordings carry no air dates, so '
      + 'the order is real but the years are not known. Differences between '
      + 'tellings are shown, never explained.';
    $('prov').textContent = '';
    $('rlink').hidden = true; $('modes').hidden = true; $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('stories');
    return renderStories();
  }
  if (raw === 'subjects') {
    $('hub').hidden = true; $('browse').hidden = true; $('reader').hidden = false;
    $('rtitle').textContent = 'Recurring subjects';
    $('rmeta').textContent = 'People, places and themes that recur across the '
      + 'complete 421-route reader corpus. Each subject links to its matching '
      + 'episodes; the three-route threshold keeps one-off mentions out of this '
      + 'recurrence index. Recurring hosts are omitted because they describe the '
      + 'show format rather than a returning subject.';
    $('prov').textContent = '';
    $('rlink').hidden = true;
    $('modes').hidden = true;
    $('fq').hidden = true;
    $('editorial').innerHTML = '';
    renderTabs('subjects');
    return renderSubjects();
  }
  if ($('atabs')) $('atabs').hidden = true;
  const id = decodeURIComponent(raw.replace(/^\/?/, ''));
  $('hub').hidden = true;
  if (id) return openItem(id);
  $('reader').hidden = true;
  $('browse').hidden = false;
  renderList();
}

(async function init() {
  try {
    const r = await fetch(dataURL('data/catalog.json'));
    state.cat = await r.json();
  } catch {
    $('stats').textContent = 'Could not load the archive index.';
    return;
  }
  state.items = state.cat.items;
  try {
    const browse = await (await fetch(dataURL('data/browse-index.json'))).json();
    state.browse = browse.routes || {};
  } catch { state.browse = {}; }
  renderStart();
  const uniqueRoutes = [...new Map(state.items.map((item) => [item.id, item])).values()];
  const hrs = uniqueRoutes.reduce((a, b) => a + b.d, 0) / 3600;
  const w = uniqueRoutes.reduce((a, b) => a + b.w, 0);
  $('stats').textContent =
    `${uniqueRoutes.length} unique reader routes · ${state.items.length} catalog cards · `
    + `${hrs.toFixed(0)} hours · ${w.toLocaleString()} words · machine-assisted`;

  // count first so the entrance can show how many stories qualify
  try {
    const rr = await (await fetch(dataURL('data/retellings.json'))).json();
    state.retold = (rr.pairs || []).length;
  } catch { state.retold = 0; }

  try {
    const st = await (await fetch(dataURL('data/stories.json'))).json();
    state.stories = (st.stories || []).length;
  } catch { state.stories = 0; }

  try {
    const sj = await (await fetch(dataURL('data/subjects.json'))).json();
    state.subjects = Object.values(sj.subjects || {})
      .reduce((n, rows) => n + rows.length, 0);
  } catch { state.subjects = 0; }

  renderFilters();
  renderProgress();
  $('q').oninput = () => { state.q = $('q').value.trim(); state.showAll = false; renderList(); };
  $('back').onclick = () => { location.hash = ''; };
  addEventListener('hashchange', route);
  route();
})();
