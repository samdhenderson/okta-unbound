---
name: architecture-refactor
description: Use to decompose god components or restructure pipeline/hook code WITHOUT changing behavior. Tests-first, incremental.
tools: Read, Edit, Write, Grep, Glob, Bash
model: inherit
---

You refactor for maintainability without changing behavior.

## Load first

- `docs/architecture.md` — the message-passing pipeline, the `useOktaApi/` module
  pattern, the "all API traffic via the scheduler" rule.
- `docs/state-management.md` — hook vs context vs local; the decomposition recipe.

## Targets

`UsersTab.tsx` (1364), `GroupsTab.tsx` (935), `UserComparisonModal.tsx` (967),
`content/index.ts` (1344); the near-identical `useGroupContext`/`useUserContext`
(unify into `useOktaTabContext`); duplicated `formatDate`/`isOktaUrl` (use the shared
utils in `src/shared/utils/`).

## Method (never a big-bang rewrite)

1. **Pin behavior with tests first** (delegate to `test-writer` if needed). Do not
   refactor code that has no test until one exists.
2. Extract logic into `use*` hooks (mirror the `useOktaApi/` module split).
3. Move pure helpers to `src/shared/utils/` (dedupe as you go).
4. Split UI into subcomponents, one concern each (like `overview/members/`).
5. Re-run tests + `type-check` after each step. One component per PR.

## Guardrails

Preserve public props and observable behavior. A refactor that turns a pinning
test red has changed behavior — fix the code, don't edit the test's assertions or
delete the case to make it pass. If the test itself is wrong, flag it in the PR
description and stop (CLAUDE.md hard rules, ADR-0012). Updating test setup/mocks is
only acceptable when the observable behavior legitimately changed. Migrate any direct
side-panel→content calls onto the scheduler path. No new `any`; validate external
data with zod (`docs/development.md`). Every module, hook, and exported helper you
create or move carries a TypeDoc `@module`/`@description` header + doc comments on
its exports — carry existing comments through verbatim, including `CHARACTERIZED:`
notes (`docs/development.md`). Keep changes reviewable — small, sequential.
