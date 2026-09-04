/**
 * The reel's contents, as data.
 *
 * A chapter says what stage to open, which rail tab it belongs to, and which
 * walk drives it. It says nothing about how it looks — no frame, no card, no
 * claim, no blurb. All of that moved to the composition, where it can be
 * changed without re-filming anything, which is the entire point of the split.
 *
 * `kind` is the one presentational hint that survives here, because it changes
 * what gets *captured* rather than how it is dressed: a `deep` chapter runs
 * longer and reads more figures off the panel, and a `tour` chapter is one walk
 * and out.
 *
 * @module
 */

/**
 * Not filmed yet, and deliberately.
 *
 * `export` and `explorer` earned chapters of their own once their demo
 * fixtures landed and dropped off this list — see `CHAPTERS` for `export` and
 * `explorer`. `policies` and `history` are still blocked on demo fixtures
 * rather than on design — see the plan's chapter checklist for what each one
 * needs. `overview` is **not** on this list: that tab no longer exists —
 * `home` replaced it, both in position and in job — so there is nothing left
 * to defer.
 *
 * Kept here as a list rather than as commented-out entries so the gap is a
 * statement instead of an oversight.
 */
export const DEFERRED = ['policies', 'history'];

/**
 * `films` is the fingerprint's business, not the composition's.
 *
 * Every scene mounts the whole panel, so "what this chapter shows" cannot be
 * derived from the story it opens: all nine stories render `<App />`. It is
 * derived from the *tabs* a chapter puts on camera, and that is what `films`
 * declares — the tab the story stages, plus any tab the walk switches to.
 * `appscope.mjs` hashes the shell plus those tabs' islands, so a change under a
 * tab no chapter films costs no re-shoot and a change under one that is filmed
 * invalidates exactly the chapters that show it.
 *
 * Two things are checked rather than trusted, because forgetting an entry here
 * is silent — it makes a clip immortal, not broken: the staged tab of the
 * chapter's story must appear in `films`, and so must every tab its walk clicks
 * in the rail. Both fail the capture run.
 */

