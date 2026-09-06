/**
 * Shared filesystem anchors for the VO build scripts.
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The `reel/` project root. */
export const REEL_ROOT = path.resolve(HERE, '../..');

/** The shoot's output directory: `capture()`'s public dir, one level above `reel/`. */
export const CAPTURES_DIR = path.resolve(REEL_ROOT, '../captures');

/** Where narration WAVs live, one per act. */
export const VO_DIR = path.join(CAPTURES_DIR, 'vo');

/** `src/vo.generated.ts`, written by `measure-vo.mjs`. */
export const VO_GENERATED_TS = path.join(REEL_ROOT, 'src/vo.generated.ts');

/** `NARRATION.md`, the recording script. */
export const NARRATION_MD = path.join(REEL_ROOT, 'NARRATION.md');

/**
 * The composition frame rate, read out of `src/frame.ts` rather than
 * restated. Same "generated, not transcribed" reasoning as `sync-theme.mjs`'s
 * palette, applied to one number instead of a whole file.
 *
 * @returns {number}
 */
export function readFps() {
  const source = readFileSync(path.join(REEL_ROOT, 'src/frame.ts'), 'utf8');
  const match = source.match(/fps:\s*(\d+)/);
  if (!match) {
    throw new Error('paths: could not find "fps: <number>" in src/frame.ts');
  }
  return Number(match[1]);
}

/**
 * Read one chapter's capture manifest, straight off disk.
 *
 * This is the read-only subset of `capture()` in `src/captures.ts`: build
 * scripts never render a chapter, so there is nothing for a mismatched schema
 * or a failed beat to threaten, and treating a not-yet-shot capture as
 * "unavailable" rather than a thrown error lets the VO budget still report on
 * every *other* chapter.
 *
 * @param {string} id
 * @returns {{ ok: true, manifest: object } | { ok: false, reason: string }}
 */
export function readManifest(id) {
  const file = path.join(CAPTURES_DIR, `${id}.json`);
  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    return { ok: true, manifest };
  } catch (err) {
    return { ok: false, reason: err.code === 'ENOENT' ? 'not captured yet' : err.message };
  }
}
