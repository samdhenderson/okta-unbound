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
- **Verified:** YYYY-MM-DD — <who or what confirmed the Problem still holds>
- **Problem:**
- **Done when:** <checkable without asking Sam>
- **Risk:**
- **Status:** open | claimed:<branch> | research:awaiting-review
  | blocked:<reason> | done:<PR#> | closed:refuted-<date>
  | closed:overtaken-by-<sha>
```

Four gate words, deliberately distinct — they were one word until 2026-08-24
and three items rotted behind it:

- `blocked:needs-human` — a product or judgment call only Sam can make. A
  nightly must not improvise one.
- `research:awaiting-review` — scoped by a nightly as a Proposed ADR. Its PR
  touches `docs/` only, zero files under `src/`. Sam moves it to `open` by
  accepting the ADR; the session that wrote it never does.
- `closed:refuted-<date>` — the Problem was investigated and does not hold.
  A refuted item is a **finished** item, not a skipped one.
- `closed:overtaken-by-<sha>` — the code moved and dissolved the Problem.

**Every item carries a `Verified` date.** Three of the five items gated on
2026-08-24 had drifted out from under their own filings — `D-008` named a
consumer count that was wrong by nine, `D-027` named a file that had been
deleted, `D-029` named a writer that was only a doc comment. A filing is a
claim about code, and code moves.

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
- **Files:** `pushGroupOps.ts:117`, then under
  `src/sidepanel/hooks/useOktaApi/` — the module was deleted by `f1e8def`
  after this item closed.
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

**Scoped 2026-08-24 and split.** The original filing was `blocked:needs-breakdown`
and sized `L` on the assumption that the transport layer had to learn about
401s. It already has. `src/content/apiRequest.ts:150-160` puts
`status: response.status` on the failure result, `RequestResult`
(`src/shared/scheduler/types.ts:82-91`) carries it across the message boundary
unchanged, and `core.ts:229` hands it to the panel. **The number arrives intact
and nothing reads it** — zero non-test occurrences of `401` in `src/`. What was
missing was a decision, not plumbing. Scoping also turned up an unrelated defect,
filed below as `D-007c`.

**The decision (Sam, 2026-08-24):** in this extension a 401 means the session is
gone, full stop. The panel only ever calls endpoints the signed-in admin is
already browsing, using that page's own session cookie — Okta answers a genuine
"you may not do this" with a 403, not a 401. So `401 ⇒ expired` needs no
heuristic and no allow-list of endpoints.

### D-007a · A failure result that can say what failed

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/scheduler/types.ts:82-91`,
  `src/sidepanel/hooks/useOktaApi/core.ts:200-229`,
  `src/sidepanel/hooks/useOktaApi/appOperations.ts:88-98`
- **Verified:** 2026-08-24 — read end to end during the D-007 scoping pass.
- **Problem:** `RequestResult` is one non-discriminated interface with
  `success: boolean` and an optional `status`, so a caller that checks
  `!result.success` still gets `status` typed as possibly-absent and has no
  reason to look at it. Every failure mode reads the same at the type level:
  expired session, rate limit, deleted entity, malformed response.
- **Done when:** `RequestResult` is a discriminated union whose failure arm
  carries a non-optional `status` (transport throws, which have no HTTP status,
  get an explicit sentinel rather than an absent field — see
  `apiRequest.ts:171-179`); a single `isSessionExpired(result)` predicate lives
  in `src/shared/scheduler/` and matches 401 only; `getAppById` uses it to stop
  collapsing rate-limited into missing. No behavior change beyond `getAppById`'s
  return — this slice is types plus one caller.
- **Risk:** Low. Touches the shape every API caller reads, so it is wide, but the
  compiler finds every site. Route through `security-logging-reviewer` anyway:
  it is the request path.
- **Status:** open
- **Related:** absorbs what `D-027` wanted before that item was overtaken.

### D-007b · One expired session, not thirty failed requests

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0041-a-401-is-a-session-not-a-request.md` (to be created),
  `src/shared/scheduler/apiScheduler.ts`, `src/sidepanel/App.tsx`
- **Verified:** 2026-08-24 — `CONVENTIONS.md`'s Session-expiry section still
  describes the live behavior correctly.
- **Problem:** When the admin's Okta session ends mid-use — signed out in
  another tab, or simply timed out — the panel does not notice. Every queued
  request fails with an ordinary "request failed" error, so a user sees a dozen
  unrelated surfaces break at once and concludes the extension is broken rather
  than that they need to sign in again. There is also nothing to stop the
  scheduler draining a full queue into the same 401 thirty times over.
- **Done when:** `docs/adr/0041-a-401-is-a-session-not-a-request.md` exists at
  Status: Proposed and answers, at minimum: **where** the signal surfaces (the
  scheduler sees every request and is the only layer that can pause the queue —
  that is the argument for it over the content script); **what** the panel
  renders and whether it is global or per-surface; whether in-flight and queued
  work is paused or drained; how the state clears (does the panel re-probe, or
  does the admin refresh); and what it costs a user who was mid-operation. It
  must also say what happens to an audit entry for an operation interrupted this
  way — the `D-013` policy and this one meet there.
- **Risk:** None to write. Medium to implement, which is why the ADR comes first.
- **Status:** research:awaiting-review

### D-007c · A 429 is never retried, because it is not an error

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/scheduler/apiScheduler.ts:373,392,406-408,454-479`
- **Verified:** 2026-08-24 — found while scoping `D-007`; read directly.
- **Problem:** `makeApiCall` resolves with the content script's failure object
  rather than throwing, so a 429 takes the **success** path at `:373`,
  increments `metrics.successfulRequests` at `:392`, and never reaches the
  `catch` at `:406-408` that is the only thing wired to `retryRequest`. Retry
  and exponential backoff therefore cover transport throws and timeouts and
  nothing else. Rate limiting is handled purely preventively — `rateLimitDetector`
  plus the cooldown at `:375-383` — so a 429 that gets through anyway is simply
  a lost request, reported to the user as a generic failure, and counted as a
  success in the metrics.
- **Done when:** A resolved failure whose status is retryable (429, and 503 if
  the ADR in `D-007a` agrees) is routed into the existing `retryRequest` path
  with its existing backoff, honoring `cancelGeneration` (`:470-475`) the same
  way; `metrics.successfulRequests` no longer counts a resolved failure. A test
  pins that a 429 is retried and that a 401 is **not** — retrying an expired
  session is just a slower way to fail.
