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
      `BulkOperationsPanel`, `CrossGroupSearch`, `CompositionReports`. `UserSearchBar`'s
      clear button now routes through `IconButton` (adopted into UsersTab in §7); only
      its raw `<input>` remains a documented composite (leading search icon + trailing
      spinner), like `SearchDropdown`.
- [x] **Checkboxes** → new shared `Checkbox` primitive (`GroupExportModal` 2,
      `GroupListItem` 1). Added to the barrel with tests.
- [~] **God-component buttons** (`GroupsTab` 10, `RulesTab` 4, `UsersTab` 3,
  `UserComparisonModal` 2) + their raw text inputs (`GroupsTab` 2, `UsersTab` 2,
  `RulesTab` 1, `UserComparisonModal` 1) → migrate during their §7 decomposition.
  **`RulesTab` + `UsersTab` done in §7; `GroupsTab` done (this session); only
  `UserComparisonModal`'s blocked follow-up remains (see below).**
  - **`GroupsTab` DONE (this session, ui-reviewer signed off).** GroupsTab's 10
    filter/sort buttons landed in the extracted `groups/GroupFilterPanel.tsx` during §7;
    its five filter/toggle groups (Group Type, Size, Push Status, Push Target App, and
    the semantic-colored Health pills via `FilterPill`'s `inactiveClassName` escape
    hatch) now route through the shared `FilterPill`. Three controls stay raw as
    documented exceptions, each with an inline `§3 exception` comment: the "Clear all"
    text-link (no shared text-link primitive — same precedent as `AttributeFacet`), the
    sort buttons (need a directional chevron `IconType` the registry lacks + `FilterPill`
    has no trailing-icon slot — same deferred call as `UserComparisonModal` L710), and
    the active-filter chip's `rounded-full` close button (`IconButton` is `rounded-md`,
    not pixel-neutral). The active Health pill's invisible `border-primary` was dropped
    (a wash — it made active health pills inconsistently ~2px larger than every other
    active pill). ui-reviewer's two a11y wins on the kept-raw controls were folded in:
    `aria-label` on the chip-remove button + `aria-pressed` on the sort buttons (plus
    `type="button"` hardening on all three). GroupsTab's 2 raw text inputs are
    `groups/GroupSearchBar.tsx`'s documented leading-glyph composite (like
    `SearchDropdown`); `GroupFilterToggle` stays a documented raw exception. Oracle
    (`GroupsTab.test.tsx`, 81 tests) stayed green.
  - **`UserComparisonModal` correction (session 5):** its raw-control migration is a
    **separate follow-up commit** after its §7 decompose-only pass, and 2 of its 3
    controls **cannot migrate cleanly** — so its true migratable count is **1**, not 2+1:
    - `L597` is a `role="tab"` tablist item → already a documented §3 tab-bar exception.
    - `L710` needs a **new chevron `IconType`** that does not exist yet.
    - `L429` → shared `Input` is **NOT pixel-neutral** (`py-3`/`border-200`/`shadow-sm`
      vs the shared base's `px-3 py-2`/`border-300`/no shadow). Needs a design call, not
      a mechanical swap.
- [x] **`AttributeFacet`** (4) → §9 chart tokenization was already complete
      (`theme/chartPalette.ts`); all 4 raw `<button>`s are **documented pixel-neutral
      exceptions** (two chromeless 11px text-links with no shared text-link primitive, the
      data-viz spread bars — an existing §3 exception, and legend-row toggles `FilterPill`
      cannot match without a `className` escape hatch). Discharged-by-documentation, not
      migrated — a text-link primitive / `FilterPill` `className` is a separate design call.
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

### 5. `[x]` Adopt the shared utils everywhere

- [x] `isOktaUrl` adopted everywhere, including the 3 context hooks (the inline
      checks were removed in the `useOktaTabContext` merge).
- [x] `UserProfileCard` adopts `dateFormat` (`formatDateShort` added for date-only).
- [x] `UsersTab.tsx` inline `formatDate`/`getRelativeTime` **removed** when UsersTab
      adopted the shared `UserProfileCard` (§7). The footer now flows through the shared
      `dateFormat` utils, so the `getRelativeTime` **NaN-guard** now applies (the old
      local one produced `'NaN years ago'` on unparseable dates) — pinned in
      `dateFormat.test.ts`. `csvUtils.formatDateForCSV` is a distinct CSV format — kept.
- Doc: `docs/development.md`. Agent: `architecture-refactor`.
- Done when: no duplicate implementations remain. ✔

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
  - **Bounded items safe to do now (session 5): DONE (swarm session).**
    - [x] Deleted the **dead `oktaUserListSchema`** (zero call sites confirmed).
    - [x] Fixed `parseOkta` leaking **zod's error message** (the mechanism was in the
          `throw`, not `log.warn` as assumed) — it now surfaces only the issue _paths/codes_
          (`{path, code}` per issue), never the received value; pinned by a test asserting the
          offending value is absent from the message.
