/**
 * Film the chapters. One clip and one manifest each, nothing composited.
 *
 *   npm run capture              # every chapter whose inputs changed
 *   npm run capture -- groups    # just that one
 *   npm run capture -- --all     # ignore the staleness cache
 *   npm run capture -- --headed  # watch it drive
 *
 * This replaces `film-scenes.mjs`, and it is about a fifth of the size because
 * it does a fifth of the work: no camera, no chapter cards, no margin, no title
 * or end card, and — the big one — **no clock reconciliation**. The old runner
 * carried a forty-line essay about three clocks because it stamped beats in
 * Node wall time and asserted that equalled video seconds. Here the screencast
 * hands back the epoch timestamp of its own first frame, so clip-local ms is a
 * subtraction and there is exactly one clock.
 *
 * ## Why one context per chapter
 *
 * Because a chapter is now an independent unit. The old reel walked every scene
 * on one page for one continuous recording, which is what made a one-word
 * caption change cost a full 162-second shoot. Separate contexts mean a chapter
 * re-films in about ten seconds and the composition concatenates.
 *
 * @module
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connect, shutdownFor, REPO } from '../lib/storybook-server.mjs';
import { findChapters } from './chapters.mjs';
import { createDriver, registerEngines, hold } from './drive.mjs';
import { instrumentInit, SHIFT_EPS_PX } from './instrument.mjs';
import { FPS, startScreencast } from './screencast.mjs';
import { PANEL, RENDER_SCALE, RETIME, stageInit, verifyStage } from './stage.mjs';
import { READY, SCROLL_ROOT } from './selectors.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const filters = argv.filter((a) => !a.startsWith('--'));

const HEADED = flag('headed');
const FORCE = flag('all') || flag('force');
const OUT = path.resolve(REPO, 'captures');

/**
 * Manifest schema version. Asserted on by the composition, never branched on.
 *
 * Bump it whenever the *shape* of what is written changes, not just the walks.
 * The fingerprint covers a chapter's inputs — its walk, the driver, the demo
 * org — and deliberately not this file, so a change to what gets recorded here
 * would otherwise leave every existing manifest reading `unchanged`. That is
 * the mechanism: `SCHEMA` is how this file invalidates its own output.
 *
 * 2 — layout shifts and declared-motion windows are clip-local ms, not epoch.
 * 3 — the instrument samples the app scroller, so `check.mjs` can see a scroll
 *     nobody asked for. A layout shift and a scroll are different events and
 *     the Layout Instability API only reports the first.
 *
 * Deliberately *not* bumped when the `chrome` measurement was dropped. The
 * field went away because the composition stopped cropping the app's own rail
 * off the top, not because any footage went stale, and an already-filmed
 * manifest carrying one extra key it no longer reads is not a reason to re-shoot
 * seven chapters. The rule this version guards is "old clip under new captions";
 * that is not what happened.
 */
const SCHEMA = 4;

/**
 * Files whose contents decide whether a chapter's clip is stale.
 *
 * A chapter re-films when its walk, the driver, the stage, or the demo org
 * changes — and not otherwise. Getting this list wrong in the safe direction
 * costs a re-shoot; getting it wrong in the unsafe direction ships a clip of
 * the old app under new captions, which is exactly the failure mode that is
 * invisible until someone watches the whole reel.
 */
const SHARED_INPUTS = [
  'src/sidepanel/demo',
  '.storybook/scripts/capture/drive.mjs',
  '.storybook/scripts/capture/stage.mjs',
  '.storybook/scripts/capture/selectors.mjs',
  '.storybook/scripts/capture/instrument.mjs',
];

/** Hash a file or a directory tree, so a changed fixture invalidates a clip. */
async function hashPath(target, hash) {
  const { readdir, stat } = await import('node:fs/promises');
  const info = await stat(target).catch(() => null);
  if (!info) return;
  if (info.isDirectory()) {
    for (const entry of (await readdir(target)).sort()) {
      await hashPath(path.join(target, entry), hash);
    }
    return;
  }
  hash.update(target);
  hash.update(await readFile(target));
}