- **Risk:** Medium — changes retry behavior against a live rate limiter. Land it
  after `D-007a`, which gives it the typed status to branch on.
- **Status:** open
- **Depends on:** `D-007a`

### D-008 · Confirm useEntityQuery.ts's abandoned-abstraction status

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/cache/useEntityQuery.ts`
- **Verified:** 2026-08-24 — **refuted.** Every importer enumerated, not sampled.
- **Problem:** ~~Zero production consumers found~~ — **this was wrong.** The
  filing claimed no production consumer used the hook and that every real
  consumer hand-rolled an effect around `entityCache`. There are **9 production
  importers across 11 call sites**: `PolicyCard.tsx:52`, `UserOverview.tsx:60`,
  `AuthPolicyOverview.tsx:82`, `GroupOverview.tsx:133`, `AppListItem.tsx:55`,
  `useUserApps.ts:157`, `useUserDetailPanes.ts:207,215`,
  `useAppOverviewData.ts:69,76`, `useUserComparison.ts:329`. The only test
  importer is its own co-located suite.

  `docs/adr/0026-visibility-gating-patterns.md:100` affirms those consumers as
  correct as written, and `CLAUDE.md:157` names the hook as part of the panel's
  caching layer. It is live infrastructure, not a seam kept for a future caller.

  The evidence the filing rested on had also moved: the cited
  `useAppsData.ts:189-192` comment explaining why that hook cannot use
  `useEntityQuery` was rewritten by `b2ab617` when `useAppsData` moved onto
  `useOrgSnapshot`. The live restatement of the same point — latch identity is
  the (tab, origin) pair, not the cache key — is now
  `src/sidepanel/hooks/useOwedLoad.ts:14-21`.

- **Done when:** Closed. Nothing to build. **A nightly that had acted on the
  original filing would have deleted a hook nine surfaces depend on**, and the
  ledger would have read as a tidy P3 cleanup while it happened — which is why
  the `Verified` line now exists in the format above.
- **Risk:** n/a.
- **Status:** closed:refuted-2026-08-24

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

**Decided 2026-08-24 and split.** The item was `blocked:needs-human` because
"what should the audit trail say when we do not know who acted" is a product
call. It has been made.

**The policy:** the extension never writes an actor it did not resolve. An
unresolved actor is represented **explicitly**, so no reader can mistake it for
a real person; the operation still goes ahead, because refusing a legitimate
admin action over a failed metadata lookup is a worse failure than a labelled
gap — and `/users/me` failing is exactly what an expiring session looks like
(`D-007`); and the user is told once, non-blockingly, so the gap is not a
surprise discovered months later in an export.

**The surface is wider than this item's original filing said**, in two ways the
implementer must not lose:

1. **Four independent implementations**, not one. `useRuleLifecycle.ts:93,102`,
   `useRuleConsolidation.ts:213,217`, `useGroupMerge.ts:131,135` each hand-roll
   the same `/api/v1/users/me` call with the same three silent paths, and
   `CoreApi.getCurrentUser` (`core.ts:250,258,261`) does it a fourth time behind
   the facade, serving group cleanup and every CSV export. A fix scoped to
   `useRuleLifecycle` would leave three surfaces contradicting the new policy.
2. **Three paths reach the placeholder**, and only one of them is a thrown
   error: the `catch` (the lookup threw), a resolved `success: false`, and a
   200 whose profile carries no `email`. From the hook's side that third case is
   a **successful** call — a fix that asks "did the lookup fail?" misses it. It
   is also the one that gets **cached** for five minutes (`core.ts:250` feeding
   `:253-255`), so a single empty profile can mislabel every audited operation
   on that tab until the TTL turns over.

**Why the representation change is nearly free right now:** nothing in the
shipping UI renders `performedBy` — `grep -rn "performedBy"
src/sidepanel/components/` is empty. The component named like the audit viewer,
`AuditLogViewer.tsx` (the History tab, mounted at `App.tsx:486`), reads
`undoManager` via `chrome.storage`, a different store with a different shape.
The IndexedDB audit trail is **write-only in the shipping product**: its only
production callers are `logOperation` and the background retention sweep. So
changing what an actor is breaks zero rendering code today, and gets materially
more expensive the day an audit viewer ships.

### D-013a · The facade resolves an actor, or says it could not

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/hooks/useOktaApi/core.ts:239-263`,
  `src/sidepanel/hooks/useOktaApi/currentUserCache.ts:19,45`,
  `src/shared/types.ts:445-461`, `src/shared/storage/auditStore.ts:186-201`,
  `src/sidepanel/hooks/useOktaApi/groupCleanup.ts:110,240`,
  `src/sidepanel/hooks/useOktaApi/exportEngine.ts:190,196`,
  `src/sidepanel/hooks/useOktaApi/core.getCurrentUser.test.ts:83`
- **Verified:** 2026-08-24 — all paths and all callers read directly.
- **Problem:** `getCurrentUser()` returns `{ email, id }` with
  `unknown@unknown.com` / `unknown` substituted on all three failure paths, so
  its callers are handed a string that is indistinguishable in type and in
  shape from a real identity. `AuditLogEntry.performedBy` is a bare `string`
  with no discriminant, so there is nowhere for "we could not tell" to live even
  if a caller wanted to record it.
- **Done when:** `getCurrentUser()` returns a discriminated
  `Actor = { kind: 'resolved'; email: string; id: string } | { kind: 'unavailable'; reason: 'threw' | 'failed' | 'no-email' }`;
  `AuditLogEntry` carries `performedBy: string | null` plus
  `actorResolution: 'resolved' | 'unavailable'`; the literal
  `unknown@unknown.com` no longer appears anywhere in `src/`, including
  `currentUserCache.ts:19`'s doc comment; **only `kind: 'resolved'` is ever
  cached** (today the no-email placeholder is); `exportAuditLog`'s
  "Performed By" column renders `(actor unavailable)` for a null actor, through
  `csvUtils.escapeCSV` like every other cell; `groupCleanup` and `exportEngine`
  are updated at both their lookup and their `performedBy` sites; and
  `core.getCurrentUser.test.ts:83` is retargeted assertion-by-assertion with an
  ADR-0022 note.

  **Check, do not assume:** `auditStore.ts:73-79` declares an index on
  `performedBy`. IndexedDB does not index null keys, so unavailable-actor
  entries fall out of a `performedBy`-filtered `getHistory` query. That is the
  correct outcome — they have no actor to filter by — but confirm it and record
  the confirmation in the PR. No DB version bump: the store and its indexes are
  unchanged, only a value becomes nullable.

