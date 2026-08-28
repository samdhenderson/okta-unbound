/**
 * Look at a chapter's stage the way the camera will.
 *
 *   npm run probe -- groups
 *   npm run probe -- groups --click="Engineering - All" --click="membership comes from"
 *   npm run probe -- rules --shot
 *   npm run probe -- compare --tab=users --scroll=400
 *
 * This is how every selector in `selectors.mjs` was found, and the rule that
 * goes with it is: **probe it, do not reason about the JSX.** The groups chapter
 * is the standing argument for that rule — the old choreography clicks a Members
 * tab strip that `cb6abea` deleted, and it fails by clicking whatever is painted
 * over the mounted ghost rather than by finding nothing.
 *
 * It differs from the `probe-scene.mjs` it replaces in the way that matters: it
 * opens the page under the **real capture geometry** — 840x980 laid out, scaled
 * to the render size — so what it reports is what the camera will see. A probe
 * run against a different viewport answers a question nobody asked.
 *
 * What it prints, and why each column:
 *   - **onstage** — the element's centre is inside the frame. Both rungs of a
 *     tab stay mounted (ADR-0016), so a great many real elements are not.
 *   - **covered** — `elementFromPoint` at the centre resolves to something else.
 *     This is the column that catches a mounted ghost, and it is the reason
 *     "the selector matched" is not evidence that a click will land.
 *
 * @module
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { connect, shutdownFor, REPO } from '../lib/storybook-server.mjs';
import { CHAPTERS, findChapters } from './chapters.mjs';
import { instrumentInit } from './instrument.mjs';
import { PANEL, RENDER_SCALE, RETIME, stageInit, verifyStage } from './stage.mjs';
import { READY, SCROLL_ROOT } from './selectors.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
/** Every `--click=` / `--scroll=`, in the order given, so a probe can walk in. */
const steps = argv
  .filter((a) => /^--(click|clickSel|scroll|type|wait)=/.test(a))
  .map((a) => {
    const [, kind, value] = /^--(\w+)=(.*)$/.exec(a);
    return { kind, value: value.replace(/^["']|["']$/g, '') };
  });

const [id] = argv.filter((a) => !a.startsWith('--'));
if (!id) {
  console.error(`usage: npm run probe -- <chapter>\n\n  ${CHAPTERS.map((c) => c.id).join('\n  ')}`);
  process.exit(1);
}
const chapter = findChapters([id])[0];
if (!chapter) {
  console.error(`no chapter "${id}". known: ${CHAPTERS.map((c) => c.id).join(', ')}`);
  process.exit(1);
}

const { url, child } = await connect();
const stopServer = shutdownFor(child);
const browser = await chromium.launch({ channel: 'chrome', headless: !flag('headed') });
const context = await browser.newContext({
  viewport: { width: PANEL.width * RENDER_SCALE, height: PANEL.height * RENDER_SCALE },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
});
await context.addInitScript({ content: stageInit(RENDER_SCALE, RETIME) });
await context.addInitScript({ content: instrumentInit(RENDER_SCALE) });
const page = await context.newPage();

await page.goto(`${url}/iframe.html?id=${chapter.story}&viewMode=story`, {
  waitUntil: 'domcontentloaded',
});
const anchor = chapter.ready ?? READY[chapter.id];
if (anchor) {
  await page.locator(anchor).first().waitFor({ state: 'visible', timeout: 30_000 });
} else {
  await page.waitForFunction(
    ([sel, chars]) => (document.querySelector(sel)?.textContent ?? '').length > chars,
    [SCROLL_ROOT, READY.contentChars],
    { timeout: 30_000 },
  );
}
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const stage = await verifyStage(page, RENDER_SCALE);
console.log(`\n${chapter.id} — ${chapter.story}`);
console.log(
  `stage ${stage.ok ? 'ok' : 'BROKEN'}  ${PANEL.width}x${PANEL.height} laid out, ` +
    `${PANEL.width * RENDER_SCALE}x${PANEL.height * RENDER_SCALE} rendered`,
);
for (const problem of stage.problems) console.log(`  ! ${problem}`);

/** Walk the page in, so a probe can inspect a state two clicks deep. */
for (const step of steps) {
  if (step.kind === 'click') {
    const target = page.getByRole('button', { name: new RegExp(step.value, 'i') }).first();
    await target.click({ timeout: 8000 }).catch((err) => {
      console.log(`  ! click "${step.value}" failed: ${String(err.message).split('\n')[0]}`);
    });
    console.log(`  → clicked "${step.value}"`);
  } else if (step.kind === 'clickSel') {
    // By raw selector, for the many controls whose accessible name is not what
    // you would aim at — a group row is a full-bleed `[title=…]` overlay whose
    // aria-label is the generic "View group details".
    await page
      .locator(step.value)
      .first()
      .click({ timeout: 8000 })
      .catch((err) => {
        console.log(`  ! clickSel ${step.value} failed: ${String(err.message).split('\n')[0]}`);
      });
    console.log(`  → clicked ${step.value}`);
  } else if (step.kind === 'scroll') {
    await page.evaluate(
      ([sel, px]) => {
        const el = document.querySelector(sel);
        // Relative, and scrollIntoView-free: the probe has to be able to reach a
        // row without triggering the sticky-nav trap the driver exists to avoid.
        if (el) el.scrollTop += Number(px);
      },
      [SCROLL_ROOT, step.value],
    );
    console.log(`  → scrolled to ${step.value}`);
  } else if (step.kind === 'type') {
    const [selector, text] = step.value.split('|');
    await page.locator(selector).first().fill(text ?? '');
    console.log(`  → typed "${text}" into ${selector}`);
  } else if (step.kind === 'wait') {
    await page.waitForTimeout(Number(step.value));
  }
  await page.waitForTimeout(1400);
}

const report = await page.evaluate(() => {
  const centre = (el) => {
    const b = el.getBoundingClientRect();
    return { b, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
  };
  const describe = (el) => {
    const { b, cx, cy } = centre(el);
    if (b.width <= 0 || b.height <= 0) return null;
    const onstage = cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight;
    const under = onstage ? document.elementFromPoint(cx, cy) : null;
    const covered = Boolean(under) && under !== el && !el.contains(under);
    const name = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
    return {
      name: name.slice(0, 46),
      onstage,
      covered,
      coveredBy: covered
        ? `${String(under.tagName).toLowerCase()} "${(under.textContent || '').trim().slice(0, 22)}"`
        : '',
      // Panel-local, because that is the coordinate space a walk thinks in.
      y: Math.round(cy / (innerHeight / 980)),
    };
  };
  const collect = (selector) =>
    Array.from(document.querySelectorAll(selector))
      .map(describe)
      .filter(Boolean)
      .filter((r) => r.name);
  return {
    headings: collect('h1,h2,h3,h4'),
    buttons: collect('button'),
    tabs: collect('[role="tab"]'),
    inputs: Array.from(document.querySelectorAll('input,textarea'))
      .map((el) => {
        const d = describe(el);
        return d && { ...d, name: el.placeholder || el.getAttribute('aria-label') || el.name || '?' };
      })
      .filter(Boolean),
    testids: Array.from(document.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    ),
  };
});

const show = (label, rows) => {
  if (!rows.length) return;
  console.log(`\n${label} (${rows.filter((r) => r.onstage && !r.covered).length} clickable)`);
  for (const r of rows) {
    // Offstage rows are printed too, and dimmed by their marker: the whole
    // point is to make a mounted ghost visible rather than to hide it.
    const mark = !r.onstage ? '  offstage' : r.covered ? `  COVERED by ${r.coveredBy}` : '';
    console.log(`  ${String(r.y).padStart(5)}  ${r.name.padEnd(46)}${mark}`);
  }
};

show('headings', report.headings);
show('tabs', report.tabs);
show('buttons', report.buttons);
show('inputs', report.inputs);
console.log(`\ntestids: ${[...new Set(report.testids)].join(', ')}`);

if (flag('shot')) {
  const dest = path.join(REPO, 'captures', `probe-${chapter.id}.png`);
  await page.screenshot({ path: dest });
  console.log(`\nshot → ${path.relative(REPO, dest)}`);
}

await context.close();
await browser.close();
stopServer();
