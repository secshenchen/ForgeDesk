import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/web/', import.meta.url));
const scope = new URL('https://example.invalid/ForgeDesk/');
const read = (name, encoding) => readFile(path.join(root, name), encoding);
const expectedVersion = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
const worker = await read('service-worker.js', 'utf8');
const match = worker.match(/^const CACHE_REVISION = ("[^"]+");\nconst APP_FILES = (\[[^\n]+\]);\n/);
assert(match, 'Missing generated precache list');
const [revision, files] = [JSON.parse(match[1]), JSON.parse(match[2])];
assert.equal(new Set(files).size, files.length, 'Duplicate cache entries');
assert(files.includes('index.html') && files.includes('manifest.webmanifest'));

async function localReference(reference, source) {
  if (reference.startsWith('#')) return;
  assert(!/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(reference), `External or root reference in ${source}: ${reference}`);
  const url = new URL(reference, new URL(source, scope));
  assert(url.href.startsWith(scope.href) && !url.search && !url.hash, `Reference escapes application scope: ${reference}`);
  const relative = decodeURIComponent(url.pathname.slice(scope.pathname.length));
  assert(files.includes(relative), `Missing cached resource: ${relative}`);
  assert((await stat(path.join(root, relative))).isFile(), `Missing file: ${relative}`);
}

const hash = createHash('sha256').update(worker.slice(match[0].length));
for (const file of files) {
  assert(/^[\w./-]+$/.test(file) && !file.startsWith('/') && !file.split('/').includes('..'));
  const bytes = await read(file);
  assert(bytes.length > 0, `Empty resource: ${file}`);
  hash.update(file).update('\0').update(bytes).update('\0');
  const text = bytes.toString('utf8');
  if (file.endsWith('.html')) {
    for (const ref of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      await localReference(ref[1], file);
    }
    assert(!/\bsrcset\s*=|<iframe\b|<base\b/i.test(text));
  } else if (file.endsWith('.css')) {
    for (const ref of text.matchAll(/url\(\s*["']?([^\s)"']+)/gi)) {
      await localReference(ref[1], file);
    }
    assert(!/@import\b/i.test(text), 'CSS imports are not supported');
  } else if (file.endsWith('.js')) {
    for (const ref of text.matchAll(/\b(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      await localReference(ref[1], file);
    }
    assert(!/['"`](?:https?:)?\/\//i.test(text), `Remote URL in ${file}`);
  }
}
assert.equal(revision, expectedVersion + '-' + hash.digest('hex').slice(0, 16));
assert.equal(worker.slice(match[0].length), await readFile(new URL('../apps/web/service-worker.js', import.meta.url), 'utf8'));
assert.match(await read('src/main.js', 'utf8'), /serviceWorker\.register\('\.\/service-worker\.js'\)/);
assert.equal(await read('src/build.js', 'utf8'), `export const version = "${expectedVersion}";\nexport const desktop = false;\n`);
const manifest = JSON.parse(await read('manifest.webmanifest', 'utf8'));
for (const field of ['id', 'scope', 'start_url']) assert.equal(manifest[field], './');
assert.equal(manifest.display, 'standalone');
assert(manifest.icons.length);
for (const icon of manifest.icons) await localReference(icon.src, 'manifest.webmanifest');

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const name = prefix + entry.name;
    if (entry.isDirectory()) return listFiles(path.join(directory, entry.name), name + '/');
    assert(entry.isFile(), `Unexpected non-file: ${name}`);
    return [name];
  }));
  return nested.flat();
}
assert.deepEqual((await listFiles(root)).sort(), [...files, 'service-worker.js'].sort());
console.log(`Web assets and PWA passed: ${files.length} local precache entries, revision ${revision}`);