- [x] Burned down the message/API-layer `any`s (60→4): typing-only, precise types
      across content/useOktaApi/scheduler/tabState/rulesCache (introduced
      `MembershipRule`; reused existing rule/group/`RequestResult` types). Repo-wide
      no-explicit-any warnings 82→26. The 4 remaining in-scope are intentional
      (`ApiResponse`/`MessageResponse` `<T = any>` defaults, the org-extensible
      `profile` index signature, `RequestResult.data` raw payload).
- [x] **Flipped `@typescript-eslint/no-explicit-any` `warn`→`error` (this session,
      ADR-0004/0006).** §7 cleared the god-component `any`s; the last production holder
      was `BulkOperationsPanel`'s `executeBulkOperation` prop (`operation: any` /
      `Promise<any[]>` / `config?: any`), now typed against the shared
      `BulkOperation`/`BulkOperationResult`. The 4 intentional survivors each got a
      reason-annotated inline `eslint-disable` (`OktaUser.profile` index signature, the
      `ApiResponse`/`MessageResponse` `<T = any>` defaults, `RequestResult.data`). Added
      a test/setup-file override turning the rule `off` (mirrors the `no-console` one, so
      mocks/fixtures may use `any`); removed the 3 now-unused inline `no-explicit-any`
      disables that override made redundant (`content/index.test.ts`, `RulesTab.test.tsx`,
      `UserComparisonModal.test.tsx`). `npm run lint` is 0 errors; a new production `any`
      now fails the build. `--max-warnings=0` CI mode stays deferred (94 warn-level
      legacy problems remain — see ADR-0004).
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
- [x] **`GroupsTab` DONE (session 6, 2 commits).** 1075 → 285-line presentational
      shell + 5 concern hooks (`useGroupsLoader`, `useGroupLiveSearch`,
      `useGroupFilters`, `useGroupSelection`, `useGroupMembersCache`) + 5
      subcomponents (`groups/`) + pure `groupSummary.ts` / `groupFilters.ts` /
      `groupsCache.ts` (each unit-tested). Commit 1 also cleared all 3 of the file's
      `any`s (structural `RawOktaGroup` + `unknown`+revive cache typing) and adopted
      `csvUtils.getDateForFilename` (the only byte-identical CSV drop-in — the
      unconditionally-quoted serializer stays inline). Decompose-only: all 80
      CHARACTERIZED tests pass; the apiRef-assigned-during-render trick (with a
      carried `react-hooks/refs` eslint-disable), the stale-wins mount race, the
      no-stale-guard live search, the by-reference live filteredGroups, the
      compareGroups in-place cache mutation, the exportGroups snapshot, and the
      searchQuery-uncounted/`clearFilters`-clears asymmetry are all preserved verbatim.
      The live-search `chrome.tabs.sendMessage` §8 bypass moved into
      `useGroupLiveSearch` (its eslint grandfather entry followed it); no scheduler
      change and no §3 raw-control migration here.
- [x] **`RulesTab` DONE (high-impact-features branch, 2 commits).** ~730 → 258-line
      presentational shell + 2 concern hooks (`useRulesData` for the load/RulesCache
      pipeline, `useRuleLifecycle` which unifies the two near-identical ~120-line
      activate/deactivate audit+undo blocks behind one `runLifecycle(id, kind)`) + 4
      subcomponents (`rules/RulesStatsGrid` on the shared `StatCard`, `RulesToolbar`,
      `RulesMetaRow`, `RulesListPanel`). Also cleared RulesTab's 3 `any`s (catch blocks
      narrow via `err instanceof Error`) and did the §3 raw-control migration: filter
      buttons → shared `FilterPill` (gained an optional `disabled` prop), search input
      kept as a documented leading-glyph composite (same call as `GroupSearchBar`).
      Decompose-behind-oracle: a fresh 9-test `RulesTab.test.tsx` CHARACTERIZED oracle
      (load/cache, immediate activate, deactivate gated behind the impact modal, preview,
      search + active-only filter, empty/error) stayed green throughout; the
      post-mutation `loadRules()` cache-first reload is preserved verbatim. The
      `chrome.tabs.sendMessage` §8 bypass moved into `useRulesData`/`useRuleLifecycle`
      (their eslint grandfather entries followed them; `RulesTab.tsx` dropped from the
      list); no scheduler change.
