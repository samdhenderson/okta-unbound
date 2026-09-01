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
- **Status:** done:#102
- **Related:** absorbs what `D-027` wanted before that item was overtaken.

### D-007b · One expired session, not thirty failed requests

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0050-a-401-is-a-session-not-a-request.md` (to be created),
  `src/shared/scheduler/apiScheduler.ts`, `src/sidepanel/App.tsx`
- **Verified:** 2026-08-29 — still holds, but on narrower ground than the
  original filing: `D-007a` shipped `isSessionExpired` (401 only), so a 401 is
  now _distinguishable_. Exactly one surface consumes it (`getAppById` →
  HomeTab's jump bar); the scheduler still drains a queue into the same 401 and
  no global signal exists, which is the whole of what this item asks for.
  **Renumbered:** this item reserved `docs/adr/0041-…`, but ADR-0041 has been
  taken since by the read-only API explorer decision — next free is 0050. The
  original `Verified` line (2026-08-24) cited `CONVENTIONS.md`'s Session-expiry
  section as evidence; that section was rewritten tonight, so it no longer
  supports the claim and the code was re-read instead.
- **Problem:** When the admin's Okta session ends mid-use — signed out in
  another tab, or simply timed out — the panel does not notice. Every queued
  request fails with an ordinary "request failed" error, so a user sees a dozen
  unrelated surfaces break at once and concludes the extension is broken rather
  than that they need to sign in again. There is also nothing to stop the
  scheduler draining a full queue into the same 401 thirty times over.
- **Done when:** `docs/adr/0054-a-401-is-a-session-not-a-request.md` exists at
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
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0054-a-401-is-a-session-not-a-request.md`. The number this item reserved on 2026-08-24 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0054** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.

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
- **Resolution note:** the surface is `AlertMessage` (`warning` — a degraded
  outcome, not a failure), driven by a new `useActorNotice` hook that owns the
  copy and the state so all three flows say the same thing. It renders in
  **two** places, not one: `RulesTab`'s existing alert stack for
  activate/deactivate, and inside `RuleConsolidationModal` /`GroupMergeModal`
  for the two wizard flows — those run behind an open modal, where a banner on
  the tab underneath would never be seen. `noteActor` is pure state called after
  `getCurrentUser()`; it never gates the write.
- **Status:** done:#99
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

  11. **An expired session really returns 401.** ADR-0054 rests entirely on
      `isSessionExpired()` firing, which requires Okta to answer an expired
      admin session with HTTP 401 rather than a 302 to a sign-in page. If these
      endpoints redirect instead, the whole suspension mechanism sits idle and
      the panel behaves exactly as it does today. Sign out in a second tab and
      watch what the next queued request actually receives.
  12. **`String.substring` out-of-range behaviour.** ADR-0055 refuses to
      implement it because Okta's clamp-versus-throw behaviour at the boundary
      is undocumented, and the disagreement is silent. Write a rule using it
      with an out-of-range index and record which it does.
  13. **Relative time-window boundaries.** Also ADR-0055: whether a "within N
      days" condition is inclusive or exclusive, and whether it evaluates
      against org time or UTC. A rule granting access for 30 days that the
      panel reads as 31 is a security claim the panel got wrong.

- **Done when:** Each numbered item above has a recorded verdict against a
  real org — confirmed, refuted, or not-reachable — with any refuted item
  filed as its own `DEBT.md` entry. Assumptions that turn out to be wrong are
  corrected in ADR-0040 rather than only in code, since the ADR is what the
  next change will be read against.
- **Risk:** None to ship — this is a read-only audit. The risk is in _not_
  doing it: every item above is currently an argument rather than an
  observation.
- **Status:** blocked:needs-live-org
- **Why blocked (2026-08-29):** this was the night's top-priority candidate by
  sort order — the only open P1 on either ledger — and it was picked up before
  anything else. Every one of its ten checks is defined as _a verdict against a
  real org_: a live delta probe, a real `x-total-count` header, an org with >200
  groups, a known push-enabled app, a suspended MV3 worker, an observed
  `X-Rate-Limit-Remaining`. An unattended sandbox session has no Okta org and no
  browser session to one, so it cannot produce a single one of those verdicts.
  It can only re-read the same code the item was written against, which is not
  what the item asks for and would produce exactly the false confidence the
  filing exists to prevent ("no part of it has run against real Okta").
  Gated rather than left `open` so it stops presenting as the highest-priority
  available work to every future run that cannot do it either. **This needs
  Sam, or any session with a real org; it is not a breakdown problem and
  splitting it further will not help.**
- **Confirmed 2026-08-29 by Sam**, and two additions. The re-gate above is
  right and stands. `I-014` is blocked from the other direction on the same
  missing thing — its sparse-patch-merge blocker also cannot be closed from the
  repo — so if a live-org session happens, run both in it. And items 11–13 were
  appended by `chore/unstick-backlog`: each is a question one of ADR-0054 /
  ADR-0055 rests on and cannot answer from the repo, which is exactly the shape
  of thing this item collects.

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
- **Status:** done:#97

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
- **Decided 2026-08-29 by Sam — `force` and the cost readout both go.** The tab
  becomes a pure reader of the snapshot store. There is no refresh button and no
  API-cost number; freshness is stated instead, as a "synced N minutes ago" line
  sourced from `useOrgSnapshot`'s `lastFullWalkAt`.

  The reasoning, recorded so the implementer does not have to re-derive it: once
  the background owns the walk, **both readouts become lies.** `force` would
  promise the admin a fetch this tab no longer performs, and an API-cost number
  scoped to a tab that issues no requests is either zero or someone else's
  spend — and the version that reports someone else's spend is worse, because it
  looks like an answer. A timestamp is the honest replacement: it is the thing
  the admin actually wants to know (is this current?) and it is a fact the tab
  can state without owning anything.

  This deletes behaviour rather than porting it. That is the point — the item is
  the slice that changes what the Rules tab _is_, and what it becomes is a view.

- **Done when:** `useRulesData` no longer fetches, no longer reports progress or
  `apiCost`, and exposes no `force`. `stats` is derived from the snapshot's raw
  rules (the four-line reduce whose shape already exists at
  `groupDiscovery.ts:94-99`), `conflicts` from `detectConflicts(rawRules)`, and
  the tab header's timestamp from `lastFullWalkAt`. The Rules tab renders a
  freshness line in place of the refresh control and the cost readout. The four
  test files that mock `RulesCache` for this path are retargeted
  assertion-by-assertion per ADR-0022, with a PR note saying what stays covered;
  any assertion pinning the refresh button or the cost number is removed under
  the "subject was deleted" carve-out, not weakened.
- **Risk:** Medium. This is the slice that changes what the Rules tab _is_. It
  removes a control admins can see, so it is user-visible and wants a line in
  the PR description, not just a commit message.
- **Status:** open

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
- **Status:** blocked:D-029c
- **Re-gated 2026-08-29 by Sam.** This was `blocked:needs-human`, but the human
  question was never in this item — it was `D-029c`'s, and it is now answered
  there. What remains is an ordering constraint, not a judgment call, so the
  gate word now names the real blocker. It becomes `open` the moment `D-029c`
  lands; no further decision from Sam is needed or should be waited for.
