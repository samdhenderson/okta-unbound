/**
 * Film the `Demo/` scenes to video, one 16:9 clip per scene.
 *
 *   npm run film                       # every scene → clips/*.webm
 *   npm run film -- drilldown          # just the scenes whose id/title matches
 *   npm run film -- --reel             # one continuous cut → clips/okta-unbound-reel.webm
 *   npm run film -- --headed           # watch it drive
 *   npm run film -- --out=takes        # somewhere other than clips/
 *
 * Sibling to `shoot-stories.mjs`, deliberately not a flag on it: that script sets
 * `reducedMotion: 'reduce'` at page creation, which is right for a screenshot and
 * fatal here. The app reads `prefers-reduced-motion` in JS as well as CSS, so
 * `useStaggerReveal` bails outright and `useCountUp` skips its animation —
 * filming with that flag produces footage of a product that does not move.
 *
 * The scenes carry no `play` functions (ADR-0043). They are stages; this is the
 * director. Movements live in `scenes/choreography.mjs`, the stage dressing in
 * `scenes/showcase.mjs`.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connect, shutdownFor, REPO } from './lib/storybook-server.mjs';
import { CHOREOGRAPHY, END_CARD, REEL_ORDER, SCENES } from './scenes/choreography.mjs';
import { PANEL, SHOWCASE_CSS, STAGE, installStage } from './scenes/showcase.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const filters = argv.filter((a) => !a.startsWith('--'));

const HEADED = flag('headed');
const REEL = flag('reel');
const OUT = path.resolve(REPO, opt('out', 'clips'));

/** How long a chapter holds the frame before the panel comes back. */
const CHAPTER_MS = 3400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { url, index, child } = await connect();
process.on('exit', shutdownFor(child));
process.on('SIGINT', () => process.exit(130));

const scenes = Object.values(index.entries)
  .filter((e) => e.type === 'story' && CHOREOGRAPHY[e.id])
  .filter((e) =>
    filters.length === 0
      ? true
      : filters.some(
          (f) => e.id === f || `${e.title}/${e.name}`.toLowerCase().includes(f.toLowerCase()),
        ),
  );

if (scenes.length === 0) {
  console.error(
    filters.length
      ? `no demo scene matched ${filters.map((f) => `"${f}"`).join(', ')}`
      : 'no demo scenes found — is scenes.stories.tsx present?',
  );
  process.exit(1);
}

/**
 * The stage, as one self-contained init script.
 *
 * `installStage` is closure-free by construction — it touches only `document`,
 * `window`, `addEventListener`, `setTimeout`, `clearTimeout`, `requestAnimationFrame` and
 * `performance` — so serializing it with `toString()` keeps `showcase.mjs` the
 * single source of truth rather than forcing a second, drifting copy inline here.
 */
const STAGE_INIT = `
  ${installStage.toString()}
  (() => {
    const apply = () => {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(SHOWCASE_CSS)};
      document.head.appendChild(style);
      installStage();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
      apply();
    }
  })();
`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });

/** Navigate to a scene. The init script has already dressed the stage. */
async function navigate(page, id) {
  await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
  // The chapter is driven through `window.__DEMO_STAGE__`, so it has to exist
  // before anything is asked of it. It is installed at DOMContentLoaded, which
  // is normally well before `networkidle` — this is a guard, not a wait.
  await page
    .waitForFunction(() => Boolean(window.__DEMO_STAGE__), { timeout: 10_000 })
    .catch(() => {});
}

/**
 * Wait until the scene is genuinely painted.
 *
 * `storyRendered` is the wrong signal: Storybook emits it only after
 * `waitForAnimations`, which a scroll-driven `.dock-band` holds open for its full
 * 5s ceiling (its `finished` promise resolves at 100% range progress), and after
 * the axe pass. Waiting on real content instead — the scroll root, then actual
 * rows — is both faster and honest about what "ready" means.
 */
async function awaitContent(page) {
  await page.waitForSelector('[data-testid="app-scroll-root"]', { timeout: 30_000 });
  // Content, not just the shell: the first cut opened on a white panel because
  // the scroll root exists well before anything has been read out of IndexedDB.
  await page
    .waitForFunction(
      () =>
        (document.querySelector('[data-testid="app-scroll-root"]')?.textContent ?? '').length > 400,
      { timeout: 15_000 },
    )
    .catch(() => {});
}

