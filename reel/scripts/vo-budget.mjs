/**
 * Print the record-to-picture contract: how long each beat, act and scene
 * actually runs, and how many words of narration that buys.
 *
 *   node scripts/vo-budget.mjs
 *
 * With `--write`, it also rewrites the `Target:` lines in `NARRATION.md` from
 * the same numbers. Those lines used to be copied across by hand, which meant
 * every retime silently staleified the target a recording was read against -
 * the one number in that file whose whole job is to be current. (ADR-0074.)
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
import { readFileSync, writeFileSync } from 'node:fs';
import { readCut } from './lib/cut.mjs';
import { NARRATION_MD } from './lib/paths.mjs';

/** Comfortable spoken pace, in words per second. See the module doc. */
const WORDS_PER_SECOND = 2.6;

const seconds = (frames, fps) => frames / fps;
const words = (secs) => Math.max(1, Math.round(secs * WORDS_PER_SECOND));
const fmt = (secs) => `${secs.toFixed(2)}s`;

function main() {
  const cut = readCut();
  const fps = cut.fps;
  const targets = new Map();

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
        targets.set(act.key, { secs, words: words(secs) });
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

      targets.set(act.key, { secs: totalSecs, words: words(totalSecs) });
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

  if (process.argv.includes('--write')) writeTargets(targets);
}

/**
 * Rewrite every `Target:` line in `NARRATION.md` from the budget just printed.
 *
 * Only the `Target:` line directly under an `### <act-key>` heading is
 * touched. The spoken `>` lines are Sam's and are never rewritten, and an act
 * with no target line gets one inserted rather than silently skipped.
 */
function writeTargets(targets) {
  const lines = readFileSync(NARRATION_MD, 'utf8').split('\n');
  const out = [];
  let written = 0;

  for (let i = 0; i < lines.length; i += 1) {
    out.push(lines[i]);
    // The act key is the first token; a heading may carry the act's label
    // after it (`### users-gap-0 (The gap)`). Anchoring to end-of-line matched
    // only the six headings that happen to have no label, and wrote 6 of 15
    // targets without saying so.
    const heading = lines[i].match(/^###\s+(\S+)/);
    if (!heading) continue;

    const target = targets.get(heading[1]);
    if (!target) continue;

    const line = `Target: ${fmt(target.secs)} (budget ~${target.words} words)`;
    // The target sits after the heading and a blank line. Find whichever of
    // the next few lines is the existing one, and replace it in place.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j += 1;
    if (j < lines.length && lines[j].startsWith('Target:')) {
      for (let k = i + 1; k <= j; k += 1) out.push(k === j ? line : lines[k]);
      i = j;
    } else {
      out.push('', line);
    }
    written += 1;
  }

  writeFileSync(NARRATION_MD, out.join('\n'));
  console.log(`\nNARRATION.md: ${written} target line(s) written.`);
}

main();
