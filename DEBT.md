# Debt

Correctness, security, perf, and standards work. UX/feature-completeness
work lives in `IMPROVEMENTS.md` instead — same item format, different track.

Seeded from a real scan on 2026-08-20 (see `NIGHTLY.md`'s seed entry for the
scan scope). No `TODO`/`FIXME`/`HACK` markers exist anywhere in `src/` — this
list came from reading code, not grepping breadcrumbs.

Format:

```
### D-NNN · <title>
- **Category:** security | correctness | perf | standards | cleanup
- **Priority:** P0 security/data-loss · P1 correctness · P2 perf/UX friction · P3 polish
- **Size:** S <1hr · M half-day · L needs breaking down
- **Files:**
- **Problem:**
- **Done when:** <checkable without asking Sam>
- **Risk:**
- **Status:** open | claimed:<branch> | blocked:<reason> | done:<PR#>
```

---

### D-001 · User Detail's rule badge under-evaluates isMemberOfAnyGroup

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/components/users/GroupMembershipsList.tsx`
  (holds `memberships`, never threads it down),
  `src/sidepanel/components/users/GroupMembershipRow.tsx:126`,
  `src/sidepanel/components/users/MembershipRuleEvidence.tsx:159`,
  `src/sidepanel/components/groups/detail/ClauseChecklist.tsx:118,215`
- **Problem:** `ClauseChecklist` calls
  `explainRuleExpression(expression, user, { maxClauses })` with no `groups`
  context, so every `isMemberOf*` clause hits the unevaluable branch and
  renders "Cannot be determined" — even though `GroupMembershipsList` (one
  call away in the tree) already holds the full `memberships` list needed to
  build that context. Compare Users (`accessCause.ts`) and the profile-edit
  blast-radius report (`shared/membership/blastRadius.ts`) both build and
  pass a `RuleGroupContext` correctly from the same kind of data, proving
  this is a wiring gap, not an evaluator limitation.
- **Done when:** User Detail's rule badges resolve `isMemberOfAnyGroup`/
  `isMemberOfGroup*` clauses whenever the user's group memberships are
  already loaded, matching what Compare Users already shows for the same
  rule+user. A regression test pins a previously-"Cannot be determined" case
  now resolving correctly — prove it fails without the fix first.
- **Risk:** Low-medium — additive data threading through 4 files, no
  evaluator changes.
- **Status:** done:#67

### D-002 · Dedupe the group-context builder duplicated in two files

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/accessCause.ts`
  (`groupContextOf`, ~line 226),
  `src/shared/membership/blastRadius.ts:107` (`groupContextOf`)
- **Problem:** Two near-identical implementations of the same
  `RuleGroupContext`-building helper. Fixing D-001 would add a third copy if
  this isn't deduped first.
- **Done when:** One shared `groupContextOf` (or equivalent) lives in one
  file; both existing call sites import it. Do this before or alongside
  D-001 so D-001 reuses the shared helper rather than adding a fourth copy.
- **Risk:** Low.
- **Status:** done:#67

