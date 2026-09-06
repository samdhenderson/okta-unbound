/**
 * The resolved cut: every scene, act and beat with the frames it actually
 * occupies.
 *
 * `vo-budget.mjs` already rebuilt each act's ramp to price narration, and
 * `look.mjs` needs the same arithmetic to point a camera at an act. Rebuilding
 * it twice is how the third copy of a formula gets written, so it is built once
 * here and both read it.
 *
 * ## Two frame origins, and why both are reported
 *
 * An act's ramp counts from zero at the act's own first frame, which is what a
 * narration budget wants. A renderer wants neither that nor the reel's global
 * clock: it wants the frame to pass to `remotion still`, and the cheapest
 * composition to render an act from is that act's own chapter (`chapter-users`
 * is seconds; `reel` is minutes). So every entry carries:
 *
 * - `from` / `frames` - chapter-local, the offset into `chapter-<scene.id>`.
 * - `reelFrom` - the same instant on the full `reel` composition's clock,
 *   including the opening title.
 *
 * Beats carry both origins too, for the same reason.
 *
 * ## What this mirrors, and the drift that implies
 *
 * The layout arithmetic here restates `actLengths` and `chapterLength` in
 * `src/comp/Chapter.tsx` and the `CHAPTERS` reduce in `src/comp/Reel.tsx`:
 * acts are laid end to end, chapters are laid end to end, and the opening
 * precedes them. That mirroring is a known cost, inherited from the build
 * scripts' inability to import TypeScript, and it is the thing the generated
 * plan is meant to retire. Until then it lives in exactly one file.
 *
 * The furniture around the chapters - the opening title and the end card - is
 * read out of the components that declare it rather than restated, on the same
 * "generated, not transcribed" principle as `readFps`.
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readScript } from './parse-script.mjs';
import { readPieceFrames } from './pieces-frames.mjs';
import { buildRampLite } from './ramp-lite.mjs';
import { readFps, readManifest, REEL_ROOT } from './paths.mjs';

/**
 * Read `export const NAME = <number>;` out of a source file.
 *
 * Only a literal is accepted. A constant that becomes a computation stops
 * resolving here rather than resolving to something stale, which is the
 * failure mode worth having: `null` is visible, a wrong number is not.
 *
 * @param {string} file Repo-relative to `reel/`.
 * @param {string} name
 * @returns {number | null}
 */
function readConst(file, name) {
  try {
    const source = readFileSync(path.join(REEL_ROOT, file), 'utf8');
    const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)\\s*;`));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The opening title's length.
 *
 * `Opening.tsx` declares this as `OVERTURE_FRAMES + PREMISE_CARD_FRAMES`, so
 * the sum is rebuilt from the two literals rather than transcribed - a number
 * typed here would be wrong the first time either card is retimed.
 *
 * Only the `reel` composition's clock depends on this. A chapter render does
 * not, which is why failing to read it is not fatal - `reelFrom` goes `null`
 * and the chapter-local numbers, the ones `look.mjs` uses by default, stay
 * exact.
 *
 * @returns {number | null}
 */
function readOpeningFrames() {
  const overture = readConst('src/comp/Overture.tsx', 'OVERTURE_FRAMES');
  const premise = readConst('src/comp/PremiseCard.tsx', 'PREMISE_CARD_FRAMES');
  return overture === null || premise === null ? null : overture + premise;
}

/**
 * The end card's length, read out of `src/comp/EndCard.tsx`.
 *
 * Nothing is laid out after it, so this only affects the reported length of
 * the `reel` composition itself - which is exactly what a contact sheet over
 * the whole film needs to be right about.
 *
 * @returns {number | null}
 */
function readEndCardFrames() {
  return readConst('src/comp/EndCard.tsx', 'END_CARD_FRAMES');
}

/**
 * Resolve the whole cut.
 *
 * An act whose capture has not been shot yet, or whose plan names a beat the
 * footage does not carry, is reported with `frames: null` and a `reason`
 * rather than throwing. A half-shot reel is the normal working state, and a
 * tool that refuses to describe *any* of it until *all* of it exists is
 * useless exactly when it is most needed.
 *
 * @returns {{
 *   fps: number,
 *   openingFrames: number | null,
 *   endCardFrames: number | null,
 *   chaptersEnd: number | null,
 *   frames: number | null,
 *   scenes: Array<{
 *     id: string, title: string, from: number, frames: number,
 *     acts: Array<{
 *       key: string, kind: 'film' | 'piece', capture: string, piece?: string,
 *       from: number, frames: number | null, reelFrom: number | null,
 *       reason?: string,
 *       beats: Array<{ beat: string, from: number, frames: number, reelFrom: number | null }>
 *     }>
 *   }>
 * }}
 */
export function readCut() {
  const fps = readFps();
  const openingFrames = readOpeningFrames();
  const pieceFrames = readPieceFrames();

  let reelCursor = openingFrames;
  const scenes = [];

  for (const scene of readScript()) {
    let chapterCursor = 0;
    const acts = [];

    for (const act of scene.acts) {
      const at = chapterCursor;
      const reelFrom = reelCursor === null ? null : reelCursor + at;
      const base = {
        key: act.key,
        kind: act.kind === 'piece' ? 'piece' : 'film',
        capture: act.kind === 'piece' ? act.from : act.capture,
        from: at,
        reelFrom,
        beats: [],
      };

      if (act.kind === 'piece') {
        const frames = pieceFrames[act.piece];
        acts.push({ ...base, piece: act.piece, frames });
        chapterCursor += frames;
        continue;
      }

      const read = readManifest(act.capture);
      if (!read.ok) {
        acts.push({ ...base, frames: null, reason: read.reason });
        continue;
      }

      let ramp;
      try {
        ramp = buildRampLite(read.manifest, act.plan, fps);
      } catch (err) {
        acts.push({ ...base, frames: null, reason: err.message });
        continue;
      }

      acts.push({
        ...base,
        frames: ramp.durationInFrames,
        beats: act.plan.map((entry) => {
          const cue = ramp.cues[entry.beat];
          return {
            beat: entry.beat,
            from: at + cue.from,
            frames: cue.durationInFrames,
            reelFrom: reelFrom === null ? null : reelFrom + cue.from,
          };
        }),
      });
      chapterCursor += ramp.durationInFrames;
    }

    scenes.push({
      id: scene.id,
      title: scene.title,
      from: reelCursor,
      frames: chapterCursor,
      acts,
    });
    if (reelCursor !== null) reelCursor += chapterCursor;
  }

  const endCardFrames = readEndCardFrames();
  const frames = reelCursor === null || endCardFrames === null ? null : reelCursor + endCardFrames;

  return { fps, openingFrames, endCardFrames, chaptersEnd: reelCursor, frames, scenes };
}

/**
 * Find one act by its key, with the scene that holds it.
 *
 * @param {ReturnType<typeof readCut>} cut
 * @param {string} key
 * @returns {{ scene: object, act: object } | null}
 */
export function findAct(cut, key) {
  for (const scene of cut.scenes) {
    const act = scene.acts.find((a) => a.key === key);
    if (act) return { scene, act };
  }
  return null;
}

/**
 * Every act key in the cut, in reel order. For error messages that name what
 * the film does have rather than only what it does not.
 *
 * @param {ReturnType<typeof readCut>} cut
 * @returns {string[]}
 */
export function actKeys(cut) {
  return cut.scenes.flatMap((scene) => scene.acts.map((act) => act.key));
}