- **Depends on:** `D-029a` (done:#95), `D-029b` (done:#97), `D-029c` (open)

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
- **Status:** done:#97
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
- **Status:** done:#97
- **Related:** `I-003`

### D-040 · `RuleCard.tsx` is well over the ~300-line bar and hand-rolls its icons

- **Category:** cleanup
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/RuleCard.tsx`,
  `src/sidepanel/components/shared/OpenInOktaLink.tsx` (the primitive it should
  be using), `src/sidepanel/components/shared/Icon.tsx`
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
- **Files:** `src/sidepanel/components/shared/Icon.tsx`,
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

### D-044 · `--bar-bleed` is measured through the rung's entrance transform

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/useActionOverflow.ts` (`publish`),
  `src/sidepanel/components/GroupsTab.tsx` (the rung wrapper that supplies the
  transform), `src/sidepanel/tailwind.css` (`.dock-band::before`, `::after`)
- **Verified:** 2026-08-26 — found while fixing the docked strip's missing merge
  seam on the Groups detail rung; deliberately left out of that diff.
- **Problem:** `publish()` sets `--bar-bleed` from
  `band.getBoundingClientRect().left`, which is the distance the merge has to
  bleed to reach the panel edge. `getBoundingClientRect` reports the
  **transformed** box. On the Groups tab the strip mounts inside a wrapper
  running `animate-push-in` (`transform: translateX(16%)` at its first frame),
  and the hook's first measure pass fires from a `ResizeObserver` during that
  entrance — so the published bleed can be the gutter plus ~16% of the rung's
  width rather than the gutter. The Users rung never sees this because its
  detail rung has no entrance animation. The consequence is cosmetic and
  transient — a merged strip that overhangs the panel edges further than it
  should, until any resize re-publishes a resting measurement — which is why it
  is filed rather than fixed inline.
- **Done when:** The published bleed reflects the band's **untransformed**
  position. Either the pass is deferred until no ancestor animation is in effect,
  or the offset is derived from something transform-free (`offsetLeft` against
  the offset parent, or the column's own padding), with a comment saying which
  and why. A story or unit test pins the published value against a transformed
  ancestor; today nothing covers it, and jsdom cannot see it (no stylesheet, no
  layout).
- **Risk:** Low. `--bar-bleed` feeds only the merge chrome and the bleed plate —
  nothing in flow, nothing interactive.
- **Status:** open
- **Related:** ADR-0032

### D-045 · Two more row comparators carry the drift `D-039` just removed

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/policies/PolicyCard.tsx` (the `memo`
  comparator and its comment at `:156`),
  `src/sidepanel/components/groups/GroupListItem.tsx` (its comparator),
  `docs/components.md` (the "Keep the memo comparator in step" rule)
- **Verified:** 2026-08-27 — raised by the `D-039` writer while removing
  `RuleCard`'s comparator; the two siblings were read, not assumed.
- **Problem:** `D-039` found that `RuleCard`'s hand-written comparator had
  fallen behind the props its render reads, and removed it in favour of the
  default shallow compare — the honest compare turned out to be identical, since
  every field hangs off one `rule` prop with stable identity. `PolicyCard` and
  `GroupListItem` still carry hand-written comparators of the same shape and
  have never been enumerated against their render bodies, so the same drift may
  already be live in them. `PolicyCard.tsx:156` also now describes something
  that no longer exists — its comment reads "Field-wise prop comparison,
  mirroring `RuleCard` and `GroupListItem`".
  The `D-039` writer additionally noted that these comparators tend to omit
  **handler** props, which is the more dangerous half: a handler wired after
  first paint leaves a control missing, and a handler swapped after first paint
  leaves a stale closure being invoked.
- **Done when:** Each of the two comparators is enumerated against every prop
  its component's render actually reads — handlers included — and is either
  widened to match or removed in favour of shallow compare with a note saying
  why, exactly as `D-039` did. A test pins late-arriving data repainting each
  card. `docs/components.md`'s blanket "Rows are `memo`ised with a custom
  comparator; every newly rendered field must be added to it" is reworded to
  match whatever survives — it is currently stated as a house rule that
  `RuleCard` no longer follows.
- **Risk:** Low. Widening or dropping a comparator can only cause _more_
  re-renders, never a stale one.
- **Status:** open
- **Related:** `D-039`

### D-046 · The Rules tab re-creates every handler it hands to a `RuleCard`

- **Category:** perf
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RulesTab.tsx` (`handlePreviewImpact`,
  `handleRequestDeactivate`, and the inline `onLoad` passed to
  `RulesListPanel`)
- **Verified:** 2026-08-27 — measured by the `D-039` writer at the call sites
  while choosing between widening and removing the comparator.
- **Problem:** `RulesTab` passes plain function expressions re-created on every
  render as `onDeactivate` and `onPreviewImpact`, plus an inline
  `onLoad={() => loadRules(false)}`. `D-039` removed `RuleCard`'s custom
  comparator, which had been masking this by ignoring handler props entirely —
  so with shallow compare in place these unstable references are now what
  limits memoisation on this surface. This is a caller-side stability problem
  and was deliberately **not** papered over by a comparator that ignores props
  it also invokes.
- **Done when:** The handlers `RulesTab` passes down are stabilised with
  `useCallback` (or hoisted), so `RuleCard`'s shallow compare can actually
  skip unchanged rows. No behavior change — this is purely render volume.
- **Risk:** Low. Nothing changes but how often a row re-renders.
- **Status:** open
- **Related:** `D-039`

### D-047 · A fully-walked org with no rules reads the same as a rule that hits nobody

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useRuleImpact.ts`,
  `src/sidepanel/components/RulesTab.tsx`,
  `docs/adr/0040-the-background-owns-the-org.md` §7
- **Verified:** 2026-08-27 — noticed by the `D-038` writer while replacing the
  row-count gate with a `complete` check.
- **Problem:** `D-038` made `fetchRawRules` serve from the org snapshot only
  when the rules walk is `complete`, which is correct and closes the
  understated-impact hole. It leaves a smaller seam behind: when the walk is
  complete and the org genuinely holds zero group rules, the impact summary
  reports that nobody loses access — accurate, but rendered identically to a
  rule that has been evaluated against a full inventory and truly affects
  nobody. The admin cannot tell "there is nothing to collide with" from "I
  checked, and nothing collides".
- **Done when:** The two cases are distinguishable in the impact summary, or a
  deliberate note records why they need not be. This is the seam ADR-0040 §7's
  "caveat rather than render a truncated inventory as the org" would eventually
  attach to, and it is the cheaper half of the remedy `D-038` declined for
  scope.
- **Risk:** Low — it is a copy/state distinction, not a data change.
- **Status:** open
- **Related:** `D-038`, ADR-0040 §7

### D-048 · A rule's exclusion list never reaches the user-path classifier

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `src/shared/ruleUtils.ts` (`formatRuleForDisplay`, the producer),
  `src/shared/types.ts` (`FormattedRule`),
  `src/shared/utils/membershipAnalysis.ts:138-172` (the documented hole),
  `src/sidepanel/components/UsersTab.test.tsx` (where it is now characterized)
- **Verified:** 2026-08-27 — surfaced by `D-029b` when rule seeding moved onto a
  path that actually formats what it is given; the producer and the type were
  both read, not inferred.
- **Problem:** `isUserExcludedFromRule` reads
  `conditions.people.users.exclude`, which only a **raw** Okta rule carries.
  Every rule that reaches the user-path classifier is a `FormattedRule`, and
  that shape has no `conditions` at all — `formatRuleForDisplay` keeps
  `groupIds`, `conditionExpression` and `userAttributes` and drops the rest. So
  the function always returns `false` on this surface, and a user on a rule's
  exclusion list is still attributed to the very rule that excludes them: the
  row says `Rule?` where the truth is `Direct`.
  `membershipAnalysis.ts` documents this in full and deliberately leaves it to
  the producer to close, which is why this is its own item. It is **pre-existing
  and long-standing** — `RulesCache` stored the same formatted shape, so no
  migration caused it; `D-029b` only made it visible, and pinned it as a
  `CHARACTERIZED (defect)` case rather than deleting the assertion that had
  been passing on a fixture no producer emits.
- **Bounded, and worth stating:** it cannot invent a membership, only mis-name
  its source — exclusion is consulted to _downgrade_ an attribution, never to
  create one. Okta applies exclusions before it reports membership, so the
  primary attribution source (`_embedded['group-rules']`) is unaffected. Only
  this fallback over-attributes, and only on the user path.
- **Done when:** The formatted shape carries what the classifier needs to see an
  exclusion — widening `FormattedRule` alone changes nothing, so the producer
  must populate it — and `UsersTab.test.tsx`'s characterization case is restored
  to asserting `Direct` with the rule unnamed, which is what it asserted before
  `D-029b` and what the admin should see. `membershipAnalysis.ts`'s "Known hole"
  block comes out with it.
- **Risk:** Medium. It changes an attribution verdict an admin acts on, and the
  producer feeds every formatted-rule consumer, not just this one.
- **Status:** claimed:beta/trust-and-polish
- **Related:** `D-029b`

### D-049 · `RULE_INVENTORY_KEY` is a cache-key literal outside `keys.ts`

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useUserMemberships.ts` (the
  `RULE_INVENTORY_KEY = 'groupRuleInventory'` declaration),
  `src/sidepanel/cache/keys.ts`
- **Verified:** 2026-08-27 — noticed by the `D-029b` writer while preserving the
  republish through this key.
- **Problem:** `CLAUDE.md` states that every cache key literal lives in
  `keys.ts`. This one is declared in the hook that publishes it, so the entity
  cache's key grammar cannot be read in one place, and a second publisher of the
  same inventory would have no obvious literal to reuse. Pre-existing; `D-029b`
  preserved the key deliberately rather than moving it, since relocating a cache
  key is a change to the cache-key grammar and belongs in its own diff.
- **Done when:** The literal moves to `src/sidepanel/cache/keys.ts` beside the
  others and the hook imports it. No behavior change — the key string itself
  must not change, or in-flight cached inventories are orphaned.
- **Risk:** Low, provided the string is preserved verbatim.
- **Status:** open
- **Related:** `D-029b`

### D-050 · The group-rules fallback fetch validates nothing

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/fetchGroupRulesRequest.ts` (the pagination
  loop), `src/shared/schemas/okta.ts` (`oktaGroupRuleSchema`),
  `src/shared/utils/oktaPagination.ts` (`parseOktaList`, the validated helper)
- **Verified:** 2026-08-27 — raised as **blocking** by `security-logging-reviewer`
  on the `D-029b`/`D-038` diff, then independently confirmed: the file contains
  no `zod`, `parseOktaList` or `schema` reference of any kind, and is untouched
  by that diff.
- **Problem:** `fetchGroupRulesRequest` concatenates `response.data` straight
  into `OktaGroupRule[]` — a raw cast, with no boundary validation at all. ADR-0006
  requires every Okta response to be validated with zod before it is rendered or
  branched on, and rule `conditions.expression` and
  `actions.assignUserToGroups.groupIds` are named in `docs/security.md` as
  end-user-controllable.
  This diverges from the write side and from its own sibling: the snapshot's
  `RULES_SPEC` (`snapshotSync.ts`) validates every rule row through
  `oktaGroupRuleSchema` before storing it, and `ruleImpact.fetchRawRules`'
  inline fallback re-validates with the same schema. Only this path does not.
- **Not introduced by `D-029b`, but newly load-bearing.** It is long-standing
  shared infrastructure with **five non-test consumers** — `useRulesData.ts`,
  `useBlastRadius.ts`, `useUserComparison.ts`, `useUserMemberships.ts` and
  `RuleCard.tsx` — which is why it was filed rather than folded into that item's
  diff. `D-029b` makes it the sole fallback for user-membership rule attribution
  once `RulesCache` stops serving that flow, so a malformed row now reaches a
  surface that answers "why is this user in this group".
- **Done when:** The pagination loop validates each page with
  `oktaGroupRuleSchema` through `parseOktaList`, mirroring
  `ruleImpact.ts`'s fallback, and drops or reports a row that fails rather than
  casting it. A test pins that a malformed rule row does not reach a consumer.
  Check all five consumers still behave when a row is rejected — a lenient
  schema that keeps the rest of the page is likely the right shape here.
- **Risk:** Low to fix, and it closes an ADR-0006 gap on a surface that renders
  access verdicts.
- **Resolution note:** `oktaGroupRuleSchema` needed no change — it is already
  `.passthrough()` with only `id`/`name`/`status` required, and `parseOktaList`
  already drops the offending row, keeps the page, and logs counts only. **The
  gap was worse than this filing said:** a rule whose
  `conditions.expression.value` is not a string made `formatRuleForDisplay`
  throw, so one malformed row returned `{ success: false }` for the _whole_
  rules load. The empty-page guard deliberately still reads pre-validation
  `response.data.length`; using the validated count would let a page whose rows
  were all dropped look like an empty final page and silently truncate the list.
  Two of the five named consumers (`useBlastRadius`, `useUserComparison`) import
  only `loadCachedGroupNames` from this module, not `fetchGroupRulesRequest` —
  they consume a different export and are unaffected.
- **Status:** done:#99
- **Related:** `D-029b`, `D-038`, ADR-0006

### D-051 · Two always-on log calls pass a raw caught error

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleImpact.ts` (the `log.warn` in
  the group-meta fetch), `src/sidepanel/hooks/useUserMemberships.ts` (the
  `log.error` in the membership load's catch)
- **Verified:** 2026-08-27 — raised by `security-logging-reviewer`; both lines
  confirmed **pre-existing** and untouched by tonight's diff (every log line the
  diff adds is a `log.debug` carrying a count or an outcome).
- **Problem:** `logger.ts` gates `debug` to development but `warn` and `error`
  always emit, including in production builds. Both call sites hand the raw
  caught `error`/`err` object to the logger rather than extracting `.message`,
  so whatever a future throw site attaches to that object ships to the console.
  `CLAUDE.md` allows identifiers and outcomes only — never request/response
  bodies or PII. There is no evidence either error currently carries a body;
  this is about the shape, not a known leak.
  `snapshotSync.ts` already models the stricter discipline, extracting
  `error.message` and logging only a code plus the collection, with a comment
  warning that copying such a line into a shipping `log.error` would do exactly
  what this item describes.
- **Done when:** Both sites log `error instanceof Error ? error.message :
'unknown'` (or an equivalent narrowing) instead of the raw object. A sweep for
  other `log.warn`/`log.error` call sites passing a bare caught value is worth
  doing in the same pass, since the fix is mechanical.
- **Risk:** Low. Console output changes; nothing else.
- **Status:** open
- **Related:** `D-029b`, `D-038`

### D-052 · `ruleImpact` models rule deactivation as retracting membership

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/shared/membership/ruleImpact.ts` (`classifyGroupImpact`
  :114-118, and the module/function docs at :5-6, :132, :153),
  `src/sidepanel/components/rules/RulesListPanel.tsx` (:41-42, the deactivate
  gate), the Preview Impact modal's copy, `ruleImpact`'s tests, and
  `.claude/skills/okta-api/references/groups-and-rules.md` (:154, :311, and the
  `[verified: shared/membership/ruleImpact]` citation on that section)
- **Verified:** 2026-08-26 — raised by Sam while reviewing the demo reel's
  rule-impact scene, then checked against Okta's documentation.
- **Problem:** `classifyGroupImpact` puts every member held **only** by the
  subject rule into `losing`, and the module documents itself as answering "who
  loses access if this rule is deactivated?". Okta does not work that way.
  Deactivating a group rule removes nobody: per _Impact of Deactivating and
  Deleting Okta Group Rules_, "Okta does not remove users that the rule added to
  a group. The group membership remains, but the rule no longer applies to new
  users." The choice to retract exists only on **delete**, where the admin picks
  between leaving the users as now-unmanaged members and removing them
  outright — surfaced as the `removeUsers` query parameter on
  `DELETE /api/v1/groups/rules/{ruleId}`, and irreversible either way.

  So the set `losing` computes is the correct answer to _delete with
  `removeUsers=true`_ and the wrong answer to _deactivate_, where the answer is
  always nobody. The repo already disagrees with itself about this:
  `groups-and-rules.md:154` states that former members "remain in the group —
  deactivation does not retract membership", and `:311` warns that "a 'what
  breaks' report that assumes retraction overstates the impact" — while the
  surrounding section cites `[verified: shared/membership/ruleImpact]` as its
  evidence. The skill is vouching for a module that contradicts it.

  It escaped notice because the hero rule's `losing` set happens to be empty, so
  every screenshot and every test of the happy path shows `0` either way.

  Docs:
  - https://support.okta.com/help/s/article/what-happens-if-group-rules-are-deactivated-and-deleted?language=en_US
  - https://developer.okta.com/docs/api/openapi/okta-management/management/tag/GroupRule/#tag/GroupRule/operation/deleteGroupRule

- **Done when:** The module names the case it actually computes rather than
  conflating two verbs. `losing` is renamed for the delete-with-removal case;
  deactivate reports the set that genuinely changes, which is the members who
  become **unattributed** (still in the group, no longer explained by any rule)
  rather than members who leave. Every consumer is audited against the new
  names: the Preview Impact modal's copy, `RulesListPanel.tsx`'s deactivate
  gate, and the tests. `groups-and-rules.md`'s `[verified:]` citation is correct
  once module and skill agree.
- **Risk:** Medium. This changes a contract and user-facing claims, so it is
  **architecturally significant** and goes through the plan-and-approval gate as
  its own PR. Do not fold it into unrelated work.
- **Status:** done:#106
- **Approved 2026-08-29 by Sam**, conditional on establishing what Okta actually
  does on delete. That was done before approving; the verdict is below and the
  item is now scoped enough to implement without re-researching it.

  **The three cases, verified against Okta's own documentation:**

  | Verb                                         | What happens to existing members                                                                                                                      | Reversible?       |
  | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
  | **Deactivate**                               | Nobody moves. "Okta does not remove users that the rule added to a group. The group membership remains, but the rule no longer applies to new users." | Yes — reactivate. |
  | **Delete, `removeUsers=false`** (or omitted) | "Users remain members of the group, but the rule no longer manages the membership." They become ordinary manual members.                              | **No.**           |
  | **Delete, `removeUsers=true`**               | "Okta removes the users from the group entirely."                                                                                                     | **No.**           |

  Okta states the delete choice plainly: _"The choice an administrator makes when
  deleting a group rule is permanent and irreversible."_ Recreating the rule
  afterwards does not undo either branch — it re-evaluates against the directory
  as it is now, which is a different set.

  `removeUsers` is an **optional Boolean** query parameter on
  `DELETE /api/v1/groups/rules/{ruleId}`, documented as "Indicates whether to
  keep or remove users from groups assigned by this rule". **Omitting it keeps
  the users.** Any UI this item produces must send the parameter explicitly
  rather than relying on that default, because the safe default and the
  destructive one differ by a single absent query string.

  **Two corrections to this item's own filing, found while verifying it:**

  1. The support-article URL it cited 404s. The live article is
     `what-happens-if-group-rules-are-deactivated-and-deleted`, and the citation
     above has been repointed. The quotes in the original filing are accurate —
     only the link had rotted.
  2. `.claude/skills/okta-api/references/groups-and-rules.md` documents the
     deactivate case correctly at `:154` and `:311` but **says nothing about
     `removeUsers` at all** — the delete endpoint is listed at `:163` with no
     mention of the parameter or the choice it encodes. That is the same blind
     spot the module has, in the reference that is supposed to catch it. Filed
     as `D-073`.

  **Scope confirmation:** implement as the **Done when** above already states —
  rename `losing` for the delete-with-removal case, have deactivate report the
  newly-**unattributed** set, audit all three consumers, fix the `[verified:]`
  citation. No preliminary ADR: the semantics are now documented facts rather
  than a design space, and the two-verb model is Okta's, not ours to choose. It
  remains its own PR and must not be folded into unrelated work.

- **Related:** ADR-0043 (the demo reel's rule-impact chapter is held out of the
  reel until this lands; when it returns it argues **both verbs side by side** —
  deactivate, where nobody moves but N members become unattributed, and delete,
  where N are removed or N are kept as now-manual members, with `removeUsers` as
  the irreversible choice between them)

### D-053 · Late-landing content re-lays-out the text beside it

**One defect in seven places, filed as a cluster because the remedy is one
convention rather than seven fixes.** In each case an element changes size after
mount — a chip whose label swaps, a count badge that only appears once a fetch
resolves, a button whose label runs through three lengths — while sitting in a
flex or grid row beside text that is `min-w-0` and therefore free to absorb the
change. The neighbour re-truncates, re-wraps, or changes its line count, and the
row visibly re-lays-out under the reader's eye.

**How it was found.** Filming the demo reel (ADR-0043) put the panel on camera at
2.6x, where the reflow is unmissable. The Layout Instability API names the shape
directly: clicking a group row reports sources `DIV.flex-1.min-w-0` and
`DIV.shrink-0.flex.items-center`, a `shrink-0` cluster widening beside a
`flex-1 min-w-0` column. The measurement and the reasoning are in
[ADR-0044](docs/adr/0044-a-reel-that-can-fail.md).

**Why the reel does not close it.** The reel absorbs the symptom reel-side and
touches no file under `src/`: a settle gate waits for the page to go quiet before
each beat, and `SHOWCASE_CSS` sets `scrollbar-gutter: stable`. Waiting conceals a
late-landing badge; it does not reserve room for one. Real users get neither the
gate nor the gutter. These items exist so the workaround does not retire the
symptom it was written against.

**The convention the fixes should converge on**, rather than seven ad-hoc
patches:

- A numeric readout that changes width renders with `tabular-nums`. The
  precedent and its rationale are already written down in
  `src/sidepanel/components/shared/StatCard.tsx:10` and
  `src/sidepanel/hooks/useCountUp.ts:70`.
- A `shrink-0` element whose content can change length reserves its widest state,
  by `min-w-` or by a fixed basis, so its neighbour never has to move.
- A late-arriving badge occupies its slot before it has a value, or the row is
  laid out so that its arrival cannot change any other track's width.

`D-053g` is the one that is not per-component and is worth doing first: it
affects every scroll box in the app, on every platform.

### D-053a · The match percentage goes from 2 characters to 4, beside a truncating label

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/ComparisonHero.tsx:78-88`
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044; this is
  the symptom Sam reported verbatim from the reel.
- **Problem:** The row is `flex items-baseline justify-between gap-2`. The right
  span renders a two-glyph placeholder while loading and `${similarity}%` after,
  so it goes from two characters to three or four, in a proportional font, with no
  `tabular-nums`, no reserved width and no `shrink-0`. The left span is
  `min-w-0 truncate text-xs …` and additionally swaps its own placeholder for
  `Match · ${scopeNote}`, so both sides change at once and the label re-truncates
  at whatever width the percentage leaves it. Because the digits are proportional,
  it keeps twitching afterwards: `9%` and `100%` are different widths and so are
  `11%` and `88%`.
- **Done when:** The percentage cannot change the label's available width. It
  carries `tabular-nums` and `shrink-0`, and it reserves the width of its widest
  state (`100%`) so the loading placeholder occupies the same box as the value.
  `ComparisonHero.stories.tsx` already has `Default` and `Loading`; the fix is
  checkable by flipping between them at side-panel width and seeing the label's
  truncation point stay put. Per ADR-0023 that stays a visual check rather than a
  class assertion.
- **Risk:** Low. One row, no behaviour.
- **Status:** open
- **Related:** `D-053`, ADR-0044. The reel masks this with a settle gate; the
  defect is unchanged for real users.

### D-053b · A status chip swings between 4 and 13 characters beside a wrapping mono expression

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/groups/detail/ClauseChecklist.tsx:183-197`
  (the clause row), `:238-248` (the summary row), `:126,132,138` (the labels)
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044.
- **Problem:** `ClauseRow` is `flex items-start justify-between gap-3` holding a
  `min-w-0 flex-1 font-mono … break-words whitespace-pre-wrap` expression beside a
  `shrink-0` chip. The chip's label is `Pass` (4 characters), `Fail` (4) or
  `Not evaluated` (13), and which one it is flips when `groupContext` resolves and
  an `isMemberOf*` clause stops being unevaluable. The chip is `shrink-0`, so the
  whole difference comes out of the expression column, which is set to wrap: the
  row changes line count, and every row below it moves. `ChecklistSummary`
  (`:238-248`) has the same shape with `Rule matches this user` /
  `Rule does not match` / `Cannot be determined`, 22 characters against 18 against
  20, beside a counts sentence that also changes.
- **Done when:** The chip column has a stable width across all three labels, so
  resolving group context changes the chip's contents and nothing else. Either the
  chip reserves the width of its longest label, or the row is a two-track grid
  with a fixed chip track rather than `justify-between`. Note `D-036` already has
  this file over the 300-line bar; do not land the two together.
- **Risk:** Low. Presentation only.
- **Status:** open
- **Related:** `D-053`, `D-036` (same file, over the line bar), ADR-0044. The reel
  masks this with a settle gate.

### D-053c · A group-count badge takes width out of a multi-line description

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/CauseWorklist.tsx:254-267`
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044.
- **Problem:** The remedy header is `flex items-start gap-2` holding an icon, a
  `min-w-0 flex-1` column (heading plus a wrapping description) and a `shrink-0`
  `{n} group` / `{n} groups` badge. The badge appears with the causes, so it goes
  from absent to present, and its width then depends on the digit count and on the
  singular/plural swap. Every one of those changes comes out of the `flex-1`
  column, which wraps, so the description re-flows each time.
- **Done when:** The badge's slot is reserved before it has a value, or the header
  is laid out so the badge cannot change the description's width (its own track,
  or the badge dropped below the heading). The count carries `tabular-nums`.
- **Risk:** Low. Presentation only.
- **Status:** open
- **Related:** `D-053`, ADR-0044. The reel masks this with a settle gate.

### D-053d · The MFA scan paragraph re-wraps three times as the button label changes

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:**
  `src/sidepanel/components/groups/detail/GroupMfaCoverageSection.tsx:72-86`,
  `src/sidepanel/components/members/MfaScanButton.tsx:47` (the three labels).
  The same button is also hosted by
  `src/sidepanel/components/members/MemberFilterPanel.tsx:118` and
  `src/sidepanel/components/members/CompositionReports.tsx:150`; check whether
  their rows have the same shape before fixing only one.
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044.
- **Problem:** The row is `flex flex-wrap items-center justify-between gap-3` with
  a `<p>` that carries no `flex-1` and no `min-w-0`, beside `MfaScanButton`. The
  button's label runs `Run MFA scan` (12 characters) then `Scanning…` (9, plus a
  loading spinner) then `Rescan` (6), and it changes variant, so it takes three
  different widths during one scan. The paragraph's own text also swaps from the
  instruction to the result sentence when the scan completes. Because the
  paragraph is a plain flex item with no basis, it sizes off its content and gets
  re-wrapped at each of those transitions, and on a narrow panel the row can
  `flex-wrap` and unwrap mid-scan.
