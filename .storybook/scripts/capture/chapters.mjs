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
 * `overview` is being renamed Home and repurposed, so a chapter built against it
 * today films a tab that is about to stop existing in that form. `policies`,
 * `export`, `explorer` and `history` are blocked on demo fixtures rather than on
 * design — see the plan's chapter checklist for what each one needs.
 *
 * Kept here as a list rather than as commented-out entries so the gap is a
 * statement instead of an oversight.
 */
export const DEFERRED = ['overview', 'policies', 'export', 'explorer', 'history'];

/** Chapters in reel order. The composition may sequence a subset; it may not reorder. */
export const CHAPTERS = [
  {
    id: 'users',
    title: 'Users',
    tab: 'users',
    kind: 'tour',
    story: 'demo-scenes--user-comparison',
    walk: () => import('./walks/users.mjs'),
  },
  {
    id: 'groups',
    title: 'Groups',
    tab: 'groups',
    kind: 'tour',
    story: 'demo-scenes--group-drilldown',
    walk: () => import('./walks/groups.mjs'),
  },
  {
    id: 'apps',
    title: 'Apps',
    tab: 'apps',
    kind: 'tour',
    story: 'demo-scenes--group-drilldown',
    walk: () => import('./walks/apps.mjs'),
  },
  {
    id: 'rules',
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
  {
    id: 'compare',
    title: 'Compare',
    tab: 'users',
    kind: 'deep',
    story: 'demo-scenes--user-comparison',
    walk: () => import('./walks/compare.mjs'),
  },
  {
    id: 'attributes',
    title: 'Attributes',
    tab: 'groups',
    kind: 'deep',
    story: 'demo-scenes--group-composition',
    walk: () => import('./walks/attributes.mjs'),
  },
  {
    id: 'reporting',
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
