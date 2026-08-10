const input = document.querySelector("#search");
const items = [...document.querySelectorAll(".interviews > li")];
const count = document.querySelector("#result-count");

function filter() {
  const query = input.value.trim().toLowerCase();
  let visible = 0;
  for (const item of items) {
    const show = !query || item.dataset.search.includes(query);
    item.hidden = !show;
    if (show) visible += 1;
  }
  count.textContent = query ? `${visible} of ${items.length} interviews shown` : "";
}

input.addEventListener("input", filter);
