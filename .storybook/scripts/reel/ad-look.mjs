/**
 * Look at the advertisement, without rendering the advertisement.
 *
 *   npm run ad:look -- stab-compare --sheet     a contact sheet of one stab
 *   npm run ad:look -- stab-compare 40          one still, 40 frames in
 *   npm run ad:look -- ad 600                   one still of the whole cut
 *   npm run ad:look -- --list                   what there is to look at
 *
 * This is `reel:look` pointed at the ad's own Remotion entry, and it is a
 * wrapper rather than a copy on purpose: the stills, the tiling and the output
 * naming are the same problem the film already solved, and `traps.md`'s entry
 * on copied helpers in the set pieces is what a second implementation of it
 * would become. `look.mjs` grew an `--entry` flag; this passes it.
 *
 * @module
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOOK = path.join(HERE, 'look.mjs');
const ENTRY = 'src/ad-entry.ts';

const argv = process.argv.slice(2);

if (argv.includes('--list')) {
  // The ad has no cut to list from, so the honest list is Remotion's own.
  const child = spawn('npx', ['remotion', 'compositions', ENTRY], {
    cwd: path.resolve(HERE, '../../../reel'),
    stdio: 'inherit',
  });
  child.on('close', (code) => process.exit(code ?? 0));
} else {
  const child = spawn('node', [LOOK, '--entry', ENTRY, ...argv], { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 0));
}