- **Risk:** Medium — audit-trail semantics and a shared facade. Route through
  `security-logging-reviewer`.
- **Status:** done:#94

### D-013b · The three hand-rolled copies use the facade

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts:93,98-107,131,160,192`,
  `src/sidepanel/hooks/useRuleConsolidation.ts:213,217,300`,
  `src/sidepanel/hooks/useGroupMerge.ts:131,135,240,241`,
  `src/sidepanel/hooks/useRuleLifecycle.test.ts:105,123,135,285`,
  `src/sidepanel/hooks/useRuleConsolidation.test.ts:106`,
  `src/sidepanel/hooks/useGroupMerge.test.ts:106`
- **Verified:** 2026-08-24 — all three copies and all six tests read directly.
- **Problem:** Three hooks re-implement the identical `/api/v1/users/me` lookup
  the facade already performs and caches per tab, each with its own copy of the
  three silent paths. Beyond the duplication, it means the `D-013a` policy would
  apply to exports and group cleanup but not to the three operations most likely
  to need an audit trail.
- **Done when:** All three hooks take their actor from `getCurrentUser()`; the
  hand-rolled requests are deleted; `useGroupMerge`'s two entries (`:240,241`)
  both carry the resolved actor; and **six** tests are retargeted
  assertion-by-assertion, each with an ADR-0022 note naming what still covers
  the case. Four are the `CURRENT BEHAVIOUR` cases in `useRuleLifecycle.test.ts`
  — note there are **four**, at `:105`, `:123`, `:135` and `:285`; the original
  filing said three and missed the failure-path one. The other two,
  `useRuleConsolidation.test.ts:106` and `useGroupMerge.test.ts:106`, assert the
  placeholder as _expected_ behaviour with no marker at all, so they will pass
  silently until someone reads them.
- **Risk:** Medium. Behavior change on an audit path, deliberately.
- **Status:** done:#94
- **Depends on:** `D-013a`
- **Closes:** `D-014` — the per-tab TTL cache comes along with the facade.

### D-013c · Tell the admin their identity could not be confirmed

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/components/` (the existing notification surface —
  find it, do not add one), plus the three hooks from `D-013b`
- **Verified:** 2026-08-24.
- **Problem:** Under `D-013a`/`D-013b` the trail stops lying, but the admin
  still learns nothing at the time. The gap would first be noticed in a CSV
  export, long after the context that would explain it is gone.
- **Done when:** An operation whose actor resolved `unavailable` shows one
  non-blocking notice — "Couldn't confirm your signed-in identity. This action
  will be recorded without an actor." — and the operation proceeds regardless.
  Reuse what is already in `components/shared`; a new surface for this needs a
  reason. Ships with a story, axe-clean (ADR-0010/ADR-0014).
- **Risk:** Low.
- **Status:** open
- **Depends on:** `D-013b`

### D-014 · useRuleLifecycle re-implements CoreApi.getCurrentUser

