import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const files = new Map([
  ['', ['index.html', 'text/html']], ['index.html', ['index.html', 'text/html']],
  ['styles/main.css', ['styles/main.css', 'text/css']],
  ['assets/forgedesk.svg', ['assets/forgedesk.svg', 'image/svg+xml']],
  ['src/main.js', ['src/main.js', 'text/javascript']],
  ['src/file-manager.js', ['src/file-manager.js', 'text/javascript']],
  ['src/data-workshop.js', ['src/data-workshop.js', 'text/javascript']],
  ['src/workspace-tools.js', ['src/workspace-tools.js', 'text/javascript']],
  ['src/build.js', ['src/build.js', 'text/javascript']],
  ['platform/browser-services.js', ['platform/browser-services.js', 'text/javascript']],
  ['manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['service-worker.js', ['service-worker.js', 'text/javascript']],
  ['LICENSE', ['LICENSE', 'text/plain']], ['NOTICE', ['NOTICE', 'text/plain']]
]);

export function previewServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const prefix = '/ForgeDesk/';
    const entry = url.pathname.startsWith(prefix) && files.get(url.pathname.slice(prefix.length));
    if (request.method !== 'GET' || !entry) {
      response.writeHead(404).end();
      return;
    }
    try {
      const bytes = await readFile(new URL('../dist/web/' + entry[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' }).end(bytes);
    } catch {
      response.writeHead(404).end('Run node scripts/build-web.mjs first.');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const server = previewServer();
  server.listen(4173, '127.0.0.1', () => console.log('http://localhost:4173/ForgeDesk/'));
}
