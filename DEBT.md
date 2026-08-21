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
- **Status:** done:#71

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
- **Status:** done:#71

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
- **Status:** done:#71

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
- **Status:** open

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

### D-018 · `lint:cited-paths` does not cover the five files a nightly run acts on

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `scripts/check-cited-paths.mjs` (the `IN_SCOPE` predicate)
- **Problem:** The gate's scope is `CLAUDE.md`, `AGENTS.md`, `docs/**`, and
  `.claude/**` — so `IMPROVEMENTS.md`, `DEBT.md`, `CONVENTIONS.md`,
  `SESSION.md`, and `NIGHTLY.md` are all outside it. Those are precisely the
  files whose `src/…` citations are read as instructions rather than as prose:
  an item's **Files** list is the scope contract a nightly writer agent is held
  to, and `SESSION.md` step 2 selects items by it. A stale path there does not
  just misdirect a reader, it mis-scopes a diff. Found the hard way on
  2026-08-21's 5th run: `I-003` cited
  `src/sidepanel/components/groups/GroupPushSection.tsx`, which has never
  existed — the file is at `groups/detail/GroupPushSection.tsx`, i.e. inside
  the off-limits window. The wrong path hid the fact that the item was not
  selectable at all, and `lint:cited-paths` passed clean over it both before
  and after the correction.
- **Done when:** `IN_SCOPE` also covers the two ledgers plus `CONVENTIONS.md`,
  `SESSION.md`, and `NIGHTLY.md`, and `npm run lint:cited-paths` is green
  against them (fix, do not exempt, whatever it turns up on the first run).
  `docs/adr/`'s exclusion stays exactly as it is and for the reason the script
  already documents. Consider whether `NIGHTLY.md` belongs: it is an
  append-only historical log, so it may deserve the same immutability argument
  as an ADR — decide explicitly and record the reasoning in the script's
  `IN_SCOPE` doc comment either way.
- **Risk:** Low — build-script scope widening, no product code. The one real
  risk is the first run turning up stale paths in items nobody is working on;
  those get corrected in place, not exempted.
- **Status:** open

### D-019 · App-label resolution is still silent on its two soft-failure paths

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:114-122`
- **Problem:** D-003 made the label-resolution `catch` log, but the catch only
  fires on a _thrown_ rejection. Two soft failures never enter it and remain
  exactly as silent as the catch used to be: a `response.success === false`,
  and a 200 whose `data` carries neither `label` nor `name`. Either one leaves
  the app showing its raw id with no trace — the same symptom D-003 was filed
  to end, reached by a different route. Noticed while fixing D-003 and
  deliberately not folded into that diff, since D-003's **Done when** names the
  catch specifically.
- **Done when:** Both soft-failure paths log through the shared `logger` at the
  same level and in the same payload-free shape as the catch beside them
  (identifier + outcome, never the response body). Behaviour otherwise
  unchanged: still keep the existing name, still never throw. A test per path,
  proven non-vacuous the way D-003's was — assert the log fires, with the
  keeps-the-name and never-throws assertions passing both before and after.
- **Risk:** Low — additive logging on two branches that already do the right
  thing behaviourally.
- **Status:** open

### D-020 · The app-label response is read without validation

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/pushGroupOps.ts:115`
- **Problem:** `response.data.label || response.data.name` reads an Okta
  response with no zod parse at the boundary, which ADR-0006 requires — every
  Okta response is untrusted, and an app label is end-user-controllable data
  that ends up rendered. The `response.success && response.data` guard in front
  of it checks presence, not shape. Pre-existing; surfaced by the D-003 fix
  reading the same lines and confirmed independently by
  `security-logging-reviewer` on that diff, which classed it pre-existing and
  out of scope for D-003.
- **Done when:** The app-label read goes through a lenient zod schema at the
  boundary like the other Okta reads in `useOktaApi/`, and a malformed response
  degrades to "keep the existing name" rather than reaching the render path.
  Check whether a suitable app schema already exists before adding one.
- **Risk:** Low — the failure mode it closes is narrow, but it is the exact
  shape ADR-0006 exists to prevent.
- **Status:** open

### D-021 · `CONVENTIONS.md`'s mandated `pkill -9 -f vitest` is unscoped

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `CONVENTIONS.md` (the "Test expectations" bullet on wrapping local
  `vitest run` invocations)
- **Problem:** The convention says to run `pkill -9 -f vitest` after every
  local vitest invocation, regardless of outcome. That pattern matches **every**
  process on the box whose command line contains `vitest` — including other
  agents' test runs and, critically, the `vitest related --run` step inside the
  `lint-staged` pre-commit hook. It also matches the issuing shell itself,
  whose own command line contains the string, which silently truncates that
  command's output. Both were hit on 2026-08-21's 5th run: a concurrent
  writer agent's `pkill` SIGKILLed the session's pre-commit hook mid-commit
  (lint-staged reverted cleanly and the retry succeeded, so nothing was lost —
  but the failure looked like a test failure, not a kill), and two diagnostic
  commands returned empty because they had killed their own shell. `SESSION.md`
  step 4 explicitly allows disjoint items to run in parallel, so concurrent
  vitest processes are a designed-for condition, not misuse.
- **Done when:** The convention's kill is scoped so it cannot reap another
  process's run or its own shell — e.g. kill by the recorded PID of the
  wrapped run rather than by pattern, or drop the blanket `pkill` in favour of
  the external `alarm` wrapper that already bounds the run. Whatever is
  chosen, the reason the blanket form was wrong is recorded inline, so a later
  session does not reintroduce it.
- **Risk:** Low to fix. Left alone, it keeps producing failures that look like
  something else, which is the expensive part.
- **Status:** open
