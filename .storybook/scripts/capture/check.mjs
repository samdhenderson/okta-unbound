/**
 * Judge the footage, not the composition.
 *
 *   npm run capture:check              # every chapter in captures/
 *   npm run capture:check -- groups    # one
 *
 * This replaces four guards with one, and it is a fifth of their size because
 * three of the four were asking questions the new architecture cannot answer
 * wrongly:
 *
 *   - `check-margin` measured whether a caption was blank. The margin is React
 *     props now, so a missing claim is a type error and a missing figure throws
 *     at render (`figure()` in `reel/src/captures.ts`). Deleted, not ported.
 *   - `check-still`'s camera channels watched a camera that no longer exists in
 *     the page. Only its scroller channel survives, below.
 *   - `check-settle` normalised shift magnitudes against a live camera scale.
 *     Nothing zooms during capture any more, so the divisor is a constant.
 *
 * What remains is the one question no composite can answer: **did the product
 * misbehave while it was being filmed?** A count badge landing a tick late and
 * re-wrapping the string beside it is a defect in the footage. It is not an
 * error, nothing throws, the beat records `ok: true`, and it looks like a bug
 * in the product to anyone watching.
 *
 * ## Exit codes
 *
 *   0  the footage is clean.
 *   1  a bad take. Add a settle, or fix the component.
 *   2  a check could not run, so its verdict means nothing. Never conflated
 *      with 1: "no violations found" and "I was unable to look" are different
 *      answers, and only one of them is good news.
 *
 * @module
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO } from '../lib/storybook-server.mjs';

const run = promisify(execFile);
/** Where the manifests are. Overridable so the fixture can point at a scratch dir. */
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const OUT = dirArg ? path.resolve(dirArg.slice(6)) : path.resolve(REPO, 'captures');

/**
 * Shift magnitudes at or above this are violations, in panel pixels.
 *
 * Imported from the recorder rather than restated: the recorder already
 * discards anything below it, so a checker with a lower threshold would be
 * asserting on data that was filtered out before it arrived.
 */
const { SHIFT_EPS_PX } = await import('./instrument.mjs');

const { SCROLL_EPS_PX, OPEN_FRAMES, OPEN_RANGE_MIN } = await import('./thresholds.mjs');

/* --- Checks --------------------------------------------------------------- */

/**
 * Nothing re-laid-out that we did not ask to move.
 *
 * A shift inside a declared motion window is footage we commanded. A shift
 * outside one is the app settling under the camera.
 */
function checkSettle(manifest) {
  const instrument = manifest.instrument;
  if (!instrument) return { ran: false, why: 'the manifest carries no instrument report' };
  if (!instrument.supported) {
    return { ran: false, why: 'this Chrome does not deliver layout-shift entries' };
  }
  const declared = (t) => instrument.motion.some((m) => t >= m.from && t <= m.to);
  /*
   * The window that reaches the reel, which starts at the first beat and not at
   * the first frame.
   *
   * `buildRamp` builds every segment's `trimBefore` from a beat's `at`, so the
   * footage before the first beat is trimmed and no viewer ever sees it. The
   * camera rolls before then on purpose — `Page.startScreencast` re-composites
   * the page, the tab rail's active indicator re-measures and slides, and the
   * runner waits that out with the camera already running rather than trying to
   * outlast a disturbance it has not caused yet. Judging those frames reported
   * a dozen violations per chapter for motion that is not in the film, which is
   * worse than useless: it buries the real ones.
   *
   * Only the head is excluded. The tail is still judged, because a chapter's
   * closing hold IS in the reel by way of `tailMs`.
   */
  const from = manifest.beats?.length ? manifest.beats[0].at : 0;
  const violations = instrument.shifts
    .filter((s) => s.px >= SHIFT_EPS_PX && s.at >= from && s.at <= manifest.durationMs)
    .filter((s) => !declared(s.at))
    .map((s) => ({
      at: s.at,
      px: Number(s.px.toFixed(1)),
      beat: beatAt(manifest, s.at),
      hadRecentInput: s.hadRecentInput,
    }));
  return {
    ran: true,
    violations,
    // Printed so the cost of ever "just filtering the noisy ones" is visible.
    // `hadRecentInput` is set for 500ms after every CDP click, which is exactly
    // when the app is settling and the defect happens.
    flagged: violations.filter((v) => v.hadRecentInput).length,
  };
}