- **Done when:** The paragraph is `min-w-0 flex-1` and the button reserves the
  width of its widest label, so a scan changes what the row says and not how it is
  laid out.
- **Risk:** Low. Presentation only.
- **Status:** open
- **Related:** `D-053`, ADR-0044. The reel masks this with a settle gate.

### D-053e · Three tab labels slide sideways when their count badges materialise

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/ComparisonTabBar.tsx:82-99`
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044.
- **Problem:** Each tab is `flex items-center justify-center gap-1.5` holding an
  icon, a label and an optional badge rendered only when
  `t.badge !== undefined && t.badge > 0`. The badge lands when the comparison
  resolves, and because the cell is `justify-center`, adding it pushes the icon and
  the label left within the cell rather than appending to their right. Three of the
  four tabs (Groups, Apps, Attributes) do it in the same frame, so the whole rail
  appears to shuffle.
- **Done when:** The badge's arrival does not move the icon or the label. Either
  the badge occupies a reserved slot from first render, or the cell's content is
  left-aligned with the badge pushed to the trailing edge so it grows into empty
  space. The badge carries `tabular-nums`.
- **Risk:** Low. Presentation only, though it touches the tab rail's alignment, so
  check the four-tab and two-column (`sm:grid-cols-4`) breakpoints both.
- **Status:** open
- **Related:** `D-053`, ADR-0044. The reel masks this with a settle gate.

### D-053f · The Filters button shrinks the search field, and the member count grows in place

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/members/MemberExplorer.tsx:346-374` (the
  search row and the Filters button), `:415-422` (the member count)
- **Verified:** 2026-08-27 — read against the file while writing ADR-0044.
- **Problem:** Two instances in one component. The search row is `flex gap-2` with
  a `flex-1` search box beside a Filters button that has neither a basis nor
  `shrink-0`; when `activeFilterCount` becomes non-zero the button gains a count
  pill, so the button grows and the search field shrinks under a typing user.
  Separately, the member count at `:418-421` renders `sorted.length` and appends
  ` of ${members.length}` only while a filter is active, so `250` becomes
  `47 of 250` in a `justify-between` row: the heading widens and the Copy button
  beside it moves.
- **Done when:** The Filters button is `shrink-0` and reserves the width of its
  badged state, so filtering never resizes the search field; and the count either
  reserves its widest form or renders both parts from first paint (`250 of 250`),
  with `tabular-nums` either way.
- **Risk:** Low. Presentation only.
- **Status:** open
- **Related:** `D-053`, ADR-0044. The reel masks this with a settle gate.

