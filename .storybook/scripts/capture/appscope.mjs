/**
 * Which of the app's own source files a chapter is filming.
 *
 * The capture cache used to hash the rig and the demo org and nothing of the
 * product, so a change to the panel a chapter is *about* left every clip reading
 * `unchanged` (I-025). Hashing `src/sidepanel` wholesale fixes that and costs a
 * four-minute nine-chapter re-shoot on every product commit, including commits
 * to tabs the reel does not film. This module computes the middle answer: the
 * slice of the app a given chapter can actually put on camera.
 *
 * ## The slice
 *
 * The panel already has a boundary that matches the reel's: `App` mounts each
 * non-default tab through `React.lazy`, so every tab is its own island hanging
 * off one shared shell. So:
 *
 * - **core** — everything reachable from the two things every chapter mounts
 *   (`demo/scenes.stories.tsx`, which mounts `App`, and `.storybook/preview.tsx`,
 *   which supplies the decorators and the stylesheet), stopping at the tab roots.
 *   That is the shell, the shared components, the hooks, the cache, the CSS.
 *   A change in core invalidates all nine chapters, which is correct: those
 *   files are on screen in all nine.
 * - **the tab islands the chapter films** — the full transitive reach of each
 *   tab root in `chapter.films`, shared modules included. Two chapters filming
 *   different tabs therefore diverge exactly by the code only one of them shows.
 *
 * Everything else — Policies, Export, Explorer, History, and anything reachable
 * only through them — is outside every chapter's scope and invalidates nothing.
 *
 * ## Why it fails loudly
 *
 * Under-hashing here is invisible: a clip of the old app plays perfectly. So
 * every way this module can lose track of a file throws instead of skipping —
 * an unresolvable relative import, a missing tab root, a chapter that films a
 * tab it did not declare, a story whose staged tab is not in its chapter's
 * `films`. A capture run that stops is recoverable; a reel that lies is not.
 *
 * @module
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { REPO } from '../lib/storybook-server.mjs';

const SRC = path.join(REPO, 'src');

/**
 * Entries every chapter mounts, whatever tab it is on.
 *
 * The story file rather than `App` directly, because the story is what actually
 * renders: it pulls in `App`, the Storybook mocks the panel talks to, and the
 * demo org. `preview.tsx` is not reachable from any story and is what installs
 * the decorators and `tailwind.css`, both of which are on camera in every frame.
 */
const SHARED_ENTRIES = ['src/sidepanel/demo/scenes.stories.tsx', '.storybook/preview.tsx'];

/** The story module whose staged tab is cross-checked against `chapter.films`. */
const SCENES = 'src/sidepanel/demo/scenes.stories.tsx';

/** The registry the rail's labels come from, parsed rather than duplicated. */
const TABS_REGISTRY = 'src/sidepanel/tabs.ts';

/**
 * Each top-level tab's root module — the boundary `App` lazy-mounts it across.
 *
 * Keyed by `TabType`. `home` is in here even though `App` imports it eagerly
 * (it is the default tab and must not be a chunk fetch): the eager import is a
 * loading decision, not a coupling one, so Home's subtree is still an island
 * and a Home-only change still films one chapter rather than nine.
 *
 * Every id in `TAB_DEFS` must appear here and every path must resolve, both
 * asserted below — a renamed tab root fails the run rather than quietly
 * dropping its subtree out of scope.
 */
const TAB_ROOTS = {
  home: 'src/sidepanel/components/HomeTab',
  users: 'src/sidepanel/components/UsersTab',
  groups: 'src/sidepanel/components/GroupsTab',
  apps: 'src/sidepanel/components/AppsTab',
  rules: 'src/sidepanel/components/RulesTab',
  policies: 'src/sidepanel/components/AuthPoliciesTab',
  export: 'src/sidepanel/components/export',
  explorer: 'src/sidepanel/components/ApiExplorerTab',
  history: 'src/sidepanel/components/AuditLogViewer',
};

