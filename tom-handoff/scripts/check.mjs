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
  "assets/second-serve-tee.png",
];

await Promise.all(required.map((file) => access(file)));

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const imageCount = (html.match(/<img /g) || []).length;

if (imageCount !== 10) throw new Error(`Expected 10 image elements, found ${imageCount}`);
if (!html.includes("TOM OH / UCLA FAST TENNIS RUNWAY")) throw new Error("Missing clear runway title");
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
if ((css.match(/grid-template-columns: 1fr/g) || []).length < 2) throw new Error("Pitch and studies are not one-column");
if ((html.match(/<li>/g) || []).length !== 5) throw new Error("Expected five concise pitch bullets");
if (!html.includes("I’m 22 and live in LA") || !html.includes("September 17")) throw new Error("Missing LA availability");
if (html.indexOf("second-serve-tee.png") > html.indexOf("<footer")) throw new Error("Second Serve must precede contact");
for (const contact of ["@TOMOHTO", "TOMOHTO@G.UCLA.EDU", "(661) 857-5287"]) {
  if (!html.includes(contact)) throw new Error(`Missing approved Tom contact: ${contact}`);
}

console.log("Tom → Mike compact handoff check passed.");
