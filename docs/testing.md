# Testing

Stack: **Vitest 4** + **@testing-library/react**, jsdom env (`src/test/setup.ts`).
Coverage via v8, thresholds lines 75%, statements 75%, functions 70%, branches 65%
(enforced in CI). This is the one place prose spells the numbers out; everywhere else
refers to `vitest.config.ts`, which is authoritative
([adr/0019](./adr/0019-coverage-threshold-recalibration.md)).

Two projects: `unit` (jsdom, browser-free — `npm run test:run`) and `storybook`
(headless Chromium, every story as a render test — `npm run test:storybook`). Only
`unit` feeds the coverage gate.

## What to test where

- **Pure logic / utils** — unit tests. Good examples: the rule engine
  (`ruleEvaluator`), `mfaUtils`, `auditStore`, `memberAnalytics`. Keep this bar for
  every new util.
- **Hooks** — test extracted logic hooks directly with `renderHook`. When you extract
  a hook from a god component, it gets a test.
- **Components** — RTL tests for shared components and feature components with real
  behavior: interactions, conditional states, error paths. Query by role, assert what
  the user sees. A component whose whole contract is "renders these props" gets a
  story instead ([adr/0023](./adr/0023-test-value-policy.md)).

### What a story actually asserts

A story without a `play` function asserts exactly two things: **it renders without
throwing, and it is axe-clean** ([adr/0011](./adr/0011-storybook-single-docs-site.md),
[adr/0014](./adr/0014-storybook-hardening.md)). It does **not** check that the right
text appeared, that a callback fired, or that a derived value is correct. Only a
`play` function does that, and at the time of writing **6 of 115 story files have
one**.

This matters when applying ADR-0023's "one runner per pure-render component". A
2026-08-13 audit found 45 components carrying both a `.test.tsx` and a
`.stories.tsx` and checked whether the story could stand in for the test. **None
could.** Even the three whose stories have `play` functions cover different ground
than their tests — `AuthPoliciesTab`'s play expands a policy, while its test also
pins re-expansion caching and the ADR-0018 visibility deferral.

So "there's already a story" is **not** on its own a reason to delete a test. Removal
under [adr/0022](./adr/0022-test-lifecycle.md)(2) requires the story to actually
assert the same behavior — read its `play` function and say so in the PR note. Going
forward, the rule bites at authoring time: don't write a render-only test for a
component that already has a story.

## Mocking the network — at the facade, not MSW

The side panel **never calls `fetch`**. Every Okta request goes side panel →
background scheduler → content script, and the content script holds the only `fetch`
in the codebase. So there is no request for MSW to intercept, and MSW is not used
anywhere in this repo ([adr/0010](./adr/0010-component-explorer.md)).

Mock at the layer under test instead:

- **Component / hook tests** — mock the `useOktaApi` facade (or the specific
  operations module), returning resolved/rejected `ApiResponse` shapes.
- **`useOktaApi/*` operation tests** — pass a fake `CoreApi` whose `makeApiRequest` is
  a `vi.fn()`. This is the seam the whole module-per-concern layout exists for.
- **Scheduler / content-script tests** — `globalThis.fetch` is already a `vi.fn()`
  from `src/test/setup.ts`; set its resolved value per case.
- **Stories** — mock at the facade via `.storybook/mocks/useOktaApi.mock.ts`.

`src/test/mocks/fixtures.ts` exports the `mockUsers` / `mockGroup` **fixtures** used
by 32 stories and tests. It was `handlers.ts` until its vestigial MSW handler array —
which no `setupServer` ever consumed — was removed along with the `msw` dependency.

Shared fakes live in `src/test/factories/`. `makeFakeCore` there is the `CoreApi`
fake every `useOktaApi/*` suite builds on; pass per-suite defaults through its
`overrides` rather than changing the factory's.

## Conventions

- Co-locate: `Foo.test.ts(x)` next to `Foo`.
- Test behavior, not implementation: query by role/text (`getByRole`), assert what
  the user sees, avoid snapshotting large trees.
- Fixtures or factories used by three or more files live in `src/test/`, not copied
  into each ([adr/0023](./adr/0023-test-value-policy.md)).
