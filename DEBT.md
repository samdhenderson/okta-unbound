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
- **Status:** open

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
- **Status:** open

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
- **Status:** open

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
- **Status:** open

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
- **Status:** open

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
- **Status:** open

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
- **Status:** open

### D-010 · CI's `verify` job has been red on `main` since at least 2026-08-15, unrelated to any one PR

- **Category:** standards
- **Priority:** P1
- **Size:** L
- **Files:** `src/sidepanel/components/UsersTab.test.tsx` (`membershipRow` call
  sites around lines 511, 533, 558), `src/sidepanel/components/UsersTab.navigation.test.tsx`
  (`pops back to the profile when a cross-tab deep-link arrives`, line ~448),
  `src/sidepanel/hooks/useRulesData.ts:181`, `src/sidepanel/components/RulesTab.test.tsx`
  — the known instances; the underlying cause(s) may reach further.
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
  1. `UsersTab.test.tsx`'s `membershipRow('Engineering')` helper intermittently
     can't find the group heading — the DOM snapshot at failure time shows
     `role="status"` "Loading group memberships..." still present, i.e. the
     membership fetch that `fireEvent.change` + `findByText('Ada Lovelace',
{timeout: 2000})` kicks off hadn't resolved by assertion time on GitHub's
     runner (never reproduces locally, including on a 4-core sandbox matching
     GitHub's `ubuntu-latest` core count — Node is forced to 24 in CI per its
     own deprecation warning, which may be a factor).
  2. A separate run additionally threw an **uncaught exception** — `TypeError:
window is not defined` inside `resolveUpdatePriority` (React DOM),
     originating from a `Timeout._onTimeout` in `useRulesData.ts:181` calling
     into `ProgressContext.tsx:203` — i.e. a timer set during
     `RulesTab.test.tsx` outlives that test's jsdom teardown and fires against
     a torn-down `window`. This is a real leaked-timer bug in `useRulesData.ts`
     independent of CI flakiness, and vitest's own warning is exactly right:
     "this might cause false positive tests" in whatever test happens to be
     running when the orphaned timer fires.
- **Done when:** Not yet defined — needs scoping first: is (1) purely
  CI-resource timing (raise the `findByText` timeout, or gate on a more
  deterministic wait) or a real race in the search→select→load chain; (2) is
  definitely a real bug (an uncancelled `setTimeout`/`setInterval` in
  `useRulesData.ts` needs a cleanup return in its effect) and should probably
  be split into its own `D-NNN` once confirmed. A real fix needs the failure
  reproduced somewhere debuggable — GitHub Actions logs only, so far.
- **Risk:** High to leave alone — a `verify` gate that's routinely red on
  `main` itself stops meaning anything, and every PR now inherits an
  unrelated red check it can't fix by itself. High to rush a fix — touches
  shared test timing patterns (`fireEvent.change` + debounced search) used
  across many files, and a real leaked-timer bug in a data-loading hook.
- **Status:** blocked:needs-breakdown
