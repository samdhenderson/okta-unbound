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

/**
 * A bare or `../`-prefixed path rooted in a directory or root file this repo
 * treats as source-of-record, ending in a real segment.
 *
 * `D-024`: originally rooted at `src/` only, so every citation of a `scripts/`,
 * `docs/`, or `.claude/` path — including `docs/adr/NNNN-*.md`, which may be
 * *cited* even though `docs/adr/` is excluded above as a *citing* corpus — was
 * invisible to this check, despite `CLAUDE.md`'s routing table and the ledgers
 * themselves being made almost entirely of exactly those citations. The
 * boundary chosen is deliberately narrow: the six directories this repo
 * actually tracks as source-of-record (`src/`, `scripts/`, `docs/`, `.claude/`,
 * `.storybook/`, `.github/`) plus the root pointer/ledger files by exact name.
 * It does **not** pull in every bare word that looks path-shaped — a
 * `package.json` script name (`npm run docs`) has no `/` and never matches;
 * a `.storybook/` or `.github/` directory reference without a `.ext` is still
 * a directory, not a file, per `HAS_EXTENSION_RE` below.
 */
const KNOWN_ROOT_DIRS = 'src|scripts|docs|\\.claude|\\.storybook|\\.github';
const KNOWN_ROOT_FILES =
  'CLAUDE\\.md|AGENTS\\.md|DEBT\\.md|IMPROVEMENTS\\.md|SESSION\\.md|CONVENTIONS\\.md|package\\.json';
const SRC_PATH_RE = new RegExp(
  `^(?:\\.\\./)+(?:${KNOWN_ROOT_DIRS})/[\\w.-]+(?:/[\\w.-]+)*$` +
    `|^(?:${KNOWN_ROOT_DIRS})/[\\w.-]+(?:/[\\w.-]+)*$` +
    `|^(?:${KNOWN_ROOT_FILES})$`,
);

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

/** A ledger item heading — `### D-024 · <title>` or `### I-035 · <title>`. */
const SECTION_HEADING_RE = /^### /;

/** A ledger item's status bullet — `- **Status:** done:#67`, `closed:refuted-2026-08-24`, `open`. */
const STATUS_BULLET_RE = /^-\s*\*\*Status:\*\*\s*(\S+)/;

/**
 * `D-031`: a `done:*`/`closed:*` ledger item is a dated record of finished
 * work, by the same argument the header above already makes for `docs/adr/`
 * and `NIGHTLY.md` — a path it cites describes the repo *as it was* when the
 * item closed, so "fixing" a citation that a later deletion broke falsifies
 * the record rather than repairing it. This computes, per line, which
 * `### `-delimited section it falls in and whether that section's `Status:`
 * bullet reads `done:*`/`closed:*`; such lines are skipped before citations
 * are even extracted. Files with no `### `/`Status:` ledger-item shape (most
 * of `docs/` and `.claude/`) simply have one un-skippable section spanning
 * the whole file, so this is a no-op outside `DEBT.md`/`IMPROVEMENTS.md`.
 */
function closedSectionLines(lines) {
  const skip = new Array(lines.length).fill(false);
  let sectionStart = 0;

  const closeSection = (end) => {
    let status = null;
    for (let j = sectionStart; j < end; j++) {
      const match = STATUS_BULLET_RE.exec(lines[j]);
      if (match) {
        status = match[1];
        break;
      }
    }
    if (status && /^(?:done|closed):/i.test(status)) {
      for (let j = sectionStart; j < end; j++) skip[j] = true;
    }
  };

  for (let i = 1; i < lines.length; i++) {
    if (SECTION_HEADING_RE.test(lines[i])) {
      closeSection(i);
      sectionStart = i;
    }
  }
  closeSection(lines.length);

  return skip;
}

const offenders = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const skip = closedSectionLines(lines);
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || skip[i]) continue;

    for (const { raw, path } of citationsOnLine(line)) {
      if (!resolveCitation(file, path)) {
        offenders.push({ file, line: i + 1, rawPath: raw });
      }
    }
  }
}

let failed = false;

if (offenders.length > 0) {
  failed = true;
  console.error('Cited paths that do not exist on disk:\n');
  for (const { file, line, rawPath } of offenders) {
    console.error(`  ${file}:${line} — ${rawPath}`);
  }
  console.error("\nUpdate the citation to the file's real location, note that it was");
  console.error('removed, or drop the reference if it no longer serves the sentence.\n');
}

