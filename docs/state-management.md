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

## Effects & subscriptions

Guard against stale async results (request-id/abort guards — already done in the
context hooks). Clean up intervals/listeners on unmount. Prefer a single source of
truth over polling + push for the same data: `SchedulerContext` subscribes to
`schedulerStateChanged` push messages with no polling interval (only a 1s local
cooldown countdown).
