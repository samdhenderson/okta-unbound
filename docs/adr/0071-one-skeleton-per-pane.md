# ADR-0071: One skeleton per pane, and only work in flight holds it

- Status: Accepted
- Date: 2026-09-03
- Relates to: [ADR-0049](./0049-one-slab-and-a-sequenced-indicator.md) (chrome that
  settles before content arrives), the skeleton-vs-spinner split in
  [`docs/motion.md`](../motion.md), and the loading/empty/error contract in
  [`docs/ux-guidelines.md`](../ux-guidelines.md)

## Context

`GroupOverviewPane` is a grid of verdict tiles, and each tile decides for itself
whether it exists yet. `MembershipSourceTile` returns `null`
(`GroupOverviewPane.tsx:157`), `AccessGrantsTile` returns `null` until its own read
lands (`:196`), `RuleRelationshipsTile` the same (`:222`). Two further facts appear
_inside_ already-rendered tiles once a second, independent read resolves — the
admin-role count on the access tile (`:203`) and the referencing-rule count on the
rules tile (`:230`). The hooks behind all of this are owned one level up in
`GroupDetailView.tsx:206-208` (`useGroupSource`, `useGroupRuleReferences`,
`useGroupAccessGrants`) and resolve independently of each other.

The grid at `GroupOverviewPane.tsx:289` therefore reflows every time one of them
returns. The pane pops in tile by tile, and a reader who starts on the first tile to
arrive has the rest of the page shove it as they read. This is precisely the layout
shift `Skeleton` was added to prevent, and Overview is the one surface that never
adopted it: fourteen call sites across Groups, Apps, Rules, Policies, Members, Home
and the two User lists already render `Skeleton`, and this pane renders none.

The per-tile `null` was not careless. The pane's module doc argues it deliberately —
**"a fact that hasn't loaded is omitted, never rendered as a zero or a dash"** — and
that rule is right and survives this ADR untouched. What it does not answer is what
the _pane_ should look like while none of its facts have arrived, and the default it
fell into is "an empty region that fills in at four different moments."

There is a trap in the obvious fix. `MembershipSourceTile`'s status can be
legitimately `'idle'` and stay there: member analysis is gated behind
`AUTO_LOAD_MEMBER_CAP` and waits for a manual trigger, so on a large group no read
is running and none will start until someone presses. A pane that waits for "every
tile resolved" waits forever on that group. The naive fix is worse than the defect.

## Decision

**A pane renders one skeleton for its whole layout until its declared settle set is
clear, then swaps once. A query holds the skeleton only while it is genuinely in
flight.**

### 1. What a pane is, for this rule

A **pane** is a tab's content region on a detail rung — a sibling of the other panes
under one `Tabs`, mounted permanently and `hidden` when inactive, per
[`docs/components.md`](../components.md)'s tabbed-pane pattern. `GroupOverviewPane`,
`GroupInsightsPane` and `UserProfilePane` are panes. The test is structural, not
visual: **the component is the thing a tab switches to, and its parent owns the tab
state.**

This rule does not reach a list row, a card, a section inside a pane, an inline
panel, or the app shell. A pane's own children do not each get this treatment — that
is the behaviour being removed. A list rung is out of scope because it already has
the pattern: its single skeleton is the list's rows.

### 2. One skeleton, one swap

While the settle set is unclear, the pane renders `Skeleton` and nothing else. When
it clears, the pane renders its real layout and does not return to the skeleton for
the same mount. There is no intermediate state in which some tiles are real and
others are placeholders — that state is the defect, drawn in grey.

The skeleton's shape approximates the settled layout closely enough that the swap
does not move what a reader is already looking at. Approximation is the standard,
not pixel identity; a placeholder that is the wrong _height_ is worth fixing, one
that is the wrong shade is not.

### 3. The settle set: only in-flight work holds the skeleton

For every query a pane depends on, exactly one of four things is true, and only the
first holds the skeleton:

| State                                    | Holds the skeleton? | What the settled pane shows                                         |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| **In flight** — a request is outstanding | **Yes**             | —                                                                   |
| **Idle by design** — gated on a user act | No                  | That tile's own idle affordance (the call-to-action that starts it) |
| **Failed**                               | No                  | That tile's own error state                                         |
| **Settled empty** — resolved, no rows    | No                  | That tile's own empty state, or its documented absence              |

The three non-holding states share one property that makes the rule easy to
remember: **no further work is running, so waiting cannot change the answer.** A
skeleton is a promise that content is arriving. Rendering one over a query nobody
has started is a lie; rendering one over a query that has already failed is a hang.

This does not fabricate a value for a fact the pane does not have. The tile owns its
own presentation in all three non-holding states, exactly as it does today — §2
governs _when the pane appears_, not _what a tile claims_.

### 4. How a pane declares its settle set — opt-in, and `=== 'loading'`

Two constraints, and both exist to make §3's trap unreachable by accident.