- [x] **`content/index.ts` DONE (swarm session, 7 commits).** 1449 → **263 lines** — a thin
      `chrome.runtime.onMessage` router + DOM-ready indicator init, delegating to 7 extracted
      concern modules under `src/content/` (mirroring the `useOktaApi/` split): `pageContext.ts`
      (URL/DOM extraction), `apiRequest.ts` (same-origin fetch core: `isSameOriginPath` guard +
      allow-listed methods + per-request XSRF), `exportHelpers.ts` (escapeCSV-guarded CSV +
      download), `indicator.ts`, `ruleHandlers.ts`, `groupHandlers.ts`, `userHandlers.ts`.
      Decompose-only: the `content/index.test.ts` oracle (152 tests) stayed green after every
      commit; the unbounded `while(nextUrl)` pagination loops and the 1–3 request search
      fallback chain moved **verbatim**; the zod `parseOkta` boundary, same-origin + method
      guard, and host parsing preserved exactly. **Scheduler/transport route untouched (§8).**
      No eslint grandfather move needed (`index.ts` is the message _receiver_, never called
      `chrome.tabs.sendMessage`). This unblocks §8's `content/index.ts` dependency.
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
    - `GroupOverview.tsx:67` ref workaround — **DONE (5e60ed7).** Removed the
      apiRef/scanMfaRef wrappers; verified `updateProgress` is `useCallback([])` so the
      whole chain to `getAllGroupMembers`/`scanGroupMfa` is identity-stable, and added
      `GroupOverview.test.tsx` with a no-reload-loop regression.
- **Decision — `UserComparisonModal` is DECOMPOSE-ONLY** (behavior AND pixels
  identical). Its §3 raw-control work is the separate follow-up in §3 above.
- **⚠️ Do NOT touch the scheduler/transport route during §7** (that is §8's behavior
  change). Tell every extraction agent this explicitly — `architecture-refactor.md`'s
  own guardrails contradict its "without changing behavior" charter here.
- [x] **UsersTab characterization oracle re-pinned FRESH (session 7).**
      `UsersTab.test.tsx` — 20 CHARACTERIZED tests, no hang (fakes only
      setTimeout/clearTimeout, drives the REAL useOktaApi). Pins: 600ms user-search
      debounce (bounded, min-2-char, mid-render-stable, the <2-char stale-results
      quirk, the §8 scheduler bypass); 300ms add-to-group search bounded to ONE call
      (locks in the memoized-searchGroups fix 6863313); detected-user auto-load
      single chain + re-entrancy guard + Clear re-trigger; lifecycle confirm (exact
      copy, one getUserById refresh, resetPassword skips it, status-only patch,
      failure banner); membership DIRECT/RULE_BASED via the in-file heuristic +
      rules-fetch-failure degradation. The session-4 suite stays parked/unused.
- [~] **UsersTab §7 pure-extraction phase (session 7, decompose-only, oracle green).**
  Small sequential commits: `analyzeMemberships` → tested
  `shared/utils/membershipAnalysis.ts`; `EXCLUDED_PROFILE_FIELDS` + the per-render
  `standardFields` Set → tested `shared/utils/profileFields.ts`
  (`getCustomProfileFields`, security filter pinned); deleted the dead `requestCount`
  locals.
- [x] **Adopted exclusion-aware membership classification (session 7, decided behavior
      change).** `membershipAnalysis.ts` is now the single source of truth (gained
      `isUserExcludedFromRule` + rules-without-exclusion filtering, ported verbatim from
      `useUserMemberships`, which now imports it). A user excluded from every matching rule
      is now DIRECT — unifying UsersTab with UserOverview / user comparison (which already
      shipped it). Pinned in unit tests + a flipped UsersTab oracle assertion;
      UserComparisonModal's 38 tests stayed green.
- [x] **Adopted the `useUserMemberships` hook in UsersTab (session 7).** Replaced both
      inline getUserGroups→rules→analyze chains with the hook (−~120 lines, last inline
      `any`s gone). Reconciled the merged-error trap per the map: the hook gained optional
      ref-held `onError`/`onLoadingChange` callbacks (so `loadMemberships` keeps its stable
      `[targetTabId]` identity and the auto-load guard holds); the orchestrator keeps owning
      the single `error` banner + `isLoadingMemberships` (last-write-wins). UsersTab 1572 →
      1333 lines, **0 `any`s**.
