const groupsEl = document.querySelector('#source-groups');
const searchEl = document.querySelector('#source-search');
const countEl = document.querySelector('#result-count');

let ledger = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[character]);
}

function sourceCard(source) {
  const records = source.records.length
    ? `<div class="records"><strong>In this archive</strong>${source.records.map(record =>
        `<a href="../#/${encodeURIComponent(record.id)}">${escapeHtml(record.label)}</a>`
      ).join('')}</div>`
    : '';
  return `<article class="source-card">
    <div class="source-top">
      <h3>${escapeHtml(source.title)}</h3>
      <span class="status">${escapeHtml(source.status)}</span>
    </div>
    <p>${escapeHtml(source.relation)}</p>
    <p class="coverage">${escapeHtml(source.coverage)}</p>
    <div class="links">
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Visit source ↗</a>
      <a href="${escapeHtml(source.archive_url)}" target="_blank" rel="noopener noreferrer">Browse history ↗</a>
    </div>
    ${records}
  </article>`;
}

function render() {
  if (!ledger) return;
  const query = searchEl.value.trim().toLocaleLowerCase();
  const matches = ledger.sources.filter(source =>
    [source.title, source.group, source.status, source.relation, source.coverage]
      .join(' ').toLocaleLowerCase().includes(query)
  );
  const groups = new Map();
  matches.forEach(source => {
    if (!groups.has(source.group)) groups.set(source.group, []);
    groups.get(source.group).push(source);
  });
  groupsEl.innerHTML = [...groups].map(([group, sources]) =>
    `<section class="source-group"><h2>${escapeHtml(group)}</h2><div class="source-grid">${sources.map(sourceCard).join('')}</div></section>`
  ).join('') || '<p class="empty">No verified sources match that search.</p>';
  countEl.textContent = `${matches.length} verified source${matches.length === 1 ? '' : 's'}`;
}

fetch('../data/web-sources.json')
  .then(response => {
    if (!response.ok) throw new Error(`Source ledger failed to load (${response.status})`);
    return response.json();
  })
  .then(data => {
    ledger = data;
    render();
  })
  .catch(error => {
    groupsEl.innerHTML = `<p class="empty">${escapeHtml(error.message)}. Return to the transcript archive and try again.</p>`;
  });

searchEl.addEventListener('input', render);
