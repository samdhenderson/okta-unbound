/**
 * Read the set-piece registry's frame lengths out of `src/pieces/`, as text.
 *
 * `PIECES` in `src/pieces/index.ts` maps a piece id to a component and a
 * `frames` constant imported from that piece's own module: a literal, never a
 * computation (see that file's module doc: a piece's length must be resolvable
 * at bundle-evaluation time). That literal is exactly what a VO budget needs
 * for a piece act's slot length, and reading it as text sidesteps the same
 * import-graph problem documented on `parse-script.mjs`.
 *
 * @module
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIECES_DIR = path.resolve(HERE, '../../src/pieces');

/**
 * Every piece id in the registry, mapped to its frame count.
 *
 * @returns {Record<string, number>}
 */
export function readPieceFrames() {
  const indexSource = readFileSync(path.join(PIECES_DIR, 'index.ts'), 'utf8');

  // `'exploded-plates': { component: ExplodedPlates, frames: EXPLODED_PLATES_FRAMES }`
  // or the unquoted-key form `ledger: { component: Ledger, frames: LEDGER_FRAMES }`.
  const entries = [
    ...indexSource.matchAll(
      /(?:'([\w-]+)'|(?<![\w-])([\w-]+)):\s*\{\s*component:\s*\w+,\s*frames:\s*(\w+)\s*\}/g,
    ),
  ].map(([, quoted, bare, framesIdent]) => ({ id: quoted ?? bare, framesIdent }));

  if (entries.length === 0) {
    throw new Error(`pieces-frames: no PIECES entries parsed out of ${indexSource.length}-char index.ts`);
  }

  // Resolve each `..._FRAMES` identifier to its literal number, wherever it is
  // exported from, by scanning every module in the directory once.
  const identToNumber = new Map();
  for (const file of readdirSync(PIECES_DIR)) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = readFileSync(path.join(PIECES_DIR, file), 'utf8');
    for (const [, ident, value] of text.matchAll(/export const (\w+_FRAMES)\s*=\s*(\d+)\s*;/g)) {
      identToNumber.set(ident, Number(value));
    }
  }

  const out = {};
  for (const { id, framesIdent } of entries) {
    const frames = identToNumber.get(framesIdent);
    if (frames === undefined) {
      throw new Error(`pieces-frames: piece "${id}" names "${framesIdent}", which no module in ` +
        `src/pieces/ exports as a literal.`);
    }
    out[id] = frames;
  }
  return out;
}
