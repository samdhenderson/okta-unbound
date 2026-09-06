/**
 * Print the record-to-picture contract: how long each beat, act and scene
 * actually runs, and how many words of narration that buys.
 *
 *   node scripts/vo-budget.mjs
 *
 * Sam records his own voice against this. The budget is derived from
 * `SCRIPT` and the shoot's own manifests rather than typed by hand anywhere,
 * so a retime (a `holdMs` bumped, a beat re-timed, a whole act re-cut) moves
 * every target the next time this runs. Nothing here writes a file; this is
 * read-to-plan, not a gate (`check-vo.mjs` is the gate).
 *
 * The word count is a guide, not a rule: ~2.6 words/second is a comfortable
 * spoken pace for clear narration (roughly 155 words/minute), so a beat that
 * budgets "3.2s -> 8 words" is telling you a sentence of about that length
 * fits without rushing, not that eight is a quota.
 *
 * @module
 */
import { readCut } from './lib/cut.mjs';

/** Comfortable spoken pace, in words per second. See the module doc. */
const WORDS_PER_SECOND = 2.6;

const seconds = (frames, fps) => frames / fps;
const words = (secs) => Math.max(1, Math.round(secs * WORDS_PER_SECOND));
const fmt = (secs) => `${secs.toFixed(2)}s`;

function main() {
  const cut = readCut();
  const fps = cut.fps;

  let grandFrames = 0;
  let grandWords = 0;
  const unavailable = [];

  for (const scene of cut.scenes) {
    console.log(`\n${scene.title} (${scene.id})`);

    for (const act of scene.acts) {
      if (act.kind === 'piece') {
        const secs = seconds(act.frames, fps);
        grandFrames += act.frames;
        grandWords += words(secs);
        console.log(`  ${act.key}  [set piece: ${act.piece}, from ${act.capture}]`);
        console.log(`    total  ${fmt(secs)}  ->  ~${words(secs)} words`);
        continue;
      }

      if (act.frames === null) {
        unavailable.push(`${act.key} (${act.reason})`);
        console.log(`  ${act.key}  [film: ${act.capture}]  -- SKIPPED: ${act.reason}`);
        continue;
      }

      const totalSecs = seconds(act.frames, fps);
      grandFrames += act.frames;
      grandWords += words(totalSecs);

      console.log(`  ${act.key}  [film: ${act.capture}]`);
      for (const beat of act.beats) {
        const beatSecs = seconds(beat.frames, fps);
        // Frames are printed act-local, the origin a narrator reads against:
        // "twelve seconds into this act", never "13,076 frames into the reel".
        const localFrom = beat.from - act.from;
        console.log(
          `    ${beat.beat.padEnd(14)} frames ${String(localFrom).padStart(5)}-` +
            `${String(localFrom + beat.frames).padEnd(5)}  ${fmt(beatSecs).padStart(7)}  ` +
            `->  ~${words(beatSecs)} words`,
        );
      }
      console.log(
        `    ${'total'.padEnd(14)} frames ${' '.repeat(12)}  ${fmt(totalSecs).padStart(7)}  ` +
          `->  ~${words(totalSecs)} words`,
      );
    }
  }

  console.log(`\n${'-'.repeat(60)}`);
  console.log(
    `Reel total: ${fmt(seconds(grandFrames, fps))} of picture, ~${grandWords} words of narration.`,
  );
  if (unavailable.length > 0) {
    console.log(
      `\n${unavailable.length} act(s) skipped, not captured yet: ${unavailable.join(', ')}`,
    );
  }
}

main();
