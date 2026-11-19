// Vice City Cover Studio — a tiny static server for app/.
// Node 22, standard library only. Serves app/index.html at / and every
// file under app/ at its path, so the app can be tried in desktop
// Chrome exactly as the grader's static server will serve it.
// Usage: node serve.ts [port]   (default port 8080)

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(join(fileURLToPath(import.meta.url), '..', 'app'));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer((req, res) => {
  const raw = decodeURIComponent(req.url?.split('?')[0] ?? '/');
  const rel = normalize(raw === '/' ? 'index.html' : raw.replace(/^\/+/, ''));
  const file = join(appDir, rel);
  if (!file.startsWith(appDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Vice City Cover Studio at http://localhost:${port}/`);
});