async function fingerprint(chapter) {
  const hash = createHash('sha256');
  hash.update(`v${SCHEMA}|scale=${RENDER_SCALE}|retime=${RETIME}|fps=${FPS}`);
  hash.update(JSON.stringify({ id: chapter.id, story: chapter.story, ready: chapter.ready ?? '' }));
  for (const input of [...SHARED_INPUTS, `.storybook/scripts/capture/walks/${chapter.id}.mjs`]) {
    await hashPath(path.resolve(REPO, input), hash);
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Wait for the stage to be worth filming.
 *
 * Deliberately **not** Storybook's `storyRendered`: it fires only after
 * `waitForAnimations`, and a scroll-driven `.dock-band` holds that open for its
 * full 5s ceiling because its `finished` promise resolves at 100% range
 * progress. Wait on real content instead.
 */
async function awaitStage(page, chapter) {
  const anchor = chapter.ready ?? READY[chapter.id];
  if (anchor) {
    await page.locator(anchor).first().waitFor({ state: 'visible', timeout: 30_000 });
  } else {
    await page.waitForFunction(
      ([selector, chars]) => (document.querySelector(selector)?.textContent ?? '').length > chars,
      [SCROLL_ROOT, READY.contentChars],
      { timeout: 30_000 },
    );
  }
  // Inter is a swap-loaded variable font with no preload, so the whole panel
  // re-measures once when the real face lands and every string beside it
  // re-wraps. No per-beat settle can wait that out — but it happens once per
  // navigation, so a single await here covers the entire chapter.
  await page.evaluate(() => document.fonts.ready);
}

async function filmChapter(browser, url, chapter) {
  const context = await browser.newContext({
    viewport: { width: PANEL.width * RENDER_SCALE, height: PANEL.height * RENDER_SCALE },
    deviceScaleFactor: 1,
    // Fatal if reduced. The app reads prefers-reduced-motion in JS as well as
    // CSS, so useStaggerReveal bails outright and useCountUp skips its
    // animation — filming with it produces footage of a product that does not
    // move, and nothing about that looks like an error.
    reducedMotion: 'no-preference',
  });
  // Both before the first navigation. Recording begins the moment the page
  // exists, and an init script is the only hook that runs before page scripts.
  await context.addInitScript({ content: stageInit(RENDER_SCALE, RETIME) });
  await context.addInitScript({ content: instrumentInit(RENDER_SCALE) });

  const page = await context.newPage();
  page.setDefaultTimeout(4000);

  const clip = path.join(OUT, `${chapter.id}.mp4`);
  const trace = { pointer: [], figures: {} };
  const beats = [];
  let recorder = null;
  /** Did the walk reach its end? Written to the manifest; see the staleness check. */
  let complete = false;
  /** Clip-local ms. Undefined before the first frame, which no beat may precede. */
  // Rounded: the screencast's origin is a float epoch, so an unrounded
  // subtraction yields values like 22.829833984375 — noise in every manifest,
  // and misleading precision on a 60fps grid where one frame is 16.7ms.
  const now = () => (recorder?.startedAt() ? Math.round(Date.now() - recorder.startedAt()) : 0);

  try {
    await page.goto(`${url}/iframe.html?id=${chapter.story}&viewMode=story`, {
      waitUntil: 'domcontentloaded',
    });
    await awaitStage(page, chapter);

    // Refuse rather than film it wrong. Every fault this catches — an
    // uninstalled stylesheet, an unscaled root, a scroller sized to the
    // viewport — produces a clip that plays perfectly and shows the wrong
    // thing, so assuming is not an option.
    const stage = await verifyStage(page, RENDER_SCALE);
    if (!stage.ok) {
      throw new Error(`stage is wrong:\n    - ${stage.problems.join('\n    - ')}`);
    }

    // Settle before rolling, so the clip opens on a still panel rather than on
    // the tail of the stagger the navigation kicked off.
    await hold(600);

    recorder = await startScreencast(page, clip);
    const drive = createDriver(page, { scale: RENDER_SCALE, panel: PANEL, now, trace });

    /** Record one named beat and the window it occupied. */
    const beat = async (name, fn) => {
      const at = now();
      let ok = true;
      let error = null;
      try {
        await fn();
      } catch (err) {
        ok = false;
        error = String(err?.message ?? err);
      }
      beats.push({ name, at, endAt: now(), ok, ...(error ? { error } : {}) });
      // A missed mark ends the chapter. The old system filmed on through a
      // failed beat and wrote `ok: false` into a manifest nobody read until the
      // footage was already wrong.
      if (!ok) throw new Error(`beat "${name}": ${error}`);
    };

    const { walk } = await chapter.walk();
    await walk({ page, drive, beat, chapter });
    // A closing hold, so the chapter does not cut on the last frame of motion.
    await hold(900);
    complete = true;
  } finally {
    if (recorder) {
      const report = await recorder.stop();
      const raw = await page.evaluate(() => window.__CAP__?.report() ?? null).catch(() => null);
      // The recorder stamps layout shifts in epoch ms, because in-page code has
      // no idea when the first frame landed. Everything else in this manifest
      // is clip-local, and a guard that mixes the two silently compares a beat
      // at 7,351 against a shift at 1,787,867,900,323. Rebase here, where the
      // origin is known, rather than asking every reader to remember.
      const origin = recorder.startedAt();
      const instrument = raw && {
        ...raw,
        shifts: raw.shifts.map((s) => ({ ...s, at: Math.round(s.at - origin) })),
        scrolls: raw.scrolls.map((s) => ({ ...s, at: Math.round(s.at - origin) })),
        // Declared-motion windows are a `from`/`to` pair, not an instant.
        motion: raw.motion.map((m) => ({
          ...m,
          from: Math.round(m.from - origin),
          to: Math.round(m.to - origin),
        })),
      };
      await writeFile(
        path.join(OUT, `${chapter.id}.json`),
        `${JSON.stringify(
          {
            schema: SCHEMA,
            id: chapter.id,
            title: chapter.title,
            tab: chapter.tab,
            kind: chapter.kind,
            story: chapter.story,
            file: path.relative(REPO, clip),
            fingerprint: await fingerprint(chapter),
            // Whether the walk reached its end. The manifest is written from a
            // `finally`, so a chapter that threw still leaves one behind — and
            // without this flag its fingerprint matches on the next run and the
            // broken take is reported as `unchanged`. Measured: a failed
            // reporting shoot went green on the very next invocation.
            ok: complete,
            // Geometry the composition needs to place and scale the texture.
            panel: PANEL,
            // Panel pixels of rail and context bar at the top, which the
            // composition crops away because it draws the rail itself.
            renderScale: RENDER_SCALE,
            fps: FPS,
            // The speed-ramp basis. The app was filmed this many times slower
            // than life, so the composition plays it back at this rate to
            // restore natural speed — and anything below that rate is genuine
            // slow motion with real frames behind it. The composition cannot
            // infer this, and a wrong guess mistimes every chapter.
            retime: RETIME,
            durationMs: report.durationMs,
            frames: report.frames,
            realFrames: report.received,
            beats,
            pointer: trace.pointer,
            figures: trace.figures,
            shiftEpsPx: SHIFT_EPS_PX,
            instrument,
          },
          null,
          2,
        )}\n`,
      );
    }
    await context.close();
  }
}

/* --- Runner -------------------------------------------------------------- */

await mkdir(OUT, { recursive: true });
const chapters = findChapters(filters);
if (chapters.length === 0) {
  console.error(`no chapter matched ${filters.join(', ')}`);
  process.exit(1);
}

// Decide staleness before starting a browser, so an entirely-warm run costs
// nothing but a few file hashes.
const work = [];
for (const chapter of chapters) {
  const want = await fingerprint(chapter);
  const existing = await readFile(path.join(OUT, `${chapter.id}.json`), 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => null);
  if (!FORCE && existing?.ok && existing?.fingerprint === want && existing?.schema === SCHEMA) {
    console.log(`  = ${chapter.id.padEnd(12)} unchanged`);
    continue;
  }
  work.push(chapter);
}

if (work.length === 0) {
  console.log('\nevery chapter is current. --all to re-film anyway.');
  process.exit(0);
}

const { url, child } = await connect();
const stopServer = shutdownFor(child);
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });
await registerEngines();

const failures = [];
for (const chapter of work) {
  const started = Date.now();
  process.stdout.write(`  · ${chapter.id.padEnd(12)} `);
  try {
    await filmChapter(browser, url, chapter);
    console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.log('FAILED');
    console.log(`      ${String(err?.message ?? err).replace(/\n/g, '\n      ')}`);
    failures.push(chapter.id);
  }
}

await browser.close();
stopServer();

if (failures.length) {
  console.log(`\n${failures.length} chapter(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`\n${work.length} chapter(s) → ${path.relative(REPO, OUT)}/`);
