/**
 * Acquire a Storybook dev server, reusing one if it is already up.
 *
 * Extracted verbatim from `shoot-stories.mjs`, which grew it first and now
 * imports it. `film-scenes.mjs` needs exactly the same lifecycle — reuse :6006
 * when a human already has it running, otherwise start a throwaway server on a
 * free port and take it down on exit — and two copies of a process-group kill is
 * one copy too many.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root, resolved from this file's location. */
export const REPO = path.resolve(here, '../../..');

/** Resolve a free TCP port (0 = let the OS pick). */
export const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

/** A Storybook index.json we can enumerate, or null if nothing is listening. */
export async function probe(url) {
  try {
    const res = await fetch(`${url}/index.json`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.entries ? json : null;
  } catch {
    return null;
  }
}

/**
 * Reuse a running dev server, else start one we own and must clean up.
 *
 * @returns `{ url, index, child }` — `child` is null when an existing server was
 * reused, which is the signal never to kill it.
 */
export async function connect() {
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

/** Build a shutdown hook that stops only a server we started ourselves. */
export function shutdownFor(child) {
  return () => {
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  };
}
