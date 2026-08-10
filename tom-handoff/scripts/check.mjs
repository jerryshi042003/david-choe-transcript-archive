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
  "assets/cap-construction-cyan.png",
  "assets/cap-construction-cyan.webp",
  "assets/cap-construction-magenta.png",
  "assets/cap-rear-magenta.png",
  "assets/cap-rear-magenta.webp",
  "assets/jumpshot-tee-cutout.png",
  "assets/jumpshot-tee-cutout.webp",
  "assets/second-serve-cutout.png",
  "assets/second-serve-cutout.webp",
];

await Promise.all(required.map((file) => access(file)));

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const imageCount = (html.match(/<img /g) || []).length;

if (imageCount !== 13) throw new Error(`Expected 13 image elements, found ${imageCount}`);
if (!html.includes("<h1>UCLA FAST</h1>") || !html.includes("<p>Tennis Runway Show</p>")) throw new Error("Missing clear runway title lockup");
if (css.includes("font-family: Impact") || css.includes("font-style: italic")) throw new Error("Runway title lockup is not quiet and consistent");
if (html.includes("Fashion show · Los Angeles · 2026")) throw new Error("Extra runway subtitle leaked into page");
if (html.includes("ball-cap-01.jpg") || html.includes("ball-cap-02.jpg")) throw new Error("Backgrounded cap photo leaked into page");
if ((html.match(/tom-ball-cap-cutout\.webp/g) || []).length !== 1) throw new Error("Expected one production WebP cap picture");
if ((html.match(/bandana-cap-cutout\.webp/g) || []).length !== 1) throw new Error("Expected one production WebP bandana-under-cap picture");
if ((html.match(/cap-construction-cyan/g) || []).length !== 1 || (html.match(/cap-rear-magenta/g) || []).length !== 1) throw new Error("Expected cyan bottom-left and magenta bottom-right cap detail views");
if (!css.includes("transform: scale(1.4)") || !css.includes("transform: scale(1.5)")) throw new Error("Cap construction views are not framed as close details");
if (html.includes("cap-spin") || /\b(?:AI|RAW|MODEL|TRANSPARENT)\b/.test(html)) throw new Error("Process labels leaked into page");
if (!css.includes("background: #00eeff")) throw new Error("Missing full neon cyan field");
if (!css.includes("background: #ff00e6")) throw new Error("Missing full neon magenta field");
if (css.includes("radial-gradient") || css.includes("picture::before") || css.includes("picture::after")) throw new Error("Random neon shapes returned");
if (html.includes("<figcaption") || html.includes("class=\"micro\"")) throw new Error("Image process captions returned");
if (!html.includes("i want to make tennis clothes that aren’t boring and ride off being a heritage-name. tennis is a universal form of expression and exploration. play with strangers, make friends, explore a city")) throw new Error("Missing Tom's exact universal-tennis phrasing");
for (const place of ["Philippines", "Rio favelas", "Shingo in Japan"]) {
  if (!html.includes(place)) throw new Error(`Missing universal-tennis place: ${place}`);
}
if ((css.match(/grid-template-columns: repeat\(3/g) || []).length !== 1) throw new Error("FAST is not the only three-column strip");
if (!css.includes(".study {\n  display: grid;\n  grid-template-columns: repeat(2")) throw new Error("Bandana raw/model studies are not paired in one row");
if (!css.includes("height: auto;\n  aspect-ratio: 4 / 5")) throw new Error("Bandana comparison frames are not locked to equal 4:5 sizing");
if (!html.includes('class="study study-green"') || !css.includes(".study-green .art-frame { background: #63cbb0; }")) throw new Error("Green raw bandana is missing its green field");
if (!html.includes('<h2 class="section-title">Bandanas</h2>') || !html.includes('<h2 class="section-title">Tennis Hat</h2>')) throw new Error("Missing simple section titles");
if (!css.includes(".pitch ul {\n  display: grid;\n  grid-template-columns: 1fr")) throw new Error("Pitch is not one column");
if (!css.includes("@media (min-width: 900px)") || !css.includes("main { width: min(1120px, 100%); }")) throw new Error("Desktop imagery is not enlarged");
if (!css.includes(".final-work,\n  footer") || !css.includes("width: min(900px, 100%)")) throw new Error("Desktop text and closing content are not constrained");
if ((html.match(/<li>/g) || []).length !== 6) throw new Error("Expected six concise pitch bullets");
if (!html.includes("I’m 22 and live in LA") || !html.includes("back permanently Sept. 17")) throw new Error("Missing LA availability");
if (html.indexOf("jumpshot-tee-cutout.webp") > html.indexOf("second-serve-cutout.webp")) throw new Error("Jump-shot tee must precede the tennis tee");
if (html.indexOf("second-serve-cutout.webp") > html.indexOf("<footer")) throw new Error("Tee pair must precede contact");
if (/assets\/(?:tom-ball-cap-cutout|bandana-cap-cutout|cap-construction-cyan|cap-rear-magenta|jumpshot-tee-cutout|second-serve-cutout)\.png/.test(html)) throw new Error("Oversized PNG fallback leaked into the production page");
if (!css.includes(".tee-grid") || !css.includes("grid-template-columns: repeat(2")) throw new Error("Closing tees are not a two-column pair");
if (!css.includes(".tee-jumpshot { background: #f4f4f4; }") || !css.includes(".tee-tennis {") || (css.match(/background: #f4f4f4;/g) || []).length !== 2) throw new Error("Closing tees are not a neutral pair");
if ((html.match(/I’M SHOOTING MY SHOT/g) || []).length !== 1 || !css.includes(".shot-line")) throw new Error("Shooting-my-shot close is missing or duplicated");
if (!css.includes(".hat-ball { background: #00eeff; }") || !css.includes(".hat-bandana { background: #ff00e6; }") || !css.includes(".hat-construction { background: #00eeff; }") || !css.includes(".hat-routing { background: #ff00e6; }")) throw new Error("Hat grid does not use cyan on the bottom-left card");
if (/\.tee-(?:jumpshot|tennis)[^}]*#(?:00eeff|ff00e6)/s.test(css)) throw new Error("Neon leaked into the closing tee pair");
if (css.includes("border: 2px solid #000")) throw new Error("Contact links still look like oversized buttons");
if ((html.match(/<a /g) || []).length !== 2) throw new Error("Expected exactly two contact links");
if (!html.includes('href="https://www.instagram.com/tomohto/"') || !html.includes('href="tel:+16618575287"')) throw new Error("Instagram or tappable phone link is missing");
if (html.includes("mailto:")) throw new Error("Email link should not compete with the two primary contacts");
for (const contact of ["@TOMOHTO", "(661) 857-5287"]) {
  if (!html.includes(contact)) throw new Error(`Missing approved Tom contact: ${contact}`);
}

console.log("Tom → Mike compact handoff check passed.");
