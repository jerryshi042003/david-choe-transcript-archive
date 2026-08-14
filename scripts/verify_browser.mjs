#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const target = process.argv[2] || 'http://127.0.0.1:8000/';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 49241;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'choe-browser-audit-'));
const screenshotPath = path.join(os.tmpdir(), 'david-choe-archive-390.png');
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (fn, label, attempts = 80) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const value = await fn();
      if (value) return value;
    } catch { /* Chrome may not be ready yet. */ }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

let socket;
try {
  const page = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const pages = await response.json();
    return pages.find((entry) => entry.type === 'page');
  }, 'headless Chrome');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (url, readyExpression) => {
    await call('Page.navigate', { url });
    return waitFor(async () => {
      const state = await evaluate(`(() => (${readyExpression}))()`);
      return state || null;
    }, url);
  };

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });

  const mobileHome = await navigate(target,
    `document.querySelectorAll('#cards li').length === 24 &&
    [...document.querySelectorAll('.start-card img')].filter((image) => image.complete && image.naturalWidth > 0).length === 4 && ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      startCards: document.querySelectorAll('.start-card').length,
      loadedImages: [...document.querySelectorAll('.start-card img')].filter((image) => image.complete && image.naturalWidth > 0).length,
      rows: document.querySelectorAll('#cards li').length,
      rowThumbs: document.querySelectorAll('#cards .record-thumb').length,
      count: document.querySelector('#count')?.textContent,
      reveal: document.querySelector('#listReveal button')?.textContent
    })`);
  assert.equal(mobileHome.clientWidth, 390);
  assert.equal(mobileHome.scrollWidth, 390, 'recordings page overflows at 390px');
  assert.equal(mobileHome.startCards, 4);
  assert.equal(mobileHome.loadedImages, 4);
  assert.equal(mobileHome.rows, 24);
  assert.equal(mobileHome.rowThumbs, 24, 'every initially visible recording needs a thumbnail');
  assert.equal(mobileHome.count, 'Showing 24 of 434 transcripts');
  assert.equal(mobileHome.reveal, 'Show all 434 recordings');

  await evaluate(`document.querySelector('#cards').scrollIntoView()`);
  await delay(200);
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  await evaluate(`document.querySelector('#listReveal button').click()`);
  const allRoutes = await waitFor(async () => {
    const counts = await evaluate(`({
      rows: document.querySelectorAll('#cards li').length,
      thumbs: document.querySelectorAll('#cards .record-thumb').length
    })`);
    return counts.rows === 434 && counts.thumbs === 434 ? counts : null;
  }, 'all recording rows');
  assert.deepEqual(allRoutes, { rows: 434, thumbs: 434 },
    'full recording reveal must expose one thumbnail for every catalog card');

  await navigate(`${target.replace(/#.*$/, '')}#recent`,
    `document.querySelectorAll('.recent-video').length === 119 && ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      total: document.querySelectorAll('.recent-video').length,
      visible: [...document.querySelectorAll('.recent-video')].filter((row) => !row.hidden).length,
      links: [...document.querySelectorAll('.recent-title a')].filter((link) => /^https:\\/\\/www\\.youtube\\.com\\/watch\\?v=/.test(link.href)).length,
      count: document.querySelector('#recentCount')?.textContent,
      reveal: document.querySelector('#recentReveal button')?.textContent
    })`);
  const mobileRecent = await evaluate(`({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    total: document.querySelectorAll('.recent-video').length,
    visible: [...document.querySelectorAll('.recent-video')].filter((row) => !row.hidden).length,
    links: document.querySelectorAll('.recent-title a').length,
    count: document.querySelector('#recentCount').textContent,
    reveal: document.querySelector('#recentReveal button').textContent
  })`);
  assert.equal(mobileRecent.scrollWidth, mobileRecent.clientWidth, 'current YouTube page overflows at 390px');
  assert.deepEqual([mobileRecent.total, mobileRecent.visible, mobileRecent.links], [119, 24, 119]);
  assert.equal(mobileRecent.count, 'Showing 24 of 119 videos');
  assert.equal(mobileRecent.reveal, 'Show all 119 current videos');
  await evaluate(`document.querySelector('#recentReveal button').click()`);
  assert.equal(await evaluate(`[...document.querySelectorAll('.recent-video')].filter((row) => !row.hidden).length`), 119);

  const reader = await navigate(`${target.replace(/#.*$/, '')}#/saga1-episode-001-with-david-choe-and-asa-akira`,
    `document.querySelectorAll('#body .line').length > 0 && ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.querySelector('#rtitle')?.textContent,
      source: document.querySelector('#srcline')?.textContent,
      status: document.querySelector('#prov')?.textContent,
      people: document.querySelector('#castline')?.textContent
    })`);
  assert.equal(reader.scrollWidth, reader.clientWidth, 'reader overflows at 390px');
  assert.equal(reader.title, 'Episode 001');
  assert.match(reader.source, /DVDASA/);
  assert.match(reader.status, /Transcript Computer transcript/);
  assert.match(reader.people, /People named/);

  await call('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
    screenWidth: 1280, screenHeight: 900,
  });
  const desktop = await navigate(target,
    `document.querySelectorAll('#cards li').length === 24 && ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      rows: document.querySelectorAll('#cards li').length,
      rowThumbs: document.querySelectorAll('#cards .record-thumb').length
    })`);
  assert.equal(desktop.clientWidth, 1280);
  assert.equal(desktop.scrollWidth, 1280, 'recordings page overflows on desktop');
  assert.equal(desktop.rows, 24);
  assert.equal(desktop.rowThumbs, 24);

  console.log(`browser completion: desktop + 390px, 434 recording reveal, 119 video reveal, reader status, images, and zero overflow passed`);
  console.log(`390px screenshot: ${screenshotPath}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (chrome.exitCode === null) {
    chrome.once('exit', () => fs.rmSync(profile, { recursive: true, force: true }));
    chrome.kill('SIGTERM');
  } else {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
