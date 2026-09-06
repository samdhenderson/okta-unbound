/**
 * Gate the narration against the picture it is meant to sit under.
 *
 *   node scripts/check-vo.mjs
 *
 * Four checks, none of which `tsc` or `check-verbs.mjs` can express:
 *
 *   1. Every act `SCRIPT` defines has a recorded WAV, unless it is named in
 *      {@link SILENT_ACTS} as deliberately silent.
 *   2. No recorded WAV runs longer than the act it is laid under, the
 *      record-to-picture rule `NARRATION.md` states: the film does not wait
 *      for narration.
 *   3. No WAV in `captures/vo/` goes unclaimed by any act, dead audio left
 *      behind by a renamed or deleted act, silently shipped in every render
 *      until someone notices the file by hand.
 *   4. No line in `NARRATION.md` writes a digit that is not part of a
 *      `` `figure:...` `` reference (`NARRATION.md`'s own house rules explain
 *      why: a spoken number is either read off a figure the capture measured,
 *      or it should not be spoken).
 *
 * ## Exit codes
 *
 * Mirrors `.storybook/scripts/capture/check.mjs` exactly, for the same reason
 * that script gives: "no violations found" and "I was unable to look" are
 * different answers, and conflating them is how a broken gate goes unnoticed.
 *
 *   0  every check ran and found nothing wrong.
 *   1  a check ran and found a problem. Fix the narration, the script, or the
 *      opt-out list.
 *   2  a check could not run at all, so nothing above is a verdict.
 *      `NARRATION.md` is missing, `SCRIPT` failed to parse, or similar.
 *
 * @module
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readActs, readCut } from './lib/cut.mjs';
import { VO_DIR, VO_GENERATED_TS, NARRATION_MD } from './lib/paths.mjs';

/**
 * Acts that are deliberately silent. No narration is ever expected for them.
 *
 * Empty today. An act earns a place here by editorial decision (a beat that
 * is filmed and not played, a placeholder piece with nothing to say about it
 * yet), never by omission. An unrecorded act with no entry here is exactly
 * the "forgot to record this one" state check 1 exists to catch.
 */
const SILENT_ACTS = new Set([
  // 'piece-ledger-4', // example: the ledger piece is still a placeholder.
]);

let bad = 0;
let broken = 0;
const report = (level, message) => {
  console.log(`  ${level === 'bad' ? 'x' : '?'} ${message}`);
  if (level === 'bad') bad += 1;
  else broken += 1;
};

/** `VO` out of `src/vo.generated.ts`, read as text so a stale build cannot lie to this gate. */
function readMeasured() {
  let source;
  try {
    source = readFileSync(VO_GENERATED_TS, 'utf8');
  } catch {
    return { ok: false, reason: `${path.relative(process.cwd(), VO_GENERATED_TS)} does not exist` };
  }
  const block = source.match(/export const VO = \{([\s\S]*?)\}\s*as const;/);
  if (!block) {
    return { ok: false, reason: 'could not find a VO export. Did the generator format change?' };
  }
  // Quoting style is prettier's call (`.prettierrc`'s `singleQuote`), and
  // `measure-vo.mjs` runs its output through prettier before writing, so
  // this accepts either quote character rather than assuming one.
  const entries = new Map();
  for (const [, key, file, seconds] of block[1].matchAll(
    /['"]([^'"]+)['"]:\s*\{\s*file:\s*['"]([^'"]+)['"],\s*seconds:\s*([\d.]+)\s*\}/g,
  )) {
    entries.set(key, { file, seconds: Number(seconds) });
  }
  return { ok: true, entries };
}

/**
 * An act's own runtime in seconds, off the generated plan.
 *
 * This used to rebuild the ramp here, from a hand-written port of
 * `buildRamp`. It now reads the frames the composition will actually render
 * (ADR-0074 5), so "the film does not wait for narration" is measured against
 * the film rather than against a second opinion about it.
 */
function actSeconds(act, fps) {
  if (act.frames === null) throw new Error(act.reason ?? 'no frames resolved for this act');
  return act.frames / fps;
}

/* --- Checks ----------------------------------------------------------- */

