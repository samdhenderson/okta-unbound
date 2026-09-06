/**
 * Prove a refactor did not move the picture.
 *
 *   npm run reel:identical -- --save baseline    before the change
 *   npm run reel:identical -- --against baseline after it
 *
 * ## Why a hash and not an eyeball
 *
 * ADR-0074's acceptance test is that the render comes out frame-identical: it
 * rewires how the composition is addressed, not what it draws, so any visible
 * difference is a bug by definition. That is a claim about thousands of frames,
 * and "I looked at a few and they seemed fine" does not support it.
 *
 * So: render the same spread of frames before and after, and compare the PNGs
 * byte for byte. A pixel that moved fails. There is no threshold to argue
 * about and no similarity score to interpret - either the bytes match or the
 * refactor changed something it should not have.
 *
 * ## What it samples
 *
 * Frames are spread across every chapter plus the opening and end card, at
 * full scale, so the sample covers each act rather than clustering wherever
 * the reel happens to be interesting. Full scale matters: a half-scale render
 * resamples, and resampling can hide a one-pixel shift.
 *
 * A frame that fails to render is recorded as a failure rather than skipped.
 * A refactor that makes a frame un-renderable has moved the picture in the
 * most complete way available.
 *
 * @module
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCut } from '../../../reel/scripts/lib/cut.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const REEL = path.join(REPO, 'reel');
const BASELINES = path.join(REEL, 'out/identical');

const TIMEOUT_MS = 120_000;

/** Frames sampled per act. Enough to catch a retime, cheap enough to run twice. */
const PER_ACT = 3;

const usage = `
Prove a refactor did not move the picture.

  npm run reel:identical -- --save <name>      render and record hashes
  npm run reel:identical -- --against <name>   render and compare against them

Options
  --per-act <n>   frames sampled per act (default ${PER_ACT})
`.trim();

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `exited ${code}`)),
    );
  });
}

/**
 * Which frames to sample, as `{ composition, frame, label }`.
 *
 * Sampling happens per act rather than uniformly over the reel so that a short
 * act gets the same scrutiny as a long one - a four-second set piece is
 * exactly the kind of thing a registry change could break, and a uniform
 * spread would give it half a frame.
 */
function sample(cut, perAct) {
  const out = [];
  for (const scene of cut.scenes) {
    for (const act of scene.acts) {
      if (act.frames === null) continue;
      for (let i = 0; i < perAct; i += 1) {
        const frame = act.from + Math.floor(((i + 0.5) * act.frames) / perAct);
        out.push({
          composition: `chapter-${scene.id}`,
          frame,
          label: `${act.key}@${frame}`,
        });
      }
    }
  }
  // The furniture is composed outside any chapter, so a chapter sample can
  // never reach it. `Reel` is the only composition that draws the opening,
  // the band across a seam, and the end card.
  if (cut.openingFrames !== null && cut.frames !== null) {
    for (const [label, frame] of [
      ['opening-early', Math.floor(cut.openingFrames * 0.25)],
      ['opening-late', Math.floor(cut.openingFrames * 0.85)],
      ['first-seam', cut.openingFrames + 5],
      ['end-card', cut.chaptersEnd + Math.floor(cut.endCardFrames / 2)],
    ]) {
      out.push({ composition: 'reel', frame, label });
    }
  }
  return out;
}

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);

async function main() {
  const argv = process.argv.slice(2);
  let name = null;
  let mode = null;
  let perAct = PER_ACT;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--save') ((mode = 'save'), (name = argv[(i += 1)]));
    else if (argv[i] === '--against') ((mode = 'against'), (name = argv[(i += 1)]));
    else if (argv[i] === '--per-act') perAct = Number(argv[(i += 1)]);
    else if (argv[i] === '--help' || argv[i] === '-h') return console.log(usage);
    else throw new Error(`Unknown argument "${argv[i]}"`);
  }
  if (!mode || !name) return console.log(usage);

  const cut = readCut();
  const frames = sample(cut, perAct);
  const dir = path.join(BASELINES, name);
  mkdirSync(dir, { recursive: true });
  const record = path.join(BASELINES, `${name}.json`);

  console.log(`${mode === 'save' ? 'Recording' : 'Checking'} ${frames.length} frames...`);

  const hashes = {};
  const failures = [];
  for (const [i, spec] of frames.entries()) {
    const out = path.join(dir, `${spec.label.replace(/[^a-z0-9@-]/gi, '_')}.png`);
    try {
      await run(
        'npx',
        [
          'remotion',
          'still',
          'src/index.ts',
          spec.composition,
          out,
          `--frame=${spec.frame}`,
          `--timeout=${TIMEOUT_MS}`,
        ],
        REEL,
      );
      hashes[spec.label] = sha(out);
    } catch (err) {
      hashes[spec.label] = `UNRENDERABLE: ${err.message}`;
      failures.push(spec.label);
    }
    process.stdout.write(`\r  ${i + 1}/${frames.length}`);
  }
  process.stdout.write('\n');

  if (mode === 'save') {
    writeFileSync(record, `${JSON.stringify(hashes, null, 2)}\n`);
    console.log(`Recorded ${Object.keys(hashes).length} frame hashes -> ${record}`);
    if (failures.length)
      console.log(`WARNING: ${failures.length} would not render: ${failures.join(', ')}`);
    return;
  }

  if (!existsSync(record)) throw new Error(`No baseline "${name}". Save one first.`);
  const before = JSON.parse(readFileSync(record, 'utf8'));

  const moved = [];
  const added = [];
  const gone = [];
  for (const label of Object.keys(hashes)) {
    if (!(label in before)) added.push(label);
    else if (before[label] !== hashes[label]) moved.push(label);
  }
  for (const label of Object.keys(before)) if (!(label in hashes)) gone.push(label);

  for (const label of moved) console.log(`  x ${label}: ${before[label]} -> ${hashes[label]}`);
  for (const label of added) console.log(`  + ${label}: not in the baseline`);
  for (const label of gone) console.log(`  - ${label}: in the baseline, not rendered now`);

  if (moved.length || added.length || gone.length) {
    console.log(
      `\nThe picture moved: ${moved.length} changed, ${added.length} new, ${gone.length} gone.`,
    );
    process.exit(1);
  }
  console.log(`\nFrame-identical across ${Object.keys(hashes).length} frames.`);
}

main().catch((err) => {
  console.error(`reel:identical: ${err.message}`);
  process.exit(1);
});
