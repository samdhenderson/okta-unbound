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

**A `done:*`/`closed:*` item eventually moves to the `## Archive` section at
the bottom of this file, collapsed to one line.** The verbose
Problem/Done-when/Risk prose is not repeated there — it stays recoverable
from git history at the linked commit, which is the point of moving it out.
An id that reaches the archive is retired permanently: never reuse it for a
new item (`scripts/check-cited-paths.mjs` enforces this across both
ledgers, archive included). See `SESSION.md` step 7 for exactly when an item
makes that move.

---

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

### D-007b · One expired session, not thirty failed requests

- **Category:** correctness
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0054-a-401-is-a-session-not-a-request.md` (to be created),
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
- **Status:** done:#118
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
- **Status:** done:#118
- **Depends on:** `D-007a`

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118
- **Related:** `D-030`, `D-018`, `D-024`

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118

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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
- **Related:** `D-038`, ADR-0040 §7

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
- **Status:** done:#118
- **Related:** `D-029b`

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
- **Status:** done:#118
- **Related:** `D-029b`, `D-038`

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
- **Status:** done:#118

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
- **Status:** done:#118
- **Related:** `D-013c` (how it was found)

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
- **Status:** closed:refuted-2026-09-02
- **Related:** ADR-0040, `I-012`

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
- **Status:** done:#118
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0058-one-context-engine.md`. The number this item reserved on 2026-08-28 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0058** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.
- **Related:** `D-059` (the other traffic cost the re-gate exposed), ADR-0018,
  ADR-0026

### D-097 · `handleGetAppInfo` reads an Okta response with no zod boundary

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
- **Status:** done:#118
- **Renumbered 2026-09-02 (`D-080`):** filed as `D-062` against an id
  already taken on 2026-08-28 by the context-engine item. This security item was
  the later filing and carried no `docs/` citations, so it moved. Any reference
  to "`D-062`" dated 2026-08-29 or later that concerns the content-script zod
  boundary means this item.
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
- **Status:** done:#118
- **Related:** `D-059`

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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118
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
- **Status:** done:#118

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
- **Status:** done:#118
- **Related:** `D-065` (introduced the drop), `D-061`, `D-050`, `D-078`

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
- **Status:** done:#118
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
- **Status:** done:#118
- **Related:** `D-065`, `D-055`

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
- **Status:** done:#118
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

### D-092 · Nine backlog items carry no `Status:` line, so no session can select them

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `IMPROVEMENTS.md` (`I-022`–`I-028`), `DEBT.md` (`D-074`, `D-075`),
  `scripts/check-cited-paths.mjs` (or a sibling wired into the same npm task —
  the cheapest place to put the guard, same argument `D-080` makes)
- **Verified:** 2026-09-01 — enumerated, not sampled. Every `### [ID]-NNN`
  section in both ledgers was extracted and tested for a `**Status:**` line.
  Thirteen sections lack one. Four are deliberate umbrellas whose sub-items
  carry the status instead (`D-007`, `D-013`, `D-029`, `D-053` — each has
  `a`/`b`/`c`… children). The remaining **nine have no sub-items and no
  status**: `I-022`, `I-023`, `I-024`, `I-025`, `I-026`, `I-027`, `I-028`,
  `D-074`, `D-075`.
- **Problem:** `SESSION.md` step 3 selects by filtering to `Status: open`. An
  item with no `Status:` line at all does not match that filter, and does not
  match `blocked:`/`research:`/`claimed:`/`closed:`/`done:` either — so it is
  never offered to a session and never appears in a backlog count as anything.
  It is not deferred, it is invisible.

  These nine are otherwise complete, well-formed items with **Category**,
  **Priority**, **Size**, **Files**, **Verified** and **Problem** — they read
  as ready to pick up. Three are P2: `I-025` (the capture fingerprint does not
  cover the app it films), `I-028` (dormant access via
  `lastMembershipUpdated`), and `D-075` (a profile write invalidated the
  memberships and never re-read them, found by filming it). `D-075` is a P2
  **correctness** bug with a reproduction.

  This is `D-080`'s failure mode one step earlier. There the ledger said
  something ambiguous; here it says nothing, and the omission is silent in the
  same safe-looking direction — nothing errors, an item simply stops being
  offered. `lint:cited-paths` cannot see it: it checks that cited **paths**
  resolve, not that an item is well-formed.

- **Done when:** each of the nine carries an explicit `Status:` line reflecting
  its real state (Sam decides `open` vs `blocked:`/`research:` per item — a
  session must not invent one, and must not silently mark them `open` and then
  claim them in the same night), and a check fails on any `### [ID]-NNN`
  section that has neither a `**Status:**` line nor at least one sub-item.
  Fold that check in with `D-080`'s duplicate-header guard if `D-080` lands
  first — same script, same npm task, one pass over the ledgers.
