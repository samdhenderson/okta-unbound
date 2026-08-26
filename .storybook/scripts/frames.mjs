/**
 * Pull still frames out of a recorded clip, for checking a take without playing it.
 *
 *   node .storybook/scripts/frames.mjs clips/okta-unbound-reel.webm out/ 2 30 61
 *
 * Decoding is done by Chrome rather than ffmpeg, which this repo does not depend
 * on: the clip is loaded into a `<video>` from a `file://` page, seeked to each
 * timestamp, and screenshotted. Slower than ffmpeg and entirely sufficient for
 * confirming that a beat landed where the manifest says it did.
 */
import { chromium } from 'playwright';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
const [file, outDir, ...times] = process.argv.slice(2);
const abs = path.resolve(file);
const htmlPath = path.join(path.dirname(abs), '.frames.html');
await writeFile(htmlPath, `<style>html,body{margin:0;background:#000}video{width:1920px;height:1080px;display:block}</style><video id="v" src="${path.basename(abs)}"></video>`);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${htmlPath}`);
await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, { timeout: 30000 });
const dur = await page.evaluate(() => document.getElementById('v').duration);
console.log('duration', dur.toFixed(1), 's');
for (const t of times) {
  const at = Math.min(Number(t), dur - 0.05);
  await page.evaluate((s) => new Promise((res) => { const v = document.getElementById('v'); v.onseeked = () => res(); v.currentTime = s; }), at);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, `f-${String(t).padStart(5,'0')}.png`) });
}
await browser.close();
await unlink(htmlPath);