function checkActs(acts, measured, wavFiles, fps) {
  for (const act of acts) {
    const hasWav = wavFiles.has(`${act.key}.wav`);
    const entry = measured.entries.get(act.key);

    if (!hasWav) {
      if (SILENT_ACTS.has(act.key)) continue;
      report(
        'bad',
        `${act.sceneId} / ${act.key}: no narration recorded (captures/vo/${act.key}.wav)`,
      );
      continue;
    }
    if (SILENT_ACTS.has(act.key)) {
      report(
        'bad',
        `${act.sceneId} / ${act.key}: recorded, but listed in SILENT_ACTS as deliberately silent, remove it from the list or delete the WAV`,
      );
    }
    if (!entry) {
      report(
        'broken',
        `${act.sceneId} / ${act.key}: captures/vo/${act.key}.wav exists but is not in vo.generated.ts, run \`npm run reel:vo:measure\``,
      );
      continue;
    }

    let picture;
    try {
      picture = actSeconds(act, fps);
    } catch (err) {
      report(
        'broken',
        `${act.sceneId} / ${act.key}: could not compute the act's own duration: ${err.message}`,
      );
      continue;
    }
    if (entry.seconds > picture) {
      report(
        'bad',
        `${act.sceneId} / ${act.key}: narration runs ${entry.seconds.toFixed(2)}s, the picture ` +
          `only holds ${picture.toFixed(2)}s (${(entry.seconds - picture).toFixed(2)}s over)`,
      );
    }
  }
}

function checkDeadAudio(acts, wavFiles) {
  const claimed = new Set(acts.map((act) => `${act.key}.wav`));
  for (const file of wavFiles) {
    if (!claimed.has(file)) {
      report('bad', `captures/vo/${file}: no act in SCRIPT claims this file (dead audio)`);
    }
  }
}

/**
 * `` `figure:groups` `` is the only place a digit may legitimately appear in
 * `NARRATION.md`'s spoken lines. Blockquote lines (`> ...`) are the only lines
 * scanned. Headings and `Target:` annotations are stage directions, not
 * words to say aloud, and both legitimately carry digits.
 */
const FIGURE_REF = /`figure:[\w.]+`/g;

function checkNarrationDigits() {
  let source;
  try {
    source = readFileSync(NARRATION_MD, 'utf8');
  } catch {
    return { ok: false, reason: `${path.relative(process.cwd(), NARRATION_MD)} does not exist` };
  }
  const lines = source.split('\n');
  let violations = 0;
  lines.forEach((line, i) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('>')) return;
    const spoken = trimmed.replace(FIGURE_REF, '');
    if (/\d/.test(spoken)) {
      report(
        'bad',
        `NARRATION.md:${i + 1}: a digit outside a \`figure:...\` reference: "${line.trim()}"`,
      );
      violations += 1;
    }
  });
  return { ok: true, violations };
}

/* --- Runner ------------------------------------------------------------- */

function main() {
  console.log('Narration gate');

  const cut = readCut();
  const acts = readActs(cut);
  const measured = readMeasured();
  if (!measured.ok) {
    report('broken', `cannot read measured narration: ${measured.reason}`);
  } else {
    // A missing directory is zero recordings, not a broken check, the
    // ordinary state of the project before anyone has run `npm run capture`'s
    // narration counterpart for the first time.
    let listing = [];
    try {
      listing = readdirSync(VO_DIR);
    } catch {
      /* captures/vo/ does not exist yet: zero files. */
    }
    const wavFiles = new Set(listing.filter((f) => f.endsWith('.wav')));
    checkActs(acts, measured, wavFiles, cut.fps);
    checkDeadAudio(acts, wavFiles);
  }

  const narration = checkNarrationDigits();
  if (!narration.ok) {
    report('broken', `cannot check NARRATION.md: ${narration.reason}`);
  }

  console.log('');
  if (broken > 0) {
    console.log(`${broken} check(s) could not run. Their verdicts mean nothing.`);
    process.exit(2);
  }
  if (bad > 0) {
    console.log(`${bad} check(s) failed.`);
    process.exit(1);
  }
  console.log(`${acts.length} act(s) clean.`);
}

main();
