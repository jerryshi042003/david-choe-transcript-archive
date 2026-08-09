const STORAGE_KEY = 'open-court-001-progress';
const list = document.querySelector('#sprint');

function loadProgress() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}

const completed = loadProgress();
list.querySelectorAll('li[data-step]').forEach((item) => {
  const step = item.dataset.step;
  const button = item.querySelector('button');
  const paint = () => {
    item.classList.toggle('done', completed.has(step));
    button.setAttribute('aria-pressed', completed.has(step) ? 'true' : 'false');
  };
  paint();
  button.addEventListener('click', () => {
    if (completed.has(step)) completed.delete(step); else completed.add(step);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
    paint();
  });
});
