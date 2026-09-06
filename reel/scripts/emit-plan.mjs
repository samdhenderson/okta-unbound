/**
 * Emit the resolved cut as JSON, by running the real script through the real
 * ramp.
 *
 *   node scripts/emit-plan.mjs            write plan.generated.json
 *   node scripts/emit-plan.mjs --check    fail if it is out of date
 *
 * ## What this replaces
 *
 * Every build script used to read `src/script.ts` as text, because the file
 * imported React and six component identifiers and so could not be evaluated
 * outside a bundler. Text parsing cannot call a function, so `buildRamp`'s
 * arithmetic was re-implemented by hand in `lib/ramp-lite.mjs` under a comment
 * asking to be kept in sync, `lib/parse-script.mjs` regexed the script's
 * structure, and `lib/pieces-frames.mjs` regexed the `PIECES` table. Three
 * parsers and a hand-copied algorithm, all downstream of one closure.
 *
 * ADR-0074 removed the closure. So this runs the actual `SCRIPT` through the
 * actual `buildRamp` and writes down what came out. The numbers here are the
 * numbers the composition will render, not a second opinion about them.
 *
 * ## How it evaluates TypeScript without a bundler
 *
 * `tsc` compiles `script.ts` and `ramp.ts` to CommonJS in `.tmp-plan/`, which
 * is then `require`d and deleted. Four details make that work, each of which
 * cost a failed attempt:
 *
 * - **CommonJS, not ESM.** Node's ESM resolver demands file extensions, and
 *   this source tree imports `'./captures'` everywhere. `require` resolves
 *   extensionless specifiers; `import` does not.
 * - **`.tmp-plan/package.json` says `commonjs`.** `reel/package.json` declares
 *   `"type": "module"`, which would otherwise make the emitted `.js` files ESM
 *   again and defeat the point.
 * - **The build lands inside `reel/`.** `captures.ts` imports `remotion` for
 *   `staticFile`, so the output has to sit where `reel/node_modules` resolves.
 *   It also emits `require('../../captures/home.json')`, which only points at
 *   the shoot's output from inside the project.
 * - **Type-only imports are erased.** `script.ts` names `DiagramId` and
 *   `PieceId` as types, so requiring it pulls in no `.tsx` and no React.
 *
 * This is a build-time convenience, never a second renderer. It reads what the
 * composition declares; it does not decide anything.
 *
 * @module
 */
import { execFileSync } from 'node:child_process';
import prettier from 'prettier';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { REEL_ROOT, readFps } from './lib/paths.mjs';

/** Where the CommonJS build lands, and is deleted from. Gitignored. */
const BUILD = path.join(REEL_ROOT, '.tmp-plan');

/** The committed output. */
export const PLAN_JSON = path.join(REEL_ROOT, 'plan.generated.json');

/** The same cut, for people rather than programs. */
export const CUT_MD = path.join(REEL_ROOT, 'CUT.generated.md');

/**
 * Compile and load `SCRIPT`, `buildRamp` and `capture`.
 *
 * @returns {{ SCRIPT: object[], buildRamp: Function, capture: Function, PIECES: object, pieceFrames: Function }}
 */
