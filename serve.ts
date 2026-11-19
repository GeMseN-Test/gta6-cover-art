// Vice City Cover Studio — tiny static server for local preview.
// Serves app/ at http://localhost:8080 so the cover maker can be tried in
// desktop Chrome exactly as the grader's static server will serve it.
// Node 22, standard library only, no network calls of its own.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 8080);
const appDir = resolve(import.meta.dirname ?? '.', 'app');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  // Never serve a path that climbs out of app/.
  const file = resolve(appDir, `.${path}`);
  if (!file.startsWith(appDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Vice City Cover Studio at http://localhost:${PORT}/`);
  console.log(`  cover shot:  http://localhost:${PORT}/?shot=cover`);
  console.log(`  editor shot: http://localhost:${PORT}/?shot=editor`);
});