/** Extensions tried when a specifier omits one, in resolution order. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'];

/** Files worth reading for further imports. A `.css` file is hashed, not walked. */
const WALKABLE = /\.(ts|tsx|js|jsx|mjs)$/;

/**
 * Import-ish specifiers: `from '…'`, `import '…'`, `import('…')`, `require('…')`.
 *
 * Deliberately a regex and not a parser. The alternative is a TypeScript
 * dependency in a build script, and the failure mode of being too eager here is
 * an over-hash (a re-shoot) while the failure mode of a parser going missing is
 * a silent under-hash.
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g;

const isFile = async (p) => Boolean((await stat(p).catch(() => null))?.isFile());

/**
 * Resolve one import specifier to a file on disk.
 *
 * @param spec - The specifier as written.
 * @param from - The file it was written in.
 * @returns An absolute path; `null` for a bare specifier (a package, which this
 *   module deliberately does not follow — see the blind spots in `capture.mjs`);
 *   or `undefined` for a local specifier that resolves to nothing, which the
 *   caller turns into a thrown error.
 */
async function resolveSpecifier(spec, from) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else return null;

  if (await isFile(base)) return base;
  for (const ext of EXTENSIONS) if (await isFile(base + ext)) return base + ext;
  for (const ext of EXTENSIONS) {
    const indexed = path.join(base, `index${ext}`);
    if (await isFile(indexed)) return indexed;
  }
  return undefined;
}

/** file → specifiers, memoized: the graph is walked once per tab plus once for core. */
const specCache = new Map();

/**
 * The import specifiers in one file, with comments stripped first.
 *
 * Full-line `//`, JSDoc continuation lines and block comments go before the
 * match, so prose describing an import (this repo writes a lot of it) neither
 * pulls a file into scope nor — the case that would actually hurt — fails the
 * run by naming a path that was never meant to resolve.
 */
