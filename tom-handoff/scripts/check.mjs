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
  "assets/cap-construction-magenta.png",
  "assets/cap-rear-magenta.png",
  "assets/second-serve-tee.png",
];

await Promise.all(required.map((file) => access(file)));

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const imageCount = (html.match(/<img /g) || []).length;

if (imageCount !== 11) throw new Error(`Expected 11 image elements, found ${imageCount}`);
if (html.includes("<header") || html.includes("section-label")) throw new Error("Visible page/section chrome returned");
if (html.includes("ball-cap-01.jpg") || html.includes("ball-cap-02.jpg")) throw new Error("Backgrounded cap photo leaked into page");
if ((html.match(/tom-ball-cap-cutout/g) || []).length !== 2) throw new Error("Expected one real cap picture with WebP fallback");
if (html.includes("cap-spin") || html.includes("AI 3D STUDY")) throw new Error("Inexact AI cap reconstruction leaked into page");
if (!html.includes("RAW PROTOTYPE / 3 PHOTO CUTOUTS")) throw new Error("Missing concise cap context");
if ((html.match(/cap-(construction|rear)-magenta\.png/g) || []).length !== 2) throw new Error("Expected two magenta cap studies");
if (!css.includes("background: #00eeff")) throw new Error("Missing full neon cyan field");
if (css.includes("radial-gradient") || css.includes("picture::before") || css.includes("picture::after")) throw new Error("Random neon shapes returned");
if (!html.includes("Jerry hits with strangers")) throw new Error("Missing universal-tennis goal");
for (const place of ["Brazil", "Italy", "Switzerland", "Philippines"]) {
  if (!html.includes(place)) throw new Error(`Missing universal-tennis place: ${place}`);
}
if (!css.includes("grid-template-columns: repeat(3")) throw new Error("FAST is not a three-column strip");
if ((css.match(/grid-template-columns: repeat\(3/g) || []).length !== 2) throw new Error("Expected compact FAST and cap strips");
if ((css.match(/grid-template-columns: 1fr/g) || []).length < 3) throw new Error("Main content is not one-column");
if (html.indexOf("second-serve-tee.png") > html.indexOf("<footer")) throw new Error("Second Serve must precede contact");
if (!html.includes("@TOMOHTO")) throw new Error("Missing approved Tom contact");

console.log("Tom → Mike compact handoff check passed.");