- **Category:** perf
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts:99-106`,
  `src/sidepanel/hooks/useOktaApi/core.ts:239-263`
- **Verified:** 2026-08-24 — still true, and now subsumed.
- **Problem:** `CoreApi.getCurrentUser()` already does exactly what the hook
  hand-rolls — the same `/api/v1/users/me` call with the same fallback — plus a
  per-tab TTL cache. The hook bypasses it and re-hits the endpoint on every
  activate/deactivate.
- **Done when:** Nothing to do separately. `D-013b` moves this hook and two
  others onto the facade, which is this item's entire content; doing it first
  would bake the old fallback into the shared helper, which is what the original
  "sequence it after D-013" note was protecting against.
- **Risk:** n/a.
- **Status:** done:#94 (closed by D-013b)

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
- **Files:** `pushGroupOps.ts:103-125` (the `Resolve app names`
  `runOperation` block), then under `src/sidepanel/hooks/useOktaApi/` — the
  module was deleted by `f1e8def` after this item closed.
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
- **Files:** `pushGroupOps.ts:108-118` (then under
  `src/sidepanel/hooks/useOktaApi/`; deleted by `f1e8def` after this item
  closed), `src/sidepanel/hooks/useOktaApi/appOperations.ts` (`getAppById`,
  then at `:110-119`, now `:88-98`)
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
- **Files:** `pushGroupOps.ts:64`, then under
  `src/sidepanel/hooks/useOktaApi/` — the module was deleted by `f1e8def`
  after this item closed.
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
- **Files:** ~~`pushGroupOps.ts`~~ (deleted), `appOperations.ts:88-98`
- **Verified:** 2026-08-24 — **overtaken.** The motivating caller no longer exists.
- **Problem:** The filing's whole argument rested on one caller:
  the deleted push-group module (`useOktaApi/pushGroupOps.ts`, gone as of
  `f1e8def`) needed a `low`-priority
  single-app read and needed to keep the numeric status that distinguishes "we
  are rate-limited" from "this app has no label", so it parsed the endpoint
  inline rather than adopt `getAppById` — leaving the endpoint parsed in two
  places. **`f1e8def` deleted `pushGroupOps.ts` entirely**, along with
  `applyPushGroupMappings` and the `Resolve app names` block, when app-group
  assignments became the `appGroups` collection and `useGroupsLoader` became a
  pure reader. The duplicate parse is gone; one parse site remains.

  What is left of the complaint is true but unmotivated. `getAppById` (now
  `appOperations.ts:88-98`; the filing's `:110-119` is stale) still collapses
  request failure, validation failure and a thrown request into one `null` and
  discards `response.status`. Its only production caller is now
  `useAppOverviewData.ts:63,71`, rendering one app's overview, which has no need
  to tell 429 from 404.

- **Done when:** Closed. The contract change it asked for is the same one
  `D-007a` needs for session detection, and `getAppById` is named there as its
  first consumer — one change, motivated by a caller that actually exists.
- **Risk:** n/a.
- **Status:** closed:overtaken-by-f1e8def
- **Related:** `D-007a`

### D-028 · Independently audit the ADR-0040 org snapshot against a real org

- **Category:** correctness
- **Priority:** P1
- **Size:** L
- **Files:** `src/shared/snapshot/snapshotSync.ts`,
  `src/shared/snapshot/syncMeta.ts`,
  `src/shared/snapshot/orgSnapshotStore.ts`,
  `src/background/snapshotScheduler.ts`, `src/background/snapshotBridge.ts`,
  `docs/adr/0040-the-background-owns-the-org.md`
- **Problem:** The snapshot was built and tested entirely against canned
  pages and a `Map`-backed `idb` fake. Every unit test passes, and several
  were checked by mutation — but **no part of it has run against real Okta.**
  The failure mode that matters here is not a crash: it is a walk that
  succeeds, stores a plausible-looking inventory, and is quietly wrong, which
  no amount of green suite proves against. This item is the independent pass,
  and it should be done by someone who did not write the code.

  Audit these, in roughly descending order of "silently wrong if untrue":

  1. **The delta probe actually discriminates.** `probeDeltaSupport` counts
     rows newer than a far-future watermark and reads `0` as support. Confirm
     against a live org that (a) the filtered count really is `0`, and (b)
     the request is not rejected outright — a 400 reads as unsupported and
     would condemn the org to permanent full walks without ever saying so.
  2. **`x-total-count` is actually returned** by `/api/v1/groups?limit=1`.
     The drift check is the only thing that can observe a deletion; a missing
     header reads as `unknown`, escalates to a full walk every time, and
     looks exactly like a working system that is merely slow.
  3. **`expand=app` survives the `rel="next"` link.** `preserveParams`
     re-appends it, but confirm on an org with >200 groups that page 2 rows
     still carry `source` — if they do not and the re-append is also wrong,
     every group after the first page silently loses its source app.
  4. **`features` is really on app list rows.** The `appGroups` shard list is
     derived from `GROUP_PUSH` in `/api/v1/apps`. If Okta omits `features`
     there, the fallback quietly takes over and the pre-existing blind spot
     (apps that push without importing) is still present while appearing
     fixed. Verify a known push-enabled app appears in the shard list.
  5. **The composite key holds.** Find or create a group assigned to two
     apps and confirm both mappings survive. Unit-tested, but this is the
     defect that would delete real data from a real admin's view.
  6. **A genuinely interrupted walk resumes.** Suspend the MV3 worker
     mid-walk (or force-reload the extension) and confirm the next attempt
     resumes from the cursor and that the eventual sweep does **not** delete
     rows the interrupted pages had returned.
  7. **Storage volume and retention.** Measure the IndexedDB footprint for
     the largest org available. Group and app profiles are plaintext on disk
     and can carry descriptions with personal data; check the result against
     `docs/security.md`'s "store no more than needed", and decide whether
     anything needs a TTL or a clear-on-sign-out that it does not have.
  8. **Rate-limit headroom.** Watch `X-Rate-Limit-Remaining` during a cold
     sync while actively using the admin console. Walks run at `low` and
     typed search at `interactive`, but the pairing has never been observed
     under real limits.
  9. **The intervals are defensible.** `DRIFT_CHECK_INTERVAL_MS` (15 min)
     bounds how long a deleted group stays listed; `appGroups` refreshes at 6
     hours. Both were chosen by argument, not measurement.
  10. **Rules still live in two places.** `shared/rulesCache` was not
      retired, so the snapshot's `rules` collection and that cache can
      disagree. Confirm no surface reads one while another reads the other
      within a single view.

- **Done when:** Each numbered item above has a recorded verdict against a
  real org — confirmed, refuted, or not-reachable — with any refuted item
  filed as its own `DEBT.md` entry. Assumptions that turn out to be wrong are
  corrected in ADR-0040 rather than only in code, since the ADR is what the
  next change will be read against.
- **Risk:** None to ship — this is a read-only audit. The risk is in _not_
  doing it: every item above is currently an argument rather than an
  observation.
- **Status:** open

### D-029 · Retire `shared/rulesCache` — the last hand-rolled cache

**Re-scoped 2026-08-24, and the file list was wrong.** The item is real and the
decision to do it deliberately stands, but nobody should scope from the original
**Files** list: it named twelve non-test consumers, and seven of them
(`RulesTab.tsx`, `fetchGroupRulesRequest.ts`, `useGroupRuleReferences.ts`,
`useGroupSource.ts`, `useUserComparison.ts`, `membershipAnalysis.ts`,
`groupRuleIndex.ts`) mention `RulesCache` **only in prose comments** and do not
import it. Worse, it named `src/sidepanel/cache/entityCache.ts` as a **writer**;
`entityCache.ts` does not reference `RulesCache` outside a cross-reference in a
doc comment at `:17`. `docs/adr/0040-the-background-owns-the-org.md:183` repeats
the same wrong count and is corrected alongside this.

**There are four real importers**, and the split below follows them. Do not land
this as a sweep — one consumer per PR, tests first.

**Why it matters to an admin, not just to the architecture:** group rules live
in two places that can disagree by up to five minutes — authoritative in the
snapshot's `rules` collection, and separately in a `chrome.storage.local` slot
with its own TTL. A single screen can show rule attribution derived from one and
a blast-radius answer ("what breaks if I deactivate this rule?") derived from
the other. Nothing detects the disagreement and nothing shows it. This is not a
request-count win — `RulesCache` already avoids refetching inside its TTL — it is
a single-source-of-truth fix.

**The precedent to follow** is `useGroupsLoader.ts:161-188`: take raw rows from
the snapshot and derive the joins at read time (`detectConflicts(rawRules)`,
then `formatRuleForDisplay(rule, undefined, conflicts)` — note the `undefined`
second argument, for the reason `groupDiscovery.ts:75-77` gives), with the
rationale that caching a join is only one more thing to invalidate.

### D-029a · Rule impact reads the snapshot

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleImpact.ts:14,77,83-97`
- **Verified:** 2026-08-24 — sole read, confirmed by enumerating importers.
- **Problem:** Reads `RulesCache.get()` for `rawRules` only — which is exactly
  what the snapshot's `rules` collection stores (`RULES_SPEC`,
  `snapshotSync.ts:718-723`, zod-parsed `OktaGroupRule` rows). Nothing here needs
  the cache's formatted/stats/conflicts bundle.
