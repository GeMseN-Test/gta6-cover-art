// Vice City Cover Studio — entrypoint for make.fun (gta6-cover-art-01).
// Copies app/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-app.ts.
// Node 22, standard library only, no build step, no network.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const repoDir = resolve(import.meta.dirname ?? '.');

mkdirSync(outDir, { recursive: true });

// The app itself: every static file the browser loads offline.
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });

// The screenshots the maker took of the app at work.
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier the gate and the judge read: built from what was copied,
// so the file on disk always matches the app the grader will run.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
// A second run must write the same bytes: buildDossier is deterministic,
// and the copy above carries no timestamps into the dossier.
