# State management & component decomposition

## Hook vs context vs local state

- **Local `useState`** — state used by one component and its immediate children.
- **Custom hook** (`src/sidepanel/hooks/`) — reusable logic, data fetching, or any
  cluster of related state + effects. This is the default home for logic.
- **Context** (`src/sidepanel/contexts/`) — genuinely global, cross-tree state.
  There are exactly two: `SchedulerContext`, `ProgressContext`. Add a third only
  when state is needed by distant, unrelated parts of the tree.

If a component has more than ~8 `useState`s, that's a smell — extract a hook.

## God-component decomposition (the target shape)

Four files concentrate risk and block testing: `UsersTab.tsx` (1364 lines, 19
`useState`), `GroupsTab.tsx` (935, 23), `UserComparisonModal.tsx` (967),
`content/index.ts` (1344). Target: no component over ~300 lines.

**Decompose tests-first, incrementally** (never a big-bang rewrite):

1. **Pin behavior** — write RTL/MSW tests around the current component so refactors
   are verifiable (see [testing.md](./testing.md)).
2. **Extract logic into hooks** — move data fetching, business logic, and derived
   state into `use*` hooks. Mirror the `useOktaApi/` module split.
3. **Extract helpers** — move formatting/pure functions to `shared/utils` (dedupe
   `formatDate`/`getRelativeTime`/`isOktaUrl` while you're there).
4. **Split UI into subcomponents** — one concern each (row, filter panel, header),
   like the well-organized `overview/members/` folder already does.
5. **Verify** tests still green after each step; land one component per PR.

## Reference patterns already in the repo

- Good: `useOktaApi/` (module split), `overview/members/` (small focused
  components), `ProgressContext` (documented, `useMemo`d).
- The near-identical `useGroupContext`/`useUserContext` (~227 lines each) should be
  unified into a shared `useOktaTabContext` base — a concrete example of the
  extract-a-hook pattern.

## Effects & subscriptions

Guard against stale async results (request-id/abort guards — already done in the
context hooks). Clean up intervals/listeners on unmount. Prefer a single source of
truth over polling + push for the same data (`SchedulerContext` currently does
both — reconcile when touched).
