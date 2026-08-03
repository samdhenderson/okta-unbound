/**
 * Screenshot Storybook stories headlessly, in one command.
 *
 *   npm run shoot -- Shared/Button           # all Button variants → ONE contact sheet
 *   npm run shoot -- shared-button--loading  # a single story, by id
 *   npm run shoot -- Rules --list            # ids only, no browser launch
 *   npm run shoot -- Modal --split           # one PNG per story instead of a sheet
 *
 * Filters are case-insensitive substring matches against `Title/StoryName`; an
 * exact story id also matches. At least one filter is required — this is a "show
 * me this component" tool, not a full-catalog snapshotter.
 *
 * Output is tuned for being READ BY AN AGENT, where every pixel costs context:
 *   - each story is cropped to its rendered content, not the empty panel around it
 *   - multiple matches compose into a single labelled sheet, so reviewing ten
 *     variants costs one image instead of ten
 *   - cells are capped in width, so a sheet stays legible without being huge
 *
 * Reuses a Storybook dev server on :6006 if one is up, else starts a throwaway one
 * on a free port and stops it on exit. Renders in system Chrome
 * (`channel: 'chrome'`), so Playwright's managed browsers need not be downloaded.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const filters = argv.filter((a) => !a.startsWith('--'));

const LIST = flag('list');
const SPLIT = flag('split');
const WIDTH = Number(opt('width', 480)); // the `sidepanelDefault` viewport preset
const HEIGHT = Number(opt('height', 900));
const MAX = Number(opt('max', 12));
const CELL = Number(opt('cell', 320)); // max on-sheet width of one story
const OUT = path.resolve(REPO, opt('out', 'shots'));

const USAGE =
  'usage: npm run shoot -- <filter…> [--list] [--split] [--max=12] [--width=480] [--cell=320] [--out=shots]\n' +
  '  filter: substring of "Title/StoryName", or an exact story id';

if (!filters.length) {
  console.error(USAGE);
  process.exit(1);
}

/** Resolve a free TCP port (0 = let the OS pick). */
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