- **Risk:** Low. Ledger and script only; no `src/` change.
- **Status:** done:#118
- **Related:** `D-080` (the duplicate-id sibling), `D-072`

### D-093 · Eleven items are stranded at `claimed:` by branches that no longer exist

- **Category:** standards
- **Priority:** P2
- **Size:** S
- **Files:** `DEBT.md` (the ten `claimed:beta/trust-and-polish` items),
  `IMPROVEMENTS.md` (`I-030`, `claimed:worktree-rules-actionbar`),
  `scripts/check-cited-paths.mjs` (the natural home for the guard, alongside
  `D-080`/`D-092`'s checks)
- **Verified:** 2026-09-02 — enumerated, not sampled. Every `claimed:` status
  in both ledgers was listed and cross-checked against `git branch -a` and
  against the squash-merged commit bodies on `main`.
- **Problem:** `SESSION.md` step 7 turns a shipped item into `done:<PR#>`.
  When that final ledger commit does not happen, the item stays `claimed:` on
  `main` forever — and step 3's filter excludes `claimed:*`, so **no future
  session can ever select it again**. Eleven items are in that state today,
  claimed by two branches that no longer exist locally or on the remote:

  - `claimed:beta/trust-and-polish` (10): `D-041`, `D-048`, `D-053a`,
    `D-053b`, `D-053c`, `D-053d`, `D-053e`, `D-053f`, `D-054`, `D-061`.
  - `claimed:worktree-rules-actionbar` (1): `I-030`.

  The two groups fail differently, which is why this needs a human read rather
  than a bulk rewrite. Five of the ten (`D-041`, `D-048`, `D-053a`, `D-054`,
  `D-061`) are named in the body of the squash-merged `a376dff` (#112), and
  `I-030` is named in `1d54e77` (#113) — those six **shipped** and are simply
  missing their `done:` line. The other five (`D-053b` … `D-053f`) are named
  in no merged commit body on `main`: they were claimed by a branch that is
  gone and either never shipped or shipped unnamed. Nothing in the ledger
  distinguishes the two cases, and a session cannot tell them apart from the
  status alone.

  This is the same silent-exclusion failure as `D-092`, from the opposite
  direction: there an item had no status and fell out of every filter; here it
  has a status that is a lie about work that finished, and falls out of the
  one filter that matters. `D-080`, `D-092` and this item are three instances
  of one gap — nothing validates the ledgers as data.

- **Done when:** each of the eleven carries a status reflecting its real state
  — the six confirmed-shipped become `done:#112`/`done:#113`, and the five
  unaccounted-for (`D-053b` … `D-053f`) are re-verified against current code
  and moved to `open` or `closed:overtaken-by-<sha>` on the evidence, one at a
  time. Sam decides any case the evidence does not settle; a session must not
  guess. Plus a check that fails on any `claimed:<branch>` whose branch exists
  neither locally nor on the remote, folded in with `D-080`'s duplicate-header
  guard and `D-092`'s missing-status guard — same script, same npm task, one
  pass over the ledgers.
- **Risk:** Low. Ledger and script only; no `src/` change. The per-item
  re-verification of `D-053b` … `D-053f` is the real cost, and it is what
  `SESSION.md`'s 14-day staleness rule exists for.
- **Status:** done:#118
- **Related:** `D-092` (missing status), `D-080` (duplicate ids), `D-072`

### D-094 · A rate-limit budget of `0` still fails open, for a different reason than `D-086`

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/shared/scheduler/rateLimitDetector.ts` (`isApproachingLimit`),
  `src/shared/scheduler/apiScheduler.ts` (`shouldEnterCooldown`)
- **Verified:** 2026-09-02 — raised by the `D-086` writer while proving its own
  guard, and read directly at both call sites. Deliberately not folded into
  `D-086`: different root cause, and one of the two files is outside that
  item's scope.
- **Problem:** `D-086` closes the case where a header does not parse to a
  finite number. It does not close the case where it parses to a perfectly
  finite `0`. `X-Rate-Limit-Limit: 0` clears the new guard and is stored, and
  the percentage is then computed as `(remaining / limit) * 100` — so
  `(n / 0) * 100` is `Infinity`, and `(0 / 0) * 100` is `NaN`. Both
  `Infinity <= threshold` and `NaN <= threshold` are `false`, so the detector
  reports calm and no cooldown is taken.

  This is the identical fail-open shape `D-086` exists to remove, arrived at
  from the other direction: there the non-finite value came from the parse,
  here it is derived from a division the parse cannot catch. The guard
  therefore has to sit at the division, not only at the parse, and it has to
  sit in **both** readers — `RateLimitDetector.isApproachingLimit` and
  `ApiScheduler.shouldEnterCooldown` each compute the ratio independently.

- **Done when:** a `limit` that is not a positive number is treated as
  "unknown" at both ratio sites — the same outcome `D-086` gives an unreadable
  header, so an unknown budget falls back to the most-restrictive observation
  anywhere rather than reading as spare capacity. A test pins each site.
  Check whether the two ratio computations should collapse into one shared
  helper rather than being guarded twice; if so, say so in the PR.
- **Risk:** Low. Behavior change is in the safe direction, and matches the
  precedent `D-086` just set.
- **Status:** done:#118
- **Related:** `D-086` (the sibling it was split from), `D-064`, `D-007c`

### D-095 · `useRuleLifecycle` never clears `RulesCache` either

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useRuleLifecycle.ts`,
  `src/shared/rulesCache.ts`
- **Verified:** 2026-09-02 — found by the `D-089` writer while wiring that
  item's own invalidation, and read directly. It is the third rule-write path
  and the only one still missing the clear.
- **Problem:** `D-089` gave `useRuleConsolidation` the `RulesCache.clear()`
  that `useCreateFeedingRule` already had. `useRuleLifecycle` — activate and
  deactivate — is the remaining write path and still has none. Activating or
  deactivating a rule changes both the cached `status` on that row and the
  cached `stats.active` / `stats.inactive` counts, so for up to the cache's
  5-minute TTL every surface reading the org-wide inventory reports a rule in
  the state it was in before the admin changed it, and the totals to match.

  Same class as `D-089`, different write path, and deliberately not folded
  into it — one concern per commit. That three separate hooks now each have to
  remember the same call is the argument `D-096` makes.

- **Done when:** a successful activate or deactivate clears `RulesCache` the
  way `useCreateFeedingRule` and `useRuleConsolidation` now do; a test pins
  that each of the two verbs invalidates, and that a failed write does not.
- **Risk:** Low. Matches a shape that already ships in two hooks.
- **Status:** done:#118
- **Related:** `D-089`, `D-096`, `I-013`

### D-096 · Rule-write cache invalidation is remembered per caller, not enforced once

- **Category:** architecture
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleWrites.ts`,
  `src/sidepanel/hooks/useCreateFeedingRule.ts`,
  `src/sidepanel/hooks/useRuleConsolidation.ts`,
  `src/sidepanel/hooks/useRuleLifecycle.ts`, `src/shared/rulesCache.ts`
- **Verified:** 2026-09-02 — this is `D-089`'s own "consider" clause, deferred
  by its writer with reasons; every caller of `createRuleWriteOperations` was
  enumerated while deciding.
- **Problem:** Three hooks write rules through `createRuleWriteOperations`,
  and each is separately responsible for calling `RulesCache.clear()`
  afterwards. Two do it today (`useCreateFeedingRule`, and
  `useRuleConsolidation` as of `D-089`); the third does not (`D-095`). The
  invariant "a rule write invalidates the org-wide inventory" is real, but
  nothing enforces it — it is re-derived by each caller, and `D-089` and
  `D-095` are both instances of a caller forgetting.

  The obvious shape is a single invalidation wired into
  `createRuleWriteOperations`, with the two existing per-caller `clear()`
  calls removed in the same change. That is **not** a nightly writer's call
  and is filed research-only for exactly the reasons `D-089`'s writer gave:
  `ruleWrites.ts` is a pure transport factory over `coreApi.makeApiRequest`
  and its own module doc says so, so giving it a `chrome.storage`-backed
  global side effect changes what that layer is; and it changes
  `useRuleLifecycle`'s behavior as a side effect of a refactor rather than as
  a decision. That is `CLAUDE.md`'s plan-and-approval gate — a reviewer could
  reasonably disagree with the layering after the code exists.

  Noted while scoping, not part of this item: there is also a narrow
  repopulation race — between a create and its follow-up deletes, a
  concurrent `loadRules(false)` can refill the entry with a pre-delete
  inventory that then lives its full TTL. Closing that is cache-generation
  work, not another `clear()`, and should be decided with the layering rather
  than bolted onto it.

- **Done when:** a Proposed-status ADR under `docs/adr/` argues where
  rule-write invalidation belongs — in the transport factory, in a thin
  wrapper above it, or left per-caller with a lint or test that fails when a
  write path forgets — and says what happens to the repopulation race under
  each. **This item ships no code**: its PR touches `docs/` only, zero files
  under `src/`. Sam moves it to `open` by accepting the ADR.
- **Risk:** Research only.
- **Status:** done:#118
- **Related:** `D-089`, `D-095`, `I-013`

### D-098 · Two doc comments cite `getAppPushGroupMappings`, deleted by `f1e8def`

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/appOperations.ts:229`,
  `src/sidepanel/hooks/useOktaApi/policyOperations.ts:17`
- **Verified:** 2026-09-02 — enumerated while closing `D-026`. `grep -rn
'getAppPushGroupMappings' src/` returns exactly these two lines and no
  declaration; the module was deleted by `f1e8def`.
- **Problem:** Both comments name `getAppPushGroupMappings` as the precedent a
  reader should follow — one for an encoding convention, one for an endpoint
  shape. The function does not exist, so a reader who goes looking finds
  nothing and cannot tell whether the convention was abandoned or merely moved.
  Same class as `D-088` and `D-070`: a comment that outlived the code it points
  at, and that `lint:cited-paths` cannot catch because it checks cited _paths_,
  not cited _symbols_.
- **Done when:** each comment either names a live precedent or states the
  convention directly without citing a deleted symbol.
- **Risk:** None — comments only.
- **Status:** open
- **Related:** `D-026` (the closure that surfaced this), `D-088`, `D-070`

### D-099 · `handleGetPolicyInfo` fetches on every policy page for a field nothing reads

- **Category:** perf
- **Priority:** P3
- **Size:** S
- **Files:** `src/content/index.ts` (`handleGetPolicyInfo`)
- **Verified:** 2026-09-02 — enumerated by the `D-070` writer, not sampled.
  `PolicyInfo.policyStatus` has **zero** readers in `src/`: `App.tsx:205` reads
  `policyInfo?.policyName` and nothing else touches the field.
  (`policyStatus.ts`'s helpers are unrelated — they take `policy.status` off a
  different type.)
- **Problem:** `handleGetPolicyInfo` fetches unconditionally on every policy
  page. `D-059` made the sibling `handleGetAppInfo` fetch only when the page
  heading is missing, on the grounds that a request whose answer the DOM already
  holds is a request spent for nothing. The policy handler never got the same
  treatment, and the enumeration above makes its case stronger, not weaker: the
  one field the fetch exists to populate beyond the DOM's answer is read by
  nobody. `D-070` corrected the doc comment that claimed the two handlers
  mirrored each other; this item is the behaviour half it deliberately declined
  to bundle in.
- **Done when:** either the fetch becomes conditional the way `D-059` made
  `handleGetAppInfo`'s conditional, or `policyStatus` is removed and the fetch
  with it — whichever the evidence supports at the time. A test pins that a
  policy page whose heading answers the question issues no request.
- **Risk:** Low — one handler, already covered by `content/index.test.ts`.
- **Status:** open
- **Related:** `D-059` (the precedent), `D-070` (the comment half)

### D-100 · A transport failure mid-merge discards the undo for copies that already landed

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/hooks/useGroupMerge.ts` (`execute`, the fatal-rethrow
  path), `src/sidepanel/hooks/useGroupMerge.test.ts` (where the current
  behaviour is now pinned as `CHARACTERIZED:`)
- **Verified:** 2026-09-02 — found by the `D-034` writer while building that
  item's characterization suite, and pinned rather than changed: a transport
  throw re-raises before `logAction` runs, so no undo entry is written for the
  memberships that had already been copied.
- **Problem:** Group merge is destructive and its undo is the only way back. If
  the copy leg throws for a transport reason — the session drops, the tab
  closes, the network fails — after N users have already been copied into the
  survivor, those N copies are real in Okta and the panel records nothing about
  them. The admin is left with a partially-merged pair of groups and no undo
  entry naming what moved.
  This is parity with the pre-`D-034` hand-rolled loop, which is exactly why
  `D-034` preserved it: that item's contract was to move the writes onto
  `runOperation` while keeping the progress and undo bookkeeping identical, so
  changing this at the same time would have made the refactor unreviewable.
  Now that the behaviour is pinned by a named test, it can be changed on its own
  evidence.
- **Done when:** an undo entry is written for whatever actually landed before a
  fatal throw, the same way the partial-failure path already does it, and the
  `CHARACTERIZED:` pin is retargeted to assert the new contract with a note
  saying what replaced it. The `all-copies-failed still empties the source` pin
  should be re-examined in the same pass — it is the other half of this shape.
- **Risk:** Medium — it changes what a destructive operation records on its
  worst path, so the test must drive it.
- **Status:** open
- **Related:** `D-034` (the refactor that pinned this), `D-013b`

### D-101 · `rule-inactive` cannot tell a paused rule from a broken one

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/BlastRadiusGroupRow.tsx`
  (`withheldReasonText`), `src/shared/membership/blastRadius.ts`
  (`additionEffect`/`removalEffect`, where the reason is set),
  `src/shared/membership/blastRadiusTypes.ts` (`WithheldReason`)
- **Verified:** 2026-09-02 — found while closing `D-085`'s last branch site.
  The reason is set whenever `active.length === 0`, and `active` is
  `rule.status === 'ACTIVE'`, which collapses `INACTIVE` and `INVALID`.
- **Problem:** The `rule-inactive` withheld reason fires for two different
  situations that call for opposite responses: an admin deliberately paused the
  rule, or Okta can no longer evaluate it. Its sentence used to assert the
  first — "The rule is inactive, so it grants nothing either way" — which is a
  confident wrong statement in the second case, on a report an admin reads
  before making an access decision. `D-085` corrected the copy to name both
  possibilities honestly, which is true but vaguer than the data now allows:
  `RuleEffect.status` carries the real status since `D-085`, so the report
  could say which one applies rather than listing both.
- **Done when:** the withheld reason distinguishes a deactivated rule from an
  unevaluable one — most likely a distinct `WithheldReason` code set where
  `active` is computed — and each renders its own sentence. The retargeted
  `Not Predicted Rule Inactive` story pins the current combined wording; retire
  or split it deliberately, with a note (ADR-0022).
- **Risk:** Low — additive reason code plus copy; the engine already has the
  status it needs.
- **Status:** open
- **Related:** `D-085` (which surfaced this and made `status` available)

### D-102 · `useOktaTabContext`'s `enabled`/`resyncPending` have no production caller

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaTabContext.ts`,
  `src/sidepanel/hooks/useOktaTabContext.test.tsx`,
  `docs/adr/0026-visibility-gating-patterns.md`
- **Verified:** 2026-09-02 — enumerated by the ADR-0058 implementer while
  merging the two context engines. The pin used to be expressed as
  `useOktaPageContext(!isPinned)`; it is now expressed as frozen identity
  selection in `App`, and no production call site passes `enabled: false`.
- **Problem:** `enabled` and `resyncPending` remain implemented, documented and
  tested as the generic ADR-0026 visibility gate, but nothing in `src/` uses
  them any more. They are a maintained API with no consumer — the same shape
  ADR-0039 rejects for unwired action descriptors, one layer down. Either they
  are the repo's general gating mechanism and something should use them, or
  they are dead weight that future readers will mistake for the live mechanism
  (ADR-0026's own audit table already had to be annotated as historical).
- **Done when:** either removed, with ADR-0026 updated to name the surviving
  mechanism, or explicitly kept with a comment saying why an unused gate is
  worth maintaining. Deciding is the work; both outcomes are acceptable.
- **Risk:** Low — the tests that cover them pass either way, but they are the
  thing that has to be retargeted or retired.
- **Status:** open
- **Related:** ADR-0058, ADR-0026, `D-062` (the merge)

### D-103 · A bare `Expand` names no row

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/apps/AppListItem.tsx`,
  `src/sidepanel/components/groups/GroupListItem.tsx`, and the assertion sites
  `src/sidepanel/cache/appAssignmentsSharing.test.tsx`,
  `src/sidepanel/components/apps/AppListItem.stories.tsx`,
  `src/sidepanel/components/groups/GroupListItem.test.tsx`,
  `src/sidepanel/components/groups/GroupListItem.stories.tsx`,
  `src/sidepanel/App.tabpersistence.test.tsx`,
  `src/sidepanel/components/GroupsTab.navigation.test.tsx`
- **Verified:** 2026-09-02 — left behind deliberately while closing `I-010`,
  then rescoped on 2026-09-02 when the fix was written: the filing named
  `PolicyCard` and `AppListItem`, but `GroupListItem` carries the identical
  bare label and is the one the navigation suites drive.
- **Problem:** `AppListItem` and `GroupListItem` labelled their disclosure
  control just `Expand`/`Collapse`. That is ambiguous on **every** row, not
  merely on duplicates — a screen-reader user tabbing a list of forty groups
  hears "Expand" forty times with nothing saying which group. `PolicyCard`
  next door already did it correctly (`Show rules for <name>`).
- **Done when:** ~~both~~ the two bare labels name their entity, and every
  assertion site is retargeted to the new exact string — not loosened to a
  regex or an index lookup.
- **Resolution:** `Expand <app>` / `Collapse <app>` and `Expand <group>` /
  `Collapse <group>`; eight assertion sites retargeted to the exact new
  strings. The id is **not** appended, which is a deliberate narrowing of the
  original filing: it asked for these labels to disambiguate "the way the copy
  controls now do", i.e. with the id folded in, and Sam's call on 2026-09-02
  was that a disclosure control is not a copy control. A copy control carries
  the id because the id is what it copies; making every row of every list
  announce ~20 opaque characters to pre-empt a collision that usually is not
  there is the same cost that kept ids out of `EntityLink`'s chip. `PolicyCard`
  is therefore untouched — it already names its policy, and its remaining
  duplicate-name gap is `D-107`'s, not a second fix here.
- **Risk:** Low — label text plus assertion retargets.
- **Status:** done:#118
- **Related:** `I-009`, `I-010`, `D-107` (the duplicate-name half)

### D-104 · A suspended session blanks every surface instead of holding last-known content

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0054-a-401-is-a-session-not-a-request.md` §3, and the
  per-surface error states across `src/sidepanel/components/**`
- **Verified:** 2026-09-02 — the `D-007b` implementer stopped here deliberately;
  the banner ships, the per-surface half does not.
- **Problem:** ADR-0054 §3 says a suspended session should leave each surface
  showing its **last-known content** under the one global banner, because the
  data on screen was true a moment ago and an expired session does not make it
  false. What ships instead: the banner appears, and every surface independently
  renders its own failed-request error state, so the admin loses the view they
  were reading at the moment they most need it — the session expired, nothing
  about the org changed.
- **Done when:** a suspended session leaves already-loaded content rendered,
  with the banner as the single explanation, and only surfaces with no content
  yet show an empty/error state.
- **Risk:** Medium — touches many surfaces' loading/error branches; needs the
  ADR-0018 stay-mounted behaviour respected.
- **Status:** open
- **Related:** `D-007b`, ADR-0054 §3

### D-105 · `interrupted` and `not attempted` audit outcomes do not exist

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/requestLog.ts` (`recordRequest`'s two-outcome
  vocabulary), `src/shared/scheduler/apiScheduler.ts` (the short-circuit path)
- **Verified:** 2026-09-02 — enumerated by the `D-007b` implementer while
  wiring suspension; `requestLog.ts` was outside its ownership.
- **Problem:** ADR-0054 §5 asks for `interrupted` and `not attempted` as audit
  outcomes, so a request the scheduler settled without sending is
  distinguishable from one that was tried and failed. `recordRequest` has a
  two-outcome vocabulary and no third state, so today a short-circuited request
  writes **no audit row at all**. The audit trail therefore under-reports: it
  shows the requests that were attempted and is silent about the ones the panel
  chose not to send, which is exactly the information someone reconstructing an
  incident would want.
- **Done when:** a request settled without being sent records an outcome saying
  so, distinct from both success and failure, and the history surface renders it.
- **Risk:** Low — additive vocabulary; the audit store already validates rows on
  read-back (`D-043`), so the schema is the thing to extend.
- **Status:** open
- **Related:** `D-007b`, `D-043`, ADR-0054 §5

### D-106 · A narrowed error message can still be Okta's own `errorSummary`

- **Category:** security
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useOktaApi/ruleImpact.ts` (~line 168),
  `src/sidepanel/hooks/useUserMemberships.ts` (~line 412), and any sibling
  adopting the same `error instanceof Error ? error.message : …` shape
- **Verified:** 2026-09-02 — found while reviewing `D-051`'s own fix. Both
  catch blocks wrap Okta API calls, so the caught `Error.message` can carry an
  `errorSummary` the org's data shaped.
- **Problem:** `D-051` replaced two `log.*` calls that passed the **raw caught
  error** with ones that pass `error.message` — a clear improvement, since the
  raw object carried a stack and whatever else rode on it. But CLAUDE.md's rule
  is "identifiers and outcomes only", and a message derived from an Okta
  failure is neither: Okta's `errorSummary` frequently interpolates the entity
  that failed, so a group or user name can still reach the log.
  The repo already decided this exact question the other way one layer down:
  `apiScheduler.ts` deliberately sets `lastError` to `` `HTTP ${status}` ``
  rather than `result.error`, with a comment saying Okta's `errorSummary` must
  not reach `SchedulerState`. These two sites are the same class of value
  treated differently, which is the part worth closing — not because the log is
  dangerous today, but because the inconsistency is how the rule erodes.
- **Done when:** both sites log an outcome the app controls (a status, a code,
  or a fixed string) rather than a message Okta wrote, matching
  `apiScheduler`'s precedent; or a comment records why a message is acceptable
  here when it was not there.
- **Risk:** Low — two log lines. Note the messages are still shown to the user
  via `reportError`, which is a different question and out of scope.
- **Status:** open
- **Related:** `D-051` (the fix that surfaced this), `D-007b`

### D-107 · Two same-named entities share one chip name for a screen-reader user

- **Category:** ux
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/shared/EntityLink.tsx` (the chip's
  `aria-label`/`title`), `src/sidepanel/components/shared/EntityLink.test.tsx`
  (where the accepted residual is pinned)
- **Verified:** 2026-09-02 — decided deliberately by Sam while closing `I-009`,
  after `ui-reviewer` pushed back on the first attempt.
- **Problem:** `I-009` fixed a real ambiguity: two entities can share a display
  name, so `Open group Engineering` could name two different chips on one
  screen. The first fix folded the entity id into every chip's accessible name.
  That removed the ambiguity and introduced a worse everyday cost — a screen
  reader then read ~20 opaque characters (`00g1a2b3c4d5e6f7g8h9`) on **every
  row of every list**, to disambiguate a collision that is usually absent.
  The id-fold was therefore kept on the **copy control**, where the id is the
  thing the control copies and naming it is honest, and reverted on the chip.
  What remains is the original ambiguity, scoped down to one case: two
  same-named entities rendered together are indistinguishable when opened.
- **Done when:** a chip disambiguates **only when it has to** — the id (or a
  shorter discriminator) is appended just for entities whose rendered name
  collides with another in the same list, or moved into a description rather
  than the name. Either shape keeps the common case quiet. The accepted-residual
  assertion in `EntityLink.test.tsx` is retargeted with a note when it lands.
- **Risk:** Medium — collision detection has to see the whole rendered list,
  which `EntityLink` does not today; a context or a caller-supplied hint are
  both plausible and the choice is the work.
- **Mechanism chosen 2026-09-02 (Sam).** The disambiguation is **conditional and
  caller-driven**: a component rendering a list of entities already holds the
  whole array, so it computes which display names occur more than once and
  passes a discriminator down to _only_ those chips. `EntityLink` gains one
  optional prop (e.g. `disambiguator`), left `undefined` in the overwhelmingly
  common case, and its `aria-label` appends the discriminator only when the
  prop is set. Rejected alternatives, with why:
  - **A context provider that auto-detects.** Chips would register their names
    on mount and the provider would recompute collisions. Nobody could forget
    it — but the accessible name then _mutates after_ a screen reader may have
    already announced it, and the registration has to happen during render.
    Correctness-by-construction is not worth a label that changes underneath
    the user.
  - **Always appending the id (or a short suffix).** Uniform and simple, and
    the reason this item exists: it charges every row for a rare problem.
    This decision also absorbs `PolicyCard`'s duplicate-name gap, which `D-103`
    deliberately did not fix — `Show rules for <name>` collides for two
    same-named policies in exactly the same way and wants exactly the same
    conditional treatment. Scope this item to cover both controls.
- **Status:** open
- **Related:** `I-009`, `I-010`, `D-103`

## Archive

Closed items, collapsed to one line each. The verbose Problem/Done-when/Risk
prose that used to live here is recoverable from git history at the linked
commit — that is the point of moving it out of this file. Ids here are
permanently retired: never reuse an archived id for a new item (the
uniqueness guard in `scripts/check-cited-paths.mjs` enforces this across both
ledgers). See `SESSION.md` step 7 and `CLAUDE.md`'s "Nightly maintenance
system" section for when an item moves here.

- **D-001** — User Detail's rule badge under-evaluates isMemberOfAnyGroup — done:#67 ([9ea42a3](https://github.com/samdhenderson/okta-unbound/commit/9ea42a3))
- **D-002** — Dedupe the group-context builder duplicated in two files — done:#67 ([9ea42a3](https://github.com/samdhenderson/okta-unbound/commit/9ea42a3))
- **D-003** — Silent app-label resolution failures in pushGroupOps — done:#70 ([c2d0109](https://github.com/samdhenderson/okta-unbound/commit/c2d0109))
- **D-004** — useRuleLifecycle.ts has zero test coverage on a security-sensitive audit path — done:#67 ([9ea42a3](https://github.com/samdhenderson/okta-unbound/commit/9ea42a3))
- **D-005** — useRuleImpact.ts has zero test coverage on its race guards — done:#70 ([c2d0109](https://github.com/samdhenderson/okta-unbound/commit/c2d0109))
- **D-006** — Untested error/guard branches in three hooks — done:#70 ([c2d0109](https://github.com/samdhenderson/okta-unbound/commit/c2d0109))
- **D-007a** — A failure result that can say what failed — done:#102 ([82a5ce4](https://github.com/samdhenderson/okta-unbound/commit/82a5ce4))
- **D-008** — Confirm useEntityQuery.ts's abandoned-abstraction status — closed:refuted-2026-08-24 (investigated; the Problem no longer held, no code change)
- **D-009** — Modal content can render underneath ActivityBar — done:#68 ([808ab30](https://github.com/samdhenderson/okta-unbound/commit/808ab30))
- **D-010** — CI's `verify` job has been red on `main` since at least 2026-08-15, unrelated to any one PR — done:#66 ([25f5e45](https://github.com/samdhenderson/okta-unbound/commit/25f5e45))
- **D-011** — App.tabpersistence.test.tsx's tab-mount waits are under-budgeted — done:#67 ([9ea42a3](https://github.com/samdhenderson/okta-unbound/commit/9ea42a3))
- **D-013** — An audit entry can misattribute who changed a rule, silently — umbrella; decided 2026-08-24 and split into D-013a/b/c, all closed (no direct commit of its own — see those three entries)
- **D-013a** — The facade resolves an actor, or says it could not — done:#94 ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-013b** — The three hand-rolled copies use the facade — done:#94 ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-013c** — Tell the admin their identity could not be confirmed — done:#99 ([a5903c4](https://github.com/samdhenderson/okta-unbound/commit/a5903c4))
- **D-014** — useRuleLifecycle re-implements CoreApi.getCurrentUser — done:#94 (closed by D-013b) ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-016** — Modal's a11y contract is only regression-tested on the fallback render path — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-017** — The `storybook` CI job is red on `main` — a story file dies on a mid-run dep re-optimization — done:#69 ([a7b72eb](https://github.com/samdhenderson/okta-unbound/commit/a7b72eb))
- **D-018** — `lint:cited-paths` cannot see the nightly ledgers, and three citations there are already dead — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-019** — The non-throwing half of app-label resolution is still silent — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-020** — pushGroupOps reads an Okta app response unvalidated, one call away from a validated helper — done:#74 ([bcf5a39](https://github.com/samdhenderson/okta-unbound/commit/bcf5a39))
- **D-021** — `CONVENTIONS.md`'s mandated `pkill -9 -f vitest` kills the shell that runs it — done:#74 ([bcf5a39](https://github.com/samdhenderson/okta-unbound/commit/bcf5a39))
- **D-023** — `lint-staged` stashes the working tree mid-commit, racing concurrent writer agents — done:#75 ([9d71a26](https://github.com/samdhenderson/okta-unbound/commit/9d71a26))
- **D-026** — `getAppPushGroupMappings` interpolates an unencoded app id — closed:overtaken-by-f1e8def ([f1e8def](https://github.com/samdhenderson/okta-unbound/commit/f1e8def))
- **D-027** — `getAppById` cannot express why it failed, so callers that need to know can't use it — closed:overtaken-by-f1e8def ([f1e8def](https://github.com/samdhenderson/okta-unbound/commit/f1e8def))
- **D-029a** — Rule impact reads the snapshot — done:#95 ([3930f4b](https://github.com/samdhenderson/okta-unbound/commit/3930f4b))
- **D-029b** — User memberships derive their rules — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-030** — `lint:cited-paths` is red on `main` right now — done:#82 ([50c0743](https://github.com/samdhenderson/okta-unbound/commit/50c0743))
- **D-032** — Audit rows written before `actorResolution` contradict their own type — done:#95 ([3930f4b](https://github.com/samdhenderson/okta-unbound/commit/3930f4b))
- **D-038** — Rule impact trusts a snapshot that may be mid-walk — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-039** — `RuleCard`'s memo comparator omits the group props it renders — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-041** — Decorative icons carry no `aria-hidden`, app-wide — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-048** — A rule's exclusion list never reaches the user-path classifier — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-050** — The group-rules fallback fetch validates nothing — done:#99 ([a5903c4](https://github.com/samdhenderson/okta-unbound/commit/a5903c4))
- **D-052** — `ruleImpact` models rule deactivation as retracting membership — done:#106 ([415baf9](https://github.com/samdhenderson/okta-unbound/commit/415baf9))
- **D-053** — Late-landing content re-lays-out the text beside it — umbrella; one defect filed as a seven-part cluster (D-053a–g), all closed (no direct commit of its own — see those entries; convention recorded in ADR-0044)
- **D-053a** — The match percentage goes from 2 characters to 4, beside a truncating label — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053b** — A status chip swings between 4 and 13 characters beside a wrapping mono expression — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053c** — A group-count badge takes width out of a multi-line description — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053d** — The MFA scan paragraph re-wraps three times as the button label changes — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053e** — Three tab labels slide sideways when their count badges materialise — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053f** — The Filters button shrinks the search field, and the member count grows in place — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-053g** — Classic scrollbars take 6px out of content width the instant a list overflows — done:#99 ([a5903c4](https://github.com/samdhenderson/okta-unbound/commit/a5903c4))
- **D-054** — `ScrollableList` still shifts 6px on load→loaded — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-055** — `formatRuleForDisplay` does unguarded string work on a field it does not validate — done:#102 ([82a5ce4](https://github.com/samdhenderson/okta-unbound/commit/82a5ce4))
- **D-059** — `handleGetAppInfo` fetches the app on every app page, even when the DOM already answered — done:#102 ([82a5ce4](https://github.com/samdhenderson/okta-unbound/commit/82a5ce4))
- **D-061** — A rule can point at a group that no longer exists, and nothing says so — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-064** — A non-ok response drops its headers, so a 429 arrives with no rate-limit headers — done:#108 ([e500796](https://github.com/samdhenderson/okta-unbound/commit/e500796))
- **D-065** — `fetchAndCacheAllGroupRules` walks a whole endpoint with no boundary schema — done:#107 ([069ef48](https://github.com/samdhenderson/okta-unbound/commit/069ef48))
- **D-075** — A profile write invalidated the memberships and never re-read them — fixed 2026-08-28 on `feat/demo-org-writes` as its own commit, landed via PR #103 ([ee1ec88](https://github.com/samdhenderson/okta-unbound/commit/ee1ec88)); the ledger's own `done:#112-era` status was a label picked when the item was closed retroactively on 2026-09-02, not the PR that shipped the fix
- **D-086** — `RateLimitDetector.parseHeaders` has no `NaN` guard, so it fails open — done:#117 ([4c28cd2](https://github.com/samdhenderson/okta-unbound/commit/4c28cd2))
- **D-089** — `useRuleConsolidation` never clears `RulesCache` after writing rules — done:#117 ([4c28cd2](https://github.com/samdhenderson/okta-unbound/commit/4c28cd2))