/**
 * Ledger-integrity guards (`D-080`, `D-092`, `D-093`).
 *
 * These read `DEBT.md`/`IMPROVEMENTS.md` structurally — as a sequence of
 * `### D-NNN`/`### I-NNN` item sections — rather than as prose, catching three
 * silent failure modes a nightly session's own item-selection logic depends on:
 * a duplicate id (one item hiding behind another's number), an item with no
 * `Status:` line (invisible to both "what's open" and "what's claimed"), and a
 * `claimed:<branch>` pointing at a branch that no longer exists anywhere (the
 * item is stuck forever, looking claimed to every future session).
 */
const LEDGER_FILES = ['DEBT.md', 'IMPROVEMENTS.md'];

/** `### D-007a · A failure result that can say what failed` — base id + optional letter suffix. */
const ITEM_HEADING_RE = /^### ([DI]-[0-9]+)([a-z]*) · /;

/**
 * `- **D-001** — <title> — done:#67 (…)` — one archived item, collapsed to a
 * plain list line (not a `### ` heading, deliberately, so `D-092`'s
 * missing-Status-line check never looks at it — an archive line has no
 * `Status:` bullet of its own by design).
 */
const ARCHIVE_ITEM_RE = /^- \*\*([DI]-[0-9]+[a-z]*)\*\* — /;

/**
 * Every id retired to a ledger's `## Archive` section. An archived id is
 * permanently spoken for — reusing it for a new live item would let that new
 * item hide behind a closed one's history, the exact hazard `D-080`'s
 * live-id uniqueness check exists to catch, so archived ids are folded into
 * the same uniqueness check below rather than exempted from it.
 */
function parseArchiveIds() {
  const ids = [];
  for (const file of LEDGER_FILES) {
    const lines = readFileSync(resolve(repoRoot, file), 'utf8').split('\n');
    let inArchive = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^## Archive/.test(lines[i])) {
        inArchive = true;
        continue;
      }
      if (!inArchive) continue;
      const match = ARCHIVE_ITEM_RE.exec(lines[i]);
      if (match) ids.push({ file, line: i + 1, id: match[1] });
    }
  }
  return ids;
}

/** Every `### `/`- **Status:**` ledger item across both ledgers, in file order. */
function parseLedgerItems() {
  const items = [];
  for (const file of LEDGER_FILES) {
    const lines = readFileSync(resolve(repoRoot, file), 'utf8').split('\n');
    let inFence = false;
    const headings = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const match = ITEM_HEADING_RE.exec(lines[i]);
      if (match) headings.push({ line: i, base: match[1], suffix: match[2] });
    }

    for (let i = 0; i < headings.length; i++) {
      const { line, base, suffix } = headings[i];
      const end = i + 1 < headings.length ? headings[i + 1].line : lines.length;
      let status = null;
      for (let j = line; j < end; j++) {
        const match = STATUS_BULLET_RE.exec(lines[j]);
        if (match) {
          status = match[1];
          break;
        }
      }
      items.push({ file, line: line + 1, id: base + suffix, base, suffix, status });
    }
  }
  return items;
}

const ledgerItems = parseLedgerItems();
const archiveIds = parseArchiveIds();

// --- D-080: every item id is unique across both ledgers, live sections and
// archives together — an archived id is retired permanently and must never
// come back as a new live item. ---
const idLocations = new Map();
for (const item of ledgerItems) {
  const locs = idLocations.get(item.id) ?? [];
  locs.push(`${item.file}:${item.line}`);
  idLocations.set(item.id, locs);
}
for (const item of archiveIds) {
  const locs = idLocations.get(item.id) ?? [];
  locs.push(`${item.file}:${item.line} (archive)`);
  idLocations.set(item.id, locs);
}
const duplicateIds = [...idLocations.entries()].filter(([, locs]) => locs.length > 1);
if (duplicateIds.length > 0) {
  failed = true;
  console.error('Duplicate ledger item ids:\n');
  for (const [id, locs] of duplicateIds) {
    console.error(`  ${id} — ${locs.join(', ')}`);
  }
  console.error('\nEvery `D-NNN`/`I-NNN` id must be unique across DEBT.md and IMPROVEMENTS.md,');
  console.error('live sections and the `## Archive` section together — a duplicate lets one');
  console.error('item hide behind another, and an archived id is retired for good.\n');
}