async function specifiersOf(file) {
  const cached = specCache.get(file);
  if (cached) return cached;
  const source = (await readFile(file, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*(\/\/|\*).*$/gm, '');
  const specs = [...new Set([...source.matchAll(SPECIFIER)].map((m) => m[1]))];
  specCache.set(file, specs);
  return specs;
}

/**
 * Every local file reachable from `entries`.
 *
 * @param entries - Absolute paths to start from.
 * @param stopAt - Files that are boundaries: not entered, and not included.
 */
async function reach(entries, stopAt = new Set()) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || stopAt.has(file)) continue;
    seen.add(file);
    if (!WALKABLE.test(file)) continue;
    for (const spec of await specifiersOf(file)) {
      const target = await resolveSpecifier(spec, file);
      if (target === null) continue;
      if (target === undefined) {
        throw new Error(
          `${path.relative(REPO, file)} imports '${spec}', which resolves to no file. ` +
            'The capture fingerprint walks this graph, so an import it cannot follow ' +
            "would silently drop code out of every chapter's scope. Fix the import, " +
            'or teach resolveSpecifier in appscope.mjs how to follow it.',
        );
      }
      if (!seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

/** Resolved tab roots and the core set, built once per process. */
let graph = null;

async function buildGraph() {
  if (graph) return graph;

  const roots = new Map();
  for (const [tab, spec] of Object.entries(TAB_ROOTS)) {
    const resolved = await resolveSpecifier(`./${spec}`, path.join(REPO, 'x.mjs'));
    if (!resolved) {
      throw new Error(
        `the '${tab}' tab root '${spec}' resolves to no file — TAB_ROOTS in ` +
          'appscope.mjs is stale, and every chapter filming that tab is currently ' +
          'hashing none of it.',
      );
    }
    roots.set(tab, resolved);
  }

  // The rail's labels, read from the app's own registry so a renamed tab cannot
  // leave a walk cross-check matching against a label nothing uses any more.
  const registry = await readFile(path.join(REPO, TABS_REGISTRY), 'utf8');
  const labels = new Map();
  for (const m of registry.matchAll(/\{\s*id:\s*'([a-z]+)',\s*label:\s*'([^']+)'/g)) {
    labels.set(m[2], m[1]);
  }
  for (const tab of labels.values()) {
    if (!roots.has(tab)) {
      throw new Error(
        `${TABS_REGISTRY} declares a '${tab}' tab that TAB_ROOTS in appscope.mjs does ` +
          'not name a root module for, so nothing under it would be hashed.',
      );
    }
  }

  const boundary = new Set(roots.values());
  const core = await reach(
    SHARED_ENTRIES.map((p) => path.join(REPO, p)),
    boundary,
  );

  const islands = new Map();
  for (const [tab, root] of roots) islands.set(tab, await reach([root]));

  graph = { roots, labels, core, islands };
  return graph;
}

/**
 * The tabs a walk drives to that its chapter did not declare.
 *
 * Only sees `railTab(page, 'Label')` with a literal label — today the one way
 * any walk changes tab, and the one that `apps.mjs` uses. A walk that reached
 * another tab some other way is a blind spot, stated as such in `capture.mjs`.
 */
async function undeclaredTabs(chapter, labels) {
  const walkFile = path.join(REPO, `.storybook/scripts/capture/walks/${chapter.id}.mjs`);
  const source = await readFile(walkFile, 'utf8').catch(() => '');
  const found = new Set();
  for (const m of source.matchAll(/railTab\(\s*page\s*,\s*'([^']+)'/g)) {
    const tab = labels.get(m[1]);
    if (!tab) {
      throw new Error(
        `walks/${chapter.id}.mjs clicks the rail tab labelled '${m[1]}', which is not a ` +
          'label in src/sidepanel/tabs.ts — the click is a no-op, or the label moved.',
      );
    }
    if (!chapter.films.includes(tab)) found.add(tab);
  }
  return [...found];
}

/** The tab a story's `beforeEach` stages, so a chapter cannot forget to declare it. */
async function stagedTab(chapter) {
  const exported = chapter.story
    .split('--')[1]
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  const source = await readFile(path.join(REPO, SCENES), 'utf8');
  const block = source.match(
    new RegExp(`export const ${exported}: Story = \\{[\\s\\S]*?\\n\\};`),
  )?.[0];
  const tab = block?.match(/\btab:\s*'([a-z]+)'/)?.[1];
  if (!tab) {
    throw new Error(
      `could not read the staged tab for story '${chapter.story}' out of ${SCENES}. ` +
        'The fingerprint uses it to check that a chapter declares the tab it opens on, ' +
        'so a story shape this cannot read has to be fixed rather than assumed.',
    );
  }
  return tab;
}

/**
 * The app source files a chapter films, sorted, as absolute paths.
 *
 * @param chapter - A chapter from `chapters.mjs`, including its `films` list.
 */
export async function appScopeFor(chapter) {
  const { labels, core, islands } = await buildGraph();

  if (!Array.isArray(chapter.films) || chapter.films.length === 0) {
    throw new Error(
      `chapter '${chapter.id}' declares no 'films' list, so the fingerprint would cover ` +
        'the shell and none of the tab it is about.',
    );
  }
  for (const tab of chapter.films) {
    if (!islands.has(tab)) {
      throw new Error(`chapter '${chapter.id}' films '${tab}', which is not a known tab.`);
    }
  }

  const staged = await stagedTab(chapter);
  if (!chapter.films.includes(staged)) {
    throw new Error(
      `chapter '${chapter.id}' opens on story '${chapter.story}', which stages the ` +
        `'${staged}' tab, but its films list is [${chapter.films.join(', ')}]. The tab a ` +
        'chapter opens on is always on camera.',
    );
  }

  const missed = await undeclaredTabs(chapter, labels);
  if (missed.length) {
    throw new Error(
      `walks/${chapter.id}.mjs switches to the ${missed.map((t) => `'${t}'`).join(', ')} ` +
        "tab, which is not in the chapter's films list. Add it, or the clip stops " +
        'invalidating when that tab changes.',
    );
  }

  const scope = new Set(core);
  for (const tab of chapter.films) for (const file of islands.get(tab)) scope.add(file);
  return [...scope].sort();
}
