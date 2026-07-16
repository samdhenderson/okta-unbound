/**
 * Bundle the TypeDoc-markdown output (.storybook/generated/api, one file per
 * symbol — hundreds) into a handful of per-subsystem markdown files
 * (.storybook/generated/internals/<slug>.md) that the `Internals/*` Storybook
 * MDX pages render. Run by `npm run docs` after typedoc.
 *
 * Inter-file relative links (`[Foo](../interfaces/Foo.md)`) are flattened to
 * plain text since the target files don't exist in the concatenated page.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(here, '../generated/api');
const OUT_DIR = path.resolve(here, '../generated/internals');

// Ordered subsystem buckets; first prefix match wins.
const SUBSYSTEMS = [
  { slug: 'hooks', title: 'Hooks', match: (p) => p.startsWith('sidepanel/hooks') },
  { slug: 'contexts', title: 'Contexts', match: (p) => p.startsWith('sidepanel/contexts') },
  {
    slug: 'scheduler',
    title: 'Scheduler & messaging',
    match: (p) => p.startsWith('shared/scheduler'),
  },
  { slug: 'rules', title: 'Rules engine', match: (p) => p.startsWith('shared/rules') },
  {
    slug: 'storage-cache',
    title: 'Storage & cache',
    match: (p) =>
      p.startsWith('shared/storage') ||
      p.startsWith('shared/cache') ||
      p.startsWith('sidepanel/cache'),
  },
  { slug: 'utils', title: 'Shared utilities', match: (p) => p.startsWith('shared/utils') },
  { slug: 'types', title: 'Types', match: (p) => p.startsWith('shared/types') },
  {
    slug: 'background',
    title: 'Background service worker',
    match: (p) => p.startsWith('background'),
  },
  { slug: 'content', title: 'Content script', match: (p) => p.startsWith('content') },
  { slug: 'shared-misc', title: 'Shared (other)', match: (p) => p.startsWith('shared') },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Flatten relative .md links to their text; keep http(s) links. */
function flattenLinks(md) {
  return md.replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1');
}

function main() {
  const files = walk(API_DIR).sort();
  const buckets = new Map(SUBSYSTEMS.map((s) => [s.slug, []]));

  for (const file of files) {
    const rel = path.relative(API_DIR, file).split(path.sep).join('/');
    if (/(^|\/)README\.md$/i.test(rel)) continue; // skip module index stubs
    const sub = SUBSYSTEMS.find((s) => s.match(rel));
    if (sub) buckets.get(sub.slug).push({ rel, file });
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  for (const sub of SUBSYSTEMS) {
    const entries = buckets.get(sub.slug);
    if (!entries.length) continue;
    const parts = [`# ${sub.title}\n`];
    for (const { rel, file } of entries) {
      const body = flattenLinks(readFileSync(file, 'utf8')).trim();
      parts.push(`\n\n---\n\n${body}`);
    }
    writeFileSync(path.join(OUT_DIR, `${sub.slug}.md`), parts.join('\n'), 'utf8');
    total += entries.length;
    // eslint-disable-next-line no-console
    console.log(`[internals] ${sub.slug}: ${entries.length} symbols`);
  }
  // eslint-disable-next-line no-console
  console.log(`[internals] bundled ${total} symbol pages into ${OUT_DIR}`);
}

main();