### D-053g · Classic scrollbars take 6px out of content width the instant a list overflows

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/tailwind.css:297-313` (the
  `.scrollable-list::-webkit-scrollbar` rules). Consumers:
  `src/sidepanel/components/shared/Modal.tsx:273` (every modal body),
  `src/sidepanel/components/shared/ScrollableList.tsx:148`,
  `src/sidepanel/components/users/comparison/ComparisonDiffTab.tsx:180` (whose
  `grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)]` tracks at `:246` truncate against
  the width it takes),
  `src/sidepanel/components/users/comparison/ComparisonAttributesTab.tsx:255`,
  `src/sidepanel/components/users/ProfileDisplayAttributesTab.tsx:252`,
  `src/sidepanel/components/RuleImpactModal.tsx:152`,
  `src/sidepanel/components/RuleConsolidationModal.tsx:112`
- **Verified:** 2026-08-27 — `grep -rn scrollbar-gutter src/` returns nothing;
  consumer list enumerated, not sampled.
- **Problem:** Styling `::-webkit-scrollbar` opts a box out of Chrome's overlay
  scrollbars entirely and gives it a classic one, whose width comes out of the
  content box. Nothing anywhere in the repo sets `scrollbar-gutter`, so every
  `.scrollable-list` box loses 6px of content width at the exact moment it crosses
  from fitting to overflowing — a row arriving from a fetch, a disclosure opening,
  a filter clearing — and every string under a `truncate` or a wrap inside it
  re-lays-out. This is the one member of `D-053` that is not waitable: there is no
  quiet period to sit through, the available width simply changes. It applies on
  every platform, because the `::-webkit-scrollbar` rules override the overlay
  behaviour macOS would otherwise give.
- **Done when:** `.scrollable-list` sets `scrollbar-gutter: stable`, so the channel
  is reserved whether or not the bar is showing and the transition costs nothing.
  Check the app's own scroll root at the same time: the panel is 360px wide at its
  narrowest and 6px of permanently reserved gutter is a real trade, so confirm the
  reserved variant reads better than the reflow before shipping it everywhere
  rather than assuming it does.
- **Risk:** Low to change, but it is a one-line rule affecting every scroll box in
  the app, so land it alone and look at the narrow breakpoint.
- **Resolution note:** shipped on `.scrollable-list` only. The app scroll root
  was looked at, as the item required, and **deliberately left alone**: it is
  unstyled, so it keeps the platform scrollbar (an overlay bar on macOS, against
  which `scrollbar-gutter` is spec'd as a no-op); where it is classic it is
  ~15px and already overflowing in most states; and decisively,
  `scrollbar-gutter` reserves inside the scroll container's padding box, so it
  would inset every full-bleed sticky band inside the root — `ContextBar` and
  `PageHeader` — leaving their background and bottom border ~15px short of the
  panel edge as a permanent seam. 6px inside a bordered list card reads as
  padding; 15px beside a white header band reads as a defect. The reflow is the
  lesser artifact there.
- **Status:** done:#99
- **Related:** `D-053`, ADR-0044. **The reel works around this by setting
  `scrollbar-gutter: stable` in `SHOWCASE_CSS`, which is reel-side only and does
  nothing for real users.** When this lands, that rule becomes a harmless
  restatement rather than a mask. **Correction, found while implementing:** the
  reel rule (now `.storybook/scripts/capture/stage.mjs:139`, not `SHOWCASE_CSS`)
  targets **two** selectors. Its `.scrollable-list` half is indeed a harmless
  restatement now. Its `[data-testid='app-scroll-root']` half is **not** — given
  the decision above it stays reel-only, and therefore stays a mask. Defensible
  on its own terms (the reel shoots at a fixed, wider viewport where a shifting
  root on camera is unacceptable and the header-seam cost does not bite), but it
  is a deliberate divergence now rather than a duplicate.

### D-054 · `ScrollableList` still shifts 6px on load→loaded

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/ScrollableList.tsx` (the loading
  branch and the empty branch, versus the scrolling branch at `:148`)
- **Verified:** 2026-08-28 — found by the `D-053g` writer while implementing it.
- **Problem:** `D-053g` reserved the scrollbar channel on `.scrollable-list`, but
  `ScrollableList` puts that class **only** on its scrolling branch. Its loading
  branch and its empty branch render `boxClasses('overflow-hidden')` without it,
  so those boxes have no reserved gutter while the loaded box does — content
  still jumps 6px the moment a spinner is replaced by rows, which is the exact
  reflow `D-053g` exists to remove. The CSS fix cannot reach this from
  `tailwind.css`, because the class is the hook.
- **Done when:** The reserved gutter applies across all three branches, so the
  box's content width does not change between loading, empty and loaded. Check
  whether adding `scrollable-list` to the non-scrolling branches has any other
  effect (they are `overflow-hidden`, so the `::-webkit-scrollbar` rules should
  be inert) before assuming the one-word change is enough.
- **Risk:** Low — but it is the remaining tail of `D-053g`, so verify against the
  same story set that item used.
- **Status:** open
- **Related:** `D-053g`

### D-055 · `formatRuleForDisplay` does unguarded string work on a field it does not validate

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/ruleUtils.ts` (`formatRuleForDisplay`, the `.replace(…)`
  around `:117`), `src/sidepanel/hooks/useOktaApi/groupDiscovery.ts` (a caller
  that formats rules from its own source)
- **Verified:** 2026-08-28 — found by the `D-050` writer; the throw was
  reproduced as the pre-fix failure of that item's first new test.
- **Problem:** `formatRuleForDisplay` types its input as an already-validated
  `OktaGroupRule` and then performs unguarded string operations on
  `rule.conditions.expression.value`. When that field is not a string the
  function **throws**, and because it runs inside a `.map` over a whole page, one
  bad row takes down the entire rules load rather than costing one row. `D-050`
  closed the boundary on `fetchGroupRulesRequest`'s path, so that specific
  entry is now safe — but the function is exported and reachable from at least
  `groupDiscovery.ts`, which formats rules obtained its own way.
- **Done when:** Every `formatRuleForDisplay` caller is **enumerated** (not
  sampled — use the `okta-claim-check` skill) and either shown to validate
  upstream, or the function is made to defend itself against a non-string
  expression. A test pins whichever guarantee is chosen.
- **Risk:** Low to investigate. The defect it protects against is a whole-surface
  outage from a single malformed row, which is why this is P2 and not P3.
- **Status:** done:#102
- **Related:** `D-050`

### D-056 · `AlertMessage` hand-rolls two raw buttons inside `components/shared`

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/AlertMessage.tsx:133` (the inline
  action button), `:149` (the dismiss button)
- **Verified:** 2026-08-28 — found by the `D-013c` writer; both confirmed
  pre-existing and untouched by that diff.
- **Problem:** `CLAUDE.md`'s hard rule is never to hand-roll a `<button>` —
  import from the `components/shared` barrel. `AlertMessage` hand-rolls two, and
  it **is** `components/shared`, so the component the rule exists to protect is
  the one breaking it. `Button` and `IconButton` live in the same directory. The
  dismiss button already carries `aria-label="Dismiss message"` and an `Icon`,
  which is most of what `IconButton` would give it.
- **Done when:** Both buttons come from the shared primitives, with
  `AlertMessage`'s rendered output and public props unchanged (it has ~35 call
  sites across `src/sidepanel/components/`, so this must be behaviour-preserving).
  Existing tests and stories stay green without retargeting.
- **Risk:** Low-medium — behaviour-preserving in intent, but the blast radius is
  every alert in the app, so lean on the story suite.
- **Status:** open

### D-057 · `RulesTab`'s alert states cannot be reached by a story

- **Category:** standards
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/RulesTab.tsx` (the alert stack),
  `src/sidepanel/components/RulesTab.stories.tsx`
- **Verified:** 2026-08-28 — found by the `D-013c` writer while adding the
  actor-unavailable notice.
- **Problem:** `RulesTab`'s error banner, and now the `D-013c` actor-unavailable
  notice, are driven by internal hook state rather than props, so
  `RulesTab.stories.tsx` cannot render either state. Two user-visible alert
  states therefore have no story and no axe coverage, on a tab that does have a
  story file. The two modal notices added by `D-013c` are prop-driven and **are**
  covered; this is the one render site that is not.
- **Done when:** The alert stack is reachable from a story — most likely by
  extracting it into a prop-driven subcomponent — and both states ship an
  axe-clean story (ADR-0010/ADR-0014). This is a refactor of how the tab gets its
  alert state, not a copy change, which is why it was not folded into `D-013c`.
- **Risk:** Low-medium — touches a large tab component; `RulesTab.tsx` is already
  near the ~300-line bar, so extraction should reduce it rather than grow it.
- **Status:** open
- **Related:** `D-013c`

### D-058 · Three modals hand-roll the eyebrow recipe `Eyebrow` exists to own

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleConsolidationModal.tsx:151,162,186`,
  `src/sidepanel/components/groups/GroupMergeModal.tsx:116` (the hand-rolled
  eyebrow labels), `:127` (an off-scale `py-2.5`),
  `src/sidepanel/components/RuleImpactModal.tsx:288` (the "Target groups"
  label — the third instance, found 2026-08-30),
  `src/sidepanel/components/shared/Eyebrow.tsx` (the primitive they should use)
- **Verified:** 2026-08-28 — spotted by `ui-reviewer` while reviewing the
  `D-013c` diff; both files confirmed **pre-existing** and untouched by that
  change. **Re-confirmed and widened 2026-08-30** — `ui-reviewer` found the same
  recipe in `RuleImpactModal` while reviewing `D-052`, and `git show` confirmed
  that line is pre-existing and untouched by that diff too.
- **Problem:** Five call sites across three modals build a section eyebrow out of
  the `tracking-wider` recipe that `docs/design-system.md` bans in favour of the
  shared `Eyebrow` component, which exists precisely so the typography contract
  lives in one place. `GroupMergeModal.tsx:127` additionally uses an off-scale
  `py-2.5`. Reported as advisory, not blocking, and deliberately not folded into
  `D-013c`'s diff — that item added notice props to these files and nothing
  else, and widening it would have broken the one-concern-per-PR rule. The same
  reasoning kept it out of `D-052`'s diff on 2026-08-30.
- **Done when:** All five eyebrow labels render through `Eyebrow`, the `py-2.5`
  moves onto the spacing scale, and all three modals' existing stories stay green
  without retargeting. **The enumeration this item asked for has now been run
  twice and grown the list both times** — run `grep -rn "tracking-wider" src/`
  and fix every hit, rather than the three modals named here.
- **Risk:** Low — presentational, behind two components that already have story
  coverage.
- **Status:** open
- **Related:** `D-013c` (how it was found)

### D-059 · `handleGetAppInfo` fetches the app on every app page, even when the DOM already answered

- **Category:** perf
- **Priority:** P2
- **Size:** S
- **Files:** `src/content/index.ts:190-208` (the unconditional fetch),
  `src/content/groupHandlers.ts:46-62` (the DOM-first pattern to mirror),
  `src/sidepanel/hooks/useOktaPageContext.ts` (the caller)
- **Verified:** 2026-08-28 — read at the commit that removed the Overview tab;
  the fetch is issued whether or not `extractAppNameFromPage()` returned a name.
- **Problem:** `handleGetAppInfo` scrapes the name from the DOM and then issues
  `GET /api/v1/apps/{id}` regardless, using the response only to fill a name it
  usually already has. `handleGetGroupInfo` next door does the opposite and
  correct thing: it fetches **only** when the DOM came up empty.

  This was harmless while `useOktaPageContext` was gated to the active Overview
  tab. That tab is gone and the hook is now the `ContextBar` masthead's feed,
  gated on `!isPinned` alone — so an admin browsing app pages now pays one
  request per app page, on every tab, forever. Accepted knowingly when the
  re-gate landed, and filed here rather than folded into that commit.

  **The nuance that makes this not a one-line change:** the API response also
  supplies `appLabel`, which the DOM cannot. A naive "skip the fetch when the DOM
  gave a name" drops the label. Decide deliberately whether `appLabel` is worth a
  request on every app page — `AppInfo.appLabel` is optional, and its consumers
  should be enumerated before it is quietly stopped being populated.

- **Done when:** The app fetch is conditional in the same shape
  `groupHandlers.ts` uses, `src/content/index.test.ts`'s `getAppInfo` block gains
  a case proving the request is **not** issued when the DOM supplies a name, and
  whatever is decided about `appLabel` is stated in the handler's doc comment
  rather than left to be rediscovered.
- **Risk:** Low — one handler, already covered by `content/index.test.ts`.
- **Status:** done:#102
- **Related:** the Overview-tab removal (which promoted this from harmless to
  per-page), `D-007a`

### D-060 · Can `/api/v1/apps` report group assignments, or must the snapshot fan out?

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `src/shared/snapshot/snapshotSync.ts` (`APP_GROUPS_SPEC`,
  `pushEnabledAppShards`), `src/sidepanel/components/apps/appFilters.ts`
  (`pushesNoGroups` and the long doc explaining the narrowing),
  `src/sidepanel/components/groups/ruleOrphans.ts` (`PUSH_APPS_ONLY`),
  `src/sidepanel/hooks/useOrgFigures.ts` (the "pushes nothing" finding)
- **Verified:** 2026-08-28 — `APP_GROUPS_SPEC.shards` walks
  `/api/v1/apps/{id}/groups` for group-push apps only; nothing in the repo has
  tested whether the question can be answered more cheaply.
- **Problem:** The `appGroups` collection is a fan-out: one listing per
  push-enabled app. Everything built on it therefore answers a **narrower**
  question than the one an admin asks. "Apps with no group assigned" ships as
  "Push apps pushing nothing"; the app-access report carries `PUSH_APPS_ONLY`;
  and for any app outside that set an absent assignment means _nobody asked_,
  not _nothing is assigned_.

  The narrowing is honest but may be unnecessary. If `GET /api/v1/apps` supports
  an `expand` that returns each app's group assignments — or if any single
  listing answers the same question — the whole fan-out collapses to one walk
  and three surfaces widen at once. Nobody has checked; the current shape was
  chosen because the fan-out was the only route _known_, not because it was
  compared against an alternative.

- **Done when:** The `okta-api` skill and Okta's own docs are checked for an
  `expand` (or any other single-listing route) that yields app→group
  assignments, and the finding is written down either way. If one exists,
  `APP_GROUPS_SPEC` loses its shard provider and `pushesNoGroups` becomes a real
  "no group assigned"; if none does, `PUSH_APPS_ONLY` and `appFilters.ts`'s doc
  get a line citing this item so the next reader does not re-open the question.
- **Risk:** Medium — a widened filter changes what three shipped surfaces claim,
  so it needs the honesty rules re-checked, not just the query swapped.
