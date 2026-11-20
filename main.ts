// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Verify the copy before the dossier is written: every file under game/ and screenshots/ must
// land in /output with the same byte size, or the program refuses rather than handing in an
// entry that is half-copied.
function listFiles(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full, base));
    else found.push({ rel: full.slice(base.length + 1), size: statSync(full).size });
  }
  return found;
}

function checkCopy(sourceDir, destDir) {
  const source = new Map(listFiles(sourceDir).map((f) => [f.rel, f.size]));
  const dest = new Map(listFiles(destDir).map((f) => [f.rel, f.size]));
  const problems = [];
  for (const [rel, size] of source) {
    if (!dest.has(rel)) problems.push(`${rel}: missing from output`);
    else if (dest.get(rel) !== size) problems.push(`${rel}: ${dest.get(rel)} bytes, expected ${size}`);
  }
  for (const rel of dest.keys()) {
    if (!source.has(rel)) problems.push(`${rel}: unexpected file in output`);
  }
  return problems;
}

const problems = [
  ...checkCopy(join(here, 'game'), join(out, 'game')),
  ...(existsSync(join(here, 'screenshots')) ? checkCopy(join(here, 'screenshots'), join(out, 'screenshots')) : []),
];
if (problems.length > 0) {
  console.error(`copy verification failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`copied game/ and screenshots/ to ${out}, sizes verified`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