**The settle set is an explicit opt-in list, never a scan.** A pane names the
statuses it waits on in one place, adjacent to where it reads them, and derives one
boolean from that list. Nothing enumerates "all the pane's queries" automatically.
The asymmetry is the whole point: forgetting to _add_ a query yields today's
behaviour, a tile that pops in slightly early — annoying, recoverable, visible in
one look. Forgetting to _exclude_ a gated query yields a pane that is a permanent
shimmer. The opt-in list makes the second mistake require a positive act.

**The predicate is `status === 'loading'`. `status !== 'done'` is banned as a settle
predicate.** That is the exact shape of the defect: all four tiles are written
`!== 'done'`, which silently folds `idle` and `error` in with in-flight. Where the
status is a union the union already draws this line — `useGroupSource`'s
`SourceStatus` is `'idle' | 'loading' | 'done' | 'error'`, one member per row of §3's
table. A settle predicate that reads anything other than the in-flight member is
wrong regardless of how it is spelled.

Two corollaries fall out:

- **A fact already in hand is not a query and is never in the settle set.**
  `AppPushTile` (`GroupOverviewPane.tsx:245-261`) reads `group.pushMappings` off the
  summary the pane was handed. Its `null` at `:250` means "this group pushes to no
  apps," which is a settled answer, not a pending one. It renders with the pane.
- **A secondary read inside a resolved tile is a per-tile decision, not a pane-level
  one.** The admin-role count (`:203`) and the referencing-rule count (`:230`) each
  append a detail line to a tile that has already rendered. Putting them in the
  pane's settle set would hold the entire pane for a subordinate fact. Whether a
  late detail line is acceptable inside a settled tile, or should instead occupy
  space the tile reserved for it, is a question about that tile's own layout.

### 5. Reuse `Skeleton`; validate `card` against the tiles

[`Skeleton`](../../src/sidepanel/components/shared/Skeleton.tsx) is the primitive —
`variant` (`text` / `row` / `card`), `size`, `count`, `width`, `label`. **No new
primitive.** The `label` becomes the pane's `role="status"` announcement, so it names
what is being read.

One caution, because it is load-bearing and easy to assume away: **`variant="card"`
has no production consumer.** Its only occurrence anywhere under `src/` is
`Skeleton.test.tsx:45`. All fourteen live call sites use `row` or `text`. The `card`
bone is a fixed three-part stack — a short label line, a large number, a detail
line — which _sounds_ like a verdict tile and has never been checked against one. An
implementer adopting it for Overview is its first real user and must compare the
rendered placeholder against the settled tile's actual height before accepting the
shape. If it does not fit, adjusting the `card` bone is in scope for that work;
inventing a fourth variant is not.

## Consequences

- **`GroupOverviewPane` is the reference implementation and the first `card`
  consumer.** Its settle set is the two auto-loading reads — app assignments and
  assigning rules. `MembershipSourceTile`'s gated status is excluded by §3, and that
  exclusion is the single line keeping a large group's Overview from shimmering
  forever.
- **The pane's "omitted, never a zero" rule is unchanged.** This ADR governs when the
  pane appears, not what a tile is allowed to claim once it has. A tile with no
  answer still renders nothing rather than a dash.
- **This does not contradict the skeleton-vs-spinner rule; it depends on it.**
  `docs/motion.md` keeps `LoadingSpinner` for unknown-shape work and for every error
  path, and `docs/ux-guidelines.md` routes errors to `AlertMessage`. §3 excludes
  failed queries from the settle set for exactly that reason: a failure is not
  content arriving, so it must never sit behind a skeleton. A pane whose layout is
  not known ahead of time is not a candidate for this rule at all.
- **Both of those docs need a paragraph they do not yet have**, and neither is edited
  here because another workstream owns them: `docs/motion.md`'s skeleton-vs-spinner
  section should gain the granularity rule (one skeleton per pane, not one per tile)
  alongside its existing per-row `size` guidance, and `docs/ux-guidelines.md`'s
  loading/empty/error section should note that gated-idle is a fourth state, distinct
  from all three.
- **The existing `Skeleton` call sites are inconsistent, and that is separate work.**
  The same `row` variant is passed three different sizes across list panes (`sm` on
  Groups, `md` on Members and User profile, `lg` on Apps, Rules, Policies, User apps
  and Group memberships) and two different counts (4 and 6); three panes pass the
  skeleton down through a `skeleton={…}` prop (Policies, Rules, `MemberList`) while
  the rest render it inline. Some of that spread is justified — `docs/motion.md` ties
  `size` to the row's own padding — and some is drift. Sorting which is which is a
  survey across eight files with no bearing on this decision, and belongs in its own
  ledger item.
- **A pane with exactly one query gets nothing new from this rule**, and that is
  fine. It already renders one skeleton for its whole layout by construction; the
  rule becomes vacuous rather than demanding ceremony.
- **What the code does not settle, and the owner must:** Overview renders _nothing_
  for a failed read today — there is no per-tile error state to fall back to once §3
  lets the pane through. Whether a failed access-grants read should show an
  `AlertMessage` in the tile's place, offer a retry, or keep today's silent absence
  is a UX decision this ADR deliberately leaves open, because it is a question about
  the tile rather than about the pane's settle.