- For refactors, **write the test against current behavior first** (it should pass),
  then refactor and keep it green — that's the safety net (see
  [state-management.md](./state-management.md)).
- **Never modify or delete an existing test to make it pass** ([adr/0012](./adr/0012-no-test-tampering.md)).
  A red test is a signal to investigate. Fix the code, or — if the behavior
  legitimately changed — update only the test's setup/mocks/fixtures. Rewriting an
  assertion or deleting/skipping a case to silence a failure is banned; if the
  assertion itself looks wrong, flag it in the PR and stop.
- **Removing a test is not the same as silencing one** ([adr/0022](./adr/0022-test-lifecycle.md)).
  Four cases are allowed — the subject was deleted, a story already asserts the same
  render, the unit was replaced and the suite is retargeted assertion-by-assertion,
  or the assertion pins something [adr/0023](./adr/0023-test-value-policy.md) bans.
  Each needs a PR note naming what stays covered.
- **What we don't test** ([adr/0023](./adr/0023-test-value-policy.md)): CSS class or
  inline-style assertions, referential identity (`Object.is` on props/callbacks),
  props brokered to mocked children, static literal tables, and a second runner for a
  pure-render component that already has a story. Fixtures used by 3+ files live in
  `src/test/`.
- **Always put a hard external timeout around any local `vitest run`** —
  `perl -e 'alarm 240; exec @ARGV' npx vitest run <file>`. `--testTimeout` does
  **not** stop a render loop (an infinite loop starves the timer). If a runner
  survives the wrapper, reap it with `pkill -9 -f '^[^ ]*node[^ ]* .*vitest'`, and
  make that `pkill` **its own final command** — never chain it ahead of anything
  that still needs to run (a commit, the `git checkout --` that restores a mutated
  file, the next run). `pkill -f` matches the full command line of every process,
  so the old bare `-f vitest` pattern also SIGKILLed the shell that invoked it, and
  everything sequenced after it silently vanished behind a bare non-zero exit. The
  `^[^ ]*node[^ ]* ` anchor matches only a process whose command line _starts_ with
  a node binary, which a shell never does. It does still match every vitest runner
  on the machine, including another agent's — when writers run in parallel,
  `pgrep -a -f '^[^ ]*node[^ ]* .*vitest'` first and `kill -9 <pid>` only the run
  you started. A hanging test file also poisons unrelated commits, since the husky
  pre-commit resolves `vitest related --run` imports on disk. CI installs Chromium
  for the browser project; local runs pin the sandbox binary via
  `VITEST_BROWSER_EXECUTABLE` (the `unit` project is browser-free). In the dev
  container that is:

  ```
  VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:storybook
  ```

  The pinned Playwright expects a newer Chromium build than the image ships, so
  without the override it tries to download one and fails. Point it at the installed
  binary — never skip the browser project to get a green run.

## Coverage gate

The thresholds in `vitest.config.ts` are enforced in CI — the `verify` job runs
`npm run test:coverage`. The gate is a **ratchet against regression, not a quality
target**: it sits a few points below actual coverage so a real drop trips it while
routine work stays green ([adr/0019](./adr/0019-coverage-threshold-recalibration.md)).
Keep new code covered so the gate stays green; the `test-writer` agent owns this.
Malformed-Okta-payload rejection is covered by the zod schema tests (see
[adr/0006](./adr/0006-zod-boundary-validation.md)).

Coverage says nothing about whether code is _reachable_. Two things follow, and they
pull in opposite directions:

- A **fully-tested dead module** scores 100% and inflates the average. Deleting it
  makes the percentage go **down** even though the codebase got healthier — removing
  `statusNormalizer.ts` cost ~0.1 points.
- An **untested dead module** never appears at all. `coverage.all` is not enabled, so
  v8 only instruments files a test actually loads; a file no test imports is absent
  from the denominator entirely.

So the gate cannot see dead code in either direction, and a small coverage drop from a
deletion PR is expected rather than a regression. `npm run knip:production` is what
finds it — see [dead-code.md](./dead-code.md).