/**
 * Put the chapter up, load the scene underneath it, then hand over to the panel.
 *
 * The ordering is the point. The chapter goes up the moment the stage exists,
 * so the panel's load, its tab-load spinner, and anything a scene has to do
 * before it is fit to film (the Rules tab's explicit "No Rules Loaded" empty
 * state, which the previous cut filmed for a whole beat) all happen behind it.
 * The panel recedes and dims rather than being covered by an opaque card: same
 * concealment, and the frame keeps its depth.
 */
async function playChapter(page, id) {
  const meta = SCENES[id];
  await page.evaluate(() => window.__DEMO_STAGE__?.resetMargin());
  await page.evaluate((s) => window.__DEMO_STAGE__?.chapter(s), {
    label: meta?.label,
    title: meta?.title,
    blurb: meta?.blurb,
  });

  const started = Date.now();
  await awaitContent(page);
  if (meta?.prologue) {
    await meta.prologue(page).catch((err) => {
      console.warn(`\n    ! ${id}/prologue: ${err?.message ?? err}`);
    });
  }
  const remaining = CHAPTER_MS - (Date.now() - started);
  if (remaining > 0) await sleep(remaining);

  await page.evaluate(() => window.__DEMO_STAGE__?.dropChapter());
  await sleep(900);
  // Park off the panel: resting the pointer on a row would hold a hover state
  // through the scene's opening claim.
  await page.mouse.move(STAGE.width - PANEL.width - 260, STAGE.height / 2);
}

/**
 * The `beat` stamp handed to a choreography function.
 *
 * It also drives the rail, from the scene's **declared** beat list rather than
 * from a running count — which is why a beat name that is not in the declaration
 * is worth a warning: it means the rail and the choreography disagree about how
 * long the scene is, and the rail would stop short without anything failing.
 */
function makeBeat(page, id, sink, originMs) {
  const declared = SCENES[id]?.beats ?? [];
  let done = 0;
  return async (name, movement) => {
    const at = Date.now() - originMs;
    if (!declared.includes(name)) {
      console.warn(`\n    ! ${id}: beat "${name}" is not in its declared beats list`);
    }
    done += 1;
    await page
      .evaluate(
        (f) => window.__DEMO_STAGE__?.progress(f),
        declared.length ? done / declared.length : 1,
      )
      .catch(() => {});
    try {
      await movement();
      sink.push({ name, at, ok: true });
    } catch (err) {
      sink.push({ name, at, ok: false, error: String(err?.message ?? err) });
      console.warn(`\n    ! ${id}/${name}: ${err?.message ?? err}`);
    }
  };
}

// Warm Vite's optimizer on a throwaway page. Recording starts the instant a page
// is created, so without this every clip opens on white while the dev server
// discovers and pre-bundles the app's dependency graph.
{
  const warm = await browser.newContext({ viewport: STAGE });
  const page = await warm.newPage();
  await navigate(page, scenes[0].id).catch(() => {});
  await awaitContent(page).catch(() => {});
  await warm.close();
  console.log('optimizer warm');
}

const manifest = [];

