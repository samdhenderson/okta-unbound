/**
 * Render one chapter, cheap, to watch the motion.
 *
 *   npm run reel:draft -- <chapter>          e.g. users, chapter-users
 *   npm run reel:draft -- <chapter> --at <act-key>
 *   npm run reel:draft -- --list
 *
 * ## Where this sits
 *
 * `reel:look` answers questions about a frame; this answers questions about
 * movement, which no still can. It is the middle rung of three:
 *
 *   reel:look    seconds     one frame, or a contact sheet of an act
 *   reel:draft   ~a minute   one chapter, half scale, watchable
 *   reel         minutes     the delivery encode, all six minutes of it
 *
 * Reach for the cheapest rung that can answer the question. A transition that
 * looks wrong on a contact sheet is usually wrong; a transition that looks
 * *right* on one has not been checked at all.
 *
 * ## The draft settings, and why they are not the delivery settings
 *
 * Half scale, JPEG frames, CRF 28 - the same trade `reel/package.json`'s
 * `draft` script already makes for the whole reel, applied to one chapter.
 * This output is for judging timing, not type: the softness these settings
 * introduce lands on exactly the fine copy `Config.setVideoImageFormat('png')`
 * exists to protect, so a draft is never evidence about how the film *looks*.
 * Render the real thing for that.
 *
 * Output goes to `reel/out/drafts/`, which is gitignored.
 *
 * @module
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCut, findAct } from '../../../reel/scripts/lib/cut.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const REEL = path.join(REPO, 'reel');
const DRAFTS = path.join(REEL, 'out/drafts');

/** Same reasoning, and the same number, as the render scripts in `reel/package.json`. */
const TIMEOUT_MS = 120_000;

const usage = `
Render one chapter, cheap, to watch the motion.

  npm run reel:draft -- <chapter>              a whole chapter
  npm run reel:draft -- <composition>          a preview: piece-*, card-*, seam...
  npm run reel:draft -- --at <act-key>         just that act's frames
  npm run reel:draft -- --list                 what there is to render

Options
  --scale <n>   default 0.5
  --crf <n>     default 28
  --out <path>  default reel/out/drafts/<name>.mp4
`.trim();

/**
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, { cwd: REEL, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`remotion exited ${code}`)),
    );
  });
}

function parse(argv) {
  const opts = { scale: 0.5, crf: 28 };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') opts.list = true;
    else if (arg === '--at') opts.at = argv[(i += 1)];
    else if (arg === '--scale') opts.scale = Number(argv[(i += 1)]);
    else if (arg === '--crf') opts.crf = Number(argv[(i += 1)]);
    else if (arg === '--out') opts.out = argv[(i += 1)];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option "${arg}"`);
    else positional.push(arg);
  }
  return { opts, positional };
}

async function main() {
  const { opts, positional } = parse(process.argv.slice(2));
  if (opts.help) {
    console.log(usage);
    return;
  }

  const cut = readCut();

  if (opts.list) {
    console.log('Previews');
    for (const [id, f] of Object.entries(cut.previews ?? {})) {
      console.log(
        `  ${id.padEnd(22)} ${String(f).padStart(5)} frames  (${(f / cut.fps).toFixed(1)}s)`,
      );
    }
    console.log('\nChapters');
    for (const scene of cut.scenes) {
      console.log(
        `  ${scene.id.padEnd(10)} ${String(scene.frames).padStart(5)} frames  ` +
          `(${(scene.frames / cut.fps).toFixed(1)}s)  ${scene.acts.length} act(s)`,
      );
    }
    return;
  }

  // An act key implies its chapter, so naming both is redundant. Accept either.
  let sceneId = positional[0];
  let range = null;
  let name;

  if (opts.at) {
    const found = findAct(cut, opts.at);
    if (!found) throw new Error(`No act "${opts.at}". Try: npm run reel:look -- --list`);
    if (found.act.frames === null) {
      throw new Error(`Act "${opts.at}" has no frames yet: ${found.act.reason}`);
    }
    sceneId = found.scene.id;
    range = [found.act.from, found.act.from + found.act.frames - 1];
    name = opts.at;
  }

  if (!sceneId) throw new Error('Name a chapter or composition, or use --at. --list shows both.');

  // A preview composition - a set piece, a card - is not a chapter and has no
  // act, so it never resolved here. That left the middle rung of the feedback
  // loop missing for exactly the case building a set piece creates: the piece
  // is registered, not yet cut into the film, and the only way to watch it
  // move was to call `remotion render` by hand.
  const previewFrames = cut.previews?.[sceneId];
  let composition;
  let frames;

  if (previewFrames !== undefined) {
    composition = sceneId;
    frames = previewFrames;
    name ??= sceneId;
  } else {
    const id = sceneId.replace(/^chapter-/, '');
    const scene = cut.scenes.find((s) => s.id === id);
    if (!scene) {
      throw new Error(
        `No chapter or composition "${sceneId}". Chapters: ` +
          `${cut.scenes.map((s) => s.id).join(', ')}. ` +
          `Previews: ${Object.keys(cut.previews ?? {}).join(', ')}`,
      );
    }
    composition = `chapter-${scene.id}`;
    frames = range ? range[1] - range[0] + 1 : scene.frames;
    name ??= scene.id;
  }

  mkdirSync(DRAFTS, { recursive: true });
  const out = opts.out ? path.resolve(REPO, opts.out) : path.join(DRAFTS, `${name}.mp4`);

  const args = [
    'remotion',
    'render',
    'src/index.ts',
    composition,
    out,
    '--image-format=jpeg',
    `--crf=${opts.crf}`,
    `--scale=${opts.scale}`,
    `--timeout=${TIMEOUT_MS}`,
  ];
  if (range) args.push(`--frames=${range[0]}-${range[1]}`);

  console.log(
    `${composition}: ${frames} frames (${(frames / cut.fps).toFixed(1)}s) at ${opts.scale}x`,
  );
  await run(args);
  console.log(`\n${out}`);
}

main().catch((err) => {
  console.error(`reel:draft: ${err.message}`);
  process.exit(1);
});
