/**
 * The resolved cut, as the composition itself resolves it.
 *
 * Every tool that needs to know where an act starts, how long a beat runs, or
 * what the reel's total length is reads this. It is a thin reader over
 * `plan.generated.json`, which `scripts/emit-plan.mjs` writes by running the
 * real `SCRIPT` through the real `buildRamp`.
 *
 * ## What this used to be
 *
 * It used to rebuild the cut itself, from `parse-script.mjs` (which regexed
 * `script.ts`), `ramp-lite.mjs` (which re-implemented `buildRamp` by hand) and
 * `pieces-frames.mjs` (which regexed the `PIECES` table) - because `script.ts`
 * imported React and could not be evaluated outside a bundler. Those three
 * files are gone (ADR-0074 §5), and with them the standing risk that the
 * narration budget was priced against arithmetic that had drifted from the
 * arithmetic the film renders.
 *
 * The frames reported here are now the frames the composition will draw,
 * because they were produced by the code that draws them.
 *
 * @module
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { REEL_ROOT } from './paths.mjs';

const PLAN_JSON = path.join(REEL_ROOT, 'plan.generated.json');
const SCRIPT_TS = path.join(REEL_ROOT, 'src/script.ts');

/**
 * Read the plan, and say so loudly if the script has moved since it was
 * written.
 *
 * A generated file that has fallen behind its source is worse than no
 * generated file, because everything downstream keeps working and quietly
 * answers about the wrong cut. `reel:plan:check` is the gate; this is the
 * courtesy warning for the working copy, where the gate has not run yet.
 *
 * @returns {{
 *   fps: number,
 *   openingFrames: number,
 *   endCardFrames: number,
 *   chaptersEnd: number,
 *   frames: number,
 *   scenes: Array<{
 *     id: string, title: string, from: number, frames: number,
 *     acts: Array<{
 *       key: string, index: number, kind: 'film' | 'piece', capture: string,
 *       piece?: string, label?: string, from: number, reelFrom: number,
 *       frames: number | null, reason?: string,
 *       beats: Array<{ beat: string, from: number, frames: number, reelFrom: number }>,
 *       marks?: Array<{ beat: string, headline?: string, stage?: string, diagram?: string }>
 *     }>
 *   }>
 * }}
 */
export function readCut() {
  let raw;
  try {
    raw = readFileSync(PLAN_JSON, 'utf8');
  } catch {
    throw new Error(`no plan.generated.json. Run: npm run reel:plan`);
  }

  try {
    if (statSync(SCRIPT_TS).mtimeMs > statSync(PLAN_JSON).mtimeMs) {
      console.warn(
        'warning: src/script.ts is newer than plan.generated.json. Run: npm run reel:plan',
      );
    }
  } catch {
    /* A missing script is somebody else's error to report. */
  }

  return JSON.parse(raw);
}

/**
 * Every act in the cut, flattened, each carrying the scene that holds it.
 *
 * The narration gate walks acts and never cares which chapter an act is in
 * except to name it in a message, which is exactly this shape.
 *
 * @param {ReturnType<typeof readCut>} cut
 */
export function readActs(cut = readCut()) {
  return cut.scenes.flatMap((scene) =>
    scene.acts.map((act) => ({ ...act, sceneId: scene.id, sceneTitle: scene.title })),
  );
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
