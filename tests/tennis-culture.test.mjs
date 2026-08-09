import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const html = readFileSync(new URL('../tennis-culture/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tennis-culture/styles.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../tennis-culture/app.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

for (const id of ['bet', 'roles', 'network', 'route', 'choe', 'audit']) assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
for (const term of ['Cherman', 'Shingo', 'Little Tokyo Table Tennis', 'Tom Oh', 'Jerry', 'Banksy', 'Sean Parker', 'ice-cream-shop']) assert.ok(html.toLowerCase().includes(term.toLowerCase()), `missing ${term}`);
assert.match(html, /not Sherman/i);
assert.match(html, /no copied podcast, film, or YouTube audio\/video/i);
assert.match(html, /434/);
assert.match(html, /177 \/ 177/);
assert.match(home, /tennis-culture\//);
assert.match(css, /@media \(max-width:\s*850px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(js, /localStorage/);

const reel = new URL('../tennis-culture/exports/open-court-doer-reel.mp4', import.meta.url);
if (existsSync(reel)) assert.ok(statSync(reel).size > 100_000, 'reel is unexpectedly small');
console.log('tennis-culture board: structural checks passed');