if (REEL) {
  // One page, one continuous recording. Playwright finalizes a video per Page,
  // and a Page survives navigation — so walking the scenes in one page yields a
  // single publication-ready file with no post-production concatenation, which
  // matters because this repo has no ffmpeg to concatenate with.
  const ordered = REEL_ORDER.filter((id) => scenes.some((s) => s.id === id)).map((id) =>
    scenes.find((s) => s.id === id),
  );
  const context = await browser.newContext({
    viewport: STAGE,
    recordVideo: { dir: OUT, size: STAGE },
    deviceScaleFactor: 1,
  });
  await context.addInitScript({ content: STAGE_INIT });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);

  const reelStarted = Date.now();
  const chapters = [];

  for (const [i, scene] of ordered.entries()) {
    const at = Date.now() - reelStarted;
    process.stdout.write(`  ${i + 1}/${ordered.length} ${scene.name} … `);
    await navigate(page, scene.id);
    await playChapter(page, scene.id);

    const beats = [];
    await CHOREOGRAPHY[scene.id](page, makeBeat(page, scene.id, beats, reelStarted));
    await sleep(900);

    chapters.push({ id: scene.id, title: scene.name, at, beats });
    console.log(`${((Date.now() - reelStarted - at) / 1000).toFixed(1)}s`);
  }

  // End card, in the same chapter register as every scene break.
  await page.evaluate(() => window.__DEMO_STAGE__?.resetMargin());
  await page.evaluate((s) => window.__DEMO_STAGE__?.chapter(s), END_CARD);
  await sleep(3200);

  const video = page.video();
  await page.close();
  await context.close();
  const dest = path.join(OUT, 'okta-unbound-reel.webm');
  if (video) {
    await video.saveAs(dest);
    // saveAs copies; without this the raw `page@<hash>.webm` stays behind and the
    // output directory holds two of every clip.
    await video.delete().catch(() => {});
  }

  const totalMs = Date.now() - reelStarted;
  await writeFile(
    path.join(OUT, 'reel.json'),
    `${JSON.stringify({ file: path.relative(REPO, dest), stage: STAGE, durationMs: totalMs, chapters }, null, 2)}\n`,
  );
  await browser.close();

  const failed = chapters.flatMap((c) =>
    c.beats.filter((b) => !b.ok).map((b) => `${c.id}/${b.name}`),
  );
  console.log(`\nreel → ${path.relative(REPO, dest)}  (${(totalMs / 1000).toFixed(0)}s)`);
  console.log(`chapter marks → ${path.relative(REPO, path.join(OUT, 'reel.json'))}`);
  if (failed.length)
    console.log(`\n${failed.length} beat(s) did not land:\n  ${failed.join('\n  ')}`);
  process.exit(0);
}

for (const scene of scenes) {
  // recordVideo is a CONTEXT option and the file is finalized only on close,
  // hence one context per scene rather than one page on a shared context.
  const context = await browser.newContext({
    viewport: STAGE,
    recordVideo: { dir: OUT, size: STAGE },
    deviceScaleFactor: 1,
    // Deliberately NO reducedMotion — see the module note above.
  });

  // Dress the stage BEFORE the first navigation. Recording begins the moment the
  // page is created, so injecting after load meant every clip opened on several
  // seconds of un-staged, full-bleed white app — the single worst artefact in the
  // first cut. An init script runs before page scripts on every navigation, so
  // the backdrop and the framed panel exist from the first painted frame.
  await context.addInitScript({ content: STAGE_INIT });

  const page = await context.newPage();
  page.setDefaultTimeout(4000);

  process.stdout.write(`filming ${scene.title}/${scene.name} … `);
  await navigate(page, scene.id);
  // A standalone clip opens on its chapter too. It is trivially trimmable, and
  // it is what carries a scene's prologue — without it the rule-impact clip
  // films its own empty state.
  await playChapter(page, scene.id);

  const started = Date.now();
  const beats = [];
  await CHOREOGRAPHY[scene.id](page, makeBeat(page, scene.id, beats, started));

  const video = page.video();
  await page.close();
  await context.close();

  const dest = path.join(OUT, `${scene.id}.webm`);
  if (video) {
    await video.saveAs(dest);
    await video.delete().catch(() => {});
  }

  const durationMs = Date.now() - started;
  manifest.push({
    id: scene.id,
    title: `${scene.title}/${scene.name}`,
    file: path.relative(REPO, dest),
    stage: STAGE,
    durationMs,
    beats,
  });
  console.log(`${(durationMs / 1000).toFixed(1)}s → ${path.relative(REPO, dest)}`);
}

await browser.close();
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const missed = manifest.flatMap((m) =>
  m.beats.filter((b) => !b.ok).map((b) => `${m.id}/${b.name}`),
);
console.log(`\n${manifest.length} clip(s) → ${path.relative(REPO, OUT)}/`);
console.log(`beat timings → ${path.relative(REPO, path.join(OUT, 'manifest.json'))}`);
if (missed.length)
  console.log(`\n${missed.length} beat(s) did not land:\n  ${missed.join('\n  ')}`);
