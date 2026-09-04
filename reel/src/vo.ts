/**
 * @module reel/vo
 * @description Narration clips, addressed by act key.
 *
 * `VO` in {@link module:reel/vo.generated} is measured off whatever WAVs
 * `scripts/measure-vo.mjs` found under `captures/vo/` the last time it ran.
 * See `NARRATION.md` for the recording contract. This module
 * is the one front door onto it, the same shape `captures.ts` gives the
 * footage: `voClip` resolves a playable source, `voMeta` returns what was
 * measured.
 *
 * **A wrong key throws. A file that has not been recorded yet does not.**
 * Those are two different mistakes and this module tells them apart by
 * checking against two different sets:
 *
 *  - `ACT_KEYS`, derived from `SCRIPT` itself, is every key an act could
 *    legitimately be asked for, the same `actKey` formula `Chapter.tsx` uses
 *    to name each `<Series.Sequence>` (duplicated here, not imported: see the
 *    note below `ACT_KEYS`). A key outside this set is not "unrecorded", it
 *    is wrong: a typo, or a stale key left behind after a chapter was
 *    re-cut. That is a build-time mistake worth failing loudly for, the same
 *    way an unknown `figure()` key is.
 *  - `VO`, generated from whatever WAVs actually exist, is the *subset* of
 *    `ACT_KEYS` that has been recorded and measured so far. Before Sam
 *    records anything this is empty, and that is the ordinary, expected state
 *    of the project, not an error.
 *
 * So a key in `ACT_KEYS` but not yet in `VO` is a **soft absence**: `voClip`
 * and `voMeta` return `undefined` rather than throwing, and `Chapter.tsx`
 * mounts no `<Audio>` at all for that act. The alternative, throwing for
 * "not recorded yet", would take the whole studio down the moment anyone
 * opened it before finishing the recording session, which is every session
 * until the last one. A key in neither set throws, because there is no
 * legitimate reason to be asking for it.
 *
 * Both functions are pure literal lookups against data computed once at
 * module scope, so they are safe to call from a component's render body on
 * every frame. Nothing here is async, and nothing here reaches the
 * filesystem (checking whether the *file itself* exists is deliberately not
 * this module's job; `staticFile` resolves lazily, and `check-vo.mjs` is
 * where "still missing" is judged as a gate rather than tolerated as a
 * render-time default).
 */
import { staticFile } from 'remotion';
import type { Act } from './script';
import { SCRIPT } from './script';
import { VO } from './vo.generated';

/** One act's measured narration. */
export interface VoEntry {
  file: string;
  seconds: number;
}

/**
 * `actKey(act, index)` from `src/comp/Chapter.tsx`, duplicated rather than
 * imported.
 *
 * `Chapter.tsx` needs `voClip`/`voMeta` (task 6, below) and this module needs
 * `Chapter.tsx`'s key formula to build `ACT_KEYS`; importing it the other way
 * would make the two modules import each other. The formula is one line and
 * has stayed one line since ADR-0053 introduced acts; if it ever changes, this
 * copy has to change with it, the same trade `scripts/lib/parse-script.mjs`
 * already makes for the build-time tooling's own copy.
 */
function actKey(act: Act, index: number): string {
  return `${act.kind === 'piece' ? `piece-${act.piece}` : act.capture}-${index}`;
}

/**
 * Every act key `SCRIPT` actually defines, computed once at module scope.
 *
 * Reading `act.kind`/`act.piece`/`act.capture` off `SCRIPT`'s literals is all
 * this does, never `capture()`, never `figure()`, never anything that reads
 * a manifest. Those throw by design (`captures.ts`), and a computation that
 * ran at module-evaluation time and could throw would take the whole bundle
 * down instead of one composition, exactly the failure `pieces/index.ts`'s
 * module doc warns a piece's `frames` must never risk.
 */
const ACT_KEYS: ReadonlySet<string> = new Set(
  SCRIPT.flatMap((scene) => scene.acts.map((act, index) => actKey(act, index))),
);

/** Every measured act key, for an error message that names what is known. */
function knownKeys(): string {
  return [...ACT_KEYS].join(', ') || '(SCRIPT defines no acts)';
}

function lookup(key: string): VoEntry | undefined {
  if (!ACT_KEYS.has(key)) {
    throw new Error(`no such act "${key}" in SCRIPT. Known: ${knownKeys()}`);
  }
  // In `ACT_KEYS` but not (yet) in `VO`: recorded and measured are the same
  // event (`measure-vo.mjs` only ever writes an entry it just probed), so
  // this is squarely "not recorded yet", not "wrong key".
  return (VO as Record<string, VoEntry>)[key];
}

/**
 * The clip source for one act's narration, or `undefined` if it has not been
 * recorded yet.
 *
 * Resolves through `staticFile` against `captures/vo/<file>` the same way
 * `clip()` in `captures.ts` resolves footage. The public dir is pointed at
 * `../captures` in `remotion.config.ts`, so this reads the shoot's own output
 * directory rather than a copy of it.
 *
 * @throws when `key` names no act `SCRIPT` defines. See this module's doc for
 *   why that is the only case that throws.
 */
export function voClip(key: string): string | undefined {
  const entry = lookup(key);
  return entry ? staticFile(`vo/${entry.file}`) : undefined;
}

/**
 * One act's measured narration duration, in seconds, or `undefined` if it has
 * not been recorded yet.
 *
 * @throws under the same condition as {@link voClip}.
 */
export function voMeta(key: string): VoEntry | undefined {
  return lookup(key);
}
