/**
 * Fail if a doc or skill cites a `src/…` file that does not exist on disk.
 *
 * Why this exists: docs, ADRs, and `.claude/` skills/agents name source paths
 * as evidence — "see `src/shared/utils/oktaUrl.ts`" — so a reader (human or
 * agent) can go look. Nothing checked that those paths stay real. Five did
 * not: four files were deleted as dead code and one was renamed, and the
 * citing prose kept naming the old locations. A doc confidently pointing at
 * a file that no longer exists is worse than no doc — it sends the next
 * reader hunting for something that was deliberately removed.
 *
 * Scope: tracked `.md` files under `docs/` and `.claude/`, the two root
 * pointer files (`CLAUDE.md`, `AGENTS.md`), and the root ledgers the nightly
 * maintenance system runs on — `DEBT.md`, `IMPROVEMENTS.md`, `SESSION.md`,
 * `CONVENTIONS.md`. The ledgers matter most of all: a nightly session picks
 * its work *by an item's Files list*, so a stale path there does not merely
 * misinform a reader, it mis-routes the machinery — it is how disjointness
 * is judged and how off-limits directories are recognised.
 *
 * Citations are read in the two forms that actually occur in this corpus — a
 * backticked span (`` `src/foo/bar.ts` ``) or a markdown link target
 * (`[text](../src/foo/bar.ts)`) — resolved relative to the citing file first
 * (docs use `../src/…`), then re-tried from the repo root (agent/skill files
 * under `.claude/` cite bare `src/…`). A citation may carry a line-number
 * suffix (`` `src/foo/bar.ts:311` ``, `:103-125`, `:120,125,161-175`), which
 * the ledgers use constantly to point at the exact block under discussion;
 * the suffix is stripped and only the path is checked for existence. Bare,
 * unformatted mentions in running prose are not scanned, and no suffix shape
 * beyond that comma/range grammar is recognised: nowhere in this corpus is a
 * real citation written otherwise, and inventing forms would just widen the
 * false-positive surface.
 *
 * Three shapes are deliberately not citations of a concrete file, so they
 * are never checked for existence:
 *   - Globs (`src/sidepanel/export/descriptors/*.ts`) — the `*` doesn't
 *     match the path-char class below, so these never parse as a path.
 *   - Directory references (`src/shared/utils/`, `src/content/`) — anything
 *     without a trailing `.ext` is treated as "the directory", not a file,
 *     and directories aren't what this check is for.
 *   - Fenced code blocks — shell/config examples, not assertions about the
 *     repo. Nothing in the current corpus cites a real path only inside a
 *     fence, so skipping them costs no coverage and avoids flagging sample
 *     commands (`npm run knip`) or illustrative snippets as broken paths.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Root-level files in scope: the two pointer files plus the live nightly ledgers. */
const ROOT_FILES = new Set([
  'CLAUDE.md',
  'AGENTS.md',
  'DEBT.md',
  'IMPROVEMENTS.md',
  'SESSION.md',
  'CONVENTIONS.md',
]);

/**
 * Docs, skills, and ledger corpus this check actually owns.
 *
 * **`docs/adr/` is deliberately excluded.** An ADR is a dated record of a
 * decision, and `docs/adr/README.md` states they are immutable once accepted —
 * a later decision supersedes an earlier one rather than rewriting it. A path
 * in an ADR describes where a file lived *at the time of the decision*, so
 * "correcting" it to today's layout falsifies the record rather than repairing
 * it. Two ADRs were edited that way before this exclusion existed: ADR-0010 had
 * its 2026-era `src/test/mocks/handlers.ts` rewritten to name a file that would
 * not exist for months, which is precisely backwards. If an ADR's citation has
 * gone stale, that is a signal to write a superseding ADR, not to edit the old
 * one — and this gate must not create pressure to do the wrong thing.
 *
 * **`NIGHTLY.md` is deliberately excluded, for the same reason.** It is an
 * append-only log of what each session found and did, so an entry's paths
 * describe the repo *as it was that night*. It already contains one citation
 * that does not resolve — `src/sidepanel/components/groups/GroupPushSection.tsx`
 * — and that is the point of the entry: it records discovering that this exact
 * path was wrong. "Fixing" it would erase the finding it documents. Same
 * argument as `docs/adr/` above; the remedy for a stale path in the log is the
 * next entry, never an edit to an old one. The other four root ledgers are
 * live working documents and stay in scope.
 */
const IN_SCOPE = (f) =>
  !f.startsWith('docs/adr/') &&
  (ROOT_FILES.has(f) || f.startsWith('docs/') || f.startsWith('.claude/'));

/** A bare or `../`-prefixed path rooted at `src/`, ending in a real segment. */
const SRC_PATH_RE = /^(?:\.\.\/)+src\/[\w.-]+(?:\/[\w.-]+)*$|^src\/[\w.-]+(?:\/[\w.-]+)*$/;

/**
 * Trailing line reference on a citation — `:311`, `:103-125`, `:93,99-106`.
 * Stripped before the path is tested; the line numbers are prose, not a file.
 */
const LINE_SUFFIX_RE = /:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/;

/** Trailing `.ext` — anything without one is a directory reference, not a file. */
const HAS_EXTENSION_RE = /\.[A-Za-z0-9]+$/;

const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const BACKTICK_RE = /`([^`]+)`/g;

const repoRoot = process.cwd();

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && f.endsWith('.md') && IN_SCOPE(f));

/** Resolve a cited path relative to its citing file, falling back to repo root. */
function resolveCitation(file, rawPath) {
  const primary = resolve(dirname(file), rawPath);
  if (existsSync(primary)) return true;
  const stripped = rawPath.replace(/^(?:\.\.\/)+/, '');
  const fallback = resolve(repoRoot, stripped);
  return existsSync(fallback);
}

/**
 * Pull candidate `src/…` citations out of one line, honoring link vs. backtick form.
 *
 * Returns `{ raw, path }` per hit: `raw` is the citation exactly as written, so an
 * offender report names text the reader can find in the file; `path` is the same
 * span with any line-number suffix removed, which is what gets resolved on disk.
 */
function citationsOnLine(line) {
  const candidates = [];

  // Markdown links first, and blank them out so their backticked label text
  // (`[`Button.tsx`](../src/Button.tsx)`) isn't also scanned as a standalone
  // backtick citation — that would report the same missing path twice.
  const withoutLinks = line.replace(MD_LINK_RE, (whole, url) => {
    candidates.push(url.trim());
    return ' '.repeat(whole.length);
  });

  for (const match of withoutLinks.matchAll(BACKTICK_RE)) {
    candidates.push(match[1].trim());
  }

  return candidates
    .map((raw) => ({ raw, path: raw.replace(LINE_SUFFIX_RE, '') }))
    .filter(({ path }) => SRC_PATH_RE.test(path) && HAS_EXTENSION_RE.test(path));
}

const offenders = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const { raw, path } of citationsOnLine(line)) {
      if (!resolveCitation(file, path)) {
        offenders.push({ file, line: i + 1, rawPath: raw });
      }
    }
  }
}

if (offenders.length > 0) {
  console.error('Cited paths that do not exist on disk:\n');
  for (const { file, line, rawPath } of offenders) {
    console.error(`  ${file}:${line} — ${rawPath}`);
  }
  console.error("\nUpdate the citation to the file's real location, note that it was");
  console.error('removed, or drop the reference if it no longer serves the sentence.');
  process.exit(1);
}

console.log(
  `All cited src/ paths resolve, across ${files.length} tracked docs, skill, and ledger files.`,
);
