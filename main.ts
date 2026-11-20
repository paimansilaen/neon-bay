// Neon Bay, a gta6-01 entry (Node 22, standard library only): the game is
// this directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network
// request), and this program hands it in. It copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library. After the
// copy it verifies every copied file's size against its source and fails
// loudly on any mismatch, so a half-written output can never pass as an entry.
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

// Verify the copy: every file under the output must match its source byte
// for byte, in size at least. A mismatch means the copy is corrupt, so the
// program exits non-zero instead of handing in a broken entry.
function checkCopy(sourceDir, outDir) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(outDir, entry.name);
    if (entry.isDirectory()) {
      checkCopy(source, target);
      continue;
    }
    if (!entry.isFile()) continue;
    const sourceSize = statSync(source).size;
    let targetSize = -1;
    try {
      targetSize = statSync(target).size;
    } catch {
      targetSize = -1;
    }
    if (targetSize !== sourceSize) {
      console.error(`copy mismatch: ${target} is ${targetSize} bytes, source ${source} is ${sourceSize} bytes`);
      process.exit(1);
    }
  }
}

checkCopy(join(here, 'game'), join(out, 'game'));
if (existsSync(join(here, 'screenshots'))) checkCopy(join(here, 'screenshots'), join(out, 'screenshots'));

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
console.log(`Neon Bay copied to ${out} and verified.`);
