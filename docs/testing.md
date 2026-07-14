# Testing

Stack: **Vitest 4** + **@testing-library/react** + **MSW** (`src/test/mocks/handlers.ts`,
`src/test/setup.ts`), jsdom env. Coverage via v8, thresholds lines/functions/
statements 80%, branches 75% (enforced in CI once component tests land).

## What to test where

- **Pure logic / utils** — unit tests. Already covered: rule engine, `statusNormalizer`,
  `mfaUtils`, `auditStore`, `memberAnalytics`. Keep this bar for every new util.
- **Hooks** — test extracted logic hooks directly (see `useOktaApi.test.ts`). When you
  extract a hook from a god component, it gets a test.
- **Components** — RTL tests for shared components and feature components with real
  behavior (interactions, conditional states). **This is the current gap: zero
  component tests exist.** New/refactored components must ship with tests.

## Conventions

- Co-locate: `Foo.test.ts(x)` next to `Foo`.
- Mock the network with **MSW**, not by stubbing `fetch` — add handlers to
  `src/test/mocks/handlers.ts`. This keeps the message-passing/API layer realistic.
- Test behavior, not implementation: query by role/text (`getByRole`), assert what
  the user sees, avoid snapshotting large trees.
- For refactors, **write the test against current behavior first** (it should pass),
  then refactor and keep it green — that's the safety net (see
  [state-management.md](./state-management.md)).

## Priority backlog

1. Shared components (`Button`, `Modal` incl. new a11y: focus trap, Escape).
2. The four god components as they're decomposed (`UsersTab`, `GroupsTab`,
   `UserComparisonModal`, plus content-script message handlers).
3. zod schemas — test that malformed Okta payloads are rejected cleanly.

The `test-writer` agent owns this backlog and keeps coverage above threshold.