function load() {
  rmSync(BUILD, { recursive: true, force: true });
  mkdirSync(BUILD, { recursive: true });
  writeFileSync(path.join(BUILD, 'package.json'), '{"type":"commonjs"}\n');

  try {
    execFileSync(
      'npx',
      [
        'tsc',
        'src/script.ts',
        'src/ramp.ts',
        'src/pieces/index.ts',
        'src/comp/cards.ts',
        '--ignoreConfig',
        '--module',
        'commonjs',
        '--target',
        'es2022',
        '--moduleResolution',
        'bundler',
        '--resolveJsonModule',
        '--skipLibCheck',
        '--jsx',
        'react',
        '--rootDir',
        'src',
        '--outDir',
        '.tmp-plan',
      ],
      { cwd: REEL_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    // A type error here is a type error in the composition, and `tsc` has
    // already said exactly what it is. Reporting that, rather than a stack
    // trace from this script, is the difference between "your script does not
    // compile" and "the plan tool crashed".
    const detail = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    throw new Error(
      `the composition does not compile, so the cut cannot be resolved:\n\n${detail}`,
    );
  }

  const require = createRequire(path.join(BUILD, 'noop.cjs'));
  return {
    SCRIPT: require('./script.js').SCRIPT,
    buildRamp: require('./ramp.js').buildRamp,
    capture: require('./captures.js').capture,
    PIECES: require('./pieces/index.js').PIECES,
    pieceFrames: require('./pieces/index.js').pieceFrames,
    CARDS: require('./comp/cards.js').CARDS,
  };
}

/**
 * Resolve the cut.
 *
 * Mirrors the layout `Chapter.tsx` and `Reel.tsx` perform - acts end to end,
 * chapters end to end - but with the real per-act lengths, so the only thing
 * restated is the ordering, not the arithmetic.
 */
/**
 * How long a piece's preview composition runs, mirroring
 * `pieces/Preview.tsx`'s `previewFrames`: the length the film gives the piece,
 * or its own pacing when no act names it yet. The two have to agree or
 * `reel:look` sheets a preview at a length the studio does not render it at.
 */
function previewFrames({ SCRIPT, pieceFrames }, id) {
  for (const scene of SCRIPT) {
    for (const act of scene.acts) {
      if (act.kind === 'piece' && act.piece === id) return pieceFrames(id, act.holds);
    }
  }
  return pieceFrames(id, undefined);
}

function resolve({ SCRIPT, buildRamp, capture, PIECES, pieceFrames }, fps) {
  const scenes = [];
  let reelCursor = 0;

  for (const scene of SCRIPT) {
    let cursor = 0;
    const acts = [];

    for (const [index, act] of scene.acts.entries()) {
      const isPiece = act.kind === 'piece';
      // The one formula that has to agree with `Chapter.tsx`'s `actKey`, and
      // the reason `vo.ts` may stop carrying its own copy of it.
      const key = `${isPiece ? `piece-${act.piece}` : act.capture}-${index}`;
      const from = cursor;
      const base = {
        key,
        index,
        kind: isPiece ? 'piece' : 'film',
        capture: isPiece ? act.from : act.capture,
        from,
        reelFrom: reelCursor + from,
      };

      if (isPiece) {
        // `pieceFrames`, not `PIECES[...].frames`: an act may retune the
        // piece's own holds, and the cut has to be the length the film will
        // actually render. Same function `Chapter` calls, so the two cannot
        // disagree about how long an act is.
        const frames = pieceFrames(act.piece, act.holds);
        acts.push({
          ...base,
          piece: act.piece,
          frames,
          // The cues this piece exposes, and what the cut has done to them.
          // `script.ts` points a reader at CUT.generated.md to find out which
          // names `holds` will accept, so the plan has to carry them.
          cues: Object.keys(PIECES[act.piece].cues ?? {}),
          ...(act.holds ? { holds: act.holds } : {}),
          beats: [],
        });
        cursor += frames;
        continue;
      }

      // A capture that has not been shot, or a plan naming a beat the footage
      // does not carry, is reported rather than thrown: a half-shot reel is
      // the normal working state and every other act still has a real answer.
      let ramp;
      try {
        ramp = buildRamp(capture(act.capture), act.plan, fps);
      } catch (err) {
        acts.push({ ...base, label: act.label, frames: null, reason: err.message, beats: [] });
        continue;
      }

      acts.push({
        ...base,
        label: act.label,
        frames: ramp.durationInFrames,
        beats: act.plan.map((entry) => {
          const cue = ramp.cues[entry.beat];
          return {
            beat: entry.beat,
            from: from + cue.from,
            frames: cue.durationInFrames,
            reelFrom: reelCursor + from + cue.from,
          };
        }),
        marks: act.marks.map((mark) => ({
          beat: mark.beat,
          headline: mark.headline,
          stage: mark.stage,
          diagram: mark.diagram,
        })),
      });
      cursor += ramp.durationInFrames;
    }

    scenes.push({ id: scene.id, title: scene.title, from: reelCursor, frames: cursor, acts });
    reelCursor += cursor;
  }

  return scenes;
}

/** Read a numeric `export const NAME = <literal>;` out of a component. */
function readConst(file, name) {
  const source = readFileSync(path.join(REEL_ROOT, file), 'utf8');
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)\\s*;`));
  return match ? Number(match[1]) : null;
}

function build() {
  const fps = readFps();
  let scenes;
  let previews;
  try {
    const loaded = load();
    scenes = resolve(loaded, fps);
    // Every preview composition `Root.tsx` derives, with its length. The
    // looking tools need this: a piece that is built but not yet cut into the
    // film has no act to take a length from, and that is exactly when somebody
    // is trying to look at it.
    previews = {
      ...Object.fromEntries(
        Object.entries(loaded.PIECES).map(([id]) => [`piece-${id}`, previewFrames(loaded, id)]),
      ),
      ...Object.fromEntries(Object.entries(loaded.CARDS).map(([id, card]) => [id, card.frames])),
    };
  } finally {
    // Always, including on a compile failure. A stale build left behind is how
    // a later run quietly reads yesterday's script.
    rmSync(BUILD, { recursive: true, force: true });
  }

  const overture = readConst('src/comp/Overture.tsx', 'OVERTURE_FRAMES');
  const premise = readConst('src/comp/PremiseCard.tsx', 'PREMISE_CARD_FRAMES');
  const endCard = readConst('src/comp/EndCard.tsx', 'END_CARD_FRAMES');
  const openingFrames = overture + premise;
  const chaptersEnd = openingFrames + scenes.reduce((t, s) => t + s.frames, 0);

  // The scenes were resolved with a cursor starting at 0; the reel's own clock
  // starts after the opening title. Shifted once here rather than threaded
  // through the resolver.
  for (const scene of scenes) {
    scene.from += openingFrames;
    for (const act of scene.acts) {
      act.reelFrom += openingFrames;
      for (const beat of act.beats) beat.reelFrom += openingFrames;
    }
  }

  return {
    _generated: 'npm run reel:plan - do not edit',
    fps,
    openingFrames,
    endCardFrames: endCard,
    chaptersEnd,
    frames: chaptersEnd + endCard,
    previews,
    scenes,
  };
}

/** `123` frames at 60fps as `2:03`. */
function clock(frames, fps) {
  const total = Math.round(frames / fps);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The cut as a readable table.
 *
 * `SCRIPT.md` carried these numbers by hand - chapter runtimes in its
 * headings, a stated total that had drifted to disagree with
 * `DESIGN-BRIEF.md` by more than two minutes. Numbers a program can derive
 * should not be typed by a person, so they are derived here and
 * `SCRIPT.md` keeps the editorial intent that only a person can write.
 */
function renderDoc(cut) {
  const { fps } = cut;
  const out = [
    '# The cut',
    '',
    '<!-- GENERATED by `npm run reel:plan`. Do not edit. -->',
    '',
    `**${clock(cut.frames, fps)}** total, at ${fps}fps: a ${clock(cut.openingFrames, fps)} opening,`,
    `${cut.scenes.length} chapters, and a ${clock(cut.endCardFrames, fps)} end card.`,
    '',
    'Every number here is what the composition renders. To change one, retime the',
    'act in `src/script.ts` and regenerate; nothing in this file is an input.',
    '',
  ];

  for (const scene of cut.scenes) {
    out.push(
      `## ${scene.title} (\`${scene.id}\`)`,
      '',
      `${clock(scene.frames, fps)} - opens at ${clock(scene.from, fps)} - ` +
        `\`chapter-${scene.id}\``,
      '',
      '| act | kind | runtime | frames | beats |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const act of scene.acts) {
      const runtime =
        act.frames === null ? `-- ${act.reason}` : `${(act.frames / fps).toFixed(1)}s`;
      const range = act.frames === null ? '' : `${act.from}-${act.from + act.frames}`;
      const beats = act.beats.map((b) => b.beat).join(', ') || (act.piece ?? '');
      out.push(
        `| \`${act.key}\` | ${act.kind === 'piece' ? `piece: ${act.piece}` : act.capture} | ` +
          `${runtime} | ${range} | ${beats} |`,
      );
    }
    out.push('');

    const withDiagrams = scene.acts.flatMap((act) =>
      (act.marks ?? [])
        .filter((mark) => mark.diagram)
        .map((mark) => `\`${mark.diagram}\` at \`${act.key}\`:${mark.beat}`),
    );
    if (withDiagrams.length > 0) out.push(`Diagrams: ${withDiagrams.join('; ')}`, '');

    const tunable = scene.acts
      .filter((act) => act.cues?.length)
      .map((act) => {
        const held = Object.entries(act.holds ?? {})
          .map(([cue, secs]) => `${cue} ${secs}s`)
          .join(', ');
        return (
          `\`${act.key}\` cues: ${act.cues.map((c) => `\`${c}\``).join(', ')}` +
          (held ? ` - held: ${held}` : '')
        );
      });
    if (tunable.length > 0) out.push(`Set piece holds: ${tunable.join('; ')}`, '');
  }

  return `${out.join('\n')}\n`;
}

/**
 * Format generated output the way the repo formats everything else.
 *
 * Via `resolveConfig` rather than a bare `format()`, for the reason
 * `measure-vo.mjs` and `sync-theme.mjs` both document: `format()` does not read
 * `.prettierrc` on its own, so skipping this makes `npm run format` - and the
 * pre-commit hook - reformat the file straight back, and `--check` then fails
 * forever against output it can never reproduce.
 */
async function formatted(text, file) {
  const options = await prettier.resolveConfig(file);
  return prettier.format(text, { ...options, filepath: file });
}

async function main() {
  const check = process.argv.includes('--check');
  const cut = build();
  const plan = await formatted(JSON.stringify(cut, null, 2), PLAN_JSON);
  const doc = await formatted(renderDoc(cut), CUT_MD);

  if (!check) {
    writeFileSync(PLAN_JSON, plan);
    writeFileSync(CUT_MD, doc);
    console.log(`plan.generated.json + CUT.generated.md: ${cut.scenes.length} scenes written.`);
    return;
  }

  for (const [file, want, name] of [
    [PLAN_JSON, plan, 'plan.generated.json'],
    [CUT_MD, doc, 'CUT.generated.md'],
  ]) {
    if (!existsSync(file)) {
      console.error(`${name} does not exist. Run: npm run reel:plan`);
      process.exit(1);
    }
    if (readFileSync(file, 'utf8') !== want) {
      console.error(`${name} is out of date. Run: npm run reel:plan`);
      process.exit(1);
    }
  }
  console.log('plan is in sync');
}

main().catch((err) => {
  console.error(`reel:plan: ${err.message}`);
  process.exit(1);
});