/** Chapters in reel order. The composition may sequence a subset; it may not reorder. */
export const CHAPTERS = [
  {
    id: 'home',
    films: ['home'],
    title: 'Home',
    tab: 'home',
    kind: 'tour',
    story: 'demo-scenes--home',
    walk: () => import('./walks/home.mjs'),
  },
  // Users is three acts on one tab (ADR-0053): the gap, the cause, the fix.
  // Three captures rather than one long walk, so a caption change stays free
  // and a beat that misses ends its act rather than the whole argument.
  {
    id: 'users-gap',
    films: ['users'],
    title: 'Users',
    tab: 'users',
    kind: 'deep',
    story: 'demo-scenes--user-comparison',
    walk: () => import('./walks/users-gap.mjs'),
  },
  {
    id: 'users-cause',
    films: ['users'],
    title: 'Users',
    tab: 'users',
    kind: 'deep',
    story: 'demo-scenes--user-comparison',
    walk: () => import('./walks/users-cause.mjs'),
  },
  {
    id: 'users-fix',
    films: ['users'],
    title: 'Users',
    tab: 'users',
    kind: 'deep',
    story: 'demo-scenes--user-comparison',
    walk: () => import('./walks/users-fix.mjs'),
  },
  {
    id: 'groups',
    films: ['groups'],
    title: 'Groups',
    tab: 'groups',
    kind: 'tour',
    story: 'demo-scenes--group-drilldown',
    walk: () => import('./walks/groups.mjs'),
  },
  {
    id: 'apps',
    films: ['groups', 'apps'],
    title: 'Apps',
    tab: 'apps',
    kind: 'tour',
    story: 'demo-scenes--group-drilldown',
    walk: () => import('./walks/apps.mjs'),
  },
  {
    id: 'rules',
    films: ['rules'],
    title: 'Rules',
    tab: 'rules',
    kind: 'tour',
    story: 'demo-scenes--rule-impact',
    /*
      This used to anchor on the "No Rules Loaded" empty state's own `Load
      Rules` button, which is now a hang rather than a fix: the Rules tab
      auto-fetches on activation via `useOwedLoad` (`RulesTab.tsx:537`,
      ADR-0069), so that empty state, and its verb, render only if the
      auto-load failed or was never eligible. In the demo neither appears, so
      the runner would wait out its whole timeout and then film whatever
      landed instead, silently, rather than failing loudly on a missing
      anchor.

      The anchor has to prove the *list* arrived, and almost nothing else on
      this rung does. `Total Rules` was the obvious replacement and is wrong
      for the same shape of reason as the verb it replaced: `RulesStatsGrid`
      is gated on `activePanel === 'stats'` (`RulesTab.tsx:659`) and
      `activePanel` starts at `'none'` (`:174`), so the grid is behind the
      Stats toggle, itself behind More. It never renders on arrival. The
      filter panel is gated the same way, on `showFilters`.

      What always renders once the fetch lands is the rules themselves, so the
      anchor is a rule. `Engineering by department` is seeded by
      `src/sidepanel/demo/snapshot.ts`, which is already a `SHARED_INPUTS`
      fingerprint dependency, so a fixture rename invalidates this chapter
      rather than quietly un-anchoring it.
    */
    ready: 'text=Engineering by department',
    walk: () => import('./walks/rules.mjs'),
  },
  // Rules is two acts on one tab (ADR-0053): the inventory, then what one rule
  // is holding up. Split rather than lengthened because the second act opens a
  // rung and two modals, and a beat that misses in there should end its own act
  // instead of taking the tab's whole argument with it.
  {
    id: 'rules-impact',
    films: ['rules'],
    title: 'Rules',
    tab: 'rules',
    kind: 'deep',
    story: 'demo-scenes--rule-impact',
    // Same anchor, same reasoning as the act above, and the same rule: this
    // chapter's own subject is `Engineering by department`, so the anchor and
    // the walk's first beat are asking for the same thing.
    ready: 'text=Engineering by department',
    walk: () => import('./walks/rules-impact.mjs'),
  },
  {
    id: 'export',
    films: ['home', 'export'],
    title: 'Export',
    tab: 'export',
    kind: 'tour',
    story: 'demo-scenes--home',
    walk: () => import('./walks/export.mjs'),
  },
  {
    id: 'explorer',
    films: ['home', 'explorer'],
    title: 'Explorer',
    tab: 'explorer',
    kind: 'tour',
    story: 'demo-scenes--home',
    // `explorer` has no rail seat (ADR-0063) — it is reached only through the
    // ⌘K palette — and `appscope.mjs`'s own fingerprint is explicit that
    // non-static reach, palette navigation named first among its examples, is
    // invisible to it. `capture.mjs` only cross-checks tabs a walk clicks IN
    // THE RAIL against `films`, so nothing enforces this entry the way the
    // module doc above describes for every other chapter: forgetting `explorer`
    // here does not fail the capture run, it just leaves a change under this
    // tab unnoticed. The clip does not break; it goes immortal, filmed once and
    // never invalidated again.
    walk: () => import('./walks/explorer.mjs'),
  },
  {
    id: 'attributes',
    films: ['groups'],
    title: 'Attributes',
    tab: 'groups',
    kind: 'deep',
    story: 'demo-scenes--group-composition',
    walk: () => import('./walks/attributes.mjs'),
  },
  {
    id: 'reporting',
    films: ['groups'],
    title: 'Reporting',
    tab: 'groups',
    kind: 'deep',
    story: 'demo-scenes--mfa-coverage',
    walk: () => import('./walks/reporting.mjs'),
  },
];

/** Look a chapter up by id, or by a prefix of it. */
export const findChapters = (filters) =>
  filters.length === 0
    ? CHAPTERS
    : CHAPTERS.filter((c) => filters.some((f) => c.id === f || c.id.startsWith(f)));