/** A Storybook index.json we can enumerate, or null if nothing is listening. */
async function probe(url) {
  try {
    const res = await fetch(`${url}/index.json`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.entries ? json : null;
  } catch {
    return null;
  }
}

/** Reuse a running dev server, else start one we own and must clean up. */
async function connect() {
  const preset = process.env.SB_URL ?? 'http://localhost:6006';
  const running = await probe(preset);
  if (running) return { url: preset, index: running, child: null };

  const port = await freePort();
  const url = `http://localhost:${port}`;
  console.log(
    `no storybook on :6006 — starting one on :${port} (seconds if Vite's cache is warm, up to a minute if not).\n` +
      `tip: keep \`npm run storybook\` running and this step is skipped.`,
  );
  // `detached` + `unref` for two reasons: an attached ChildProcess handle keeps
  // Node's event loop alive, so the script would hang forever waiting on a server
  // it never gets around to killing; and its own process group lets us signal
  // storybook AND the node it forks in one shot.
  const child = spawn(
    path.join(REPO, 'node_modules/.bin/storybook'),
    ['dev', '-p', String(port), '--no-open', '--quiet', '--ci'],
    { cwd: REPO, stdio: 'ignore', detached: true },
  );
  child.unref();
  child.on('error', (err) => {
    console.error(`\nfailed to start storybook: ${err.message}`);
    process.exit(1);
  });

  const started = Date.now();
  const deadline = started + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      console.error(`storybook exited with code ${child.exitCode}`);
      process.exit(1);
    }
    const index = await probe(url);
    const secs = Math.round((Date.now() - started) / 1000);
    if (index) {
      console.log(`storybook ready in ${secs}s`);
      return { url, index, child };
    }
    if (secs && secs % 10 === 0) console.log(`  …still booting (${secs}s)`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  console.error('storybook did not become ready within 180s');
  process.exit(1);
}

const { url, index, child } = await connect();

/** Stop the server we started (never one that was already running). */
const shutdown = () => {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
};
process.on('exit', shutdown);
process.on('SIGINT', () => process.exit(130));

const matches = (s) => {
  const label = `${s.title}/${s.name}`.toLowerCase();
  return filters.some((f) => s.id === f || label.includes(f.toLowerCase()));
};
const all = Object.values(index.entries)
  .filter((e) => e.type === 'story')
  .filter(matches);

if (!all.length) {
  console.error(`no story matched ${filters.map((f) => `"${f}"`).join(', ')}`);
  process.exit(1);
}
if (LIST) {
  for (const s of all) console.log(`${s.id}\t${s.title}/${s.name}`);
  process.exit(0);
}

// Cap up front and SAY SO — a silently truncated sheet reads as complete coverage.
const stories = all.slice(0, MAX);
if (all.length > stories.length) {
  console.log(`${all.length} matched; showing first ${stories.length} (raise with --max=)`);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// System Chrome — Playwright's own browser download is not part of `npm ci`
// (see the VITEST_BROWSER_EXECUTABLE note in vitest.config.ts).
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

/**
 * Union bounding box of every visible top-level element, padded. Spans `body > *`
 * rather than `#storybook-root` alone because modals portal outside the root; a
 * `layout: 'centered'` story therefore crops to its component instead of paying
 * for a mostly-empty 480×900 panel.
 */
const contentBox = () =>
  page.evaluate(() => {
    let l = Infinity,
      t = Infinity,
      r = -Infinity,
      b = -Infinity;
    for (const el of document.body.children) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      l = Math.min(l, box.left);
      t = Math.min(t, box.top);
      r = Math.max(r, box.right);
      b = Math.max(b, box.bottom);
    }
    if (l === Infinity) return null;
    const pad = 12;
    const x = Math.max(0, l - pad);
    const y = Math.max(0, t - pad);
    return {
      x,
      y,
      width: Math.min(window.innerWidth, r + pad) - x,
      height: Math.min(window.innerHeight, b + pad) - y,
    };
  });

const shots = [];
for (const s of stories) {
  // Play functions run in the canvas, so the mocked Loading/Empty/ErrorState
  // variants capture in their real state rather than falling back to defaults.
  await page.goto(`${url}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#storybook-root > *', { timeout: 15_000 }).catch(() => {});
  // No measurable box means the story is all `position: fixed` (a modal overlay
  // contributes no height to its portal wrapper) — full-viewport is right there.
  const clip = await contentBox();
  const png = await page.screenshot(clip ? { clip } : { fullPage: true });
  shots.push({ story: s, png });
  if (SPLIT || stories.length === 1) await writeFile(path.join(OUT, `${s.id}.png`), png);
}

/**
 * Compose the captures into one labelled sheet — one image to read, not N. A
 * fixed column grid keeps cells aligned, and the viewport is trimmed to the
 * composed height so the sheet carries no blank margin (blank pixels cost the
 * same context as rendered ones).
 */
async function writeSheet() {
  const cols = Math.min(Math.ceil(Math.sqrt(shots.length)), 3);
  const cells = shots
    .map(
      ({ story, png }) =>
        `<figure><figcaption>${story.name}</figcaption>` +
        `<img src="data:image/png;base64,${png.toString('base64')}"></figure>`,
    )
    .join('');
  const width = cols * CELL + (cols - 1) * 16 + 32;
  await page.setViewportSize({ width, height: 600 });
  await page.setContent(
    `<style>
       body{margin:0;padding:16px;background:#fff;font:600 12px/1.4 ui-sans-serif,system-ui;color:#1d1d21}
       main{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
       figure{margin:0;max-width:${CELL}px}
       figcaption{padding:0 0 4px;color:#6e6e78}
       img{display:block;max-width:100%;border:1px solid #e0e0e5;border-radius:4px}
     </style>
     <h1 style="font-size:13px;margin:0 0 12px">${shots[0].story.title}</h1>
     <main>${cells}</main>`,
  );
  // Clip to what was actually laid out: `fullPage` would pad the sheet out to the
  // viewport box, and blank pixels cost an agent the same context as drawn ones.
  const box = await page.evaluate(() => {
    let r = 0,
      b = 0;
    for (const el of document.querySelectorAll('h1, figure')) {
      const rect = el.getBoundingClientRect();
      r = Math.max(r, rect.right);
      b = Math.max(b, rect.bottom);
    }
    return { x: 0, y: 0, width: Math.ceil(r) + 16, height: Math.ceil(b) + 16 };
  });
  await page.setViewportSize({ width: box.width, height: box.height });
  const file = path.join(OUT, 'sheet.png');
  await page.screenshot({ path: file, clip: box });
  return file;
}

const result = stories.length === 1 ? path.join(OUT, `${stories[0].id}.png`) : await writeSheet();

await browser.close();
shutdown();
console.log(
  SPLIT || stories.length === 1
    ? `${stories.length} → ${OUT}`
    : `${stories.length} stories → ${result}`,
);
