/**
 * Assert that the reel's margin is never blank.
 *
 *   node .storybook/scripts/check-margin.mjs [clips/reel.json]
 *
 * The specific regression this pins: the first cut called `clearCaption()` at the
 * end of most beats and kept filming, so the left 45% of a 1920x1080 frame sat
 * empty for seconds at a time. Stills at t=33s and t=128s were blank from the
 * rail to the panel, and nothing in `reel.json` reported it — every beat was
 * `ok: true`, because a beat that says nothing still lands.
 *
 * So the check samples the margin at each beat boundary rather than trusting the
 * manifest: it seeks the clip to every `at` in `reel.json`, reads the margin
 * region off a canvas, and counts pixels brighter than the ink backdrop. A
 * chapter fills the whole frame and is skipped by the same measure — it is not
 * an empty margin, it is a different register.
 *
 * Decoding is Chrome's, not ffmpeg's, which this repo does not depend on. Same
 * technique as `frames.mjs`.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const manifestPath = path.resolve(process.argv[2] ?? 'clips/reel.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const clip = path.resolve(path.dirname(manifestPath), '..', manifest.file);

/** The margin: from just right of the rail to just left of the panel. */
const REGION = { x: 120, y: 90, w: 720, h: 900 };

/** How far above the ink backdrop a pixel has to be to count as content. */
const INK_LUMA = 24;
/** Below this many lit pixels the margin is empty for practical purposes. */
const MIN_LIT = 400;

const htmlPath = path.join(path.dirname(clip), '.check-margin.html');
await writeFile(
  htmlPath,
  `<style>html,body{margin:0;background:#000}video{width:1920px;height:1080px;display:block}</style>` +
    `<video id="v" src="${path.basename(clip)}"></video><canvas id="c" width="1920" height="1080"></canvas>`,
);

// `getImageData` on a canvas that has drawn a `file://` video taints it, and the
// whole check is a pixel read. `frames.mjs` gets away without this because it
// screenshots rather than reading back.
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${htmlPath}`);
await page.waitForFunction(
  () => {
    const v = document.getElementById('v');
    return v && v.readyState >= 2;
  },
  { timeout: 30_000 },
);

const duration = await page.evaluate(() => document.getElementById('v').duration);

/** Every beat boundary, plus a probe one second in where a beat is long enough. */
const samples = [];
for (const chapter of manifest.chapters ?? []) {
  for (const beat of chapter.beats ?? []) {
    samples.push({ id: `${chapter.id}/${beat.name}`, at: beat.at / 1000 });
    samples.push({ id: `${chapter.id}/${beat.name}+1s`, at: beat.at / 1000 + 1 });
  }
}

/** Count pixels in `region` at `at` that are brighter than the ink backdrop. */
async function litPixels(at, region) {
  return page.evaluate(
    async ([at, region, inkLuma]) => {
      const v = document.getElementById('v');
      await new Promise((res) => {
        v.onseeked = () => res();
        v.currentTime = at;
      });
      const c = document.getElementById('c');
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, 1920, 1080);
      const { data } = ctx.getImageData(region.x, region.y, region.w, region.h);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Rec. 601 luma is plenty here: the question is only "is anything drawn
        // on top of the backdrop", not what colour it is.
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luma > inkLuma + 18) count += 1;
      }
      return count;
    },
    [at, region, INK_LUMA],
  );
}

const blank = [];
for (const sample of samples) {
  if (sample.at >= duration - 0.1) continue;
  const lit = await litPixels(sample.at, REGION);
  const state = lit < MIN_LIT ? 'BLANK' : 'ok';
  if (state === 'BLANK') blank.push({ ...sample, lit });
  console.log(
    `  ${state.padEnd(5)} ${sample.at.toFixed(1).padStart(6)}s  ${String(lit).padStart(7)} lit  ${sample.id}`,
  );
}

/**
 * The control: the dead strip left of the rail, which is ink at every frame.
 *
 * Without it this script is unfalsifiable — a detector that returns "lit" for
 * everything would report a clean run over the very cut this check exists to
 * catch. If the control ever reads as populated, the threshold is wrong and the
 * `ok` lines above mean nothing.
 */
const CONTROL = { x: 0, y: 90, w: 88, h: 900 };
const controls = [];
for (const at of [duration * 0.25, duration * 0.5, duration * 0.75]) {
  controls.push({ at, lit: await litPixels(at, CONTROL) });
}

await browser.close();
await unlink(htmlPath);

console.log(`\ncontrol strip (left of the rail, must read empty):`);
for (const c of controls)
  console.log(`  ${c.at.toFixed(1).padStart(6)}s  ${String(c.lit).padStart(7)} lit`);
if (controls.some((c) => c.lit >= MIN_LIT)) {
  console.error(
    `\ncontrol region read as populated — the threshold is wrong and every "ok" above is meaningless`,
  );
  process.exit(2);
}

console.log(`\n${samples.length} sample(s) across ${duration.toFixed(1)}s`);
if (blank.length) {
  console.error(`\n${blank.length} sample(s) had a blank margin:`);
  for (const b of blank) console.error(`  ${b.at.toFixed(1)}s  ${b.id}  (${b.lit} lit)`);
  process.exit(1);
}
console.log('margin populated at every beat boundary');
