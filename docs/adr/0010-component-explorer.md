# ADR-0010: Adopt Storybook as the component explorer

- Status: Accepted
- Date: 2026-07-16

## Context

Shared and feature components had no way to be viewed, exercised, or visually
reviewed in isolation — verifying a variant/size/state meant running the whole
extension against a live Okta session. `docs/testing.md` already flags "zero
component tests" as the coverage gap; the same isolation gap existed for visual
review (`ui-reviewer`) and design handoff. The app's data boundary is
`useOktaApi` over `chrome` messaging (`docs/architecture.md`), not `fetch`, so the
existing MSW test setup (`src/test/mocks/handlers.ts`) doesn't help here.

## Decision

Adopt **Storybook 10** (`@storybook/react-vite`, Vite builder) as the component
explorer, with a lean addon set: core `storybook` + `@storybook/addon-a11y` +
`@storybook/addon-docs` only (no Chromatic, no Vitest/browser addon, no MCP
addon).

- Stories **colocate in `src`** as `<Component>.stories.tsx`, mirroring the
  `.test.tsx` colocation convention — not a parallel `stories/` tree.
- Config lives in `.storybook/`: `main.ts` merges the app's Vite config (dropping
  the `@crxjs` plugins, which require the MV3 manifest) and aliases the
  `useOktaApi` facade to a mock; `preview.tsx` wraps every story in the app's real
  provider stack (`ErrorBoundary → ProgressProvider → SchedulerProvider`) and
  installs a benign `chrome` fake.
- **Mock at the `useOktaApi` facade boundary**, not MSW: the extension never
  calls `fetch` from the side panel (all Okta traffic is content-script-only,
  reached via `chrome` messaging), so MSW's request interception has nothing to
  intercept. `.storybook/mocks/useOktaApi.mock.ts` exports a
  `makeUseOktaApiValue()` fixture factory instead.
- `npm run storybook` (dev, `:6006`) and `npm run build-storybook` (static build
  to gitignored `storybook-static/`) are added as npm scripts.
- CI gates `build-storybook` as a parallel job in `.github/workflows/ci.yml`
  (ADR-0005), so a story that doesn't type-check or build fails the PR the same
  way a lint/type/test regression does.
- Every new or changed `shared`/leaf feature component ships a co-located story
  (`docs/component-explorer.md`), enforced the same way test coverage is:
  reviewed at PR time and caught as backlog when missed.

## Consequences

- Adds `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`,
  `@storybook/addon-docs` as dev dependencies; no runtime dependency changes.
- Components can be developed, reviewed, and accessibility-checked (via
  `addon-a11y`) in isolation, without a live Okta session.
- `eslint.config.js` and `typedoc.json` both special-case `**/*.stories.{ts,tsx}`
  (react-refresh export-shape override; excluded from the generated API docs) —
  the same treatment test files already get.
- A second "does it render" surface exists alongside Vitest/RTL; the two are
  complementary, not redundant — Storybook is for visual/interaction review, RTL
  stays the behavioral test of record (`docs/testing.md`).
- Un-storied shared/leaf components are coverage debt, tracked the same way
  under-tested components are.
