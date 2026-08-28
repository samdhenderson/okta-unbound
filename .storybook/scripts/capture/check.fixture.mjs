/**
 * Prove the guard can fail.
 *
 *   npm run capture:check:fixture
 *
 * A checker that has never been seen to flag anything is indistinguishable from
 * a checker that flags nothing, and "seven chapters clean" is worthless until
 * someone has watched it say otherwise. So each control plants exactly one
 * defect into a copy of a real capture and asserts the guard names it, by name.
 *
 * The magnitudes come from `thresholds.mjs` rather than from literals here. A
 * fixture with its own hard-coded 40px shift keeps passing after somebody
 * raises the threshold to 50, at which point the suite is reporting a working
 * detector that can no longer detect anything.
 *
 * ## Exit codes
 *
 *   0  every control was caught, and the clean case was not.
 *   1  a control slipped through, or the clean case was flagged. Either way the
 *      guard's verdicts on real footage cannot be trusted.
 *
 * @module
 */
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO } from '../lib/storybook-server.mjs';
import { OPEN_RANGE_MIN, SCROLL_EPS_PX } from './thresholds.mjs';
import { SHIFT_EPS_PX } from './instrument.mjs';

const run = promisify(execFile);
const CAPTURES = path.resolve(REPO, 'captures');

/** The chapter every control is built from. Short, and it scrolls. */
const SUBJECT = 'groups';

const scratch = await mkdtemp(path.join(tmpdir(), 'reel-guard-'));

/** Run the guard against a scratch dir and report how it answered. */
async function judge() {
  try {
    const { stdout } = await run('node', [
      path.join(REPO, '.storybook/scripts/capture/check.mjs'),
      `--dir=${scratch}`,
    ]);
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.code ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** Lay a fresh copy of the subject into the scratch dir, optionally damaged. */
async function plant(damage) {
  await rm(scratch, { recursive: true, force: true });
  await cp(CAPTURES, scratch, { recursive: true });
  // One chapter, so a control's verdict is unambiguous.
  const { readdir, unlink } = await import('node:fs/promises');
  for (const file of await readdir(scratch)) {
    if (!file.startsWith(SUBJECT)) await unlink(path.join(scratch, file));
  }
  const file = path.join(scratch, `${SUBJECT}.json`);
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  await damage(manifest, scratch);
  await writeFile(file, JSON.stringify(manifest, null, 2));
}

/** A clip time that is inside a beat and outside every declared motion window. */
function quietMoment(manifest) {
  const beat = manifest.beats[manifest.beats.length - 1];
  for (let at = beat.endAt - 60; at > beat.at; at -= 20) {
    if (!manifest.instrument.motion.some((m) => at >= m.from && at <= m.to)) return at;
  }
  throw new Error('no undeclared moment in the subject capture to plant into');
}

const controls = [
  {
    name: 'clean',
    want: 0,
    says: null,
    damage: async () => {},
  },
  {
    name: 'settle',
    want: 1,
    says: 'settle',
    // Well above the recorder's own floor, so this is testing the checker
    // rather than the recorder's rounding.
    damage: async (manifest) => {
      manifest.instrument.shifts.push({
        at: quietMoment(manifest),
        px: SHIFT_EPS_PX * 40,
        hadRecentInput: false,
      });
    },
  },
  {
    name: 'still',
    want: 1,
    says: 'still',
    damage: async (manifest) => {
      const at = quietMoment(manifest);
      const top = manifest.instrument.scrolls.at(-1)?.top ?? 0;
      manifest.instrument.scrolls.push({ at, top });
      manifest.instrument.scrolls.push({ at: at + 34, top: top + SCROLL_EPS_PX * 60 });
      manifest.instrument.scrolls.sort((a, b) => a.at - b.at);
    },
  },
  {
    name: 'open',
    want: 1,
    says: 'open',
    // A real flat clip, not a doctored number: this control exercises ffmpeg
    // and the signalstats parse as well as the threshold.
    damage: async (manifest, dir) => {
      await run('ffmpeg', [
        '-v', 'error', '-y',
        '-f', 'lavfi',
        '-i', `color=c=white:s=${manifest.panel.width}x${manifest.panel.height}:r=${manifest.fps}:d=1`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        path.join(dir, `${manifest.id}.mp4`),
      ]);
    },
  },
  {
    name: 'unrunnable',
    want: 2,
    says: 'COULD NOT RUN',
    // "I found nothing" and "I could not look" have to be different answers, or
    // a broken recorder reads as clean footage.
    damage: async (manifest) => {
      delete manifest.instrument;
    },
  },
];

let failed = 0;
for (const control of controls) {
  await plant(control.damage);
  const verdict = await judge();
  const codeOk = verdict.code === control.want;
  const saysOk = control.says === null ? true : verdict.out.includes(control.says);
  const ok = codeOk && saysOk;
  if (!ok) failed += 1;
  console.log(`  ${ok ? '.' : 'x'} ${control.name.padEnd(11)} exit ${verdict.code} (wanted ${control.want})`);
  if (!ok) {
    if (!saysOk) console.log(`      output never mentioned "${control.says}"`);
    console.log(
      verdict.out
        .trim()
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n'),
    );
  }
}

await rm(scratch, { recursive: true, force: true });

if (failed > 0) {
  console.log(`\n${failed} control(s) not caught. The guard's verdicts mean nothing.`);
  process.exit(1);
}
console.log(`\n${controls.length} controls behaved. The guard can fail.`);
