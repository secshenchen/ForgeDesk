import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { previewServer } from '../../scripts/serve-web.mjs';

const executable = process.argv[2];
assert(executable, 'Pass an installed Chromium browser executable');
const build = fileURLToPath(new URL('../../build/', import.meta.url));
await mkdir(build, { recursive: true });
const profile = await mkdtemp(path.join(build, 'web-smoke-'));
const version = (await readFile(new URL('../../VERSION', import.meta.url), 'utf8')).trim();
const server = previewServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/ForgeDesk/`;
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--remote-debugging-pipe',
  '--user-data-dir=' + profile, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'inherit', 'pipe', 'pipe'] });
let launchError;
browser.on('error', error => { launchError = error; });

async function until(description, test) {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    if (launchError) throw launchError;
    const result = await test();
    if (result) return result;
    await delay(80);
  }
  throw new Error('Timed out: ' + description);
}

let sessionId;
let sequence = 0;
const pending = new Map();
const remoteRequests = [];
const missingResources = [];
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP command timed out: ' + method));
    }, 12000);
    pending.set(id, reply => {
      clearTimeout(timeout);
      if (reply.error) reject(new Error(reply.error.message));
      else resolve(reply.result);
    });
    browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

let incoming = '';
browser.stdio[3].on('error', error => { launchError = error; });
browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data', chunk => {
  incoming += chunk;
  let end;
  while ((end = incoming.indexOf('\0')) >= 0) {
    const reply = JSON.parse(incoming.slice(0, end));
    incoming = incoming.slice(end + 1);
    if (reply.id) {
      const handler = pending.get(reply.id);
      pending.delete(reply.id);
      handler?.(reply);
    } else if (reply.method === 'Network.requestWillBeSent') {
      const { url } = reply.params.request;
      if (/^https?:/.test(url) && new URL(url).origin !== new URL(base).origin) remoteRequests.push(url);
    } else if (reply.method === 'Network.responseReceived' && reply.params.response.status >= 400) {
      missingResources.push(reply.params.response.url);
    }
  }
});

try {
  const targets = await send('Target.getTargets');
  const target = targets.targetInfos.find(item => item.type === 'page');
  assert(target);
  ({ sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }));
  await send('Network.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: base });
  const ready = 'document.querySelectorAll(".card").length === 10';
  await until('workbench and ten cards', () => evaluate(ready));
  await evaluate('location.hash = "files"');
  await until('file management panel', () => evaluate('Boolean(document.querySelector("#file-picker"))'));
  await evaluate(`(() => {
    const input = document.querySelector('#file-picker');
    const files = new DataTransfer();
    files.items.add(new File(['abc'], 'sample.txt'));
    files.items.add(new File(['xyz'], 'other.txt'));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
    const query = document.querySelector('#file-filter');
    query.value = 'sample';
    query.dispatchEvent(new Event('input'));
  })()`);
  assert.equal(await evaluate('document.querySelectorAll("#file-results li").length'), 1);
  await evaluate('document.querySelector("#file-results button").click()');
  await until('SHA-256 of selected file', () => evaluate(
    'document.querySelector("#file-results output").textContent === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"'));
  await evaluate(`(() => {
    const filter = document.querySelector('#file-filter');
    filter.value = '';
    filter.dispatchEvent(new Event('input'));
    Array.from(document.querySelectorAll('main button')).find(b => b.textContent === '校验全部匹配文件').click();
  })()`);
  await until('batch SHA-256', () => evaluate(
    'Array.from(document.querySelectorAll("#file-results output")).filter(o => /^[0-9a-f]{64}$/.test(o.textContent)).length === 2'));
  await evaluate('location.hash = "data"');
  await until('data workshop panel', () => evaluate('Boolean(document.querySelector(".data-preview"))'));
  await evaluate(`(() => {
    const input = document.querySelector('main input[type=file]');
    const files = new DataTransfer();
    files.items.add(new File(['name,score\\nAda,7\\nBo,9\\n'], 'sample.csv'));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
  })()`);
  await until('CSV imported in browser', () => evaluate(
    'JSON.parse(document.querySelector(".data-preview").textContent || "[]").length === 3'));
  assert.deepEqual(await evaluate(`(() => {
    const query = document.querySelector('main input[type=search]');
    query.value = 'Ada';
    query.dispatchEvent(new Event('input'));
    return JSON.parse(document.querySelector('.data-preview').textContent);
  })()`), [['Ada', '7']]);
  await evaluate('location.hash = "home"');
  await until('return to workbench after file check', () => evaluate(ready));
  assert.equal(await evaluate('document.querySelector("#version").textContent'), 'v' + version);
  const theme = await evaluate('document.documentElement.dataset.theme');
  await evaluate('document.querySelector("#theme").click()');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), theme === 'dark' ? 'light' : 'dark');
  await evaluate(`(() => {
    const search = document.querySelector('#search');
    search.value = '磁盘';
    search.dispatchEvent(new Event('input'));
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".card").length'), 1);
  await evaluate('document.querySelector(".card").click()');
  await until('module details', () => evaluate('document.querySelector("h1")?.textContent === "磁盘实验室"'));
  assert.match(await evaluate('document.querySelector("main").textContent'), /最大文件/);
  await evaluate('document.querySelector(".back").click()');
  await until('back to workbench', () => evaluate('document.querySelector("h1")?.textContent === "技术工作台"'));
  await evaluate('document.querySelector(".toolbar a").click()');
  await until('settings and platform capabilities', () => evaluate('document.querySelectorAll("dl dt").length === 5'));
  await evaluate(`(() => {
    const search = document.querySelector('#search');
    search.focus();
    search.value = '网络';
    search.dispatchEvent(new Event('input'));
  })()`);
  await until('global search opens results', () => evaluate('document.querySelector("h1")?.textContent === "技术工作台"'));
  assert(await evaluate('document.activeElement.id === "search"'));
  assert.equal(await evaluate('document.querySelectorAll(".card").length'), 1);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 740, deviceScaleFactor: 1, mobile: true });
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Narrow layout overflows');
  await until('active service worker', () => evaluate('Boolean(navigator.serviceWorker.controller)'));
  const keys = await evaluate(`(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find(name => name.startsWith('forgedesk:')));
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  })()`);
  assert(keys.includes('/ForgeDesk/assets/forgedesk.svg') && keys.includes('/ForgeDesk/styles/main.css'));
  assert(keys.every(key => key.startsWith('/ForgeDesk/')));
  assert.deepEqual(missingResources, []);
  server.close();
  server.closeAllConnections();
  await send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  await send('Page.navigate', { url: base + 'index.html' });
  await until('offline reload through service worker', () => evaluate(ready));
  assert.equal(await evaluate('navigator.onLine'), false);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), theme === 'dark' ? 'light' : 'dark');
  assert.deepEqual(remoteRequests, []);
  console.log('Browser passed: module navigation, file filtering and SHA-256, CSV import and filter, themes, settings, narrow layout, offline reload.');
} finally {
  server.close();
  server.closeAllConnections();
  browser.kill();
}