- **Done when:** It reads the snapshot instead. Note it lives in an operation
  factory, not a React hook, so it takes `orgSnapshotStore.getRecords('rules',
origin)` imperatively rather than `useOrgSnapshot` —
  `createRuleImpactOperations` does not currently take an `origin` and needs one
  threaded from its caller. Its existing paginated fallback at `:83-97` stays,
  unchanged, covering a cold snapshot.
- **Risk:** Low — one read site, one shape, and the fallback already handles an
  empty result.
- **Resolution note:** shipped with `orgSnapshotStore.getCollection`, not
  `getRecords` as the filing said. The store's own TypeDoc says to prefer
  `getCollection` everywhere except a composed-key collection (`appGroups`), and
  it returns unwrapped entities — which is exactly `rawRules`, with no
  `.map(r => r.entity)`. Rules are keyed from `row.id`, so the envelope carries
  nothing here. The origin is threaded `RulesTab` → a new optional
  `UseOktaApiOptions.oktaOrigin` → `useOktaApi.ts` → the factory; four files
  beyond this item's **Files** list, forced by its own "needs one threaded from
  its caller". The fallback is unchanged and now covers three cases rather than
  one: no origin resolved yet, a cold snapshot, and a snapshot holding only
  another org. One consequence was filed rather than folded in: `D-038`.
- **Status:** done:#95

### D-029b · User memberships derive their rules

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useUserMemberships.ts:38,212,234,249-250`
- **Verified:** 2026-08-24.
- **Problem:** Two reads of `RulesCache.get()` for `cached.rules` — the
  _formatted_ shape, which the snapshot does not store. This is the surface that
  answers "why is this user in this group", so it is one half of the
  disagreement described above.
- **Done when:** It derives formatted rules from the snapshot's raw rows the way
  `useGroupsLoader.ts:167-188` does. It already republishes through
  `entityCache`'s `RULE_INVENTORY_KEY`, so the derive happens once per key rather
  than per consumer. The deliberate no-write-back at `:249-250` (rules there
  carry ids in place of names) stops being a concern and its comment goes.
- **Risk:** Low-medium — correctness-critical read that surfaces render verdicts
  from. Pin the derived output against the current cached output first.
- **Status:** open

### D-029c · The Rules tab stops owning a cache

- **Category:** correctness
- **Priority:** P2
- **Size:** L
- **Files:** `src/sidepanel/hooks/useRulesData.ts:17,172-178,205,214-215`
- **Verified:** 2026-08-24.
- **Problem:** The only consumer that needs the **whole** bundle: `stats`
  (`:176`, drives the tab header), `timestamp` (`:177` → `lastFetchTime`), and
  `conflicts`. It is also a **writer** (`:205`). Each piece is derivable —
  `stats` is a four-line reduce whose shape already exists inline at
  `groupDiscovery.ts:94-99`, `conflicts` is `detectConflicts(rawRules)`,
  `timestamp` maps to `useOrgSnapshot`'s `lastFullWalkAt` — but the hook also
  owns progress reporting, `apiCost` accounting (`:178,214-215`) and `force`
  refresh semantics, all of which mean "I fetch on demand" and have to be
  re-expressed against a store that syncs in the background. Four test files
  mock `RulesCache` for this path.
- **Done when:** Not checkable yet — needs Sam on what `force` and the API-cost
  readout should mean once the panel no longer initiates the walk.
- **Risk:** Medium. This is the slice that changes what the Rules tab _is_.
- **Status:** blocked:needs-human

### D-029d · Delete the duplicate walk, then the cache

- **Category:** correctness
- **Priority:** P2
- **Size:** L
- **Files:** `src/sidepanel/hooks/useOktaApi/groupDiscovery.ts:8,91,121,145-156`,
  `src/shared/rulesCache.ts` (deleted here, and only here),
  `docs/adr/0040-the-background-owns-the-org.md` §6
- **Verified:** 2026-08-24.
- **Problem:** `fetchAndCacheAllGroupRules` is a **duplicate producer** of
  `RULES_SPEC`'s walk — the snapshot already fetches every group rule in the org
  — so this should be removed rather than ported. But `ensureGroupRulesLoaded`
  and `getGroupRulesForGroup` are called from an imperative operation factory
  with no origin and no React context, and `getGroupRulesForGroup`'s two paths
  are documented at `:145-150` as having to return the _formatted_ shape, a
  subtlety that has already caused one real bug (`inferBestMatchRule` degrading
  to a positional guess). Its downstream callers (`useGroupSource`,
  `useGroupRuleReferences`) assume a warm cache costs nothing, which the
  snapshot preserves.
- **Done when:** `src/shared/rulesCache.ts` is deleted, no module outside
  `orgSnapshotStore` reads or writes a rules cache, and a test pins that two
  surfaces reading rules within one view cannot disagree. Anything removed
  carries an ADR-0022 note. ADR-0040 §6's Status paragraph is updated to say the
  retirement is complete — and not before.
- **Risk:** Medium. Land last, after `D-029a`–`c`.
- **Status:** blocked:needs-human
- **Depends on:** `D-029a`, `D-029b`, `D-029c`

### D-030 · `lint:cited-paths` is red on `main` right now

- **Category:** standards
- **Priority:** P1
- **Size:** S
- **Files:** `DEBT.md` (four `done:` items citing a deleted file),
  `docs/security.md:230`
- **Verified:** 2026-08-24 — reproduced on a clean head, then confirmed
  against `origin/main` itself: `git ls-tree origin/main` shows the push-group
  module absent, while `git show origin/main:DEBT.md` still cites it five
  times.
- **Problem:** `npm run lint:cited-paths` is **red on `main`** — not merely on
  a working branch. `1fc6dd2` squash-merged ADR-0040 into `main` (PR #76) and
  carried the deletions with it, but not the citations, so the gate has been
  red on the default branch since that merge and no session has reported it.
  It was red before any of 2026-08-24's ledger work began. `f1e8def` deleted the push-group module under
  `src/sidepanel/hooks/useOktaApi/` and an earlier commit deleted the groups
  cache under `src/sidepanel/components/groups/`; citations of both survived.
  (Both are named without a filename here on purpose — spelling either path
  out would make this item fail the very gate it is filed about.)

  As of this filing, five citations remain: four in `DEBT.md` naming the
  push-group module, and `docs/security.md:230` naming the groups cache. The
  2026-08-24 ledger pass reworded two others rather than leave them.

  All four `DEBT.md` hits sit inside **`done:`** items — `D-003`, `D-019`,
  `D-020`, `D-026` — closed records of work against a file that no longer
  exists. That is the interesting part. The checker's own header argues that
  `docs/adr/` and `NIGHTLY.md` are excluded because they are dated records
  whose paths describe the repo as it was, and "correcting" them would
  falsify the record. A `done:` item is the same kind of artifact and is
  currently scanned as live prose.

- **Done when:** Done. Fixed in the same PR that filed it, because
  `lint:cited-paths` is a **hard gate** in `ci.yml`'s `verify` job (no
  `continue-on-error`), so the PR could not merge green while it stood — and
  merging past it with `--admin` is the exact behaviour `D-010` and `D-017`
  were about. Folding it in beat both alternatives; the five citations live in
  the same two files this PR already rewrites.

  **Chosen: annotate, don't restructure.** The four `DEBT.md` sites now name
  the file without a resolvable `src/` path and say where it used to live and
  which commit removed it, so the closed record still points a reader at the
  right place. `docs/security.md`'s TTL bullet was **factually** stale, not
  just a broken link — it listed a cache ADR-0040 retired — so it was rewritten
  rather than annotated.

  **Not chosen:** teaching the checker that a `done:`/`closed:` item is a dated
  record. That is the better structural answer and it is filed separately as
  `D-031`; making that call inside a merge would have been a design decision
  taken for the wrong reason.

- **Risk:** Low to fix. The risk is leaving it: a red gate on `main` teaches
  everyone to ignore the job, which is exactly how `D-010` and `D-017`
  happened — both of those were also "red on `main`, unnoticed for weeks".
  This is the third instance of the same pattern, which is itself worth a
  look: nothing routinely runs the ladder against `main`.
- **Status:** done:#82
- **Related:** `D-018`, `D-024` (the same checker's known blind spots), `D-031`

### D-031 · `check-cited-paths` scans closed ledger items as if they were live prose

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `scripts/check-cited-paths.mjs`, `DEBT.md`, `IMPROVEMENTS.md`
- **Verified:** 2026-08-24 — the question surfaced while fixing `D-030`.
- **Problem:** `D-030` was four dead citations in `done:` items — closed records
  of work against a file that has since been deleted. The checker's own header
  argues at length that `docs/adr/` and `NIGHTLY.md` are excluded **because they
  are dated records**: a path in them describes the repo as it was, so
  "correcting" it falsifies the record rather than repairing it. A `done:` or
  `closed:` ledger item is the same kind of artifact by the same argument, and
  is currently scanned as live prose.

  This will recur. Every item that closes against a file someone later deletes
  becomes a future gate failure, and the only remedies available are to annotate
  a historical record or to weaken it — `D-030` chose the former four times in
  one sitting, which is the smell.

  The counter-argument is real and should be weighed rather than assumed away:
  the checker's header says the ledgers matter **most** of all, because a
  nightly picks work _by an item's Files list_, so a stale path there mis-routes
  machinery rather than merely misinforming a reader. But that argument applies
  to items a session can still claim. It does not apply to `done:`/`closed:`
  ones, which step 3 filters out before Files is ever read.

- **Done when:** Either the checker skips `Files:` citations inside an item
  whose `Status:` is `done:*` or `closed:*` (and says so in its header, next to
  the ADR and `NIGHTLY.md` exclusions it already explains), or a written
  decision records why the ledgers should be treated differently from every
  other dated record in the repo. Not a silent config tweak either way.
- **Risk:** Low. Narrowing a gate needs care, but the narrowing is precisely
  scoped by a status field the file already parses.
- **Status:** open
- **Related:** `D-030`, `D-018`, `D-024`

### D-032 · Audit rows written before `actorResolution` contradict their own type

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/types.ts` (`AuditLogEntry`),
  `src/shared/storage/auditStore.ts` (`getHistory`, `logOperation`)