- **Status:** open
- **Related:** ADR-0040, `I-012`

### D-061 · A rule can point at a group that no longer exists, and nothing says so

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `src/shared/rules/groupRuleIndex.ts`,
  `src/sidepanel/components/groups/ruleOrphans.ts` (the sibling module this
  would join), `src/sidepanel/components/RuleCard.tsx`
- **Verified:** 2026-08-28 — noticed while building the Home reports; the
  snapshot holds both collections, so the join is free and simply is not made.
- **Problem:** `actions.assignUserToGroups.groupIds` is a list of ids Okta does
  not validate against the group inventory on read. A rule whose target group
  was deleted still lists it, still shows as `ACTIVE`, and does nothing — and
  the panel renders it exactly like a working rule. The org snapshot already
  holds `groups` and `rules`, so "target ids with no matching group" is a set
  difference over rows on disk: **zero requests.**

  The honesty rule from the Home reports applies unchanged and is the reason
  this is not a five-line change: groups is read _negatively_ here (a missing id
  is only meaningful if the group walk finished), so the finding must be
  suppressed entirely unless that collection is `complete`. Reusing
  `resolveCount`'s `gates` is the intended shape.

- **Done when:** The join lives beside the others in `ruleOrphans.ts` with its
  own unit cases, an incomplete group walk suppresses it, and the rule surface
  says which target is missing rather than rendering a dead rule as a live one.
- **Risk:** Low to compute, medium to present — claiming a rule is broken is a
  strong claim, and it must not be made off a half-read group list.
- **Status:** open
- **Related:** `D-060`, ADR-0040 §7

### D-062 · Two context engines probe the same page twice on every navigation

- **Category:** perf
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0058-one-context-engine.md` (to be created); read-only for
  reference: `src/sidepanel/hooks/useOktaTabContext.ts`,
  `src/sidepanel/hooks/useGroupContext.ts`,
  `src/sidepanel/hooks/useOktaPageContext.ts`, `src/sidepanel/App.tsx`
- **Verified:** 2026-08-28 — both hooks are mounted in `App` and both are now
  always-on; each sends its own `getOktaOrigin` plus its own entity probes on
  every navigation.
- **Problem:** `App` runs two independent `useOktaTabContext` instances.
  `useGroupContext` feeds every tab's `targetTabId`/`oktaOrigin`;
  `useOktaPageContext` feeds the `ContextBar` masthead. They have always
  overlapped, but the overlap used to be bounded because the page hook was gated
  to the active Overview tab. Removing that tab made it always-on, so the
  duplication is now paid on **every** navigation rather than on some of them.

  Folding one into the other would roughly halve probe traffic. It is
  architecturally significant — it changes what feeds nine tabs and the
  masthead, and the two hooks have different failure semantics today (one
  latches `error`, the other falls back to `admin`) — so it is a proposal
  first.

- **Done when:** A Proposed-status ADR exists under `docs/adr/` naming the merged
  hook's shape, what happens to the two failure semantics, and how a pin
  interacts with a single engine. **Zero files under `src/`.**
- **Risk:** n/a — research only.
- **Status:** research:awaiting-review
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0058-one-context-engine.md`. The number this item reserved on 2026-08-28 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0058** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.
- **Related:** `D-059` (the other traffic cost the re-gate exposed), ADR-0018,
  ADR-0026

### D-062 · `handleGetAppInfo` reads an Okta response with no zod boundary

- **Category:** security
- **Priority:** P2
- **Size:** S
- **Files:** `src/content/index.ts` (`handleGetAppInfo`, the `response.data.name`
  / `response.data.label` reads), `src/content/index.test.ts` (whose existing
  case title already admits it: "no zod validation here")
- **Verified:** 2026-08-29 — raised independently by the `D-059` writer and by
  `security-logging-reviewer` on the same diff; both read the handler directly.
- **Problem:** ADR-0006 says every Okta response is validated at the
  content-script boundary before it is rendered or branched on. `handleGetAppInfo`
  does not: it reads `.name` and `.label` off `response.data` raw. Its two
  neighbours in the same file do the opposite — `handleGetGroupInfo` parses with
  `oktaGroupSchema`, `handleGetPolicyInfo` with `oktaPolicyListItemSchema` — so
  this is a gap in an otherwise consistent boundary, not an undecided question.
- **Bounded, and worth stating:** `D-059` made the fetch conditional, so this
  path now runs strictly less often (only when the page heading is missing).
  Exposure is reduced, not closed — the reviewer's words.
- **Done when:** `handleGetAppInfo` parses its response with a lenient schema the
  same way `handleGetPolicyInfo` does, degrading rather than throwing on a
  validation miss, and the test whose title concedes the gap is retargeted.
- **Risk:** Low — one handler, already covered by `content/index.test.ts`.
- **Status:** open
- **Related:** `D-059`, ADR-0006

### D-063 · `AppInfo` is declared twice, verbatim, in two files

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/types.ts` (the shared declaration),
  `src/sidepanel/hooks/useOktaPageContext.ts` (a verbatim local copy it also
  re-exports)
- **Verified:** 2026-08-29 — enumerated by the `D-059` writer while tracing every
  consumer of `AppInfo.appLabel`; both declarations read in full, not grepped.
- **Problem:** The content script imports the shared `AppInfo`; the hook declares
  its own identical copy and re-exports that. Nothing links them, so a field
  added to one is invisible to the other and no type error anywhere says so. The
  two are in sync today purely by coincidence of having been written together.
- **Done when:** One declaration survives, in `shared/types.ts`, and the hook
  imports it. Any re-export it needs is a re-export of that type.
- **Risk:** Low — mechanical, and the compiler proves the merge.
- **Status:** open
- **Related:** `D-059`

### D-064 · A non-ok response drops its headers, so a 429 arrives with no rate-limit headers

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/content/apiRequest.ts` (the `!response.ok` return, which omits
  `headers` although the function has already built them),
  `src/shared/scheduler/rateLimitDetector.ts` (the consumer that needs them),
  `src/content/index.test.ts` (which already pins the drop as a `BUG (pinned)`)
- **Verified:** 2026-08-29 — surfaced by the `D-007a` writer and confirmed
  directly against the file: `headers` is populated from `response.headers` and
  then included on the success return and on the `DELETE` return, but not on the
  `!response.ok` return.
- **Problem:** `RateLimitDetector` exists to read `X-Rate-Limit-Remaining` /
  `-Limit` / `-Reset` off Okta responses, and `CONVENTIONS.md` describes cooldowns
  driven by them. A 429 is exactly the response whose headers matter most — and
  it is a `!response.ok` response, so its headers never leave the content script.
  Rate limiting is therefore steered only by the headers of requests that
  succeeded, and the one response that says "you are being throttled, here is
  when to come back" tells the scheduler nothing.
- **Why it is filed now:** it directly limits `D-007c`. That item routes a
  retryable resolved failure into `retryRequest` with backoff; honest backoff
  wants `X-Rate-Limit-Reset`, which under this defect is not there to read.
  `D-007c` should not be started before this is fixed or consciously accepted.
- **Done when:** the `!response.ok` return carries `headers` like its siblings,
  the pinned `BUG (pinned)` case in `content/index.test.ts` is retargeted to
  assert the headers survive, and `RateLimitDetector` is shown to observe them on
  a 429.
- **Risk:** Low to fix. The behavior change is that the scheduler starts seeing
  headers it currently cannot, which is the point.
- **Status:** done:#108
- **Related:** `D-007a`, `D-007c`

### D-065 · `fetchAndCacheAllGroupRules` walks a whole endpoint with no boundary schema

