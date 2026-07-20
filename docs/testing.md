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
- **Always put a hard external timeout around any local `vitest run`** —
  `perl -e 'alarm 180; exec @ARGV' npx vitest run <file>` and `pkill -9 -f vitest`
  after. `--testTimeout` does **not** stop a render loop (an infinite loop starves
  the timer). A hanging test file also poisons unrelated commits, since the husky
  pre-commit resolves `vitest related --run` imports on disk. CI installs Chromium
  for the browser project; local runs pin the sandbox binary via
  `VITEST_BROWSER_EXECUTABLE` (the `unit` project is browser-free).

## Coverage gate

The 80/75 thresholds (`vitest.config.ts`) are enforced in CI — the `verify` job
runs `npm run test:coverage`. Keep new code covered so the gate stays green; the
`test-writer` agent owns this. Malformed-Okta-payload rejection is covered by the
zod schema tests (see [adr/0006](./adr/0006-zod-boundary-validation.md)).