- **Verified:** 2026-08-25 — noticed by the `D-013b` writer while making the
  field required.
- **Problem:** `AuditLogEntry` is both the write shape and the IndexedDB row
  shape, and since `D-013b` those genuinely differ. `actorResolution` is
  required, but rows persisted before `D-013a` have no such field, so
  `getHistory` hands callers `AuditLogEntry` objects that do not satisfy the
  type. Nothing reads the field today, which is the only reason this is latent
  rather than a live bug — `D-013c`, or any audit-trail UI that branches on
  `actorResolution`, would hit it immediately and would read `undefined` as a
  falsy "unavailable" without ever having been told.
- **Done when:** Either a `PersistedAuditLogEntry` (field optional) is split
  from the write-side `AuditLogEntry` and `getHistory` returns it, or
  `getHistory` normalises at read time so every row it returns really does carry
  the field. Whichever is chosen, the `AuditLogEntry` TypeDoc note that
  currently warns readers to decide display from `performedBy === null` is
  updated to say what the code now guarantees.
- **Risk:** Low — no DB migration either way; this is a type/read-path fix.
- **Resolution note:** shipped the **split type**, not read-time normalisation,
  and the argument matters for whoever reads this next. Normalising cannot be
  done honestly here: before `D-013a` an unresolvable actor was written as the
  literal `unknown@unknown.com`, **not** as `null`, so a legacy row is never
  `performedBy === null`. Mapping every legacy row to `'unavailable'` would
  misreport the majority that name a real admin; mapping to `'resolved'` (or
  deriving it from `performedBy !== null`, which is the same thing for legacy
  rows) would relabel the placeholder rows as resolved — the exact invention
  `D-013`'s policy forbids. The only rule separating the two populations is
  sniffing for a literal `D-013a` deliberately deleted from `src/`.
  So `PersistedAuditLogEntry` carries the field as optional and is what the
  `AuditDB` row schema and `getHistory` return; the absent field **is** the
  third state. `ActorResolution` was deliberately **not** widened with a third
  member — it is also the write-side type, and a writer must not be able to
  record "I did not check" as an answer. Confirmed: `exportAuditLog` decides its
  cell from `performedBy` alone, so a legacy row still exports its stored actor
  rather than `(actor unavailable)`, still through `escapeCSV`. No `DB_VERSION`
  bump, no migration, no index change.
- **Status:** done:#95
- **Related:** `D-013a`, `D-013b`, `D-013c`