### D-003 · Silent app-label resolution failures in pushGroupOps

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:117`
- **Problem:** The catch around per-app label resolution
  (`catch { // Keep existing name on failure }`) has no logging at all,
  unlike every sibling catch in this file. A systemic label-resolution
  failure (auth/rate-limit issue) would leave apps silently stuck showing
  raw ids with zero trace to diagnose why.
- **Done when:** The catch logs via the shared `logger` (outcome only, no
  payload) matching the sibling catches' pattern in the same file.
- **Risk:** Low.
- **Status:** done:#70

### D-004 · useRuleLifecycle.ts has zero test coverage on a security-sensitive audit path

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts` (no `.test.ts` exists)
- **Problem:** This hook writes audit-trail entries for rule
  activate/deactivate. Its catch at `:104-106` silently defaults
  `currentUserEmail` to `'unknown@unknown.com'` on a failed `/users/me`
  lookup — an audit entry can misattribute who performed a rule change, with
  nothing surfaced to the user. The `response.success === false` branch
  (`:149-173`) and the outer exception branch (`:174-203`) are also
  untested.
- **Done when:** A test file exists covering the unknown-email fallback, the
  failure-response branch, and the exception branch; `npm run test:coverage`
  stays green.
- **Risk:** Medium — touches audit logging; route through
  `security-logging-reviewer` before merge.
- **Status:** done:#67

### D-005 · useRuleImpact.ts has zero test coverage on its race guards

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useRuleImpact.ts` (no `.test.ts` exists)
- **Problem:** Two stale-capture guards (`:90`, `:96`) exist specifically to
  stop a "reopened for another rule" race from clobbering state, plus the
  error path (`:95-101`) — none of it is tested. A regression here would
  only surface as a user-visible race, not a test failure.
- **Done when:** A test file covers both stale-capture guards (simulating a
  reopen-for-another-rule mid-flight) and the error path.
- **Risk:** Low-medium.
- **Status:** done:#70

### D-006 · Untested error/guard branches in three hooks

- **Category:** standards
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useGroupSource.ts:120,125,161,175,199`,
  `src/sidepanel/hooks/useSearchWithDropdown.ts:128,132-137,134,139`,
  `src/sidepanel/hooks/useUserContext.ts:43`
- **Problem:** Each has real conditional logic (stale-run guards,
  post-unmount guards, a `success===false` fallback) with thin or no
  dedicated test coverage (coverage report: useGroupSource 68%/40%
  branches, useSearchWithDropdown 52%/41%, useUserContext 60%/20%).
- **Done when:** Each named branch has at least one test proving both sides
  of the condition.
- **Risk:** Low.
- **Status:** done:#70

### D-007 · No session-expiry / 401 handling anywhere in the API path

- **Category:** correctness
- **Priority:** P2
- **Size:** L
- **Files:** `src/content/apiRequest.ts`,
  `src/shared/scheduler/apiScheduler.ts`,
  `src/sidepanel/hooks/useOktaApi/core.ts`
- **Problem:** Zero handling anywhere of an expired-session 401 as distinct
  from any other failed request (see `CONVENTIONS.md`'s Session-expiry
  section for the decision record). A mid-session Okta logout currently
  surfaces as an ordinary failed-request error, with no path to a "your
  session expired, please refresh" UI state.
- **Done when:** Not yet defined — needs scoping first (what counts as
  "expired" vs a genuine 401 authorization error; whether the signal surfaces
  at the scheduler or content-script layer).
- **Risk:** High if rushed — touches the security-relevant request path;
  scope through `security-logging-reviewer` before implementation.
- **Status:** blocked:needs-breakdown

### D-008 · Confirm useEntityQuery.ts's abandoned-abstraction status

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/cache/useEntityQuery.ts`
- **Problem:** Zero production consumers found — every real consumer
  hand-rolls its own effect around `entityCache` directly, and at least one
  (`useAppsData.ts:189-192`) documents why it can't use `useEntityQuery`
  (ADR-0026: cache key ≠ latch identity). Unclear whether this is a
  deliberately-kept seam for future consumers or dead code.
- **Done when:** Not checkable without Sam — keep-as-seam vs. delete is a
  judgment call about intent, not a code question.
- **Risk:** Low to investigate; removing a public cache abstraction without
  sign-off could surprise him.
- **Status:** blocked:needs-human

### D-009 · Modal content can render underneath ActivityBar

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/components/shared/Modal.tsx`,
  `src/sidepanel/App.tsx` (mount order), and the ~14 modal call sites still
  inside their tab panels: `UserComparisonModal`, `GroupComparisonModal`,
  `AddToGroupModal`, `ProfileSaveModal`, `RuleConsolidationModal`,
  `GroupMergeModal`, `GroupExportModal`, `AuditLogUndoModal`,
  `RuleImpactModal`, `GroupMembersSection.tsx:254`, `ProfileDisplayModal`,
  `CopyMembersModal`, `BreakdownDetailsModal`
- **Problem:** `ActivityBar` renders `fixed bottom-0 z-50` — the same
  z-index as `Modal`'s `fixed inset-0 z-50`. `ActivityBar` mounts last in
  `App.tsx`, so at equal z-index it paints on top, visually covering the
  bottom of any open modal from one of those ~14 call sites (footer action
  buttons included). `TabJumpPalette` was already moved outside the scroll
  root specifically to dodge this exact bug — the fix was never applied
  anywhere else.
- **Done when:** No open modal's interactive content can render underneath
  `ActivityBar`, verified with a story/test rendering a modal alongside
  `ActivityBar` at typical heights. Fix should be structural (Modal's own
  stacking, or a documented mount-order rule) — not a per-call-site patch,
  since a 15th modal would reintroduce the bug otherwise.
- **Risk:** Medium — shared `Modal` used everywhere; needs the story suite
  re-verified across call sites.
- **Status:** done:#68

### D-010 · CI's `verify` job has been red on `main` since at least 2026-08-15, unrelated to any one PR

- **Category:** standards
- **Priority:** P1
- **Size:** L
- **Files:** `src/sidepanel/components/UsersTab.test.tsx` (the `membershipRow`
  helper and its 5 call sites),
  `src/sidepanel/components/UsersTab.navigation.test.tsx`
  (`pops back to the profile when a cross-tab deep-link arrives`),
  `src/sidepanel/hooks/useRulesData.ts` (the two `completeProgress` timers)
- **Problem:** Discovered while investigating why PR #66 (a same-night baseline
  repair, unrelated to any of these files) came back with a red `verify` check
  on GitHub Actions despite `npm run test:coverage` passing clean locally on 2
  consecutive full runs. Checking GitHub Actions' history for `main` itself
  shows the same job has been failing on every push for at least the last 4
  commits back to 2026-08-15 (`114e676`, `74893fb`, `5ad0b8a`, `61075d8`,
  `b1b0515`) — i.e. this is pre-existing on `main`, not something PR #66
  introduced; confirmed directly by running `verify` against `b1b0515` (PR
  #66's own base commit, zero diff) and seeing the identical failure. Two
  distinct symptoms recur across runs:
  1. `UsersTab.test.tsx`'s `membershipRow('Engineering')` helper can't find the
     group heading — the DOM snapshot at failure time shows `role="status"`
     "Loading group memberships..." still present and the action strip's buttons
     still `disabled`, i.e. the membership fetch had not resolved by assertion
     time on GitHub's runner.
  2. A separate run additionally threw an **uncaught exception** — `TypeError:
window is not defined` inside `resolveUpdatePriority` (React DOM),
     originating from a `Timeout._onTimeout` in `useRulesData.ts` calling into
     `ProgressContext.tsx` — a timer set during `RulesTab.test.tsx` outliving
     that test's jsdom teardown and firing against a torn-down `window`.
- **Root cause (found — the "needs scoping" note below is now answered):** Both
  symptoms were reproduced deterministically **locally**, which the original
  filing thought impossible. The trick is that neither depends on GitHub at
  all — they depend on the membership fetch being slow. Adding a delay to the
  `/users/{id}/groups` route in a scratch copy of the suite reproduces the exact
  same 5 failures, at the same helper, on the same line.
  1. **The wait never waited.** `expect(await screen.findByText('Engineering'))
.toBeInTheDocument()` preceded every `membershipRow('Engineering')` call.
     It looks like it waits for the group row; it does not. The `oktaUser()`
     fixture gives the user a **`department` of `Engineering`** and
     `rawGroup()` names the group `Engineering`, and the detail rung keeps all
     three panes mounted (ADR-0018) — so `findByText` resolved against the
     Profile pane's department `<span>` the instant the user was selected. A
     probe confirmed it: at the moment that wait resolved, the matched node was
     `SPAN` inside a `<dd>`, there was exactly **one** `Engineering` node in the
     DOM, and `queryAllByRole('heading', { level: 4 })` returned `[]`. The
     assertion was also tautological (`findBy*` throws if it finds nothing, so
     `.toBeInTheDocument()` can never fail). The row lookup then raced the
     membership load with no wait of its own and lost on any runner slow
     enough — hence green locally, red on GitHub.
  2. **A real leaked timer.** `useRulesData.ts` closed its progress bar via a
     bare `setTimeout(() => completeProgress(), …)` on both the cache-hit
     (500ms) and fetch-success (1000ms) paths, fired from inside an async
     callback with nothing cancelling it on unmount. When it outlived a test's
     jsdom teardown it called into `ProgressContext` against a torn-down
     `window` — a genuine production-code bug, not test flakiness, and exactly
     the "may cause false positive tests" vitest warned about.
- **Done when:** ~~Not yet defined~~ — **done.** (1) `membershipRow` is now
  async and awaits `findByRole('heading', { level: 4, name })` — the wait the
  callers always meant — with an explicit 5s budget matching the existing
  `findByText('Ada Lovelace', …, { timeout: 2000 })` pattern, since reaching a
  row costs a three-request chain. The bogus `findByText` preamble is deleted at
  all 5 call sites; every real assertion is untouched. The same
  under-specified-wait bug in `UsersTab.navigation.test.tsx`'s cross-tab
  deep-link case (its `waitFor` was satisfied by `resetNav()`, before the
  `loadUserById` it precedes resolved) is fixed by awaiting the header text
  instead of reading it synchronously. (2) `useRulesData.ts` now holds the
  pending completion in a ref, clears it on unmount and before re-arming, and
  checks a `mountedRef` before calling `completeProgress()`.
  **Proof it is not vacuous:** with a 1200ms delay injected into the membership
  route, the pre-fix suite fails exactly the 5 CI tests; post-fix, the suite
  passes 22/22 even at a 2500ms delay.
- **Risk:** ~~High to leave alone~~ — resolved. The fix adds no behavior change
  to shipped UI beyond the timer cleanup, and weakens no assertion (ADR-0012):
  the deleted `findByText` lines were tautological waits on the wrong element,
  which is ADR-0022's "the assertion pins something that is not what it claims"
  carve-out, and each is replaced by a strictly stronger wait on the element the
  caller actually goes on to assert against.
- **Status:** done:#66

### D-011 · App.tabpersistence.test.tsx's tab-mount waits are under-budgeted

- **Category:** standards
- **Priority:** P1
- **Size:** S
- **Files:** `src/sidepanel/App.tabpersistence.test.tsx`
- **Problem:** The file passed inside a full-suite `test:coverage` run and
  failed when run on its own (2 of 3 isolated runs red at
  `findByLabelText('Select Engineering')`). Not environmental: every tab in
  this suite is lazy — that is what the suite exists to pin — so the first
  `openTab` for a tab pays a dynamic `import()` a later one does not, and
  Testing Library's default `findBy*` budget of 1s is under that cost on a
  cold module graph. In a full-suite run an earlier file had already warmed
  the chunk, so the race was invisible. It surfaced through the pre-commit
  `vitest related` hook, which pulled the file in as related to an unrelated
  staged change and blocked the commit.
- **Done when:** The waits that cross a tab's first mount carry an explicit
  budget rather than the 1s default, and the file passes in isolation on
  repeated runs.
- **Risk:** Low — test-only, and strictly strengthening: each wait is on the
  element its caller goes on to assert against, for longer. No assertion
  weakened or removed (ADR-0012).
- **Status:** done:#67

### D-012 · `conditionExpressionOf` is replicated in four files

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/membership/blastRadius.ts:103`,
  `src/shared/utils/membershipAnalysis.ts:181`,
  `src/sidepanel/components/users/comparison/accessCause.ts:221`,
  `src/sidepanel/components/users/MembershipRuleEvidence.tsx:37`
- **Problem:** Exactly the shape D-002 just fixed for `groupContextOf`, one
  helper over: four copies of
  `rule.conditionExpression || rule.conditions?.expression?.value || ''`,
  three of them carrying a comment that points at one of the others.
  ADR-0036 names it alongside `groupContextOf` as the second replicated
  helper. `shared/membership/groupContext.ts` (added by D-002) is the
  obvious home, or a sibling module beside it.
- **Done when:** One implementation; all four call sites import it. Verify
  first that all four really are identical — `ruleUtils.ts:22,114` and
  `consolidation.ts:88` read the same field but are **not** the same helper
  (different fallbacks, one lowercases and strips whitespace); they are not
  part of this item.
- **Risk:** Low — behavior-preserving if the identity check above holds.
- **Status:** open

### D-013 · An audit entry can misattribute who changed a rule, silently

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts:93,99-106`
- **Problem:** The underlying defect D-004 pinned but deliberately did not
  fix. When the current-user lookup does not yield an email, the hook writes
  the audit entry anyway, attributed to the literal `unknown@unknown.com`,
  and surfaces nothing to the user — so the trail records a rule change with
  a placeholder actor and reads exactly like a real entry. **The surface is
  wider than D-004's filing said:** three distinct paths reach the
  placeholder — the lookup throwing (the catch), a `success: false`
  response, and a 200 whose profile carries no `email`. A fix that only
  handles the throw would leave two paths misattributing. All three are
  pinned by `useRuleLifecycle.test.ts` as `CURRENT BEHAVIOUR`, so a fix has
  something to move.
- **Done when:** Not yet defined — needs a decision first: refuse the
  mutation, write the entry with an explicit "actor unknown" marker
  distinguishable from a real address, or surface a warning. That is a
  product call about an audit trail, not a code question. Whatever is
  chosen, retarget the three `CURRENT BEHAVIOUR` tests assertion-by-
  assertion rather than deleting them.
- **Risk:** Medium — audit-trail semantics; route through
  `security-logging-reviewer`.
- **Status:** blocked:needs-human

### D-014 · useRuleLifecycle re-implements CoreApi.getCurrentUser

- **Category:** perf
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts:99-106`,
  `src/sidepanel/hooks/useOktaApi/core.ts:239-263`
- **Problem:** `CoreApi.getCurrentUser()` already does exactly what the hook
  hand-rolls — the same `/api/v1/users/me` call with the same
  `unknown@unknown.com` fallback — plus a per-tab TTL cache. The hook
  bypasses it and re-hits the endpoint on every activate/deactivate.
- **Done when:** The hook calls `getCurrentUser()` from the facade; the
  hand-rolled request is gone; `useRuleLifecycle.test.ts` still passes (it
  mocks the facade, so the seam is already there).
- **Risk:** Low, but **sequence it after D-013** — that item may change what
  the fallback should be, and doing this first would move the decision into
  a shared helper used by other callers.
- **Status:** open

### D-015 · The ghost copy-id recipe is now duplicated in EntityLink and CopyableId

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/CopyableId.tsx:45-62`,
  `src/sidepanel/components/shared/EntityLink.tsx:183-199`
- **Problem:** I-001 gave `EntityLink` a `copyId` control that re-implements
  `CopyableId`'s `IconButton` + `Icon` (`clipboard`/`clipboard-check`) +
  `useCopyToClipboard` + accessible-name-flips-to-`Copied!` recipe
  byte-for-byte. `docs/components.md` is explicit that the two copy
  primitives exist so nobody hand-rolls that pair again — this is a fresh
  instance of exactly the drift that entry was written to prevent. Raised by
  `ui-reviewer` on PR #68 as advisory; filed rather than folded into that
  diff, per `CLAUDE.md`.
- **Done when:** One implementation of the ghost copy-id button; both
  `CopyableId` and `EntityLink` use it. `CopyableId`'s public props and
  rendered output are unchanged (it is used in shipped views), and
  `EntityLink`'s `copyId` behaviour — including the no-`id` and
  not-navigable cases — is unchanged. Existing tests for both stay green
  without being retargeted.
- **Risk:** Low — behaviour-preserving extraction behind two stable APIs.
- **Status:** open

### D-016 · Modal's a11y contract is only regression-tested on the fallback render path

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/components/shared/Modal.test.tsx` (the
  `Modal accessibility` and `Modal exit transition` describes, and the
  `Modal stacking` describe's `mountShell()` harness)
- **Problem:** D-009 made `Modal` portal into a shell-declared layer when one
  exists, and render in place when none does. `App` always mounts the layer,
  so **every modal in production takes the portal branch** — but the
  `role="dialog"` / `aria-modal` / focus-trap / Escape / focus-restore
  assertions all render `Modal` with no layer present, i.e. they only cover
  the fallback. The three stacking tests that do mount a layer assert
  document position only. The branch that ships is the one least covered for
  the property `CLAUDE.md`'s modal rule actually cares about. Raised by
  `ui-reviewer` on PR #68.
- **Done when:** The modal a11y contract (dialog role, `aria-modal`, Tab
  trap, Escape-to-close, focus restore, and the `aria-hidden`/`inert` exit
  window) is asserted with a mounted modal layer as well as without —
  parametrising the existing describes over both configurations is the
  cheapest route. No existing assertion weakened or deleted (ADR-0012).
- **Risk:** Low — test-only, strictly additive coverage.
- **Status:** done:#72

### D-017 · The `storybook` CI job is red on `main` — a story file dies on a mid-run dep re-optimization

- **Category:** standards
- **Priority:** P1
- **Size:** S
- **Files:** `.storybook/main.ts` (the `viteFinal` `optimizeDeps.include` list),
  `src/sidepanel/components/shared/Modal.tsx:41` (the `react-dom` import that
  triggers it)
- **Problem:** The `storybook` job has failed on every run since PR #68 merged
  — on both of that PR's commits, on a re-run of the same head, and on the
  merge commit itself (`808ab30`) — while `verify` stays green. It always
  fails the same way:

  ```
  Failed to import test file .../shared/ActionBar.stories.tsx
  Caused by: Vitest failed to find the current suite.
  ```

  `ActionBar.stories.tsx` is a bystander and was never touched. D-009's fix
  added `import { createPortal } from 'react-dom'` to `Modal.tsx` — the only
  new bare specifier in that PR, and distinct from the `react-dom/client`
  `main.tsx` imports, which Vite optimizes as a separate entry. So `react-dom`
  is discovered lazily when the browser runner first loads `Modal`, and the
  resulting dep re-optimization reloads the page and invalidates
  already-served module URLs; whichever story file is in flight dies, and when
  the reload lands during collection the story's `test()` calls arrive with no
  current suite, which is the second line above.

  `.storybook/main.ts` already documents this exact failure mode and already
  carries the remedy for `zod` — the fix is `react-dom` beside it.

- **Done when:** ~~Not yet defined~~ — **done.** `react-dom` is pre-bundled in
  `.storybook/main.ts`'s `optimizeDeps.include`, beside the `zod` entry that
  was already there for the same reason.
- **Correction to the filing above:** `ActionBar.stories.tsx` is the **first**
  file the run processes, not the last. Vitest orders test files largest-first
  and it is the biggest story file in the tree — confirmed by reading the local
  run's completion order, where it is file 1 of 149. That is precisely the slot
  a dep-optimizer reload lands in, so the diagnosis is stronger than the filing
  thought, and "the run's tail behaviour" is **not** the right fallback
  hypothesis if this does not work.
- **Proof:** CI only, as the filing predicted. The suite passes locally with
  **and** without the fix (149 files / 1042 tests green both ways, run on the
  fix branch before and after the change), so there is no local red-then-green
  to show. `npm run build-storybook` was also re-run clean against the change.
  If the `storybook` job does not go green on `main` after #69 lands, reopen
  this item rather than patching further — the diagnosis is then wrong.
- **Risk:** Low to fix (one line in a build config, no product code). High to
  leave: a red gate on `main` trains everyone to ignore the job, which is how
  D-010 went unnoticed for four commits.
- **Note for whoever picks this up:** ~~a nightly session may not catch this at
  step 1~~ — addressed. `CONVENTIONS.md` now lists `test:storybook` as an
  unconditional baseline gate with the sandbox invocation it needs, so the
  red-baseline rule fires on its own. (It did, on 2026-08-21's 4th run: the
  baseline check caught this without the item having to be claimed by name.)
- **Status:** done:#69

### D-018 · `lint:cited-paths` cannot see the nightly ledgers, and three citations there are already dead

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `scripts/check-cited-paths.mjs:53-54` (the `IN_SCOPE` predicate)
- **Problem:** `IN_SCOPE` admits `CLAUDE.md`, `AGENTS.md`, and anything under
  `docs/` or `.claude/` — which excludes every file the nightly maintenance
  system actually runs on: `DEBT.md`, `IMPROVEMENTS.md`, `SESSION.md`,
  `CONVENTIONS.md`, `NIGHTLY.md`. The gate reported "All cited src/ paths
  resolve, across 50 tracked docs/skill files" on a green baseline while three
  citations in `IMPROVEMENTS.md` pointed at files that do not exist:
  `groups/GroupPushSection.tsx` (I-003, really `groups/detail/GroupPushSection.tsx`),
  `components/PolicyCard.tsx` and `components/AppListItem.tsx` (I-004, really
  `components/policies/` and `components/apps/`). All three were corrected in
  the ledger on 2026-08-21 (5th run); this item is the systemic half.
  This is not cosmetic. A nightly session selects items by their **Files**
  list — it is how disjointness is checked, how the `groups/detail/`
  off-limits rule is applied, and what the writer agent is handed as its
  scope. A stale path defeats all three: I-003's wrong path hid the fact that
  the item reaches into the off-limits directory, which is exactly the check
  that was supposed to catch it.
- **Done when:** `check-cited-paths.mjs` also covers the tracked root ledger
  files (`DEBT.md`, `IMPROVEMENTS.md`, `SESSION.md`, `CONVENTIONS.md`,
  `NIGHTLY.md`), and `npm run lint:cited-paths` is green with them in scope.
  Note that `NIGHTLY.md` is an append-only historical log, so a path that was
  correct when written may since have moved — decide deliberately whether to
  include it or exclude it the way `docs/adr/` already is, and record the
  reason in the script's header comment either way.
- **Risk:** Low — one predicate in a lint script, no product code. The only
  real work is whatever dead citations it surfaces on first run.
- **Status:** done:#72

### D-019 · The non-throwing half of app-label resolution is still silent

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:103-125`
  (the `Resolve app names` `runOperation` block)
- **Problem:** D-003 fixed the `catch`. It did not fix the two ways the same
  block fails without throwing, and those are the likelier ones:
  `if (response.success && response.data)` falls straight through when the
  request resolves with `success: false`, and the inner `if (label)` falls
  through when a 200 carries neither `label` nor `name`. Either way the app
  stays on its raw id with nothing logged — the exact symptom D-003 was filed
  about. A scheduler-level 401 or 429 surfaces as `success: false`, not as a
  throw, so the most likely systemic failure mode still leaves no trace.
  Additionally, this phase's `runOperation` result is discarded (a bare
  `await` with no assignment), unlike the mapping phase below it whose
  outcome is inspected — so a wholly-failed or cancelled label phase is
  indistinguishable from a clean one at the call site.
  `appOperations.getAppById:110-119` shows the house pattern for the same
  endpoint: `log.error('getAppById failed', { code, appId })`.
- **Done when:** Both non-throwing paths log via the shared `logger`
  (identifiers and outcomes only, no payload), and the label phase's
  `runOperation` outcome is either inspected or has a comment saying why it
  deliberately is not. Existing `pushGroupOps.test.ts` cases stay green; new
  cases proven non-vacuous the same way D-003's was.
- **Risk:** Low — logging plus one outcome check, no change to the degrade
  behavior itself. Touches logging, so route through
  `security-logging-reviewer`.
- **Status:** done:#72

### D-020 · pushGroupOps reads an Okta app response unvalidated, one call away from a validated helper

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:108-118`,
  `src/sidepanel/hooks/useOktaApi/appOperations.ts:110-119` (`getAppById`)
- **Problem:** ADR-0006 requires every Okta response to be validated with zod
  at the boundary. `applyPushGroupMappings` branches on
  `response.data.label || response.data.name` straight off a raw
  `makeApiRequest` to `/api/v1/apps/{id}`, with no parse — while the sibling
  list call _in the same function_ validates through
  `oktaAppGroupAssignmentSchema`, and `getAppById` resolves that identical
  endpoint through `parseOkta(oktaAppListItemSchema, …)`. The label is
  rendered as an app name in the UI, so it is end-user-influenced text
  reaching the DOM unvalidated. `getAppById` also `encodeURIComponent`s the
  id, which the raw call here does not.
- **Done when:** The label lookup goes through `getAppById` (preferred — it
  already returns a validated `OktaAppListItem`, caches nothing, and logs its
  own failure) or parses with the same schema inline. Behavior for a
  resolvable app is unchanged. Sequence **after D-019**, or fold D-019 into
  it: adopting `getAppById` changes what the failure paths look like, so
  doing them in the other order means writing the logging twice.
- **Risk:** Low-medium — swapping the call changes the failure surface
  (`getAppById` returns `null` rather than throwing). Touches
  Okta-response handling: route through `security-logging-reviewer`.
- **Resolution note:** shipped with the **inline parse**, not `getAppById`.
  That helper calls `makeApiRequest` at default priority (this phase runs at
  `low`), and collapses every failure into `null`, discarding the HTTP
  `status` that D-019's test asserts by value — adopting it would have meant
  deleting a field from a live assertion. Recorded in the module's
  `@remarks`. The consequence is filed as `D-027`.
- **Status:** done:#74

### D-021 · `CONVENTIONS.md`'s mandated `pkill -9 -f vitest` kills the shell that runs it

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `CONVENTIONS.md` (the "Test expectations" bullet on the external
  timeout wrapper), and by inheritance every agent file that repeats it
- **Problem:** The mandated cleanup is
  `perl -e 'alarm 240; exec @ARGV' npx vitest run <file>`, then
  `pkill -9 -f vitest`. But `pkill -f` matches against the **full command
  line of every process**, and when the two are chained in one shell
  invocation (`… vitest run x && … ; pkill -9 -f vitest`) the invoking
  shell's own command line contains the string `vitest` — so the `pkill`
  SIGKILLs its own parent shell along with the runner. Anything sequenced
  after it in that command never runs, and the command reports a bare
  non-zero exit with no output explaining why.
  Observed twice on 2026-08-21 (5th run), independently: the D-005 writer
  agent had a mutation-test run truncated mid-flight this way, briefly
  leaving a mutated copy of `useRuleImpact.ts` on disk (it restored it), and
  the session lead lost a `git commit` that was chained after the same
  `pkill` — the commit silently did not happen and only a follow-up
  `git status` revealed it. The failure mode is quiet and it can leave
  mutated production files behind, which is the dangerous part.
  Second-order: a stray `pkill -f vitest` from one agent also kills any other
  agent's in-flight run, so this gets worse the moment a night runs writers
  in parallel — which `SESSION.md` step 4 explicitly permits.
- **Done when:** `CONVENTIONS.md` states that the `pkill` must be its own
  final command, never chained after anything that still needs to run, and
  narrows the pattern so it cannot match the invoking shell (e.g.
  `pkill -9 -f 'node.*vitest'`, verified against a live run to confirm it
  still reaps the runner). Any agent file repeating the recipe is updated to
  match.
- **Risk:** Low to fix. Non-trivial to leave: it silently truncates commands
  and can strand a mutated source file in the working tree.
- **Resolution note:** the suggested `pkill -9 -f 'node.*vitest'` was tested
  and **rejected** — the recipe's own `pkill` argument puts both words on the
  invoking shell's command line, so it still matches itself; the `[n]ode`
  bracket trick fails too, on any `node_modules/…vitest` path. Shipped
  pattern is `^[^ ]*node[^ ]* .*vitest`, anchored to a command line that
  _starts_ with a node binary, verified on both halves against live
  processes. `docs/testing.md` was added to the scope: it repeats the recipe
  and is the authority the three skill files cite as its source.
- **Status:** done:#74

### D-022 · Half of a React-warning assertion cannot fire under React 19

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaTabContext.test.tsx:360-364`
- **Problem:** The post-unmount case ends by asserting that no `console.error`
  call matched `/not wrapped in act|unmounted component/i`. The alternation
  has two halves and only one is live on React 19 (`^19.2.0` here): the
  "Can't perform a React state update on an unmounted component" warning was
  removed in React 18, so that half can never match and contributes nothing.
  The `not wrapped in act` half **does** still fire under React 19, so the
  assertion is half-dead, not dead — the original flag from the D-006 writer
  called it wholly vacuous, which overstates it.
  The load-bearing assertion in that test is the line above it
  (`expect(sendCount()).toBe(afterFirstAttempt)` — no retry after unmount);
  the warning check is a belt-and-braces addition. This is the only
  occurrence of the pattern in `src/`.
- **Done when:** Either the dead `unmounted component` alternand is dropped
  (leaving the live `act` check, which is a narrowing, not a weakening — the
  removed half could not fail), or a comment records that it is retained
  deliberately as a guard against a React downgrade. Do **not** delete the
  assertion outright: the surviving half is real, and ADR-0012 applies.
- **Risk:** Low. Cosmetic in effect — no coverage changes either way.
- **Status:** open

### D-023 · `lint-staged` stashes the working tree mid-commit, racing concurrent writer agents

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `package.json` (the `lint-staged` config), `.husky/pre-commit`
- **Problem:** Same family as `D-021`, found the same way — by it nearly
  biting. `lint-staged` opens every run with "Backing up original state... in
  git stash", which stashes **unstaged** changes across the whole working
  tree, runs its tasks, then restores them. `SESSION.md` step 4 explicitly
  permits running writer agents in parallel when their files are disjoint, and
  the session lead commits each item as its agent reports. So a commit for
  item A routinely runs while agent B still has uncommitted edits to its own
  file — and for the duration of A's `vitest related` run (tens of seconds),
  B's edits are not on disk. If B reads, writes, or runs a test against its
  file inside that window it sees the pre-edit content, and a write lands on a
  tree that is about to be overwritten by the stash pop.
  Observed on 2026-08-21 (6th run): two commits ran while another agent was
  live. Both restored cleanly and nothing was lost, so this is a latent race,
  not a confirmed loss — but the failure mode is silent and would present as
  "the agent's edit vanished", which is exactly the kind of thing that gets
  misdiagnosed as the agent misbehaving.
  Note this is **not** a reason to stop parallelising writers; it is a reason
  the lead should not commit while a writer is live, or the hook should not
  stash what it does not need.
- **Done when:** Either the sequencing rule is written down where a nightly
  session will read it (`SESSION.md` step 4, plus `CONVENTIONS.md` if the
  agent files repeat it) — "do not commit while another writer agent is
  live" — or `lint-staged` is configured not to stash the unrelated working
  tree (`--no-stash`, weighing what that gives up on a failed hook run).
  Whichever is chosen, the reasoning is recorded, because the two options
  trade different things away.
- **Risk:** Low to fix. The bug it prevents is rare but silent and would be
  misattributed when it happens.
- **Correction to the filing above:** the stated mechanism is wrong, checked
  against the installed `lint-staged` (16.2.6). It does not stash unstaged
  changes off disk here. The tree-clearing
  `git stash push --keep-index` branch runs only under `hideUnstaged`, which
  defaults false and is not set in `package.json`; the branch that runs is
  `git stash create` + `git stash store`, a snapshot that leaves every file in
  place. There is therefore no window in which a concurrent agent's file is
  missing from disk, and the "reads see pre-edit content" half of the filing
  does not happen. **The real hazard is the failure path, and it is worse:**
  on any task error `restoreOriginalState` runs `git reset --hard HEAD` and
  re-applies the hook-start snapshot, discarding every working-tree
  modification repo-wide — and an edit a live writer made after that snapshot
  is in neither the stash nor the tree afterwards. `vitest related --run` runs
  on every `*.{ts,tsx}` commit here, so a red related test reaches that path
  routinely. The rule the item asks for is right; only its reasoning needed
  replacing.
- **Resolution note:** shipped the **sequencing rule**, not `--no-stash`, with
  the corrected reasoning recorded in `CONVENTIONS.md` as the item requires.
  `--no-stash` would genuinely close the hole — it implies `--no-revert`, so
  the destructive reset can never fire — but it removes the rollback net for
  every contributor's commit (a failed hook leaves half-`eslint --fix`ed files
  on disk), which is a shared-contract change, and it edits hook wiring, which
  `CLAUDE.md` puts outside an unattended session's authority. It stays a
  decision for Sam. Note the diff touches neither file in the **Files** list
  above: the rule went to `SESSION.md` step 4 and `CONVENTIONS.md`, which is
  the item's own first "Done when" option.
- **Prior art:** PR #73 (2026-08-22, branch `claude/stoic-gates-sd14ng`)
  reached the same conclusion about the mechanism and never landed on `main`,
  which is why this item was still `open`. That analysis was not consulted
  while implementing — it surfaced afterwards in the branch's CI history, and
  the source read above was done independently. Worth knowing that an
  unmerged nightly branch can carry findings the ledger never received.
- **Status:** done:#75

### D-024 · `check-cited-paths` still cannot see any path that is not under `src/`

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `scripts/check-cited-paths.mjs` (`SRC_PATH_RE`)
- **Problem:** `D-018` widened the gate's _corpus_ to the nightly ledgers and
  taught it to read line-suffixed citations. It did not widen what a citation
  may point **at**: `SRC_PATH_RE` is rooted at `src/`, so every cited path
  outside it is invisible. That is not hypothetical — `D-018`'s own **Files**
  list cites `scripts/check-cited-paths.mjs:53-54`, `SESSION.md` and
  `CONVENTIONS.md` cite each other and `docs/*.md`, and `CLAUDE.md`'s routing
  table is almost entirely `docs/` paths. None of it is checked. The same
  argument `D-018` makes applies with equal force: a session is routed by
  these citations.
  Raised by the `D-018` writer and deliberately left out of that item's diff,
  because widening the root is a design decision rather than a one-line
  predicate change.
- **Done when:** Cited repo paths outside `src/` resolve or the gate fails,
  and `npm run lint:cited-paths` is green with them in scope. The real work is
  deciding the boundary first: `docs/adr/` is excluded as a _citing_ corpus
  for immutability reasons, but that says nothing about whether an ADR may be
  _cited_ — and a naive widening pulls in every cross-link in `docs/`, plus
  `.github/`, `.storybook/` and `package.json` script names that look like
  paths. Record the boundary and its reasoning in the script header the way
  the existing exclusions are recorded.
- **Risk:** Low to fix; the effort is in the boundary decision and whatever
  dead citations first light-up surfaces.
- **Status:** open

### D-025 · The vitest timeout recipe carries two different `alarm` values

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `docs/testing.md` (`alarm 180`),
  `.claude/skills/okta-claim-check/references/tooling.md` (`alarm 180`),
  `CONVENTIONS.md` (`alarm 240`),
  `.claude/skills/okta-test/SKILL.md` (`alarm 240`),
  `.claude/skills/okta-verify/SKILL.md` (`alarm 240`)
- **Problem:** `D-021` made the five copies of the external-timeout recipe
  agree word-for-word on the `pkill` half, and deliberately left the `alarm`
  half alone: two files say `180`, three say `240`. Which is right is a real
  question, not a typo — a single-file run wants the short budget, a
  `test:coverage` or `test:storybook` run needs far more than either (both
  routinely exceed 240s in this sandbox, so an agent following the recipe
  literally on a full run gets a truncated run and reads it as a failure).
  Surfaced by the `D-021` writer and filed rather than folded in, because
  picking a number is a decision, not a mechanical edit.
- **Done when:** Either one value is chosen and applied to all five, or the
  recipe states explicitly that the budget scales with the run (with a value
  per run shape), and all five agree. Whichever is chosen, the reasoning is
  recorded where the recipe lives.
- **Risk:** Low. Left alone, an agent that follows the recipe verbatim on a
  full-suite run gets a truncated run and may diagnose a red suite that is
  really just the alarm firing.
- **Status:** open

### D-026 · `getAppPushGroupMappings` interpolates an unencoded app id

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:64`
- **Problem:** `` `/api/v1/apps/${appId}/groups?limit=${OKTA_PAGE_SIZE}` ``
  interpolates `appId` raw, one function above the label lookup that `D-020`
  just taught to `encodeURIComponent` it, and inconsistent with the sibling
  `appOperations.getAppGroupAssignments`, which already encodes the same path
  segment.
  **Deliberately filed P3, not P2** (assessed by `security-logging-reviewer`
  on PR #74): `appId` here is `group.sourceAppId`, which `groupSummary.ts:41-54`
  sources from `group.source.id` (an Okta-assigned system id) or a
  regex-extracted segment of `_links.apps.href` — not free-form
  end-user-controllable text like a group name or rule expression. Even given
  a crafted value containing `/`, `?` or `#`, the request stays `GET`-only and
  both the background's `isValidScheduleRequest` and the content script's
  independent `isSameOriginPath` guard re-parse the URL against the Okta
  origin and enforce the method allow-list (`docs/security.md` §5), so an
  altered path cannot leave the origin or escalate beyond a GET the admin's
  own session already permits. Unlike `D-020`'s target, this value is never
  rendered — it only shapes the outbound path. A hardening/consistency gap,
  not an injection vector.
- **Done when:** The path segment is encoded the way `getAppById` and
  `getAppGroupAssignments` encode theirs; existing `pushGroupOps.test.ts`
  cases stay green and one new case pins the encoding.
- **Risk:** Low.
- **Status:** open

### D-027 · `getAppById` cannot express why it failed, so callers that need to know can't use it

- **Category:** standards
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/hooks/useOktaApi/appOperations.ts:110-119`,
  `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts` (the `Resolve app names`
  block, as the motivating caller)
- **Problem:** `getAppById` collapses request-failure, validation-failure and
  a thrown request into one `null`, discards the HTTP `status`, calls
  `makeApiRequest` at default priority with no way to ask for another, and
  logs under its own `[useOktaApi]` prefix. That is exactly why `D-020` could
  **not** adopt it for the push-group label lookup and parsed inline instead:
  that call site runs at `low` priority on purpose, and `D-019`'s test asserts
  the `status: 429` that distinguishes "we are rate-limited" from "this app
  has no label". The result is a validated single-app read that the one caller
  who most wants it cannot use — so the endpoint is now parsed in two places.
- **Done when:** Not yet defined — needs a decision first. A richer return
  type (a discriminated result rather than `null`) or a `priority` parameter
  is a contract change on a shared facade with existing callers, i.e. the
  plan-and-approval gate applies and it likely wants an ADR. Research-only
  until Sam signs off on a proposal.
- **Risk:** Medium if rushed — changes a shared API surface. Low to leave: the
  duplicate parse is documented in `pushGroupOps.ts`'s `@remarks`.
- **Status:** blocked:needs-breakdown
