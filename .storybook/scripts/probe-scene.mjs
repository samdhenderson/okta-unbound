/**
 * Print the interactive surface of a demo scene, so choreography targets real
 * elements instead of guessed ones.
 *
 *   node .storybook/scripts/probe-scene.mjs demo-scenes--group-drilldown
 *   node .storybook/scripts/probe-scene.mjs demo-scenes--group-drilldown --click="Engineering"
 *
 * Not part of the reel; a bench instrument.
 */
import { chromium } from 'playwright';
import { connect, shutdownFor } from './lib/storybook-server.mjs';

const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--')) ?? 'demo-scenes--group-drilldown';
const clickText = (argv.find((a) => a.startsWith('--click=')) ?? '').slice(8);
const width = Number((argv.find((a) => a.startsWith('--width=')) ?? '--width=480').slice(8));

const { url, child } = await connect();
process.on('exit', shutdownFor(child));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="app-scroll-root"]', { timeout: 30_000 });
await page.waitForTimeout(2500);

const dump = async (label) => {
  const found = await page.evaluate(() => {
    const out = { buttons: [], tabs: [], inputs: [], expandables: [], testids: [], headings: [] };
    const text = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      const t = text(el);
      if (t && !out.buttons.includes(t)) out.buttons.push(t);
    }
    for (const el of document.querySelectorAll('[role="tab"]')) {
      const t = text(el);
      if (t && !out.tabs.includes(t)) out.tabs.push(t);
    }
    for (const el of document.querySelectorAll('input, textarea')) {
      out.inputs.push(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.type);
    }
    for (const el of document.querySelectorAll('[aria-expanded]')) {
      out.expandables.push(`${el.getAttribute('aria-expanded')} :: ${text(el)}`);
    }
    for (const el of document.querySelectorAll('[data-testid]')) {
      const t = el.getAttribute('data-testid');
      if (t && !out.testids.includes(t)) out.testids.push(t);
    }
    for (const el of document.querySelectorAll('h1,h2,h3,h4')) {
      const t = text(el);
      if (t && !out.headings.includes(t)) out.headings.push(t);
    }
    return out;
  });
  console.log(`\n───────── ${label} ─────────`);
  for (const [key, values] of Object.entries(found)) {
    console.log(`\n  ${key} (${values.length}):`);
    for (const v of values.slice(0, 22)) console.log(`    ${v}`);
    if (values.length > 22) console.log(`    …${values.length - 22} more`);
  }
};

await dump(`${id} @ load`);

if (clickText) {
  const target = page.getByText(clickText, { exact: false }).first();
  await target.click({ timeout: 5000 }).catch((e) => console.log(`\nclick failed: ${e.message}`));
  await page.waitForTimeout(2500);
  await dump(`${id} after clicking "${clickText}"`);
}

await browser.close();
