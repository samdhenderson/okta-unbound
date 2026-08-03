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
`UsersTab.tsx` (1364 → 335 lines), `GroupsTab.tsx` (935 → 405),
`UserComparisonModal.tsx` (967 → 233), `content/index.ts` (1344 → 255). No component
now runs over ~300 lines; hold that line for new work.

The decomposition ran **tests-first and incrementally** (never a big-bang rewrite) —
the same playbook for any future large component:

1. **Pin behavior** — write RTL/MSW tests around the component so refactors are
   verifiable (see [testing.md](./testing.md)).
2. **Extract logic into hooks** — move data fetching, business logic, and derived
   state into `use*` hooks. Mirror the `useOktaApi/` module split.
3. **Extract helpers** — move formatting/pure functions to `shared/utils` (dedupe
   `formatDate`/`getRelativeTime`/`isOktaUrl` while you're there).
4. **Split UI into subcomponents** — one concern each (row, filter panel, header),
   like the well-organized `overview/members/` folder does.
5. **Verify** tests still green after each step; land one component per PR.

## Reference patterns already in the repo

- Good: `useOktaApi/` (module split), `overview/members/` (small focused
  components), `ProgressContext` (documented, `useMemo`d).
- The once near-identical `useGroupContext`/`useUserContext` now share a
  `useOktaTabContext` base (`src/sidepanel/hooks/useOktaTabContext.ts`, 308 lines);
  `useGroupContext.ts` (62 lines) and `useUserContext.ts` (57 lines) are thin
  wrappers over it — a worked example of the extract-a-hook pattern.

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
