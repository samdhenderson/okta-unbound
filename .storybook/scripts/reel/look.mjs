/**
 * Look at the reel without rendering the reel.
 *
 *   npm run reel:look -- <composition> <frame>     one still
 *   npm run reel:look -- <composition> --sheet     a contact sheet of the whole thing
 *   npm run reel:look -- --at <act-key>            the cheapest look at one act
 *   npm run reel:look -- --list                    what there is to look at
 *
 * ## Why this exists
 *
 * The only way to see a change used to be `npm run reel`, a full render of a
 * six-minute film. So a one-frame question ("is the headline colliding with
 * the panel?") cost minutes, and a pacing question ("does that beat breathe?")
 * cost the same minutes again for every guess. Work that cannot be seen
 * cheaply gets done blind, and blind work on a film is guesswork.
 *
 * A still is seconds. A contact sheet - stills at even intervals, tiled into
 * one image - answers a pacing question in one look instead of a scrub. Both
 * are things a person or an agent can actually put eyes on.
 *
 * ## The act shorthand
 *
 * `--at users-fix-3` is the call worth knowing. It resolves an act key through
 * the cut, then sheets *that act only*, out of that act's own chapter
 * composition rather than the reel - which is the difference between rendering
 * 1,271 frames of context and rendering 22,162. The composition, the frame
 * range and the tiling are all derived; there is nothing to work out by hand.
 *
 * ## What it does not do
 *
 * It renders no audio and it is not a gate. A still cannot show a transition
 * and a sheet cannot show motion; both narrow down where to look, and
 * `npm run reel:draft <chapter>` is the next rung when the question is
 * genuinely about movement. Nothing here writes into the repo: output lands in
 * `reel/out/looks/`, which is gitignored.
 *
 * @module
 */
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { readCut, findAct, actKeys } from '../../../reel/scripts/lib/cut.mjs';

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The repo root: three levels up from `.storybook/scripts/reel/`. */
const REPO = path.resolve(HERE, '../../..');
const REEL = path.join(REPO, 'reel');
/** Gitignored, alongside Remotion's own `out/`. */
const LOOKS = path.join(REEL, 'out/looks');

/** How many stills a contact sheet uses when `--frames` is not given. */
const SHEET_DEFAULT = 12;

/**
 * Remotion aborts a render whose first component render exceeds 30s, and Inter
 * is fetched from Google's CDN at module scope. Same reasoning, and the same
 * number, as the render scripts in `reel/package.json`.
 */
const TIMEOUT_MS = 120_000;

const usage = `
Look at the reel without rendering the reel.

  npm run reel:look -- <composition> <frame>    one still at that frame
  npm run reel:look -- <composition> --sheet    a contact sheet of the composition
  npm run reel:look -- --at <act-key>           sheet one act, from its own chapter
  npm run reel:look -- --at <act-key> <n>       one still, n frames into that act
  npm run reel:look -- --list                   compositions and act keys

Options
  --entry <path>     which Remotion entry to look in. Defaults to the film's
                     \`src/index.ts\`; the advertisement lives in
                     \`src/ad-entry.ts\` (or use \`npm run ad:look\`).
  --sheet            tile the stills into one image instead of leaving them loose
  --frames <n>       how many stills a sheet uses (default ${SHEET_DEFAULT})
  --scale <n>        render scale, default 0.5 (a sheet does not need full res)
  --out <path>       where to write; default reel/out/looks/<name>.png
`.trim();

/**
 * Run a command, inheriting stdio so Remotion's progress is visible.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

/**
 * Render one still out of a composition.
 *
 * @param {string} composition
 * @param {number} frame
 * @param {string} out Absolute path.
 * @param {number} scale
 * @param {string} entry The Remotion entry the composition is registered in.
 */
async function still(composition, frame, out, scale, entry) {
  await run(
    'npx',
    [
      'remotion',
      'still',
      entry,
      composition,
      out,
      `--frame=${frame}`,
      `--scale=${scale}`,
      `--timeout=${TIMEOUT_MS}`,
    ],
    REEL,
  );
}

/**
 * Tile a directory of stills into one contact sheet.
 *
 * ffmpeg's `tile` filter, the same ffmpeg the capture rig already shells out
 * to in `screencast.mjs`. The grid is as square as the count allows, so twelve
 * stills read as 4x3 rather than a 12-wide strip nobody can see.
 *
 * @param {string} dir Holding `look-000.png` and friends.
 * @param {number} count
 * @param {string} out
 */
