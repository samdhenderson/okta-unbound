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
 * `policies`, `export`, `explorer` and `history` are blocked on demo fixtures
 * rather than on design — see the plan's chapter checklist for what each one
 * needs. `overview` is **not** on this list: that tab no longer exists —
 * `home` replaced it, both in position and in job — so there is nothing left
 * to defer.
 *
 * Kept here as a list rather than as commented-out entries so the gap is a
 * statement instead of an oversight.
 */
export const DEFERRED = ['policies', 'export', 'explorer', 'history'];

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
    // The Rules tab opens on an explicit "No Rules Loaded" empty state of about
    // 200 characters, which never clears the default >400 content heuristic. It
    // must name its own anchor or the runner waits out its whole timeout and
    // then films the empty state anyway.
    ready: 'text=Load Rules',
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
    // Same empty state, same reason as the act above: the Rules tab opens on
    // "No Rules Loaded", which never clears the default content heuristic.
    ready: 'text=Load Rules',
    walk: () => import('./walks/rules-impact.mjs'),
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
