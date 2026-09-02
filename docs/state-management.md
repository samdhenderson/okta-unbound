# State management & component decomposition

## Hook vs context vs local state

- **Local `useState`** — state used by one component and its immediate children.
- **Custom hook** (`src/sidepanel/hooks/`) — reusable logic, data fetching, or any
  cluster of related state + effects. This is the default home for logic.
- **Context** (`src/sidepanel/contexts/`) — genuinely global, cross-tree state.
  There are exactly two: `SchedulerContext`, `ProgressContext`. Add a third only
  when state is needed by distant, unrelated parts of the tree.

If a component has more than ~8 `useState`s, that's a smell — extract a hook.

## God-component decomposition (how we decomposed)

The overhaul broke up four files that concentrated risk and blocked testing:
`UsersTab.tsx` (1364 → 237 lines), `GroupsTab.tsx` (935 → 509),
`UserComparisonModal.tsx` (967 → 91), `content/index.ts` (1344 → 328).

**~300 lines is the target, not a description of the current tree.** Over a dozen
components are still above it, `GroupsTab.tsx` and `RulesTab.tsx` furthest. Two are
benign by construction — `Icon.tsx` is a flat glyph registry and `ActivityBarView.tsx`
is a presentational shell — but the rest are decomposition candidates. Count them
rather than trusting a number written here, which goes stale within a PR or two:

```
find src/sidepanel/components -name "*.tsx" \
  -not -name "*.test.tsx" -not -name "*.stories.tsx" \
  | xargs wc -l | sort -rn | head -20
```

Hold the line for new work, and prefer extracting a hook to letting one of these grow.

The decomposition ran **tests-first and incrementally** (never a big-bang rewrite) —
the same playbook for any future large component:

1. **Pin behavior** — write RTL tests around the component so refactors are
   verifiable, mocking at the `useOktaApi` facade (see [testing.md](./testing.md)).
2. **Extract logic into hooks** — move data fetching, business logic, and derived
   state into `use*` hooks. Mirror the `useOktaApi/` module split.
3. **Extract helpers** — move formatting/pure functions to `shared/utils` (dedupe
   `formatDate`/`getRelativeTime`/`isOktaUrl` while you're there).
4. **Split UI into subcomponents** — one concern each (row, filter panel, header),
   like the well-organized `components/members/` folder does.
5. **Verify** tests still green after each step; land one component per PR.

## Reference patterns already in the repo

- Good: `useOktaApi/` (module split), `components/members/` (small focused
  components), `ProgressContext` (documented, `useMemo`d).
- The once near-identical `useGroupContext`/`useUserContext` both used to run their
  own `useOktaTabContext` instance (`src/sidepanel/hooks/useOktaTabContext.ts`) as
  a thin wrapper — a worked example of the extract-a-hook pattern.
  `useUserContext.ts` still is. ADR-0058 took `useGroupContext` a step further: it
  is now a pure selector over the panel's single `useOktaPageContext` engine
  (`src/sidepanel/hooks/useGroupContext.ts`) — no `useOktaTabContext` instance, no
  probe, no listener, no state of its own.
- **Lift only what a neighbour reads.** `useUserDetailPanes` owns the user rung's
  three panes but lifts exactly one thing: _which_ pane is on screen, because the
  action bar and the page header above the card both read it. Every filter, pill and
  disclosure inside a pane stays local — panes are hidden rather than unmounted, so
  local state survives a switch without being lifted or persisted.
- **One hook serving two differently-shaped surfaces keys on the domain identifier,
  not on the row type.** `useProfileEdit` drives both the Users tab's flat attribute
  list and the Compare view's two-column parity rows. It returns
  `cells: Record<string, AttributeEditCell>` keyed by the bare Okta attribute
  **name** — the same key as the draft and the patch — so each surface indexes
  `cells[attribute.name]` from whatever row type it already has. Widening a derived
  row type to carry edit state instead would have coupled the hook to one surface's
  shape and forced the other to fabricate it. The hook also holds no module state, so
  the Compare view simply instantiates two (ADR-0035).
- **A config that is read differently from how it is stored** keeps both copies.
  `useProfileDisplayConfig` holds the stored config (written back verbatim) beside a
  reconciled one (projected onto what exists right now); the second is what renders,
  the first is what survives a failed load. See ADR-0033 for why the reconciliation
  must not write back.

## Sub-navigation inside a tab: the view stack

`useViewStack` (`hooks/useViewStack.ts`, ADR-0016) is a hook, not a context, because
sub-navigation has one owner and one subtree, and each tab needs its **own** stack.
Instantiate it once per tab shell; it returns `currentEntry`, `depth`, `isRoot`, a
breadcrumb `trail`, and `push`/`pop`/`popTo`/`reset`.

**It preserves navigation state only.** What a consumer must do so `pop` looks like a
real "back", in order of preference:

1. **Keep the list mounted and hide it** (`hidden` / `className="hidden"`), rendering
   the pushed view as its **sibling**. Every `useState` inside the list survives,
   however deep, and so does the element focus is restored to.
2. **Lift the state** into a hook owned by the tab shell. Needed per piece, and it
   cannot reach state owned by a row (e.g. a row's `expanded` flag), which is why
   option 1 is preferred.

**Scroll is the exception either way.** `display: none` destroys the scroll box, so
`scrollTop` returns as `0`. `useScrollPreservation(ref, visible)` captures it before
the hide and restores it in a layout effect on the way back.

## Scroll across a top-level tab switch — already handled

Do **not** add scroll handling to a new tab. Only Groups and Users own a scroll box
(`ScrollableList`); every other tab scrolls the single `h-screen overflow-y-auto`
root div in `App`, shared by all of them. `TabPanel` (`components/TabPanel.tsx`)
wraps every panel and runs `useScrollPreservation` against that shared element, so
each tab banks and restores its own offset and a first visit opens at the top
(ADR-0018). A tab reaching for `window.scrollY` / `window.scrollTo` is a bug — the
window never scrolls in this layout, so both are inert.

Focus moves into the pushed view and is restored to the trigger on `pop`, with **no
focus trap** — see [ux-guidelines.md](./ux-guidelines.md).

## Gating background work on visibility

Tabs stay mounted when hidden (ADR-0018), so **any effect that can reach Okta, poll,
re-probe page context, or attach a `window`/`document` listener must be gated on
whether its tab is visible.** The convention:

- The tab component takes `isActive?: boolean` (default `true`, so standalone/story
  use is unaffected) and passes it down to hooks as `enabled?: boolean`.
- **Deferred re-arm** — put `enabled` in the effect's guard _and_ its dependency
  array. The work is deferred, not dropped: it runs on the next show (`useAppsData`).
  The same gate nests one level down: `useUserDetailPanes` passes `pane === 'apps'`
  and `pane === 'profile'` into `useUserApps` and the org's schema read, so opening a
  user pays for the default pane only and entering another pane later runs the work
  that was deferred rather than dropping it.
- **Owed-load latch** — when the effect must _not_ re-run on every return to the tab:
  raise an `owedRef` in one effect keyed on the real inputs, pay it in a second effect
  gated on `enabled` (`useGroupRuleReferences`). Without this, gating turns every tab
  revisit into a refetch.

## Effects & subscriptions

Guard against stale async results (request-id/abort guards — already done in the
context hooks). Clean up intervals/listeners on unmount. Prefer a single source of
truth over polling + push for the same data: `SchedulerContext` subscribes to
`schedulerStateChanged` push messages with no polling interval (only a 1s local
cooldown countdown).
