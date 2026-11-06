import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const desktop = args[0] === '--desktop';
if ((!desktop && args.length !== 0) || (desktop && (args.length !== 2 || !args[1]))) {
  throw new Error('Usage: node scripts/build-web.mjs [--desktop <output-directory>]');
}
const destination = desktop ? path.resolve(args[1]) : path.join(root, 'dist', 'web');
const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid VERSION');

const files = new Map([
  ['index.html', 'ui/src/index.html'],
  ['src/main.js', 'ui/src/main.js'],
  ['src/file-manager.js', 'ui/src/file-manager.js'],
  ['src/data-workshop.js', 'ui/src/data-workshop.js'],
  ['src/workspace-tools.js', 'ui/src/workspace-tools.js'],
  ['styles/main.css', 'ui/styles/main.css'],
  ['assets/forgedesk.svg', 'ui/assets/forgedesk.svg'],
  ['platform/browser-services.js', 'platform/web/browser-services.js'],
  ['LICENSE', 'LICENSE'],
  ['NOTICE', 'NOTICE']
]);
if (!desktop) files.set('manifest.webmanifest', 'apps/web/manifest.webmanifest');

const output = new Map();
for (const [target, source] of files) output.set(target, await readFile(path.join(root, source)));
if (desktop) {
  const html = output.get('index.html').toString('utf8');
  output.set('index.html', html.replace('  <link rel="manifest" href="./manifest.webmanifest">\n', ''));
}
output.set('src/build.js', `export const version = ${JSON.stringify(version)};\nexport const desktop = ${desktop};\n`);

if (!desktop) {
  const worker = await readFile(path.join(root, 'apps/web/service-worker.js'), 'utf8');
  const hash = createHash('sha256').update(worker);
  for (const [name, bytes] of output) hash.update(name).update('\0').update(bytes).update('\0');
  const revision = version + '-' + hash.digest('hex').slice(0, 16);
  const prelude = `const CACHE_REVISION = ${JSON.stringify(revision)};\nconst APP_FILES = ${JSON.stringify([...output.keys()])};\n`;
  output.set('service-worker.js', prelude + worker);
}
for (const [name, data] of output) {
  const target = path.join(destination, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}
console.log(`Built ForgeDesk ${version} (${desktop ? 'desktop UI' : 'web'}) at ${destination}`);
