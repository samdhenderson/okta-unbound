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

### 2. `[x] `console.* → logger` migration

- [x] Migrated ~260 sites across shared infra, hooks, content, background, and
      components to `createLogger(scope)`; security-logging review verified no
      token/payload/PII leaks (fixed 4 endpoint-query-string leaks in the scheduler).
- [x] The 3 context hooks (56 calls) rewritten with lean logging during the
      `useOktaTabContext` merge; `ruleEvaluator.test.ts` console spies handled via a
      test-file ESLint override (tests may spy on console).
- [x] Flipped `no-console` `warn`→`error` in [eslint.config.js](../eslint.config.js)
      (exceptions: `logger.ts` inline-disable, test files); updated ADR-0004.
- Done: `grep -rn "console\." src` returns only `logger.ts` (+ comment examples and
  intentional test spies); rule flipped and enforced.

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
  - **`UserComparisonModal` correction (session 5):** its raw-control migration is a
    **separate follow-up commit** after its §7 decompose-only pass, and 2 of its 3
    controls **cannot migrate cleanly** — so its true migratable count is **1**, not 2+1:
    - `L597` is a `role="tab"` tablist item → already a documented §3 tab-bar exception.
    - `L710` needs a **new chevron `IconType`** that does not exist yet.
    - `L429` → shared `Input` is **NOT pixel-neutral** (`py-3`/`border-200`/`shadow-sm`
      vs the shared base's `px-3 py-2`/`border-300`/no shadow). Needs a design call, not
      a mechanical swap.
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

- [x] `isOktaUrl` adopted everywhere, including the 3 context hooks (the inline
      checks were removed in the `useOktaTabContext` merge).
- [x] `UserProfileCard` adopts `dateFormat` (`formatDateShort` added for date-only).
- [ ] `UsersTab.tsx` inline `formatDate`/`getRelativeTime` — removed during its §7
      decomposition. `csvUtils.formatDateForCSV` is a distinct CSV format — keep.
- Doc: `docs/development.md`. Agent: `architecture-refactor`.
- Done when: no duplicate implementations remain (UsersTab pending §7).

### 6. `[~]` zod at the fetch boundary + `any` burndown

- [x] Wired strict `parseOkta` into the two single-object read paths that already
      degrade gracefully: `handleGetUserInfo` (`oktaUserSchema`, falls back to page
      scraping) and `handleGetGroupInfo` (`oktaGroupSchema`, falls back to 'Unknown').
      Added `oktaGroupSchema` tests. Removed the `userStatus as any`.
- [ ] Multi-item / non-standard-shape paths deferred: search-users/groups and
      `getUserGroups` return lists (throwing on one sparse item would nuke the whole
      result — needs a resilient per-item parse decision first); `getUserContext` hits
      the non-standard `/admin/users/search` `aaData` DataTables shape (own schema).
  - **⚠️ session-5 correction — do NOT wire the strict schemas into the list paths.**
    The premise was wrong. `oktaGroupSchema` (`shared/schemas/okta.ts:64-70`) is a bare
    `z.object` with **no `.passthrough()`**, so parsing a list item **strips**
    `type`/`_embedded`/`lastUpdated`/`created` — silently zeroing member counts and
    misclassifying every `APP_GROUP` as `DIRECT`. That is **silent corruption, worse
    than throwing**. Also there is still **no single fetch boundary**: search exists
    twice, on two transports. Revisit list-path validation only **after §8** unifies the
    transport, and add `.passthrough()` (or explicit fields) before it touches any list.
  - **Bounded items safe to do now (session 5):**
    - Delete the **dead `oktaUserListSchema`** (`okta.ts:72`, zero call sites).
    - Fix `parseOkta` interpolating **zod's error message into `log.warn`** — it echoes
      received values, so it becomes a PII leak the moment anyone adds a `z.enum` over a
      PII field. Log the issue _paths/codes_, never the value.
- [x] Burned down the message/API-layer `any`s (60→4): typing-only, precise types
      across content/useOktaApi/scheduler/tabState/rulesCache (introduced
      `MembershipRule`; reused existing rule/group/`RequestResult` types). Repo-wide
      no-explicit-any warnings 82→26. The 4 remaining in-scope are intentional
      (`ApiResponse`/`MessageResponse` `<T = any>` defaults, the org-extensible
      `profile` index signature, `RequestResult.data` raw payload).
- [ ] Flip `@typescript-eslint/no-explicit-any` `warn`→`error` (ADR-0004/0006) —
      **blocked on §7**: 19 `any`s remain only in the god components
      (UsersTab/GroupsTab/RulesTab/BulkOperationsPanel), which decompose in §7; flip
      once those clear (plus the 4 intentional ones get `eslint-disable` w/ reason).
- Doc: `docs/development.md` + `docs/architecture.md`. Agents: `test-writer`
  (schema tests), `security-logging-reviewer`.
- Done when: hot-path responses validated; `any` count near zero; rule flipped.

### 7. `[~]` Decompose the god components (tests-first)

- Order (current line counts): `UserComparisonModal.tsx` (963, 10 useState, 3 useEffect)
  → `GroupsTab.tsx` (1075, 23 useState, 3 useRef) → `UsersTab.tsx` (1550, 18 useState +
  2 useRef, 4 useEffect) → `content/index.ts` (1417).
- [x] **`UserComparisonModal` DONE (session 5, 2 commits).** 963 → 213-line
      presentational shell + 3 concern hooks (`useComparisonApps`, `useGroupCopy`,
      `useUserComparison`) + 5 subcomponents (`comparison/`) + pure
      `comparisonAnalytics.ts` and `shared/utils/userDisplay.ts` (each with unit tests).
      Decompose-only: all 38 CHARACTERIZED tests pass; the global add-lock, the two
      divergent resets, the uncancellable membership load, the dead `appsError` branch
      and the `[comparedUser]`-only eslint-disable are all preserved verbatim. The
      raw-control migration (§3) and the eslint-disable retirement are deliberate
      follow-ups, NOT done here.
- Per file: (1) pin behavior with RTL/MSW tests; (2) extract logic into `use*` hooks
  (mirror the `useOktaApi/` module split); (3) move pure helpers to `shared/utils`;
  (4) split UI into subcomponents (like `overview/members/`); (5) re-verify.
- [x] Merged the near-identical `useGroupContext`/`useUserContext`/
      `useOktaPageContext` into a shared generic `useOktaTabContext<T>` base (thin
      wrappers, public APIs unchanged; first tests added). Done ahead of the god-
      component work since it was self-contained.
- [x] **Session 4 — characterization tests pinning the §7 targets (the pass/fail
      ORACLE for the decomposition).** Additive only, named `CHARACTERIZED: …`; several
      pin **existing BUGS as-is**. **Do not "fix" a CHARACTERIZED test** — if one fails,
      the refactor is wrong. Landed: `UserComparisonModal.test.tsx` (38),
      `GroupsTab.test.tsx` (71), `content/index.test.ts` (111).
- [x] **Session 4 — root-cause fix that UNBLOCKS the decomposition (`6863313`).**
      `useOktaApi` rebuilt `coreApi` + all 9 operation objects every render, so every
      returned fn had a fresh identity → any effect depending on one re-ran forever
      (UsersTab's Add-to-Group debounced search re-queried `/api/v1/groups` ~3×/sec
      while the modal was open, draining rate-limit quota). Fixed with `useMemo` over
      `coreApi`, the 9 op objects, both `wrapOperation` results, and the returned object.
      Regression tests in `useOktaApi.test.ts` pin identity stability — **keep them**.
  - **Consequence — now unblocked (do each deliberately, with a test proving no loop):**
    - `UserComparisonModal`'s load-effect `eslint-disable` (~L128) was load-bearing
      ONLY because of the non-memoization → likely retireable now. **Verify, don't
      assume.**
    - `GroupOverview.tsx:67` has a ref workaround ("avoid re-triggering when
      `useOktaApi` returns new function refs") for the same reason → likely removable.
- **Decision — `UserComparisonModal` is DECOMPOSE-ONLY** (behavior AND pixels
  identical). Its §3 raw-control work is the separate follow-up in §3 above.
- **⚠️ Do NOT touch the scheduler/transport route during §7** (that is §8's behavior
  change). Tell every extraction agent this explicitly — `architecture-refactor.md`'s
  own guardrails contradict its "without changing behavior" charter here.
- [ ] **UsersTab characterization tests must be re-pinned FRESH.** Session 4's suite
      hangs — not from the product loop (that's fixed; proven by the `useOktaApi`
      identity tests) but from its own fake-timer handling (`vi.runToLast` spinning).
      Parked for reference only at
      `…/wf_5f5c654e-d8d/UsersTab.test.tsx.HANGS.parked`; writing fresh is cheaper than
      debugging its 1409 lines.
- Target: no component over ~300 lines.
- Doc: `docs/state-management.md`. Agents: `test-writer` then `architecture-refactor`.
- **Pre-computed asset:** deep per-component decomposition maps (state/effect
  inventory, API call sites, pure helpers, proposed hook + subcomponent split, ranked
  `riskyBits`, blockers) live as a 4-object JSON stream at
  `…/wf_5f5c654e-d8d/maps.json` — `jq` it (172K), read the map for a component before
  touching it. **Do not regenerate** (~430k tokens / 12 min).
- Done when: each target is decomposed with tests, behavior unchanged.

### 8. `[ ]` Raise coverage + enable the coverage gate

- Add component tests as §7 proceeds until `npm run test:coverage` meets 80/75, then
  add the coverage step to CI (see §1).
- Also standardize on the single content-script path (drop the direct
  side-panel→content route that bypasses the scheduler — `useOktaApi/core.ts`).
- **⚠️ session-5 sequencing corrections:**
  - The scheduler migration **depends on §7's `content/index.ts` item**. The semantic
    content-script handlers are **compound** (unbounded `while(nextUrl)` pagination + a
    1–3 request fallback chain live inside the content script) and do **not** map 1:1
    onto a scheduler whose unit of work is one fetch. Decompose them first.
  - `UserComparisonModal` has **ZERO direct `sendMessage` calls** (the earlier
    assumption was wrong — its hooks are already decomposed and could migrate now).
  - **Honest regression to surface, not absorb:** `processQueue` checks the cooldown
    **before** priority, so a typed search would stall up to 30s where today it is
    instant. Needs a new **`interactive` tier exempt from the cooldown gate**.
  - `src/shared/scheduler/` has **ZERO tests** and `clearQueue()` **leaks promises** —
    test it (and fix the leak) **before** migrating anything onto it.
- Doc: `docs/testing.md` / `docs/architecture.md`. Agent: `test-writer`.

### 9. `[ ]` Small cleanups

- Tokenize the `AttributeFacet.tsx` dataviz ramp (define a named `chartPalette`).
- Reconcile the `SchedulerContext` poll+push double source of truth when next touched.

---

## Known debt surfaced, not yet actioned (session 4/5)

- The 269 characterization tests added ~34 `any`s (repo-wide `no-explicit-any` 26→60),
  **all in test files**. The §6 `warn`→`error` flip needs a **test-file override** for
  `no-explicit-any` (mirror the existing `no-console` test override).
- `npm run lint` does **not** cover `scripts/`. `npx eslint .` finds a live **parsing
  error at `scripts/build.js:109`** — pre-existing; the current gate can't see it.
- Guardrail (learned the hard way): **always put a hard external timeout around any
  vitest run** — `perl -e 'alarm 180; exec @ARGV' npx vitest run <file>` and
  `pkill -9 -f vitest` after. `--testTimeout` does NOT stop a render loop (an infinite
  loop starves the timer); session 4 pinned a vitest process at 100% CPU / 2.1GB RSS.
  Husky pre-commit runs `vitest related --run` on staged `*.{ts,tsx}`, resolving imports
  **on disk** — a hanging test file in the tree poisons unrelated commits.

---

## Suggested first session after a context clear

> "Read docs/refactoring-plan.md and CLAUDE.md. Continue §7: read the pre-computed map
> for the top unchecked target from `…/wf_5f5c654e-d8d/maps.json`, decompose it
> tests-first behind the existing `CHARACTERIZED:` oracle, keep the scheduler route
> untouched (that's §8), verify green, and commit ONE component per commit."

Pick one item, keep it small, verify green, repeat.
