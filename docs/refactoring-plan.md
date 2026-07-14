# Refactoring plan (living)

Start here for the remaining maintainability work. This is the execution backlog
that follows the 2026-07 baseline audit; it is **living** — check items off and add
new ones as they surface. The point-in-time findings are in
[audit/2026-07-audit.md](./audit/2026-07-audit.md); the "why" is in [adr/](./adr/).

**Ground rules for every item below**

- Read only the doc(s) named in the item (see the CLAUDE.md routing table).
- Tests-first for anything with runtime behavior; keep `npm run test:run`,
  `npm run type-check`, and `npm run lint` (0 errors) green after each change.
- Land small and sequential — one component/concern per change, `prettier --write`
  touched files. Prefer the shared utils/components that already exist.

Status legend: `[ ]` todo · `[~]` partially done · `[x]` done.

---

## Order of work (do top-to-bottom; each is independently shippable)

### 1. `[ ]` One-time repo-wide format, then turn on the gates

- Run `npm run format` as its own dedicated commit (ADR-0003).
- Re-enable the two CI steps in [.github/workflows/ci.yml](../.github/workflows/ci.yml):
  the `format:check` step and the coverage step (only once §5 has raised coverage).
- Doc: `docs/development.md`. Agent: none (mechanical).
- Done when: `npm run format:check` passes in CI.

### 2. `[~] `console.* → logger` migration

- Replace remaining raw `console.*` (~324 sites; background/content/`useOktaApi/core.ts`
  hot paths already done) with `createLogger(scope)` from
  [src/shared/utils/logger.ts](../src/shared/utils/logger.ts). **Never log tokens or
  payloads** — action/endpoint/outcome only.
- Then flip `no-console` `warn`→`error` in [eslint.config.js](../eslint.config.js)
  (keep the logger module's `eslint-disable`), and update ADR-0004.
- Heaviest files: `content/index.ts`, `RulesTab.tsx`, `useUserContext.ts`,
  `useGroupContext.ts`, `UsersTab.tsx`, `apiScheduler.ts`.
- Doc: `docs/development.md`. Agent: `security-logging-reviewer` to verify no leaks.
- Done when: `grep -rn "console\." src` returns only `logger.ts`; lint stays 0 errors.

### 3. `[ ]` Route raw `<button>`s through shared `Button`

- ~54 raw `<button>`s in feature components → shared `Button`. Where a shape is
  missing (filter chip / toggle), add a `chip`/`toggle` variant to `Button` rather
  than inline classes. Same for raw `<input>/<select>/<textarea>`.
- Sites: `GroupsTab.tsx`, `RulesTab.tsx`, `GroupCollections.tsx`, `SearchDropdown.tsx`, …
- Doc: `docs/components.md`. Agent: `component-builder`; verify with `ui-reviewer`.
- Done when: `grep -rn "<button" src/sidepanel/components` hits only `shared/`.

### 4. `[~]` Finish the `error → danger` codemod

- 29 call sites still pass `type: 'error'` to `AlertMessage`. Migrate them to
  `'danger'` (the alias in [shared/status.ts](../src/sidepanel/components/shared/status.ts)
  keeps them working meanwhile), then drop the `'error'` alias from
  `StatusTypeWithLegacy`.
- Doc: `docs/design-system.md` / ADR-0002. Agent: `ui-reviewer`.
- Done when: `grep -rn "'error'" src` finds no status usages; alias removed.

### 5. `[~]` Adopt the shared utils everywhere

- Replace remaining inline Okta-domain checks (~15 sites) with `isOktaUrl`
  ([shared/utils/oktaUrl.ts](../src/shared/utils/oktaUrl.ts)) — e.g.
  `useOktaPageContext.ts`, `useGroupContext.ts`, `useUserContext.ts`.
- Replace the duplicate `formatDate`/`getRelativeTime` in `UsersTab.tsx`,
  `users/UserProfileCard.tsx`, `csvUtils.ts` with
  [shared/utils/dateFormat.ts](../src/shared/utils/dateFormat.ts).
- Doc: `docs/development.md`. Agent: `architecture-refactor`.
- Done when: no duplicate implementations remain.

### 6. `[~]` zod at the fetch boundary + `any` burndown

- In `content/index.ts`, parse Okta JSON with the schemas in
  [shared/schemas/okta.ts](../src/shared/schemas/okta.ts) via `parseOkta(...)` right
  after `response.json()`; extend schemas as new endpoints are covered (hot paths:
  users, groups, memberships).
- Replace `any` in the message/API layer with inferred types; target the 68 `any`s.
- Then flip `@typescript-eslint/no-explicit-any` `warn`→`error` (ADR-0004/0006).
- Doc: `docs/development.md` + `docs/architecture.md`. Agents: `test-writer`
  (schema tests), `security-logging-reviewer`.
- Done when: hot-path responses validated; `any` count near zero; rule flipped.

### 7. `[ ]` Decompose the god components (tests-first)

- Order: `UserComparisonModal.tsx` (967) → `GroupsTab.tsx` (935, 23 useState) →
  `UsersTab.tsx` (1364, 19 useState) → `content/index.ts` (1344).
- Per file: (1) pin behavior with RTL/MSW tests; (2) extract logic into `use*` hooks
  (mirror the `useOktaApi/` module split); (3) move pure helpers to `shared/utils`;
  (4) split UI into subcomponents (like `overview/members/`); (5) re-verify.
- Also: merge the near-identical `useGroupContext`/`useUserContext` into a shared
  `useOktaTabContext` base.
- Target: no component over ~300 lines.
- Doc: `docs/state-management.md`. Agents: `test-writer` then `architecture-refactor`.
- Done when: each target is decomposed with tests, behavior unchanged.

### 8. `[ ]` Raise coverage + enable the coverage gate

- Add component tests as §7 proceeds until `npm run test:coverage` meets 80/75, then
  add the coverage step to CI (see §1).
- Also standardize on the single content-script path (drop the direct
  side-panel→content route that bypasses the scheduler — `useOktaApi/core.ts`).
- Doc: `docs/testing.md` / `docs/architecture.md`. Agent: `test-writer`.

### 9. `[ ]` Small cleanups

- Tokenize the `AttributeFacet.tsx` dataviz ramp (define a named `chartPalette`).
- Reconcile the `SchedulerContext` poll+push double source of truth when next touched.

---

## Suggested first session after a context clear

> "Read docs/refactoring-plan.md and CLAUDE.md. Start with item 2 (console→logger
> migration) for `src/content/index.ts` only: migrate its console calls to the
> logger with no payload/token logging, keep tests/lint/type-check green, and have
> the security-logging-reviewer agent verify no leaks."

Pick one item, keep it small, verify green, repeat.