- **Category:** security
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/groupDiscovery.ts`
  (`fetchAndCacheAllGroupRules`), `src/shared/utils/oktaPagination.ts` (the
  `schema`-less branch that casts `response.data` straight to `T[]`)
- **Verified:** 2026-08-29 — found by the `D-055` writer while enumerating that
  item's callers; the pagination cast was read directly, not inferred.
- **Problem:** `fetchAllPages<OktaGroupRule>(…)` is called with **no `schema`
  option**, so `oktaPagination.ts` casts the raw page straight to `OktaGroupRule[]`
  and unvalidated rows flow into `RulesCache` and on to every consumer. This is
  the second half of what `D-050` closed on `fetchGroupRulesRequest`'s path.
  `D-055` stopped the specific outage (a non-string expression no longer throws
  out of a `.map`), but malformed `groupIds` and other fields still reach
  consumers unchecked. The path is live: `ensureGroupRulesLoaded` →
  `useGroupRuleReferences`, and `getGroupRulesForGroup` → `useGroupSource`,
  `useGroupMerge`.
- **Done when:** the walk passes `{ schema: oktaGroupRuleSchema, context: 'GET
/api/v1/groups/rules' }` — `fetchAllPages` already supports it — and what
  happens to a row that fails validation is a stated decision, since this changes
  what reaches the cache.
- **Risk:** Medium — it changes what gets cached, so a row Okta sends that the
  schema rejects would stop appearing. That is the intended effect but it is a
  behavior change, not a pure hardening.
- **Status:** done:#107
- **Related:** `D-050`, `D-055`, ADR-0006

### D-066 · `groupIdsReferencedBy` carries the identical unguarded expression read `D-055` just fixed

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/fetchGroupRulesRequest.ts` (`groupIdsReferencedBy`)
- **Verified:** 2026-08-29 — spotted by the `D-055` writer while fixing the twin
  in `src/shared/ruleUtils.ts`.
- **Problem:** It runs the same `expression.match(…)` shape on a condition
  expression it does not check is a string. It is safe **today** only because its
  single caller validates upstream at the boundary `D-050` closed — so it is a
  latent copy of `D-055`'s defect rather than a live one, and it becomes live the
  moment a second caller arrives that does not validate.
- **Done when:** it reads its expression through the same string-or-`''` guard
  `ruleUtils.ts` now uses, or the two share one helper.
- **Risk:** Low — no behavior change for any well-formed rule.
- **Status:** open
- **Related:** `D-055`, `D-050`

### D-067 · No story reaches any arm of HomeTab's jump-bar app lookup

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/HomeTab.stories.tsx` (its `makeOps()`
  never overrides `getAppById`), `.storybook/mocks/useOktaApi.mock.ts` (whose
  default answers `{ kind: 'missing' }`)
- **Verified:** 2026-08-29 — raised by `ui-reviewer` against the `D-007a` diff
  and left deliberately unfixed there rather than widening a nightly diff.
- **Problem:** `D-007a` gave the jump bar's app fetcher four outcomes
  (`found | missing | session-expired | failed`), two of which throw
  user-facing copy. No story types an app id, and no story overrides
  `getAppById`, so **none** of the four branches is exercised through `HomeTab` —
  not even the pre-existing `found`/`missing` pair. The generic machinery is
  covered elsewhere (`useJumpResolver.test.tsx` pins throw → `mode: 'error'`,
  `JumpBar.stories.tsx`'s `Failed` story pins the error render), but the specific
  copy these arms throw is asserted nowhere.
- **Done when:** stories mirroring `IdResolvesWithoutARequest` /
  `UserIdCostsOneRequest` override `getAppById` to return `{ kind:
'session-expired' }` and `{ kind: 'failed', status: 500 }` and assert the exact
  message each renders; axe-clean per ADR-0014.
- **Risk:** Low — stories only, no `src/` behavior.
- **Status:** open
- **Related:** `D-007a`, ADR-0010, ADR-0014

### D-068 · `createSchedulerPageRequest` drops the status the walk now has

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/utils/oktaPagination.ts` (`createSchedulerPageRequest`
  and the `PageRequest` shape it fills),
  `src/sidepanel/components/home/orgFigures.ts` (whose module header names this
  as the blocker for its 403-specific copy)
- **Verified:** 2026-08-29 — raised by the `D-007a` writer; `orgFigures.ts`'s own
  header documents the dependency.
- **Problem:** The snapshot walk's `PageRequest` shape discards the failure
  status. `orgFigures.ts` says in prose that this is what stops it telling an
  admin "you are not allowed to read this" apart from "this failed". Before
  `D-007a` there was no guaranteed status to thread; now there is, so the item is
  actionable where it previously was not.
- **Done when:** the failure status survives into `PageRequest`, and
  `orgFigures.ts` either uses it for the 403 case or its header stops citing the
  gap.
- **Risk:** Low to thread, medium to present — a permissions claim to an admin is
  a strong claim and needs the honesty rules re-checked.
- **Status:** open
- **Related:** `D-007a`, ADR-0040

### D-069 · Two dead remnants around the app-lookup path

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/cache/appAssignmentsSharing.test.tsx` (a
  `getAppById` mock nothing under test calls), `src/shared/scheduler/types.ts`
  (`RequestSuccess.fromCache`)
- **Verified:** 2026-08-29 — both enumerated by the `D-007a` writer while
  tracing `getAppById`'s callers and rebuilding `RequestResult`.
- **Problem:** Two small untruths. The test file mocks `getAppById`, but the
  enumeration showed no subject under test in that file reaches it — so the mock
  documents a dependency that is not there, and had to be updated by `D-007a` for
  no behavioral reason. Separately, `RequestSuccess.fromCache` has **zero
  producers** repo-wide (`grep` returns only the declaration); it was carried
  through the union rewrite unchanged rather than removed, because removing it is
  a separate decision.
- **Done when:** the dead mock is removed and `fromCache` is either removed or
  given the producer it implies, each verified with the `okta-claim-check` skill
  rather than a grep for the name.
- **Risk:** Low. `knip` is advisory here and will not catch either.
- **Status:** open
- **Related:** `D-007a`

### D-070 · `handleGetPolicyInfo`'s "mirrors handleGetAppInfo" is no longer true

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/content/index.ts` (`handleGetPolicyInfo`'s doc comment, and the
  unconditional fetch it describes)
- **Verified:** 2026-08-29 — noticed by the `D-059` writer immediately after
  making the app handler conditional.
- **Problem:** The policy handler's doc comment says it mirrors
  `handleGetAppInfo`. After `D-059` it does not: the app handler fetches only
  when the DOM comes up empty, the policy handler still fetches every time. The
  cross-reference now points at a shape that changed out from under it.
- **Second half, worth deciding rather than assuming:** the policy handler fetches
  for `policyStatus`, which the DOM genuinely cannot supply — so unlike `D-059`
  the request may well be earned. But nobody has enumerated `policyStatus`'s
  consumers, which is exactly the check that turned `D-059` from a guess into a
  decision.
- **Done when:** the doc comment describes what the handler actually does, and
  `policyStatus`'s consumers are enumerated so the unconditional fetch is either
  justified in the comment or filed as its own perf item.
- **Risk:** Low — a comment, plus an enumeration that may produce a follow-up.
- **Status:** open
- **Related:** `D-059`

### D-071 · Two stale claims in `CONVENTIONS.md`'s messaging sections

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `CONVENTIONS.md` (the "Messaging conventions" bullet on direct
  `sendMessage` reads, and the "SPA route-change handling" section's file
  locations), `src/content/groupHandlers.ts`, `src/content/userHandlers.ts`
- **Verified:** 2026-08-29 — both found by `docs-maintainer` while rewriting the
  Session-expiry section, and both left alone as outside that task's scope.
- **Problem:** Two claims a nightly run is told to trust are not accurate.
  1. "Messaging conventions" says a direct `sendMessage` page-context read
     "carries no Okta API traffic and doesn't touch the scheduler." The second
     half is true; the first is not. `handleGetGroupInfo`, `handleGetAppInfo` and
     `handleGetPolicyInfo` all fall back to `handleMakeApiRequest` when the DOM
     comes up empty — a real Okta call that bypasses the scheduler. That is a
     deliberate, documented design, but the sentence as written denies it exists,
     which matters because the surrounding rule is the one forbidding
     scheduler-bypassing traffic. `D-059` made this fallback _less_ frequent, not
     absent.
  2. "SPA route-change handling" locates `handleGetGroupInfo` /
     `handleGetUserInfo` in `src/content/index.ts`. They moved to
     `groupHandlers.ts` / `userHandlers.ts` in PR #45; `index.ts` only routes to
     them now. The cited path still resolves, so `lint:cited-paths` cannot catch
     this — it is a prose claim, not a broken link.
- **Done when:** Both claims describe what the code does. The first should say
  plainly that these reads may fall back to an unscheduled Okta call and why that
  is acceptable, rather than implying they never call Okta.
- **Risk:** None — documentation only. The risk is in leaving it: `CONVENTIONS.md`
  is what an unattended run is told to match, so a wrong claim there propagates
  into code.
- **Status:** open
- **Related:** `D-059`

### D-072 · A backlog item that reserves an ADR number always loses it

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `DEBT.md`, `IMPROVEMENTS.md`, `docs/adr/README.md` (the "Adding an
  ADR" section)
- **Verified:** 2026-08-29 — enumerated, not sampled. **All five**
  `research:awaiting-review` items named an ADR filename in their **Files**
  list, and **all five numbers had been taken** by an unrelated ADR before the
  item was picked up: `D-007b` reserved 0041 (taken by the API explorer),
  `I-008` reserved 0042 (audit log), `I-012` reserved 0043 (the reel's stage),
  `I-018` reserved 0046 (the response layer), `D-062` reserved 0047 (elevation).
  Five for five.
- **Problem:** The convention is that a research item names the ADR it will
  produce, filename and all. But an ADR number is claimed by whoever _writes_
  one, and feature branches write them continuously — `0041`–`0053` all landed
  in the five days after these items were filed. A backlog item can sit for
  weeks. So the reservation is a claim on a shared sequence made by the party
  least able to act on it, and it is not merely unreliable: **it failed every
  single time it was tried.**

  The failure is quiet in the way that matters. `lint:cited-paths` only checks
  that cited paths _resolve_, so a reserved-but-not-yet-written filename is
  invisible to it while the item waits, and once the number is taken the item
  now points at a real file about a completely different subject. `I-018`'s
  reserved `0046` resolves today — to the response-layer ADR. A reader
  following that citation lands somewhere plausible and wrong, which is worse
  than a broken link.

- **Done when:** The item template stops reserving numbers. A research item
  names its ADR by **title only** ("an ADR on how deep the snapshot goes"), and
  the number is assigned when the file is written. `docs/adr/README.md`'s
  "Adding an ADR" section says so explicitly, since that is where "number
  sequentially" is already stated and is where the next person will look. Any
  remaining reserved filename in either ledger is converted to a title.
- **Risk:** None — a convention change plus a handful of prose edits. The five
  affected items were repointed by hand on `chore/unstick-backlog`; this item
  is about stopping the sixth.
- **Status:** open
- **Related:** `D-030` (the other way a citation goes stale without failing a
  gate)

### D-073 · The `okta-api` skill documents rule deletion without `removeUsers`

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `.claude/skills/okta-api/references/groups-and-rules.md:163,297-311`
- **Verified:** 2026-08-29 — found while verifying `D-052` against Okta's docs.
- **Problem:** The skill's group-rule section lists
  `DELETE /api/v1/groups/rules/{ruleId}` at `:163` with no mention of the
  `removeUsers` query parameter, and its "Rule impact: blast radius before a
  change" section at `:297-311` explains the **deactivate** case correctly
  ("Deactivating a rule does not remove existing members") while never stating
  what **delete** does.

  That is the same blind spot `D-052` records in `shared/membership/ruleImpact`,
  sitting in the reference that exists to catch exactly this. Worse, `:311`
  carries a `[verified: shared/membership/ruleImpact]` marker — so the skill
  vouches for the module using the module, and a reader consulting the skill
  before touching rule impact is told the half of the story that is already
  right and nothing about the half that is wrong.

  The missing facts, established under `D-052`: `removeUsers` is an optional
  Boolean; omitting it **keeps** users as now-unmanaged members; `true` removes
  them from the group entirely; both delete branches are irreversible, unlike
  deactivate.

- **Done when:** `groups-and-rules.md` documents the three-way distinction
  (deactivate / delete-keep / delete-remove) with its reversibility, names
  `removeUsers` on the endpoint listing, and carries a `[docs]` marker with the
  live support-article URL. The `[verified:]` marker at `:311` is only correct
  once `D-052` has landed, so this item states the API fact independently of the
  module rather than citing it.
- **Risk:** None to the app — skill documentation only. The risk in leaving it
  is that the skill is what a future session reads _before_ implementing
  `D-052`, and it currently omits the parameter that item turns on.
- **Status:** open
- **Related:** `D-052` (the module-side defect this reference failed to catch)

### D-074 · A null figure on Home renders an em dash, on camera

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/home/FigureNumber.tsx`
- **Verified:** 2026-08-28 — line 48 renders the literal `'—'` when `value` is
  `null`, confirmed by reading the component while building the reel's Home
  chapter.
- **Problem:** `FigureNumber` prints an em dash as its placeholder for a figure
  that has not resolved. ADR-0043 bans em and en dashes on camera, and Home is
  about to become the reel's first chapter, so this glyph is one incomplete
  collection away from being in the film.

  It is latent rather than live: under a complete demo snapshot every figure
  resolves and the branch is never taken. But "never taken under the fixtures we
  happen to ship" is not the same as safe — a collection left `complete: false`
  (ADR-0040 §7 makes that a real state, not a hypothetical) puts one on screen,
  and it would be discovered in footage rather than in review.

  Not folded into the reel work that found it: the placeholder glyph for an
  unresolved figure is a design-system decision about the product, not about the
  film, and the film is the wrong reason to change it. Whatever replaces it
  wants to be the same choice everywhere a figure can be absent.

- **Done when:** `FigureNumber`'s null placeholder is a glyph the design system
  names, applied consistently wherever a figure can be absent, with the
  `aria-hidden` behaviour it already has preserved. A story covers the null
  case.
- **Risk:** Low. One component, one branch, already storied.
- **Related:** ADR-0043 (no dashes on camera), ADR-0040 §7 (a collection can
  honestly be incomplete)
- **Renumbered:** filed as `D-063` on `feat/demo-org-writes` while `main` gave that
  number to a different item. Main's numbering is the published one, so this moved
  rather than main's. Exactly the failure `D-072` describes for ADR numbers, one
  ledger over.

### D-075 · A profile write invalidated the memberships and never re-read them

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useUsersTabProfileEdit.ts`,
  `src/sidepanel/hooks/useUsersTabState.ts`
- **Verified:** 2026-08-28 — found by filming it. The reel's Users chapter saves
  a corrected `department`, switches to the Groups pane, and waits for the group
  the rule then fills. The row never arrived; the capture refused the take.
- **Problem:** `useProfileEdit` invalidates `cacheKeys.userMemberships(userId)`
  on a confirmed save, on explicit grounds recorded in its own comment: a group
  rule reads profile attributes, so a write to one can move a membership.
  Invalidating was all it did. The Groups pane stays mounted (ADR-0018) and
  holds the analysis it last loaded, so dropping the cache behind it changed
  nothing on screen and the pane went on showing the memberships from before the
  write until something else happened to reload them.

  The remedy already existed and was already wired for the two neighbouring
  paths. `useUsersTabState.refreshSelectedUserMemberships` invalidates _and_
  re-loads with `{ force: true }`, and both the add-to-group flow and the
  compare-copy flow call it. The profile-write path was the one that did not.

  Worse than a stale count: the save modal's blast-radius report had, seconds
  earlier, named the exact groups the edit would move. So the panel predicted
  the change, wrote it, and then declined to show it arriving — which reads as
  the prediction having been wrong.

  And the reload has to be handed **the user the write produced**. Membership
  analysis classifies each group by evaluating the org's rules against the
  user's attributes, so a reload given the pre-write user re-fetches the right
  groups and then decides none of them are rule-fed - the corrected attribute is
  the very thing the rule reads. That failure is louder than the one above: the
  group arrives carrying a `Direct` badge, which is a confident wrong answer
  rather than a stale one. Caught in a still from the reel, where the row the
  chapter had just narrated as a rule applying was labelled `Added directly`.

- **Done when:** a confirmed save, and an undo of one, both re-read the selected
  user's memberships, classified against the profile the write produced. Unit
  tests cover that a `failed` outcome does not refresh at all.
- **Risk:** Low. One callback threaded through a hook that already takes four.
- **Related:** ADR-0035 (the three-state write), ADR-0018 (tabs stay mounted),
  ADR-0052 (the writable demo org that made this filmable)

- **Fixed:** 2026-08-28 on `feat/demo-org-writes`, as its own commit. Filed here
  rather than folded into the reel commit that found it (CLAUDE.md), and kept in
  the ledger because the finding is the useful part: an `invalidate` with no
  reload beside it is invisible on a surface that does not remount, and this
  codebase has three of them.
- **Renumbered:** filed as `D-064` on `feat/demo-org-writes` while `main` gave that
  number to a different item. Main's numbering is the published one, so this moved
  rather than main's. Exactly the failure `D-072` describes for ADR numbers, one
  ledger over.

### D-076 · The org snapshot's delta cannot see a membership change

- **Verified:** 2026-08-29 — found while parsing `lastMembershipUpdated`
  (`0247c9f`), by reading `deltaUrl` against the field's documented semantics.
- **Problem:** `shared/snapshot/snapshotSync.ts` builds every collection's delta
  as `search=lastUpdated gt "<watermark>"` (`deltaUrl`), and advances the
  watermark from `identify()`, which reads `record.lastUpdated` and nothing else.

  For groups that is the wrong clock. Okta bumps `lastUpdated` when a group's
  **profile** is edited and `lastMembershipUpdated` when its **membership**
  changes — the two move independently. So a group that gained or lost fifty
  members, but was not renamed, has an unchanged `lastUpdated`, is excluded from
  every subsequent delta, and its stored row is never rewritten. The row carries
  `_embedded.stats.usersCount`, so **the cached member count silently rots**.

  Nothing detects it. The drift check (`checkDrift` → `driftVerdict`) compares
  the collection's _total row count_ against `x-total-count`, and membership
  churn does not change how many groups exist. ADR-0040 pairs delta with drift
  because "a delta cannot see a deletion"; this is a second hole in the same
  argument, and drift does not close it either.

  Consequence: every surface reading a group's member count off the snapshot —
  the Groups list, the size filter, `analyzeClutter`'s `empty` signal,
  `findCleanupCandidates`, `findUnmaintainedAppAccess`, the Home reports — can
  be reporting a figure that is arbitrarily old, while the panel says the
  snapshot is fresh. An empty group that has since been filled still reads as
  empty, and it is one click from the bulk machinery.

- **Done when:** the groups delta reflects membership changes. The shape that
  fits the existing code is to OR both clocks into the query
  (`lastUpdated gt "W" or lastMembershipUpdated gt "W"`) and to advance the
  watermark from whichever of the two is later, per row. Three things need
  checking before that is written:
  1. Group `search` documents only `sw`/`eq`/`co`, yet `deltaUrl` already relies
     on `gt`. `probeDeltaSupport` is what makes that safe — it demands a
     _proven_ zero count and falls back to a full walk otherwise. Any new query
     shape must be probed the same way, including the `or`, or an org that
     ignores the predicate silently skips real changes.
  2. `identify()` is shared by every collection. Only groups carry
     `lastMembershipUpdated`; reading an absent field elsewhere is harmless, but
     the per-collection asymmetry should be deliberate and documented.
  3. Whether Okta's `filter` (which documents `lastMembershipUpdated`) is the
     better instrument than `search` here — `filter` supports the field and the
     ordering operators, `search` supports neither reliably.
- **Risk:** Medium. This is the sync contract and it touches ADR-0040's
  reasoning, so it wants an ADR rather than a direct edit. The failure mode it
  fixes is silent and affects numbers admins act on, which argues for doing it
  soon; the fix itself can widen a delta into a near-full walk if the query is
  wrong, which argues for the probe being right first.
- **Status:** research:awaiting-review
- **Related:** `0247c9f` (parses the field this needs), ADR-0040 (the sync
  design this amends)

### D-077 · `STALE_AGE_DAYS` was tuned for the wrong clock

- **Verified:** 2026-08-29 — filed from `3b6ba65`, which changed the signal
  beneath this threshold without moving the threshold.
- **Problem:** `clutterAnalysis.STALE_AGE_DAYS` is 365, and the rationale
  recorded for that number was that a 3- or 6-month cutoff "would flag ordinary,
  healthy groups". That reasoning was about the _profile_ clock, where it holds
  — nobody renames a healthy group, so a year of silence there is weak evidence
  and a shorter window would be noise. The signal now reads
  `lastMembershipUpdated`, where it holds much less: a year with no joiner and
  no leaver is genuinely unusual for a live team, so 365 is probably far too
  conservative and the Dormant bucket under-reports.
- **Done when:** the threshold is re-derived against the membership clock,
  against a real org's distribution rather than by intuition, and the constant's
  docblock records the new rationale. Splitting it into two constants (one per
  clock, since the fallback path still reads the profile one) is worth
  considering and rejecting explicitly.
- **Risk:** Low, but it changes what admins are shown, so it wants a real
  distribution behind it rather than a guess.
- **Status:** open
- **Related:** `3b6ba65`, `D-076`

### D-078 · The `okta-api` skill denies a field Okta returns

- **Verified:** 2026-08-29 — read directly against Okta's OpenAPI reference for
  `listGroups`/`getGroup`.
- **Problem:** `.claude/skills/okta-api/SKILL.md:134` states "**Okta exposes no
  group-membership timestamp**" and
  `references/groups-and-rules.md:98` states "**There is no membership
  timestamp**". Both are correct about the _per-member_ question — Okta really
  does not say when a given user joined a given group, and only the System Log
  answers that within 90 days. But both read as a blanket denial, and Okta does
  return a group-level `lastMembershipUpdated` on every group, on the LIST
  response as well as the single GET.

  This is not hypothetical harm: the app went without the field for its whole
  history, and `GroupMetadataSection` had recorded the same false belief in its
  own header (corrected in `0247c9f`). The skill is what a future session reads
  _before_ touching group staleness, and it currently tells them the field does
  not exist.

- **Done when:** both passages keep the per-member point and add the
  group-level field: that it is default-returned on `/api/v1/groups`, that it is
  one of only four `filter`-able group properties (`id`, `type`, `lastUpdated`,
  `lastMembershipUpdated`), that `created` is _not_ filterable on groups, and
  that `sortBy` works only alongside `search` while group `search` carries no
  ordering operators — so a range and an ordering cannot be requested in one
  call. Marked `[docs]` with the OpenAPI URL.
- **Risk:** None to the app — skill documentation only.
- **Status:** open
- **Related:** `0247c9f`, `D-073` (the other stale claim in the same skill)

### D-079 · `expand=stats` embeds `hasAdminPrivlege`, spelled Okta's way

- **Verified:** 2026-08-29 — from Okta's OpenAPI schema for the group `stats`
  embed.
- **Problem:** The `okta-api` skill writes `hasAdminPrivileges`. Okta's field is
  `hasAdminPrivlege` — missing the `i`, and singular. Any code or guidance built
  on the skill's spelling reads `undefined` forever and fails open, silently.
  Separately, the field has a known accuracy defect for custom admin roles, so
  it should carry a "do not report from this" warning rather than merely being
  spelled correctly.
- **Done when:** the skill uses Okta's spelling, notes it is a misspelling in
  the API itself so nobody "corrects" it back, and warns against reporting from
  it. Nothing in `src/` reads it today; this is pre-emptive.
- **Risk:** None today. It is a trap laid for whoever adds admin-privilege
  reporting.
- **Status:** open
- **Related:** `D-078`

### D-080 · `D-062` names two different items, and the ledger cannot tell them apart

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `DEBT.md` (`:2630` and `:2668`, the two `### D-062` headers),
  `docs/adr/0058-one-context-engine.md:5,13`, `docs/adr/README.md:69`,
  `NIGHTLY.md:45,201,228`
- **Verified:** 2026-08-30 — enumerated, not sampled. Every `### [ID]-NNN`
  header in both ledgers was extracted and passed through `uniq -d`: `D-062` is
  the **only** duplicate across all 100+ items, and it is a genuine collision of
  two unrelated items, not one item written twice.
- **Problem:** `DEBT.md:2630` is `D-062 · Two context engines probe the same
page twice on every navigation` — category `perf`, status
  `research:awaiting-review`, scoped by ADR-0058. `DEBT.md:2668` is `D-062 ·
handleGetAppInfo reads an Okta response with no zod boundary` — category
  `security`, status `open`. They share an id and nothing else. The second was
  filed on 2026-08-29 in the `D-062`…`D-070` batch (`NIGHTLY.md:201`) against an
  id already taken on 2026-08-28.

  This breaks the one mechanism `SESSION.md` step 2 depends on. That step greps
  open PRs for bare `I-NNN`/`D-NNN` tokens and treats every match as claimed —
  so a PR closing the security item marks the research item claimed too, and a
  PR closing the research item hides an **open P2 security gap** from every
  subsequent session. It fails in the safe-looking direction: nothing errors,
  an item simply stops being offered.

  It also corrupts citations already in `docs/`. `ADR-0058:5` says "Scoped by:
  `D-062`" and `docs/adr/README.md:69` says "Scopes `D-062`" — both meaning the
  context-engine item, both now ambiguous. `lint:cited-paths` cannot see this:
  it checks that cited **paths** resolve, not that a cited **item id** is
  unique. This is the same class of quiet failure as `D-072` (a reserved ADR
  number that silently retargets), one level up: there the citation resolved to
  the wrong document, here it resolves to either of two.

- **Done when:** one of the two items is renumbered to a free id (the security
  one is the later filing and has no `docs/` citations pointing at it, so it is
  the cheaper move), every reference to the renumbered item is updated across
  `DEBT.md`, `IMPROVEMENTS.md`, `NIGHTLY.md` and `docs/`, and a check makes the
  collision impossible to reintroduce — extending `scripts/check-cited-paths.mjs`
  (or a sibling script wired into the same npm task) to fail on a duplicate
  `### [ID]-NNN` header is the cheapest place to put it, since that script
  already walks the ledgers.
- **Risk:** Low to fix — a renumber plus a mechanical citation sweep. The risk
  in leaving it is that the security item stays invisible to step 2 the next
  time either id appears in a PR.
- **Status:** open
- **Related:** `D-072` (the reserved-ADR-number failure — same quiet-citation
  class), `D-031`, `D-024`

### D-081 · `RuleImpactModal`'s error state is not announced to a screen reader

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleImpactModal.tsx:257-261` (the
  hand-rolled error `<div>`), `src/sidepanel/components/shared/AlertMessage.tsx`
  (the primitive it should use)
- **Verified:** 2026-08-30 — found by `ui-reviewer` on the `D-052` diff, then
  confirmed **pre-existing** with `git show`: the flagged lines appear nowhere in
  that commit's diff.
- **Problem:** `docs/ux-guidelines.md` requires error states to render through
  the shared `AlertMessage` (`type="danger"`), which carries `role="alert"`.
  `RuleImpactModal` hand-rolls a plain `<div>` instead, so when the impact walk
  fails the modal changes silently for anyone not watching the pixels — the
  failure of a preview whose entire purpose is to inform a destructive decision.
  It is the load-failure arm of a modal that is otherwise well covered.
- **Done when:** the error arm renders through `AlertMessage` with
  `type="danger"`, the announcement is asserted by a story or test that reaches
  the error state (`RuleImpactModal.stories.tsx` already has the other arms), and
  `status` vocabulary stays `danger`, not `error`, per ADR-0002 — note the
  component's internal `status === 'error'` union member is a different thing
  from the visual token and does not need renaming here.
- **Risk:** Low — one arm of one modal, already story-covered.
- **Status:** open
- **Related:** `D-056` (the same primitive hand-rolling its own buttons),
  `D-057` (alert states no story can reach)

### D-082 · Five test fixtures build addresses on a real domain, not `example.com`

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/membership/ruleImpact.test.ts:21`,
  `src/shared/membership/groupSource.test.ts`,
  `src/shared/membership/memberSourceIndex.test.ts`,
  `src/shared/membership/mergePlan.test.ts`,
  `src/sidepanel/components/RuleImpactModal.test.tsx`
- **Verified:** 2026-08-30 — found by `security-logging-reviewer` on the `D-052`
  diff and enumerated, not sampled: `grep -rn "@x\.io" src/` returns exactly
  five files. Confirmed pre-existing — `git show main:…ruleImpact.test.ts` has
  the identical line 21.
- **Problem:** `CLAUDE.md` says fixtures use fake placeholders (`00gFAKE…`,
  `user@example.com`). These five build logins and emails as `` `${id}@x.io` ``.
  `x.io` is a live, registered second-level domain, not one of the RFC 2606
  reserved names. No real person's data is exposed — the local parts are
  synthetic (`u1`, `u2`) — so this is a convention breach rather than a leak, and
  it is filed at P3 for that reason. It still matters: the repo's rule is
  absolute precisely so that nobody has to make this judgement call per fixture,
  and a sibling suite in the same directory (`useOktaApi/ruleImpact.test.ts:78`)
  already does it correctly with `ada@example.com`.
- **Done when:** all five use `example.com` (or a documented `.test`/`.invalid`
  placeholder), the suites stay green without retargeting any assertion — these
  are fixture inputs, not expectations — and a grep for a non-reserved domain
  across `src/` comes back empty.
- **Risk:** Low — fixture inputs only. Check each suite for an assertion that
  happens to hard-code the old string before swapping.
- **Status:** open

### D-083 · The docked strip and the header merge into one surface with two content margins

- **Verified:** 2026-08-30 — measured in the capture rig (Chrome, real
  scroll-driven timeline) on the Groups list rung at 400px and 840px, and
  visible in the same shot at both widths.
- **Problem:** At full merge the header and the action strip are one continuous
  pinned surface with a single bottom edge — that is the whole point of the
  merge — but their contents do not line up. `PageHeader`'s row is padded
  `px-(--sp-gutter)`, so the title sits at the column gutter; `ActionBar`'s row
  is padded `p-2` **inside** a band that is itself inset by that same gutter, so
  the verbs and the search field sit at gutter + 8px. Measured docked at 400px:
  title `x=16`, first verb `x=24`, search field `x=24`; at 840px, `x=20` against
  `x=28`. The 8px is constant at every density, because the row's padding is a
  raw `p-2` rather than one of ADR-0048's spacing roles.

  It is filed as debt rather than cosmetics because `ActionBar`'s own module
  header states the opposite as a design guarantee — "the row keeps the column's
  padding whether the band is inside its margins or past them, which is also
  what keeps the verbs aligned with the header's own content once the two have
  become one surface." The code has never done that. So either the doc or the
  padding is wrong, and a reader trusting the doc will not go and measure.

  Affects every docked strip, not just Groups: `UserActionBar` merges through
  the same band.

- **Done when:** docked, the strip's first verb and its `subRow` share a left
  edge with the header's title at every density, and `ActionBar`'s module note
  either describes what the code does or is deleted. The fix has to hold in both
  states — the strip is a card inset in the gutter at rest and full-bleed when
  docked, and the row must not shift horizontally between them, since holding
  the buttons still through the merge is the reason the animated chrome lives on
  a `::before` in the first place. Check against
  `ActionBar.stories.tsx`'s docking stories and `useActionOverflow.test.ts` —
  the fit arithmetic reads the row's padding at runtime (`readPx` on
  `padding-inline-start`/`-end`), so changing it changes the overflow budget and
  must not be hard-coded anywhere.
- **Risk:** Low. Chrome-only change to one row's padding, but it moves the
  overflow budget, so the split can change at narrow widths and wants a look at
  360px before and after.
- **Status:** open
- **Related:** ADR-0032 (the sticky stack and the merge), ADR-0048 (the spacing
  roles the raw `p-2` predates), `useActionOverflow` (reads the row's padding)

### D-084 · The granting-group fallback's walked app-group rows still die with the panel

- **Category:** perf
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useUserApps.ts` (`resolveGrantingGroups`),
  `src/sidepanel/cache/appGroupSnapshot.ts` (the read half, which exists),
  `src/shared/snapshot/snapshotSync.ts` (`APP_GROUPS_SPEC`, `runShardedWalk`'s
  sweep), `src/shared/snapshot/orgSnapshotStore.ts` (`upsertMany`, `sweepStale`)
- **Verified:** 2026-08-31 — filed by the ADR-0059 work while wiring the read
  half; the sweep interaction was read directly in `runShardedWalk`, not assumed.
- **Problem:** ADR-0059 made the fallback read app→group assignments out of the
  org snapshot before walking anything, which covers `GROUP_PUSH` apps. Every
  **other** app still walks `/api/v1/apps/{id}/groups`, and that result lands
  only in the panel-owned in-memory `entityCache` at `TTL_LONG`. Close the side
  panel and it is gone; the next visit to the same user's Apps pane re-spends one
  request per unresolved app against the `/api/v1/apps` bucket — the same bucket
  the report that prompted ADR-0059 was exhausting.
- **Why it is not just "write them to the snapshot":** `runShardedWalk` stamps
  every row it writes with the walk's mark and then **sweeps** anything not
  re-marked. A row written opportunistically by the panel, for an app the
  fan-out's shard list does not contain, is by construction never re-marked — so
  the next `appGroups` walk would delete it. Widening the shard list to every app
  instead is the opposite trade: it turns a fan-out over push-enabled apps into
  one over the whole inventory, which is a much larger bill than the one being
  saved.
- **Done when:** a walked app-group result survives the panel closing, and a
  subsequent sharded walk provably does not delete it. Whatever the mechanism —
  a separate collection with its own retention, an exemption in the sweep keyed
  on how a row was written, or a TTL'd side store — the sweep interaction is the
  thing that has to be shown, not argued. A test that writes a row by the panel
  path, runs a full `runShardedWalk` that does not include that app, and asserts
  the row is still there.
- **Risk:** Medium. It touches the sweep, which is the mechanism that keeps the
  snapshot from accumulating rows for deleted entities — an exemption written
  loosely would make deletions invisible in a collection whose whole job is to
  reflect the org.
- **Status:** open
- **Related:** ADR-0040 (the snapshot and its sweep), ADR-0059 (the read half
  that exists), ADR-0020 (why absence is not an empty answer)

### D-085 · `oktaGroupRuleSchema` rejects the `INVALID` status Okta reports

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/shared/schemas/okta.ts:136` (`status: z.enum(['ACTIVE', 'INACTIVE'])`),
  `src/shared/types.ts:132` (`OktaGroupRule.status`), `:181`
  (`FormattedRule.status`), `src/sidepanel/hooks/useOktaApi/groupDiscovery.ts`,
  `src/sidepanel/hooks/fetchGroupRulesRequest.ts`,
  `src/shared/snapshot/snapshotSync.ts` (`RULES_SPEC`),
  `.claude/skills/okta-api/references/groups-and-rules.md:153`
- **Verified:** 2026-08-31 — raised by the `D-065` writer and confirmed against
  the schema and both type declarations. Every one of them enumerates exactly
  two states.
- **Problem:** Okta's `GroupRuleStatus` has a third value, `INVALID` — the
  status a rule takes when it stops being evaluable, e.g. its expression
  references a group that has been deleted. The schema admits only
  `ACTIVE | INACTIVE`, and `OktaGroupRule`/`FormattedRule` type it the same way.
  Before `D-065` this cost nothing on the org-wide walk, because that walk had
  no schema and an `INVALID` row flowed through mistyped-but-present. **`D-065`
  turned that into a silent drop**: the row now fails validation and is
  discarded with only a count in a debug warning, so a broken rule disappears
  from the cache entirely on all three schema-bearing paths.
  This directly undercuts `D-061`, which exists to surface rules pointing at
  groups that no longer exist — `INVALID` is Okta's own signal for exactly that
  condition, and we now throw it away. The repo's own skill reference
  (`groups-and-rules.md:153`, "status is `ACTIVE` or `INACTIVE`") states the
  same wrong thing and should be corrected with it; compare `D-078`, an already
  open item of the same shape against the same skill.
- **Done when:** `INVALID` is a first-class status end to end — accepted by
  `oktaGroupRuleSchema`, present in `OktaGroupRule.status` and
  `FormattedRule.status`, and handled (not defaulted) at every branch on those
  unions, so an `INVALID` rule reaches the cache and is visibly distinguishable
  from an `INACTIVE` one rather than silently vanishing. The skill reference is
  corrected in the same change. Verify against Okta's published
  `GroupRuleStatus` enum before implementing — the widening is only safe if the
  set really is `ACTIVE | INACTIVE | INVALID`.
- **Risk:** Medium. Widening the schema alone is one line and strictly
  additive, but widening the two shipped unions makes the compiler demand a
  decision at every status branch, which is the actual work — and the point.
  **Not folded into `D-065`** deliberately: a one-line schema widen would have
  left `INVALID` flowing as a lie in the type system, and the honest fix is
  architecturally significant enough that a reviewer could reasonably disagree
  with it after the code exists (`CLAUDE.md`'s plan-and-approval gate).
- **Status:** open
- **Related:** `D-065` (introduced the drop), `D-061`, `D-050`, `D-078`

### D-086 · `RateLimitDetector.parseHeaders` has no `NaN` guard, so it fails open

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/scheduler/rateLimitDetector.ts` (`parseHeaders`),
  `src/shared/scheduler/rateLimitDetector.test.ts:76` (the case that already
  pins the `NaN` outcome)
- **Verified:** 2026-08-31 — raised by the `D-064` writer while proving the
  detector observes headers on a 429; read directly.
- **Problem:** `parseHeaders` uses bare `parseInt` on the `X-Rate-Limit-*`
  values with no `Number.isNaN` check. A malformed or absent-but-present header
  yields `NaN`, and every downstream comparison then fails **open**:
  `NaN <= threshold` is `false`, so `isApproachingLimit` reports calm and no
  cooldown is taken. There is already a test pinning the `NaN` outcome, so this
  is a known shape rather than a surprise — but it is pinned, not fixed.
  `D-064` makes it newly reachable: rate-limit headers now arrive on failure
  responses too, so `parseHeaders` sees strictly more input than before.
- **Done when:** a value that does not parse to a finite number is treated as
  "unknown", not as zero-or-calm; the pinning test is retargeted to assert the
  safe outcome with an ADR-0022 note.
- **Risk:** Low. Behavior change is in the safe direction (unknown capacity
  stops reading as spare capacity).
- **Status:** open
- **Related:** `D-064`, `D-007c`

### D-087 · The content script forwards the whole response header bag

- **Category:** security
- **Priority:** P3
- **Size:** S
- **Files:** `src/content/apiRequest.ts:152-156` (the `headers` collection),
  `src/background/snapshotBridge.ts:114-115` (a consumer that re-forwards it)
- **Verified:** 2026-08-31 — raised by `security-logging-reviewer` on tonight's
  diff; pre-existing on the success path, not introduced by `D-064`.
- **Problem:** `handleMakeApiRequest` collects **every** response header and
  messages the whole bag to the background, though the only consumers are
  `RateLimitDetector` (`x-rate-limit-*`) and the paginator (`link`). The Fetch
  API does not expose `set-cookie`, so nothing secret rides along today, and no
  header value is logged anywhere — this is defense in depth, not a live leak.
  But it leaves a bag of unfiltered response metadata one careless `log.debug`
  away from disclosure. `D-064` made failures symmetric with successes here, so
  the bag now crosses on more responses than before, which is what prompted the
  review note.
- **Done when:** the collection is narrowed to the keys the scheduler actually
  reads, or a comment records why the full bag is deliberate. Decide also
  whether `snapshotBridge` should relay failure headers at all — nothing
  consumes them there, and after `D-064` it now forwards them.
- **Risk:** Low.
- **Status:** open
- **Related:** `D-064`

### D-088 · Two stale comments name `groupDiscovery` as the schema-less rules walk

- **Category:** standards
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/ruleUtils.ts:23-25`,
  `src/shared/ruleUtils.test.ts:769-772`
- **Verified:** 2026-08-31 — found by the `D-065` writer; both read directly.
- **Problem:** Both comments assert as fact that "`groupDiscovery`'s
  `fetchAndCacheAllGroupRules` walks `/api/v1/groups/rules` with no schema, so a
  raw row reaches them exactly as Okta sent it (`D-055`)". `D-065` made that
  false tonight. `D-055`'s guard in `formatRuleForDisplay` is still correct and
  must stay — the function is exported and other callers exist — but its stated
  reason now names a caller that no longer qualifies, which is precisely the
  kind of citation that gets a future reader to delete a live guard.
- **Done when:** both comments name a caller that is actually unvalidated, or
  state the guard's reason without leaning on one.
- **Risk:** Low — comments only, but the guard they justify is load-bearing.
- **Status:** open
- **Related:** `D-065`, `D-055`

### D-089 · `useRuleConsolidation` never clears `RulesCache` after writing rules

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useRuleConsolidation.ts`,
  `src/shared/rulesCache.ts`
- **Verified:** 2026-08-31 — found by the `I-013` writer while wiring its own
  invalidation; nothing in `src/` clears that cache except its own tests and,
  as of tonight, `useCreateFeedingRule`.
- **Problem:** `RulesCache` holds the org-wide rule inventory on a 5-minute
  TTL. `useRuleConsolidation` creates and deletes rules and never invalidates
  it, so for up to five minutes afterwards every surface reading the org-wide
  snapshot serves an inventory that does not match Okta — including the
  consolidation UI that just performed the write.
- **Done when:** a successful consolidation clears `RulesCache` the way
  `useCreateFeedingRule` now does; a test pins that a write invalidates.
  Consider whether the invalidation belongs in `ruleWrites` rather than in each
  caller, so the next write path cannot forget.
- **Risk:** Low.
- **Status:** open
- **Related:** `I-013`

### D-090 · `MAX_RULE_NAME` is declared twice

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/rules/consolidation.ts` (module-private
  `MAX_RULE_NAME`), `src/sidepanel/hooks/useCreateFeedingRule.ts`
  (`MAX_RULE_NAME_LENGTH`)
- **Verified:** 2026-08-31 — the second copy was added by `I-013`, which needed
  the same 50-character Okta limit and could not import a module-private const.
- **Problem:** Okta's 50-character rule-name limit is now encoded in two
  places under two names. If Okta changes it, one will be missed.
- **Done when:** one exported constant; both call sites import it.
- **Risk:** Low.
- **Status:** open
- **Related:** `I-013`

### D-091 · `GroupDetailView.tsx` is 514 lines, well over the ~300-line bar

- **Category:** cleanup
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/groups/detail/GroupDetailView.tsx`
- **Verified:** 2026-08-31 — measured by `ui-reviewer` on tonight's diff.
- **Problem:** The container is 514 lines against `CLAUDE.md`'s ~300-line
  guideline. This is pre-existing — `I-013` added roughly fifteen lines of prop
  wiring and put all of its state in `useCreateFeedingRule`, so the diff did not
  cause it — but the file is now the largest thing on the rung and every new
  verb makes it worse.
- **Done when:** the view is under the bar, with logic pushed into hooks and
  panes rather than split arbitrarily by line count.
- **Risk:** Low-medium — it is the detail rung's container; land it tests-first.
- **Status:** open