/** The app's own scroller did not move outside a scroll we commanded. */
function checkStill(manifest) {
  const instrument = manifest.instrument;
  if (!instrument?.scrolls) {
    return { ran: false, why: 'the manifest carries no scroll samples (schema too old?)' };
  }
  const windows = instrument.motion.filter((m) => m.kind === 'scroll');
  const declared = (t) => windows.some((m) => t >= m.from && t <= m.to);
  const violations = [];
  for (let i = 1; i < instrument.scrolls.length; i += 1) {
    const previous = instrument.scrolls[i - 1];
    const sample = instrument.scrolls[i];
    const moved = Math.abs(sample.top - previous.top);
    if (moved < SCROLL_EPS_PX) continue;
    if (sample.at < 0 || sample.at > manifest.durationMs) continue;
    if (declared(sample.at)) continue;
    violations.push({
      at: sample.at,
      px: moved,
      from: previous.top,
      to: sample.top,
      beat: beatAt(manifest, sample.at),
    });
  }
  return { ran: true, violations };
}

/**
 * The clip does not open on a blank frame.
 *
 * Retargeted rather than ported. The old check watched for the reel's title
 * card being missing; the recorder now primes the page until a real frame
 * lands, so the question is simply whether that priming worked. Chrome paints
 * white before `<html>` exists and Vite dev fires `DOMContentLoaded` seconds
 * late, so a clip that starts on a flat rectangle is the observable symptom of
 * having rolled too early.
 *
 * Uniformity is the test, not brightness: it catches a white overlay and a
 * black frame with the same measurement.
 */
async function checkOpen(manifest) {
  // Manifests record a repo-relative path, but a fixture writes its clip beside
  // its manifest. Prefer the sibling when one is there.
  const beside = path.join(OUT, `${manifest.id}.mp4`);
  const clip = existsSync(beside) ? beside : path.resolve(REPO, manifest.file);
  let stderr = '';
  try {
    ({ stderr } = await run(
      'ffmpeg',
      [
        '-v',
        'info',
        '-i',
        clip,
        '-frames:v',
        String(OPEN_FRAMES),
        '-vf',
        'signalstats,metadata=print',
        '-f',
        'null',
        '-',
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    ));
  } catch (err) {
    return { ran: false, why: `ffmpeg could not read ${manifest.file}: ${err.message}` };
  }
  const mins = [...stderr.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map((m) => Number(m[1]));
  const maxes = [...stderr.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map((m) => Number(m[1]));
  if (mins.length === 0) {
    return {
      ran: false,
      why: 'ffmpeg reported no signalstats — is this build missing the filter?',
    };
  }
  const violations = mins
    .map((min, i) => ({ frame: i, range: (maxes[i] ?? min) - min }))
    .filter((f) => f.range < OPEN_RANGE_MIN);
  return { ran: true, violations };
}

/** Which beat was running at a clip time, for a message that names the subject. */
function beatAt(manifest, at) {
  return manifest.beats.find((b) => at >= b.at && at <= b.endAt)?.name ?? '(between beats)';
}

/* --- Runner --------------------------------------------------------------- */

const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const files = (await readdir(OUT).catch(() => []))
  .filter((f) => f.endsWith('.json'))
  .filter((f) => filters.length === 0 || filters.some((id) => f.startsWith(id)));

if (files.length === 0) {
  console.error(
    `no manifests in captures/${filters.length ? ` matching ${filters.join(', ')}` : ''}. Run \`npm run capture\` first.`,
  );
  process.exit(2);
}

let bad = 0;
let broken = 0;

for (const file of files.sort()) {
  const manifest = JSON.parse(await readFile(path.join(OUT, file), 'utf8'));
  const results = {
    settle: checkSettle(manifest),
    still: checkStill(manifest),
    open: await checkOpen(manifest),
  };

  const failed = Object.entries(results).filter(([, r]) => r.ran && r.violations.length > 0);
  const unran = Object.entries(results).filter(([, r]) => !r.ran);

  const mark = unran.length ? '?' : failed.length ? 'x' : '.';
  console.log(`  ${mark} ${manifest.id}`);

  for (const [name, result] of unran) {
    broken += 1;
    console.log(`      ${name}: COULD NOT RUN — ${result.why}`);
  }
  for (const [name, result] of failed) {
    bad += 1;
    console.log(`      ${name}: ${result.violations.length} violation(s)`);
    for (const v of result.violations.slice(0, 6)) {
      if (name === 'open') {
        console.log(`        frame ${v.frame}: luma range ${v.range}, wanted ${OPEN_RANGE_MIN}+`);
      } else {
        console.log(`        ${String(v.at).padStart(6)}ms  ${v.px}px  during "${v.beat}"`);
      }
    }
    if (result.violations.length > 6) {
      console.log(`        … and ${result.violations.length - 6} more`);
    }
    if (name === 'settle' && result.flagged > 0) {
      console.log(
        `        (${result.flagged} carry hadRecentInput, recorded and deliberately not filtered)`,
      );
    }
  }
}

if (broken > 0) {
  console.log(`\n${broken} check(s) could not run. Their verdicts mean nothing.`);
  process.exit(2);
}
if (bad > 0) {
  console.log(`\n${bad} check(s) failed. Re-shoot after fixing, or add a settle to the walk.`);
  process.exit(1);
}
console.log(`\n${files.length} chapter(s) clean.`);
