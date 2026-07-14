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

### 1. `[~]` One-time repo-wide format, then turn on the gates

- [x] Run `npm run format` as its own dedicated commit (ADR-0003).
- [x] Re-enable the `format:check` CI step in
      [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- [ ] Add the coverage CI step (only once §5/§8 has raised coverage to 80/75).
- Doc: `docs/development.md`. Agent: none (mechanical).
- Done when: `npm run format:check` passes in CI. ✔ (coverage gate pending §8)

### 2. `[~] `console.* → logger` migration

- [x] Migrated ~260 sites across shared infra, hooks, content, background, and
      components to `createLogger(scope)`; security-logging review verified no
      token/payload/PII leaks (fixed 4 endpoint-query-string leaks in the scheduler).
- [ ] The 3 context hooks (`useGroupContext`/`useUserContext`/`useOktaPageContext`,
      56 calls) are deferred to the §7 `useOktaTabContext` merge (rewritten with fresh
      lean logging), plus `ruleEvaluator.test.ts` console-spy assignments.
- [ ] Flip `no-console` `warn`→`error` in [eslint.config.js](../eslint.config.js)
      once the above land, and update ADR-0004.
- Doc: `docs/development.md`. Done when: `grep -rn "console\." src` returns only
  `logger.ts` (+ intentional test spies); rule flipped.

### 3. `[~]` Route raw `<button>`s through shared primitives

Approach chosen (not "everything through `Button`"): a small **primitive family** —
`Button` (CTA), new `IconButton` (icon-only), `FilterPill` (chip/toggle, promoted to
`shared/`). Raw `<button>`s **inside** `shared/` primitives are allowed; the target is
no raw buttons in **feature** components. A few genuinely-custom controls stay raw,
documented (tab bar, dynamic-color banner, radio-cards, data-viz bars).

- [x] Built `IconButton` (+ tests); promoted `FilterPill` to `shared/`; barrel updated.
- [x] Migrated ~22 raw buttons across 19 **stable** (non-god) feature components to
      `Button`/`IconButton`/`FilterPill`. 7 left raw as documented custom controls.
- [x] **Stable text inputs** routed through shared `Input` (extended with
      `onKeyDown`/`autoFocus`/`inputRef` + a `bg-white` base): `GroupCollections` (3),
      `BulkOperationsPanel`, `CrossGroupSearch`, `CompositionReports`. `UserSearchBar`
      left raw+documented (trailing clear-button + spinner + refocus composite).
- [x] **Checkboxes** → new shared `Checkbox` primitive (`GroupExportModal` 2,
      `GroupListItem` 1). Added to the barrel with tests.
- [ ] **God-component buttons** (`GroupsTab` 10, `RulesTab` 4, `UsersTab` 3,
      `UserComparisonModal` 2) + their raw text inputs (`GroupsTab` 2, `UsersTab` 2,
      `RulesTab` 1, `UserComparisonModal` 1) → migrate during their §7 decomposition.
- [ ] **`AttributeFacet`** (4) → with the §9 chart tokenization.
- Doc: `docs/components.md`. Agent: `component-builder`; verify with `ui-reviewer`.
- Done when: no raw `<button>` in feature components except documented exceptions;
  form controls routed through shared `Input`/`Select`/`Textarea`/`Checkbox`.

### 4. `[x]` Finish the `error → danger` codemod

- [x] Migrated the 12 `AlertMessage type:'error'` call sites to `'danger'` and
      removed the `'error'` alias + `normalizeStatus` from
      [shared/status.ts](../src/sidepanel/components/shared/status.ts); AlertMessage now
      consumes the canonical `StatusType` directly. (The unrelated `ConnectionStatus`
      union and `StatCard`/`PageHeader` `variant='error'` color prop are a separate
      vocabulary, intentionally untouched.)
- Doc: `docs/design-system.md` / ADR-0002.

### 5. `[~]` Adopt the shared utils everywhere

- [x] `isOktaUrl` adopted at all non-hook sites (the only remaining inline checks
      are in the 3 context hooks, handled by the §7 `useOktaTabContext` merge).
- [x] `UserProfileCard` adopts `dateFormat` (`formatDateShort` added for date-only).
- [ ] `UsersTab.tsx` inline `formatDate`/`getRelativeTime` — removed during its §7
      decomposition. `csvUtils.formatDateForCSV` is a distinct CSV format — keep.
- Doc: `docs/development.md`. Agent: `architecture-refactor`.
- Done when: no duplicate implementations remain (UsersTab pending §7).

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
