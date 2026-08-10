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
  "assets/ball-cap-01.jpg",
  "assets/ball-cap-02.jpg",
  "assets/tom-ball-cap-cutout.png",
  "assets/tom-ball-cap-cutout.webp",
  "assets/second-serve-tee.png",
];

await Promise.all(required.map((file) => access(file)));

const html = await readFile("index.html", "utf8");
const imageCount = (html.match(/<img /g) || []).length;
const forbidden = /David Choe|meeting notes|potential/i;

if (imageCount !== 11) throw new Error(`Expected 11 visible image elements, found ${imageCount}`);
if ((html.match(/RAW BANDANA/g) || []).length !== 2) throw new Error("Expected two raw bandana views");
if ((html.match(/MODEL CONCEPT \/ AI-WORN/g) || []).length !== 2) throw new Error("Expected two AI-worn bandana views");
if (!html.includes("TRANSPARENT DEMO")) throw new Error("Missing transparent demo context");
if (!html.includes("UCLA / FAST RUNWAY")) throw new Error("Missing UCLA / FAST runway context");
if (!html.includes("LOS ANGELES · SEPTEMBER 17")) throw new Error("Missing LA availability");
if (!html.includes("MAKE REAL SAMPLES WITH MIKE")) throw new Error("Missing Tom learning goal");
if (!html.includes("Jerry always hits with strangers")) throw new Error("Missing Jerry universal-tennis goal");
for (const place of ["Brazil", "Italy", "Switzerland"]) {
  if (!html.includes(place)) throw new Error(`Missing universal-tennis proof: ${place}`);
}
if (!html.includes("Philippines first")) throw new Error("Missing travel sequence");
if (!html.includes("IF I MISS THIS SECOND SERVE / TEE ARTWORK")) throw new Error("Missing tee artwork context");
if (!html.includes("@TOMOHTO")) throw new Error("Missing approved Tom contact");
if (forbidden.test(html)) throw new Error("Internal-planning copy leaked into public handoff");

console.log("Tom → Mike handoff check passed.");
