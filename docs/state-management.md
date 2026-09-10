# State management & component decomposition

## Hook vs context vs local state

- **Local `useState`** — state used by one component and its immediate children.
- **Custom hook** (`src/sidepanel/hooks/`) — reusable logic, data fetching, or any
  cluster of related state + effects. This is the default home for logic.
- **Context** (`src/sidepanel/contexts/`) — genuinely global, cross-tree state.
  There are exactly four: `SchedulerContext`, `ProgressContext`,
  `NavigationContext` (cross-entity jumps) and `OrgEntityIndexContext`
  (the panel's single mount of the org snapshot index). Add a fifth only when
  state is needed by distant, unrelated parts of the tree — or, as with the
  index, when a _cost_ must be paid once for parts of the tree that cannot share
  a parent below the shell. Home and the ⌘K palette are siblings, and each
  mounting its own copy of `useOrgEntityIndex` meant eight IndexedDB reads and
  eight broadcast listeners for one org's four collections.

  A context that owns a cost, rather than only a value, still answers to the
  visibility rule below: `OrgEntityIndexProvider` takes an `enabled` that `App`
  sets to the union of its readers (Home on screen, or the palette open), so a
  provider mounted for the whole session drives no traffic for a surface nobody
  is looking at.

If a component has more than ~8 `useState`s, that's a smell — extract a hook.

## God-component decomposition (how we decomposed)

The overhaul broke up four files that concentrated risk and blocked testing —
`UsersTab.tsx` (1364 → 237 lines), `GroupsTab.tsx` (935 → 509),
`UserComparisonModal.tsx` (967 → 91), `content/index.ts` (1344 → 328).

**~300 lines is the target, not a description of the current tree.** Over a dozen
components are still above it, `GroupsTab.tsx` and `RulesTab.tsx` furthest; two are
benign by construction (`Icon.tsx` is a flat glyph registry, `ActivityBarView.tsx`
a presentational shell). Count them with `wc -l` over
`src/sidepanel/components/**/*.tsx` rather than trusting a number written here.
Hold the line for new work, and prefer extracting a hook to letting one of these grow.

The decomposition ran **tests-first and incrementally** (never a big-bang rewrite) —
the same playbook for any future large component:

1. **Pin behavior** — RTL tests around the component, mocked at the `useOktaApi`
   facade (see [testing.md](./testing.md)), so refactors are verifiable.
2. **Extract logic into hooks** — data fetching, business logic and derived state
   into `use*` hooks, mirroring the `useOktaApi/` module split.
3. **Extract helpers** — formatting and pure functions to `shared/utils`.
4. **Split UI into subcomponents** — one concern each (row, filter panel, header),
   like `components/members/` does.
5. **Verify** tests still green after each step; land one component per PR.

## Reference patterns already in the repo

- Good: `useOktaApi/` (module split), `components/members/` (small focused
  components), `ProgressContext` (documented, `useMemo`d).
- **One context engine, and a selector over it.** `useUserContext` still wraps its
  own `useOktaTabContext` instance — a worked example of extract-a-hook.
  `useGroupContext` went further and is the shape to copy: **a pure selector over
  the panel's single `useOktaPageContext`** (`hooks/useGroupContext.ts`), one
  `useMemo` and nothing else — no second probe, no listener, no state. Two engines
  cost two round trips per navigation and can disagree about the active tab. The
  two fields answer different questions and stay distinct: `pageType` is only
  meaningful when `connectionStatus === 'connected'`, so **a failed probe reports
  `unknown`, never `admin`** — `admin` is the _successful_ answer "a console page
  carrying no entity", and reading it out of a dead probe conflates the two.
- **Lift only what a neighbour reads.** `useUserDetailPanes` owns the user rung's
  three panes but lifts exactly one thing: _which_ pane is on screen, because the
  action bar and the header both read it. Every filter, pill and disclosure inside a
  pane stays local — panes are hidden rather than unmounted, so local state survives.
- **One hook serving two differently-shaped surfaces keys on the domain identifier,
  not on the row type.** `useProfileEdit` drives both the Users tab's flat attribute
  list and the Compare view's two-column parity rows. It returns
  `cells: Record<string, AttributeEditCell>` keyed by the bare Okta attribute
  **name** — the same key as the draft and the patch — so each surface indexes
  `cells[attribute.name]` from whatever row type it has. Widening a derived row type
  to carry edit state would couple the hook to one surface. It holds no module
  state, so the Compare view instantiates two.
- **A config that is read differently from how it is stored** keeps both copies.
  `useProfileDisplayConfig` holds the stored config (written back verbatim) beside a
  reconciled one (projected onto what exists right now); the second is what renders,
  the first is what survives a failed load. [architecture.md](./architecture.md)
  has why the reconciliation must not write back.

## Sub-navigation inside a tab: the view stack

`useViewStack` (`hooks/useViewStack.ts`) is a hook, not a context, because
sub-navigation has one owner and one subtree, and each tab needs its **own** stack.
Instantiate it once per tab shell; it returns `currentEntry`, `depth`, `isRoot`, a
breadcrumb `trail`, and `push`/`pop`/`popTo`/`reset`.

**It preserves navigation state only.** What a consumer must do so `pop` looks like a
real "back", in order of preference:

1. **Keep the list mounted and hide it** (`hidden` / `className="hidden"`), rendering
   the pushed view as its **sibling**. Every `useState` inside the list survives,
   however deep, and so does the element focus is restored to.
2. **Lift the state** into a hook owned by the tab shell — needed per piece, and it
   cannot reach state owned by a row, which is why option 1 is preferred.

**Scroll is the exception either way.** `display: none` destroys the scroll box, so
`scrollTop` returns `0`; `useScrollPreservation(ref, visible)` captures it before
the hide and restores it in a layout effect on the way back.

## Scroll across a top-level tab switch — already handled

Do **not** add scroll handling to a new tab. Only Groups and Users own a scroll box
(`ScrollableList`); every other tab scrolls the single `h-screen overflow-y-auto`
root div in `App`, shared by all of them. `TabPanel` (`components/TabPanel.tsx`)
wraps every panel and runs `useScrollPreservation` against that shared element, so
each tab banks and restores its own offset and a first visit opens at the top. A tab
reaching for `window.scrollY` / `window.scrollTo` is a bug: the window never scrolls
here, so both are inert. Focus moves into the pushed view and is restored to the
trigger on `pop`, with **no focus trap** — see
[ux-guidelines.md](./ux-guidelines.md).

## Gating background work on visibility

**A tab mounts once and is hidden, never unmounted**, so eight tabs mean eight sets
of live effects and the whole design rests on hidden tabs being inert. **Every tab
receives `isActive` and must gate on it anything that issues an Okta request, polls,
re-probes page context, or attaches a listener to a shared global (`window`,
`document`).** A tab that does not is a background API caller, spending the shared
scheduler's budget on a screen nobody is looking at, and a new tab or mount effect
is not done until it answers "what does this do while hidden?".

**Gating lives at the hook or tab that owns the effect — never as a
`useEntityQuery` option.** `visible` / `revalidateOnShow` were proposed and
rejected: a show-time boolean cannot express work that happens on _hide_
(`useUserComparison` clears itself when its surface goes off-screen), and the
identity worth latching on is not always the cache key — `useAppsData` latches on
`(targetTabId, oktaOrigin)` while caching on origin alone, deliberately, so two
Chrome tabs on one org share an inventory.

**Check upstream before adding a gate.** The `useEntityQuery` call sites pass
`enabled` for key-readiness only and are correctly ungated: what would change their
key is already frozen one level up (`App`'s pinned identity selection,
`deriveTabContext` in `pinContext.ts`), and a second gate below that buys nothing.

`isActive` arrives at a hook as `enabled?: boolean` (default `true`, so standalone
and story use are unaffected). An audit found **five** shapes; only the first two
trigger loads, and anything generalising visibility behaviour has to account for
the other three rather than rediscover them.

| Pattern                    | Behaviour                                                                                                     | Sites                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Owed-load latch**        | fires once per real input change; deferred while hidden; never on a bare reshow                               | `useOwedLoad` — `useAppsData`, `useGroupRuleReferences`, `useGroupAccessGrants`, `GroupDetailView`, `AuthPoliciesTab` |
| **Refetch-on-every-show**  | no idempotency beyond a debounce; re-runs whenever shown                                                      | `useExportTab`'s match-count probe, `useGroupLiveSearch`, `useDebouncedUserSearch`, `useAddToGroup`                   |
| **Reset-on-hide**          | does work when the surface goes **invisible**                                                                 | `useUserComparison`                                                                                                   |
| **Bookkeeping-on-arrival** | fires per arrival; no data, no cache, nothing to key                                                          | `RulesTab`'s `markTabVisited`                                                                                         |
| **Dual-axis owed-resync**  | gated on `enabled` **and** `document.hidden`; a navigation observed while suppressed is owed on the next show | `useOktaTabContext`                                                                                                   |

The latch was the one duplicated shape worth extracting:
`useOwedLoad(identity, ready, run)` (`hooks/useOwedLoad.ts`) remembers which input
it last acted on and acts again only when that input differs. Without it, "gate on
`isActive`" silently turns every tab revisit into a refetch. The **deferred
re-arm** underneath both load rows is `enabled` in the effect's guard _and_ its
dependency array, so work is deferred rather than dropped; it nests, as when
`useUserDetailPanes` passes `pane === 'apps'` / `pane === 'profile'` down so
opening a user pays for the default pane only.

The dual-axis gate is a live capability with tests, but **no production call site
passes `enabled: false` any more**: the pin no longer suspends the context engine
(`App` freezes the identity selection instead), so `!isPinned` is no longer folded
into that flag.

## One skeleton per pane

A **pane** is a tab's content region on a detail rung — the thing a tab switches to,
whose parent owns the tab state. The rule does not reach a list row, a card, a
section inside a pane, or the app shell.

**A pane renders one `Skeleton` for its whole layout and swaps once.** There is no
intermediate state where some tiles are real and others are placeholders — that
state is the defect, drawn in grey — and it never returns to the skeleton for the
same mount. The placeholder approximates the settled layout closely enough that
the swap does not move what a reader is already looking at.

**Only an in-flight query holds the skeleton.** Idle-by-design (gated on a user
act), failed, and settled-empty all release it, and the tile owns its own idle
affordance, error state or empty state. The three share one property: no work is
running, so waiting cannot change the answer. A skeleton over a query nobody
started is a lie; over one that already failed, it is a hang.

**The settle set is an explicit opt-in list, never a scan**, named beside where the
statuses are read. Forgetting to _add_ a query makes one tile pop in early;
forgetting to _exclude_ a gated one makes the pane a permanent shimmer.

**The predicate is `status === 'loading'`; `status !== 'done'` is banned** — it
folds `idle` and `error` in with in-flight, which is the defect. A fact already in
hand is not a query and never joins the set, and a secondary read inside an
already-resolved tile is that tile's layout problem, not the pane's.

## Effects & subscriptions

Guard against stale async results (request-id/abort guards — already done in the
context hooks). Clean up intervals/listeners on unmount. Prefer a single source of
truth over polling + push for the same data: `SchedulerContext` subscribes to
`schedulerStateChanged` push messages with no polling interval (only a 1s local
cooldown countdown). Rules for the pipeline these hooks call into — cancellation,
batch runs, rate-limit buckets — live in [scheduler.md](./scheduler.md).