### D-033 · Two docs still cite `unknown@unknown.com` as current behavior

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `docs/ux-guidelines.md:90`, `docs/features-plan.md:250`
- **Verified:** 2026-08-25 — both cited while implementing `D-013a`.
- **Problem:** Both describe the placeholder actor as what the extension does.
  `D-013b` removed the literal from `src/` entirely, so the docs now describe
  behavior that no longer exists. `lint:cited-paths` cannot catch this — it
  checks that cited _paths_ resolve, not that cited _behavior_ is still real.
- **Done when:** Both passages describe the `Actor` contract instead: an
  unresolved actor is recorded as `performedBy: null` with
  `actorResolution: 'unavailable'`, and the operation proceeds anyway.
- **Risk:** None — documentation only.
- **Status:** open

### D-034 · `useGroupMerge` copies members with a hand-rolled loop, not `runOperation`

- **Category:** standards
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useGroupMerge.ts`
- **Verified:** 2026-08-25 — read while wiring the hook to the actor facade.
- **Problem:** The survivor-membership PUTs run as a hand-rolled `for` loop over
  `makeApiRequest`. `CONVENTIONS.md`'s "Okta API throttling" section says any
  bulk/multi-call operation goes through `coreApi.runOperation`, never a
  hand-rolled loop. Every request still passes through the scheduler, so this is
  not a rate-limit hole — it is a convergence problem plus a missing cancel: a
  merge in flight cannot be abandoned the way every other bulk operation can.
- **Done when:** The member copy runs through `coreApi.runOperation`, and the
  merge's progress reporting and undo bookkeeping are preserved — that
  bookkeeping is the reason this was not folded into `D-013b`.
- **Risk:** Medium — rewrites the progress and undo paths of a destructive
  operation. Needs its own tests before the change, not after.
- **Status:** open

### D-035 · `currentUserSchema` lives in `core.ts`, away from every other Okta schema

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/core.ts:48-53`,
  `src/shared/schemas/okta.ts`
- **Verified:** 2026-08-25 — raised by `security-logging-reviewer` on the
  `D-013a`/`D-013b` diff, advisory.
- **Problem:** `D-013a` added a lenient zod schema for `/api/v1/users/me`
  inline in `core.ts`. Every other Okta-response schema lives in
  `shared/schemas/okta.ts`. ADR-0006 is satisfied either way — this is
  discoverability drift, not a validation gap — but the next person adding a
  boundary schema now has two places to look and two precedents to copy.
- **Done when:** The schema moves to `shared/schemas/okta.ts` beside its
  siblings, or a one-line comment in `okta.ts` records why hook-local response
  schemas are allowed to stay local.
- **Risk:** Low.
- **Status:** open

### D-036 · `ClauseChecklist.tsx` is over the ~300-line bar

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/groups/detail/ClauseChecklist.tsx`
- **Verified:** 2026-08-25 — 309 lines after `I-002`, confirmed by
  `ui-reviewer` (the implementing agent reported 312 and attributed the growth
  to TypeDoc; roughly half of it is the `resolveGroupName` `useMemo`, the new
  prop, and the `RuleExpressionText` wiring — real logic).
- **Problem:** `CLAUDE.md` asks for components under ~300 lines with logic
  pushed into hooks. The file was at 285 before `I-002` and is now just over.
- **Done when:** `ClauseRow` and `ResolvedValue` are extracted as siblings —
  the same move `ClauseGroupList.tsx` already records — and the file is back
  under the bar without behavior changing.
- **Risk:** Low — behavior-preserving extraction, route to
  `architecture-refactor`.
- **Status:** open

### D-037 · `useOktaApi`'s returned facade has no explicit interface

- **Category:** cleanup
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/hooks/useOktaApi.ts`
- **Verified:** 2026-08-25 — noticed while adding `getCurrentUser` to the
  facade for `D-013b`.
- **Problem:** The facade's public surface is inferred from a ~90-key object
  literal. Adding a key — which `D-013b` had to do — changes the public API of
  the hook every side-panel surface consumes, and nothing in review shows that
  as an API change. There is also no single place to read what the facade
  offers.
- **Done when:** The return value is annotated with an exported, TypeDoc'd
  interface, so an addition or removal is visible as a type change.
- **Risk:** Low mechanically, but it will surface existing shape mismatches;
  expect the first attempt to reveal more than it fixes.
- **Status:** open

### D-038 · Rule impact trusts a snapshot that may be mid-walk

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleImpact.ts` (`fetchRawRules`),
  `src/shared/snapshot/orgSnapshotStore.ts` (`getMeta`),
  `src/shared/snapshot/syncMeta.ts`,
  `src/sidepanel/cache/useOrgSnapshot.ts:14-21` (the contract being bypassed)
- **Verified:** 2026-08-26 — raised independently by the `D-029a` writer **and**
  by `security-logging-reviewer` on the same diff.
- **Problem:** `D-029a` moved the impact preview onto the org snapshot, and it
  trusts the snapshot whenever it returns at least one row. It never reads
  `complete` from the collection's sync meta. `useOrgSnapshot.ts:14-21` states
  the contract this bypasses in so many words — "a partial walk is labelled
  partial … so a caller can caveat rather than render a truncated inventory as
  the org" (ADR-0040 §7) — and exposes `complete` precisely so a consumer can
  honour it. `ruleImpact` reads the store imperatively (it is an operation
  factory, not a hook) and so never sees it.
  The question this feature answers is "who loses access if I deactivate this
  rule". The dangerous direction is not a missing rule but a **stale** one: a
  rule deleted in Okta but not yet swept from an incomplete walk makes the tool
  believe a member is still covered by another active rule when they are not,
  which **understates** the impact of the deactivation. That is a wrong answer
  to an access question, presented unqualified.
- **Done when:** Either `fetchRawRules` requires `complete` before serving from
  the snapshot and falls through to its existing paginated fetch otherwise, or
  the impact summary carries the incompleteness through to the UI so the admin
  is not given an unqualified answer. Pick one deliberately and record why — the
  first is cheaper and costs a walk; the second is more informative and is the
  direction ADR-0040 §7 points. A test pins that a partial snapshot does not
  silently become the answer.
- **Risk:** Low to fix. The risk is leaving it: the failure is a confident wrong
  answer, not an error state.
- **Status:** open
- **Related:** `D-029a` (introduced the read), `D-029`
- **Also noticed:** an org with genuinely zero group rules can never satisfy
  "at least one row", so it re-paginates `/api/v1/groups/rules` on every impact
  preview even when fully synced. Correctness-safe — it never serves wrong data
  — so it is a missed optimisation, not a second defect. A `complete` check
  would incidentally fix it, which is one more argument for that option.

### D-039 · `RuleCard`'s memo comparator omits the group props it renders

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/components/RuleCard.tsx` (the `memo` comparator)
- **Verified:** 2026-08-26 — raised by the `I-003` writer while working in the file.
- **Problem:** The custom `memo` comparator does not compare `groupIds`,
  `groupNames` or `allGroupNamesMap`, so a card whose group names resolve _after_
  first paint can keep rendering the stale set. `docs/components.md` states the
  rule directly: a custom comparator must be kept in step with the props the
  component actually reads.
  `I-003` makes this materially more visible. Before it, an unresolved group and
  a resolved one differed by a colour and a truncated id; now they are two
  different components — an `EntityLink` chip that opens the group versus a
  stated "name not loaded". A missed re-render used to look like a styling
  quirk; it now looks like the app not knowing a group it does know.