async function sheet(dir, count, out) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  await run(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(dir, 'look-%03d.png'),
      '-frames:v',
      '1',
      '-filter_complex',
      `tile=${cols}x${rows}:margin=8:padding=4:color=0x111111`,
      out,
    ],
    REPO,
  );
}

/** Print the compositions and act keys worth naming. */
function list(cut) {
  console.log('Compositions');
  console.log('  reel, reel-delivery, verbs');
  console.log(`  ${cut.scenes.map((s) => `chapter-${s.id}`).join(', ')}`);
  const previews = Object.keys(cut.previews ?? {});
  if (previews.length > 0) console.log(`  ${previews.join(', ')}`);
  console.log('\nAct keys  (use with --at)');
  for (const scene of cut.scenes) {
    console.log(`  ${scene.title} (chapter-${scene.id})`);
    for (const act of scene.acts) {
      const span =
        act.frames === null
          ? `-- ${act.reason}`
          : `frames ${act.from}-${act.from + act.frames}  (${(act.frames / cut.fps).toFixed(1)}s)`;
      console.log(`    ${act.key.padEnd(24)} ${span}`);
    }
  }
}

/**
 * Parse argv into a request. Kept separate from doing the work so an
 * unparseable command line fails before anything renders.
 *
 * @param {string[]} argv
 */
