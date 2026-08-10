import { access, readFile } from "node:fs/promises";

const required = [
  "index.html",
  "styles.css",
  "vercel.json",
  "assets/show-01.jpg",
  "assets/show-02.jpg",
  "assets/show-03.jpg",
  "assets/bandana-01.jpg",
  "assets/bandana-01-worn.jpg",
  "assets/bandana-02.jpg",
  "assets/bandana-02-worn.jpg",
  "assets/tom-ball-cap-cutout.png",
  "assets/tom-ball-cap-cutout.webp",
  "assets/bandana-cap-cutout.png",
  "assets/bandana-cap-cutout.webp",
  "assets/jumpshot-tee-cutout.png",
  "assets/jumpshot-tee-cutout.webp",
  "assets/second-serve-cutout.png",
  "assets/second-serve-cutout.webp",
];

await Promise.all(required.map((file) => access(file)));

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const imageCount = (html.match(/<img /g) || []).length;

if (imageCount !== 11) throw new Error(`Expected 11 image elements, found ${imageCount}`);
if (!html.includes("TOM OH / UCLA FAST TENNIS RUNWAY")) throw new Error("Missing clear runway title");
if (html.includes("Fashion show · Los Angeles · 2026") || html.includes("SHOOTING MY SHOT.")) throw new Error("Subtitle or closing caption leaked into page");
if (html.includes("ball-cap-01.jpg") || html.includes("ball-cap-02.jpg")) throw new Error("Backgrounded cap photo leaked into page");
if ((html.match(/tom-ball-cap-cutout/g) || []).length !== 2) throw new Error("Expected one real cap picture with WebP fallback");
if ((html.match(/bandana-cap-cutout/g) || []).length !== 2) throw new Error("Expected one bandana-under-cap picture with WebP fallback");
if (html.includes("cap-spin") || /\b(?:AI|RAW|MODEL|TRANSPARENT)\b/.test(html)) throw new Error("Process labels leaked into page");
if (!css.includes("background: #00eeff")) throw new Error("Missing full neon cyan field");
if (!css.includes("background: #ff00e6")) throw new Error("Missing full neon magenta field");
if (css.includes("radial-gradient") || css.includes("picture::before") || css.includes("picture::after")) throw new Error("Random neon shapes returned");
if (html.includes("<figcaption") || html.includes("class=\"micro\"")) throw new Error("Image process captions returned");
if (!html.includes("play with strangers, make friends, explore a city")) throw new Error("Missing universal-tennis goal");
for (const place of ["Brazil", "Italy", "Switzerland", "Philippines"]) {
  if (!html.includes(place)) throw new Error(`Missing universal-tennis place: ${place}`);
}
if ((css.match(/grid-template-columns: repeat\(3/g) || []).length !== 1) throw new Error("FAST is not the only three-column strip");
if (!css.includes(".study {\n  display: grid;\n  grid-template-columns: repeat(2")) throw new Error("Bandana raw/model studies are not paired in one row");
if (!css.includes("height: auto;\n  aspect-ratio: 4 / 5")) throw new Error("Bandana comparison frames are not locked to equal 4:5 sizing");
if (!css.includes(".pitch ul {\n  display: grid;\n  grid-template-columns: 1fr")) throw new Error("Pitch is not one column");
if (!css.includes("@media (min-width: 900px)") || !css.includes("main { width: min(1120px, 100%); }")) throw new Error("Desktop imagery is not enlarged");
if (!css.includes(".final-work,\n  footer") || !css.includes("width: min(900px, 100%)")) throw new Error("Desktop text and closing content are not constrained");
if ((html.match(/<li>/g) || []).length !== 5) throw new Error("Expected five concise pitch bullets");
if (!html.includes("I’m 22 and live in LA") || !html.includes("September 17")) throw new Error("Missing LA availability");
if (html.indexOf("jumpshot-tee-cutout.png") > html.indexOf("second-serve-cutout.png")) throw new Error("Jump-shot tee must precede the tennis tee");
if (html.indexOf("second-serve-cutout.png") > html.indexOf("<footer")) throw new Error("Tee pair must precede contact");
if (!css.includes(".tee-grid") || !css.includes("grid-template-columns: repeat(2")) throw new Error("Closing tees are not a two-column pair");
if (!css.includes(".tee-jumpshot { background: #ff00e6; }") || !css.includes(".tee-tennis { background: #00eeff; }")) throw new Error("Closing tees are missing neon fields");
if ((html.match(/<a /g) || []).length !== 2) throw new Error("Expected exactly two contact links");
if (!html.includes('href="https://www.instagram.com/tomohto/"') || !html.includes('href="tel:+16618575287"')) throw new Error("Instagram or tappable phone link is missing");
if (html.includes("mailto:")) throw new Error("Email link should not compete with the two primary contacts");
for (const contact of ["@TOMOHTO", "(661) 857-5287"]) {
  if (!html.includes(contact)) throw new Error(`Missing approved Tom contact: ${contact}`);
}

console.log("Tom → Mike compact handoff check passed.");