- **Done when:** The comparator covers every prop the render reads, or is
  removed in favour of the default shallow compare with a note saying why the
  custom one was not needed. A test pins that late-arriving group names repaint
  the card.
- **Risk:** Low. Widening a comparator can only cause _more_ re-renders, never
  a stale one.
- **Status:** open
- **Related:** `I-003`

### D-040 · `RuleCard.tsx` is well over the ~300-line bar and hand-rolls its icons

- **Category:** cleanup
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/RuleCard.tsx`,
  `src/sidepanel/components/shared/OpenInOktaLink.tsx` (the primitive it should
  be using), `src/sidepanel/components/overview/shared/Icon.tsx`
- **Verified:** 2026-08-26 — measured by the `I-003` writer; ~490 lines before
  that item, ~530 after.
- **Problem:** Three separate house rules, all in one file:
  1. `CLAUDE.md` asks for components under ~300 lines with logic pushed into
     hooks. The expanded detail body is the obvious extraction (`RuleCardDetails`).
  2. Two inline `<svg>` elements — the external-link glyph on "View in Okta" and
     the disclosure chevron — against the rule that icons come from the `Icon`
     registry.
  3. That same anchor carries `style={{ fontFamily: 'var(--font-heading)',
minHeight: '36px' }}`, an inline pixel style, and looks like it simply
     wants to be the shared `OpenInOktaLink`.
     Its "USES ATTRIBUTES" pills also hand-roll a chip that duplicates `Badge`.
- **Done when:** The file is back under the bar by extraction (no behaviour
  change), both inline SVGs come from `Icon` or the anchor becomes
  `OpenInOktaLink`, and the attribute pills use `Badge`. Route to
  `architecture-refactor`; existing tests and stories stay green untouched.
- **Risk:** Low — behaviour-preserving, but the file has two consumers now
  (the Rules tab and the Group Detail Rules tab), so verify both.
- **Status:** open
- **Related:** `I-003`, `D-036` (the same bar, one file over)

### D-041 · Decorative icons carry no `aria-hidden`, app-wide

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/overview/shared/Icon.tsx`,
  `src/sidepanel/components/shared/EntityLink.tsx`,
  `src/sidepanel/components/shared/CopyableId.tsx`
- **Verified:** 2026-08-26 — raised by `ui-reviewer` on the `I-003` diff, which
  added three fresh instances of a pre-existing gap.
- **Problem:** `docs/ux-guidelines.md` requires decorative SVG and dividers to
  carry `aria-hidden="true"`. `Icon` never sets it itself, and its call sites
  inside `EntityLink` and `CopyableId` do not either — so every entity chip in
  the app announces a decorative glyph that duplicates the label beside it.
  This is systemic and pre-existing; `I-003` did not introduce it, which is why
  it was filed rather than folded into that diff (`CLAUDE.md`).
- **Done when:** Decorative `Icon` usages are hidden from the accessibility tree
  — defaulting `aria-hidden` inside `Icon` with an opt-out for the rare case
  where the glyph _is_ the accessible name is the cheapest route, but check for
  that case first rather than assuming it does not exist. Stories stay axe-clean.
- **Risk:** Low, but it touches every icon in the app, so land it on its own.
- **Status:** open

### D-042 · The `idb` fake is copy-pasted across four test files

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleImpact.test.ts`,
  `src/sidepanel/hooks/useAppsData.test.ts`,
  `src/sidepanel/hooks/useGroupsLoader.test.tsx`,
  `src/shared/snapshot/orgSnapshotStore.test.ts`,
  `src/test/factories/` (the home it wants)
- **Verified:** 2026-08-26 — the fourth copy was added by `D-029a`; the writer
  flagged it rather than extracting mid-item.
- **Problem:** The same `vi.hoisted` `Map`-backed `idb` fake now exists verbatim
  in four test files. Every surface that moves onto the org snapshot adds
  another copy, and `D-029b`/`D-029c` are queued to do exactly that.
  `src/test/factories/` already exists for shared test doubles.
- **Done when:** One fake in `src/test/factories/`; all four files import it.
  Purely test-side, behaviour-preserving; every existing assertion stays.
- **Risk:** Low.
- **Status:** open
- **Related:** `D-029a`, `D-029b`, `D-029c`

### D-043 · Nothing validates an audit row on the way out of IndexedDB

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/storage/auditStore.ts` (`getHistory`, `getStats`),
  `src/shared/types.ts` (`PersistedAuditLogEntry`)
- **Verified:** 2026-08-26 — noticed by the `D-032` writer while splitting the
  row type.
- **Problem:** `getHistory` trusts whatever `idb` returns to match the declared
  shape. A row carrying a garbage `actorResolution` string — written by an older
  build, or by anything that reached the database — types as `ActorResolution`
  and passes straight through to a caller that will branch on it. `D-032` made
  the declared shape honest about a _missing_ field; it did nothing about a
  _wrong_ one.
  ADR-0006 targets Okta responses, not our own storage, so this violates no
  stated rule. It is the same class of problem one storage layer down, and it is
  filed so the decision is deliberate rather than an omission.
- **Done when:** Either rows are parsed on read with a lenient zod schema the
  way Okta responses are (dropping or repairing a malformed row, never
  throwing), or a note in `auditStore.ts` records why our own store is trusted
  and Okta's responses are not.
- **Risk:** Low either way. The cost of leaving it is a silent wrong branch in
  whatever audit UI ships next.
- **Status:** open
- **Related:** `D-032`, `D-013c`