function parse(argv) {
  const opts = { scale: 0.5, count: SHEET_DEFAULT, sheet: false, entry: 'src/index.ts' };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') opts.list = true;
    else if (arg === '--sheet') opts.sheet = true;
    else if (arg === '--at') opts.at = argv[(i += 1)];
    else if (arg === '--frames') opts.count = Number(argv[(i += 1)]);
    else if (arg === '--scale') opts.scale = Number(argv[(i += 1)]);
    else if (arg === '--out') opts.out = argv[(i += 1)];
    else if (arg === '--entry') opts.entry = argv[(i += 1)];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option "${arg}"`);
    else positional.push(arg);
  }
  return { opts, positional };
}

/**
 * Work out what to render: which composition, which frames, what to call it.
 *
 * @returns {{ composition: string, frames: number[], name: string, sheet: boolean }}
 */
async function target(cut, opts, positional) {
  if (opts.at) {
    const found = findAct(cut, opts.at);
    if (!found) {
      throw new Error(`No act "${opts.at}". The film has: ${actKeys(cut).join(', ')}`);
    }
    const { scene, act } = found;
    if (act.frames === null) {
      throw new Error(`Act "${act.key}" has no frames yet: ${act.reason}`);
    }
    const composition = `chapter-${scene.id}`;

    // A bare number after --at is an offset into the act, not a chapter frame.
    // "20 frames into users-fix-3" is the question somebody actually has.
    if (positional.length > 0) {
      const into = Number(positional[0]);
      if (!Number.isFinite(into)) throw new Error(`"${positional[0]}" is not a frame number`);
      if (into >= act.frames) {
        throw new Error(`Act "${act.key}" is ${act.frames} frames; ${into} is past its end`);
      }
      return {
        composition,
        frames: [act.from + into],
        name: `${act.key}-${into}`,
        sheet: false,
      };
    }
    return {
      composition,
      frames: spread(act.from, act.frames, opts.count),
      name: act.key,
      sheet: true,
    };
  }

  const [composition, frameArg] = positional;
  if (!composition)
    throw new Error('Name a composition, or use --at <act-key>. --list shows both.');

  if (opts.sheet || frameArg === undefined) {
    const length =
      compositionLength(cut, composition) ?? (await askRemotion(opts.entry, composition));
    if (length === null) {
      throw new Error(
        `Cannot work out how long "${composition}" runs, so it needs an explicit frame: ` +
          `npm run reel:look -- ${composition} <frame>`,
      );
    }
    return {
      composition,
      frames: spread(0, length, opts.count),
      name: composition,
      sheet: true,
    };
  }

  const frame = Number(frameArg);
  if (!Number.isFinite(frame)) throw new Error(`"${frameArg}" is not a frame number`);
  return { composition, frames: [frame], name: `${composition}-${frame}`, sheet: false };
}

/**
 * How long a composition runs.
 *
 * Chapters and the reel come off the cut; every preview composition comes off
 * the plan's `previews` map, which is derived from the `PIECES` and `CARDS`
 * registries.
 *
 * Previews used to return `null` here, which broke the first command the skill
 * tells you to run after building a set piece: `--sheet` on a brand-new piece
 * refused, because a piece not yet cut into the film has no act to take a
 * length from - exactly when somebody is trying to look at it.
 *
 * @returns {number | null}
 */
function compositionLength(cut, composition) {
  if (composition === 'reel' || composition === 'reel-delivery') return cut.frames;
  if (composition.startsWith('chapter-')) {
    const scene = cut.scenes.find((s) => s.id === composition.slice('chapter-'.length));
    return scene ? scene.frames : null;
  }
  return cut.previews?.[composition] ?? null;
}

/**
 * How long a composition runs when the cut has never heard of it.
 *
 * The advertisement (`src/ad-entry.ts`) is not in `plan.generated.json` and
 * never will be: it has no acts, no chapters and no footage, so there is
 * nothing for `emit-plan` to emit about it. Rather than teach the plan about a
 * second film or hand-maintain a table of stab lengths here, this asks Remotion
 * what it registered - which is the only answer that cannot go stale, because
 * it comes from the same bundle the still will be rendered out of.
 *
 * @returns {Promise<number | null>}
 */
async function askRemotion(entry, composition) {
  const { stdout } = await execFileAsync('npx', ['remotion', 'compositions', entry], { cwd: REEL });
  for (const line of stdout.split('\n')) {
    // `<id>  <fps>  <w>x<h>  <frames> (<n> sec)`
    const match = line.trim().match(/^(\S+)\s+\d+\s+\d+x\d+\s+(\d+)\s/);
    if (match && match[1] === composition) return Number(match[2]);
  }
  return null;
}

/**
 * `count` frames spread evenly across `[from, from + length)`, sampled at the
 * middle of each slice rather than its edge.
 *
 * Sampling on the edges puts both boundary frames on the sheet, and a boundary
 * frame is the least representative frame there is: the first is the one where
 * the slide has not drawn yet and the panel has not arrived, and the last
 * renders whatever the *next* act put there. Twelve tiles are a small budget;
 * spending two of them on transitions wastes a sixth of the sheet. The
 * midpoint of each slice is the frame that actually stands for its slice.
 *
 * @returns {number[]}
 */
function spread(from, length, count) {
  const n = Math.max(1, Math.min(count, length));
  return Array.from({ length: n }, (_, i) =>
    Math.min(from + length - 1, from + Math.floor(((i + 0.5) * length) / n)),
  );
}

async function main() {
  const { opts, positional } = parse(process.argv.slice(2));
  if (opts.help) {
    console.log(usage);
    return;
  }

  const cut = readCut();
  if (opts.list) {
    list(cut);
    return;
  }

  const plan = await target(cut, opts, positional);
  mkdirSync(LOOKS, { recursive: true });

  if (!plan.sheet) {
    const out = opts.out ? path.resolve(REPO, opts.out) : path.join(LOOKS, `${plan.name}.png`);
    await still(plan.composition, plan.frames[0], out, opts.scale, opts.entry);
    console.log(`\n${plan.composition} frame ${plan.frames[0]}\n${out}`);
    return;
  }

  const dir = path.join(LOOKS, `${plan.name}.frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  console.log(
    `${plan.composition}: ${plan.frames.length} stills across frames ` +
      `${plan.frames[0]}-${plan.frames[plan.frames.length - 1]}`,
  );
  for (const [i, frame] of plan.frames.entries()) {
    await still(
      plan.composition,
      frame,
      path.join(dir, `look-${String(i).padStart(3, '0')}.png`),
      opts.scale,
      opts.entry,
    );
  }

  const rendered = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
  const out = opts.out ? path.resolve(REPO, opts.out) : path.join(LOOKS, `${plan.name}.sheet.png`);
  await sheet(dir, rendered, out);
  rmSync(dir, { recursive: true, force: true });

  const fps = cut.fps;
  console.log(
    `\n${plan.name}: ${rendered} frames, ` +
      `${plan.frames.map((f) => (f / fps).toFixed(1) + 's').join(' ')}\n${out}`,
  );
}

main().catch((err) => {
  console.error(`reel:look: ${err.message}`);
  process.exit(1);
});