- [~] **UsersTab §7 remaining.**
  - [x] **(a) Adopted the four drifted orphan UI forks** (decided: adopt+reconcile), each
        its own commit with ui-reviewer sign-off. `UserSearchResults` reconciled to
        UsersTab's pixels (caller supplies the `!selectedUser` gate). `UserSearchBar` +
        `GroupMembershipsList`'s open-group link now route their clear/open buttons through
        the shared `IconButton` (best-long-term §3 wins; `UserSearchBar` docs updated).
        `GroupMembershipsList` reconciled off its drifted non-token blue-_/amber-_ colors
        back to Odyssey tokens + shared `LoadingSpinner`, and gained an `actions` header
        slot for the Add-to-Group button. `UserProfileCard` (shared with UserOverview) was
        adopted for the whole card: extended with an `afterCard` slot (holds UsersTab's
        lifecycle actions) + ported Preferences + Custom Attributes sections
        (UserOverview passes `showCollapsibleSections={false}`, so it is unaffected); the
        duplicate PageHeader "Open in Okta" was removed. UsersTab 1333 → **682 lines**.
  - [x] **(c) §5 done** — deleted UsersTab's local `formatDate`/`getRelativeTime`; the
        card now uses the shared `dateFormat` utils (NaN-guard asserted). See §5.
  - [x] **(b) Extracted the four concern hooks** (session 8), one commit each, oracle
        21/21 green after each: `useUsersTabSearch` (query/results/isSearching + 600ms
        debounce + the `searchUsers` read), `useDetectedUserAutoLoad` (hasAutoLoadedUser
        guard + the `getUserDetails` auto-load effect), `useUserLifecycleActions`
        (suspend/unsuspend/reset + confirm, owns its own `useOktaApi` slice), and
        `useAddToGroup` (modal + 300ms group type-ahead + add, owns its own `useOktaApi`
        slice). UsersTab no longer calls `useOktaApi` directly. The two raw
        `chrome.tabs.sendMessage` read sites moved VERBATIM into the two search/auto-load
        hooks; the eslint grandfather list gained those two files and dropped `UsersTab.tsx`
        (now clean). UsersTab 682 → **451 lines**.
  - [x] **(d) Presentational split (swarm session, 3 commits, oracle 21/21 green each).**
        UsersTab 517 → **335 lines** via three pixel-neutral extractions under
        `components/users/` (each with co-located stories + TypeDoc): `AddToGroupModal`,
        `UserLifecycleActions`, `DetectedUserBanner`. The Add-to-Group type-ahead's raw
        `<input>` + dropdown `<button>`s stayed raw with a documented `CHARACTERIZED:`
        exception (shared `Input` is not pixel-neutral here — `mb-2` label, `outline` focus,
        nested wrapper that breaks the absolutely-positioned spinner/dropdown — same exemption
        as `SearchDropdown`/`UserSearchBar`). Scheduler route untouched. 335 is within the
        ~300 region; no further extraction attempted without a pixel change.
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
  - ~~`src/shared/scheduler/` has **ZERO tests**~~ — **stale (swarm session):** the scheduler
    now has full coverage (`apiScheduler.test.ts`, `apiScheduler.cancel.test.ts`,
    `cancellation.test.ts`, `runBatch.test.ts`). Re-audit whether `clearQueue()` still
    **leaks promises** (`apiScheduler.ts:541`) against those tests before migrating onto it.
- Doc: `docs/testing.md` / `docs/architecture.md`. Agent: `test-writer`.

### 9. `[ ]` Small cleanups

- [x] Tokenize the `AttributeFacet.tsx` dataviz ramp — already done in
      `theme/chartPalette.ts` (named `INDIGO_RAMP`/`CHART_NONE_COLOR`/`CHART_OTHER_COLOR`); no
      raw hex remains in `components/**`. (Verified during the swarm session.)
- Reconcile the `SchedulerContext` poll+push double source of truth when next touched.

### 10. `[ ]` Component-explorer (Storybook) story-coverage backlog

Storybook landed (ADR-0010) and **all 77 components now have co-located stories**
(run as browser tests via `@storybook/addon-vitest`, ADR-0011). The docs site also
hosts the auto-generated `Internals` API reference and the `Documentation`/ADR
pages, deployed to GitHub Pages. Going forward, any `shared`/leaf feature component
touched without a co-located `.stories.tsx` is backlog — add one in the same change
per `docs/component-explorer.md`'s templates.

- [x] Full catalog covered (77/77), all stories run as browser tests (423 passing).
      `UsersTab` is included in the runner: its story-canvas crash was an infinite
      render loop from the `useOktaApi` mock returning a fresh object per render (see
      `docs/component-explorer.md` → "Mock stability matters"), not the component
      itself, so no `!test` exclusion is needed.
- Remaining follow-ups (deferred): promote a11y `test: 'todo'` → `'error'` after an
  a11y cleanup pass.
- Doc: `docs/component-explorer.md`. Agent: `component-builder`.

---

## Known debt surfaced, not yet actioned (session 4/5)

- ~~The 269 characterization tests added ~34 `any`s (repo-wide `no-explicit-any`
  26→60), **all in test files**. The §6 flip needs a **test-file override** for
  `no-explicit-any`.~~ **DONE (§6 flip session):** the test/setup override was added
  (mirrors `no-console`, rule `off`), so test-file `any`s no longer block the flip.
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