// --- D-092: every item has a Status line, except umbrella items whose lettered ---
// --- children (D-007 -> D-007a/b/c) carry it instead. Detected structurally: an ---
// --- item with no suffix is an umbrella exactly when the very next item shares ---
// --- its base id and does carry a suffix. ---
const missingStatus = [];
for (let i = 0; i < ledgerItems.length; i++) {
  const item = ledgerItems[i];
  if (item.status) continue;
  const next = ledgerItems[i + 1];
  const isUmbrella = item.suffix === '' && next && next.base === item.base && next.suffix !== '';
  if (!isUmbrella) missingStatus.push(item);
}
if (missingStatus.length > 0) {
  failed = true;
  console.error('Ledger items with no `- **Status:**` line:\n');
  for (const item of missingStatus) {
    console.error(`  ${item.file}:${item.line} — ${item.id}`);
  }
  console.error('\nEvery item needs a Status line so a nightly session can tell what is open,');
  console.error('claimed, or done. An umbrella item (like D-007) is exempt only when its lettered');
  console.error('children carry the status instead.\n');
}

// --- D-093 (optional): a claimed:<branch> whose branch exists nowhere. ---
// Best-effort — a git failure here degrades to a skipped check, never a false failure.
try {
  const localBranches = execFileSync('git', ['branch', '--format=%(refname:short)'], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);
  const remoteBranches = execFileSync('git', ['branch', '-r', '--format=%(refname:short)'], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((b) => b.replace(/^[^/]+\//, '').trim())
    .filter(Boolean);
  const knownBranches = new Set([...localBranches, ...remoteBranches]);

  const deadClaims = ledgerItems.filter((item) => {
    const match = /^claimed:(.+)$/.exec(item.status ?? '');
    return match && !knownBranches.has(match[1]);
  });
  if (deadClaims.length > 0) {
    console.warn('Warning: ledger items claimed by a branch that no longer exists:\n');
    for (const item of deadClaims) {
      console.warn(`  ${item.file}:${item.line} — ${item.id} (${item.status})`);
    }
    console.warn('\nThese look claimed to every future session but the branch is gone — reset the');
    console.warn('Status or confirm the branch under a different name.\n');
  }
} catch (e) {
  console.warn(`Skipping the dead-claimed-branch check — \`git branch\` failed: ${e.message}\n`);
}

/**
 * Advisory: flag live items ready to move to `## Archive`, and resolve the
 * commit for each where that's possible from local history — so archiving
 * a night's worth of closed items is "check this list, paste the suggested
 * lines" rather than a `gh pr view` per id. Never fails the build: a
 * candidate this run can't resolve a sha for is exactly the common case
 * right after a PR merges before the ledger update is archived, and is
 * flagged as such rather than invented.
 */
const archivedIdSet = new Set(archiveIds.map((a) => a.id));
const archiveCandidates = ledgerItems.filter(
  (item) => item.status && /^(done|closed):/i.test(item.status) && !archivedIdSet.has(item.id),
);
if (archiveCandidates.length > 0) {
  console.warn(`Ledger items closed but not yet archived (${archiveCandidates.length}):\n`);
  for (const item of archiveCandidates) {
    const prMatch = /^done:#(\d+)/.exec(item.status);
    let suggestion = item.status;
    if (prMatch) {
      try {
        const sha = execFileSync(
          'git',
          ['log', '--format=%H', '--grep', `(#${prMatch[1]})`, '-1'],
          { encoding: 'utf8' },
        ).trim();
        suggestion = sha
          ? `commit ${sha.slice(0, 7)} — https://github.com/samdhenderson/okta-unbound/commit/${sha}`
          : `PR #${prMatch[1]} has no matching merge commit in local history yet (not on main?)`;
      } catch {
        suggestion = 'could not query git log for a matching commit';
      }
    }
    console.warn(`  ${item.file}:${item.line} — ${item.id} (${item.status}) — ${suggestion}`);
  }
  console.warn(
    '\nSee CLAUDE.md\'s "Nightly maintenance system" and SESSION.md step 7 for when to move\n' +
      'these into `## Archive` — only once the closing PR is actually merged to `main`.\n',
  );
}

if (failed) process.exit(1);

console.log(
  `All cited paths resolve and both ledgers are structurally sound, across ${files.length} tracked docs, skill, and ledger files.`,
);
