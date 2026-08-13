#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(data, 'catalog.json'), 'utf8'));
const items = [...new Map(catalog.items.map((item) => [item.id, item])).values()];
const methodPath = path.join(data, 'method.json');
const method = JSON.parse(fs.readFileSync(methodPath, 'utf8'));
const hours = Number((items.reduce((sum, item) => sum + item.d, 0) / 3600).toFixed(1));
const words = items.reduce((sum, item) => sum + item.w, 0);
const first = method.findings.find((finding) => finding.heading === 'The corpus is complete');

if (!first) throw new Error('method page lost its corpus-completion finding');
first.result = `${items.length} unique reader routes · ${catalog.items.length} catalog cards · ${hours} hours · ${words.toLocaleString()} words`;
first.body = `Every unique reader route in the current catalog has a transcript record and completed editorial layer. ${catalog.items.length - items.length} extra cards are alternate source entries that resolve to an existing reader route; they are not counted again as distinct transcripts. Five music uploads are deliberately excluded and recorded as excluded rather than quietly dropped: transcribing a performance produces song lyrics, which this archive does not republish.`;
method.counts.items = items.length;
method.counts.hours = hours;
method.counts.words = words;

fs.writeFileSync(methodPath, `${JSON.stringify(method, null, 2)}\n`);
console.log(`refreshed method counts for ${items.length} unique routes`);
