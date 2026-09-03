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

### D-028 · Independently audit the ADR-0040 org snapshot against a real org

A line that links a **PR** rather than a commit was archived while that PR was
still in flight, so its squash-merge sha did not exist yet. Replace the PR link
with the commit link once it lands; until then the PR is the reference. Nothing
downstream reads the link, so a stale one is a documentation debt, not a build
failure — but an id here is retired either way, so only archive an item whose
PR you expect to land.

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

### D-108 · The non-answer register fails AA contrast, at half the required ratio

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/AppScopeIndicator.tsx`
  (`nonAnswerClasses`), `src/sidepanel/components/users/comparison/GroupSourceIndicator.tsx`
  (the same treatment), and any later adopter of the register
- **Verified:** 2026-09-02 — measured while scoping `I-017`.
- **Problem:** Both indicators render their non-answer states as
  `italic text-neutral-400`. `--color-neutral-400` is `#aeaeae`, which computes
  to **2.22:1 on white and 2.02:1 on `--color-neutral-50`** — under half the
  4.5:1 WCAG AA floor for normal text. These are not decorative strings: they
  are the states that tell a reader the app does _not_ know something
  (`Source unknown`, `Source not compared`, a deduction that must not be read
  as proven), so they are exactly the text a reader most needs to notice.

  The story gate did not catch it. `a11y.test` is `'error'` in
  `.storybook/preview.tsx` and `tailwind.css` is imported by the preview, so
  axe both ran and had the styles. The likely explanation is that axe reports
  `incomplete` rather than `violation` when it cannot resolve the background
  behind inline text, and `incomplete` does not fail a run — **this is
  unproven and worth proving**, because if it holds, every colour-contrast
  guarantee the story suite appears to give is weaker than it looks.

  `I-017`'s three unresolved-entity chips deliberately chose `text-neutral-600`
  (4.64:1 on neutral-50, 5.10:1 on white) _over_ this precedent, and its filing
  worried that was a deviation. It is not a deviation; it is the correction.

- **Done when:** the non-answer register clears 4.5:1 on the backgrounds it
  actually renders against — `text-neutral-600` is the register `I-017` already
  settled on and the cheap route. Both indicators use it, their stories still
  pass, and the axe-`incomplete` hypothesis above is either confirmed (and
  recorded, since it weakens a gate the repo trusts) or disproven.
- **Risk:** Low to change per site. The finding it makes is that a green gate
  proved less than it appeared to.
- **Scope is wider than the two files above — measured 2026-09-02.** The register
  is not confined to the two indicators: `text-neutral-400` appears **58 times
  across 42 files** and `text-neutral-500` (3.02:1 on neutral-50, also under the
  floor) **168 times**. Not all are violations, and the item must not be worked
  as though they are:
  - **5** sit on `disabled:` variants (`Button`, `IconButton`). WCAG 1.4.3
    explicitly exempts disabled controls — leave them.
  - **13** are on icon/`svg` lines. Decorative graphics carrying `aria-hidden`
    are out of scope; an icon that is the _only_ carrier of meaning is not.
  - The remaining **~40** are candidates on real text, of which only the two
    named above have actually been measured against their rendered background.
    So the deliverable is an **audit with a rule**, not a find-and-replace: decide
    what the muted register is allowed to be, at what size, on which backgrounds,
    and record it in `docs/design-system.md` so the next muted string does not
    re-derive it. A blanket `400`→`600` sweep would flatten a deliberate two-step
    hierarchy (`500` for secondary, `400` for tertiary) into one tone, which is a
    visual-design decision and not this item's to make alone.
- **Worth pairing with the coming design-polish pass.** Retuning a colour
  register is exactly that pass's kind of work, and doing it there gets the
  hierarchy re-designed rather than merely made compliant.
- **Status:** open
- **Related:** `I-017` (chose the correct value and doubted itself), `I-015`
  (its raw id uses `text-neutral-500`, same register), ADR-0010, ADR-0014

### D-109 · `AppListItem`'s header is click-to-expand but not keyboard-operable

- **Category:** correctness
- **Priority:** P2
- **Size:** S
- **Files:** `src/sidepanel/components/apps/AppListItem.tsx:197-203`
- **Verified:** 2026-09-02 — read directly while scoping `I-023`.
- **Problem:** The card body is a raw `<div className="press-subtle …"
onClick={toggleExpanded}>`. A mouse user can expand an app by clicking
  anywhere in its header; a keyboard user cannot reach that target at all. The
  file says so itself at :199-202 — _"No keyboard affordance on this body …
  giving the row itself one means a `StretchedButton` overlay. Deliberately out
  of scope here."_ The disclosure is still reachable via the adjacent
  `IconButton`, so this is a missing parallel affordance rather than a trapped
  control, which is why it was survivable to defer.

  It stopped being survivable when it became the pattern. `I-023` was filed as
  "make `PolicyCard`'s header toggle **like its siblings**" — and of the two
  siblings, `RuleCard` uses `StretchedButton` correctly while this one does not.
  A consistency item pointed at the wrong neighbour propagates the defect
  instead of the pattern. `I-023` was implemented against `RuleCard` for exactly
  this reason.

- **Done when:** `AppListItem`'s header is operable by keyboard, via the shared
  `StretchedButton` overlay the file's own comment names, with the trailing
  `IconButton` still working and `aria-expanded` on exactly one control. A story
  covers the keyboard path. The `PolicyCard` implementation shipped under
  `I-023` is the reference.
- **Risk:** Low — one file, and a landed sibling to copy.
- **Status:** open
- **Related:** `I-023` (fixed the same defect on `PolicyCard`), `D-103`

### D-110 · The `Icon` catalog story does not show six registry glyphs

- **Category:** cleanup
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/Icon.stories.tsx` (the `AllIcons`
  grid), `src/sidepanel/components/shared/Icon.tsx` (the `IconType` union, for
  reference)
- **Verified:** 2026-09-02 — enumerated the union against the story: 37 registry
  entries, 6 absent.
- **Problem:** `AllIcons` is the catalog a component author reads to find out
  what glyphs exist before hand-rolling one. It is missing `clock`, `close`,
  `external-link`, `filter`, `pin` and `terminal` — so the browsing surface
  under-reports the registry by 16%, and the failure mode is precisely the one
  `I-021` existed to fix: someone inlines an `<svg>` for a glyph that was
  already there. Predates `I-021`, which added its two new entries to the grid
  correctly and did not widen scope to the pre-existing gap.
- **Done when:** the catalog renders every member of `IconType`, derived from
  the union rather than hand-listed — a hand-maintained copy of a type is what
  drifted in the first place.
- **Risk:** Low — story-only.
- **Status:** open
- **Related:** `I-021`

### D-111 · A year-old timestamp reads "0 year ago" for five days of every year

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/shared/ruleUtils.ts:218-228` (the relative-time formatter)
- **Verified:** 2026-09-02 — reproduced by executing the branch arithmetic over
  a day sweep; the boundary is exact.
- **Problem:** The formatter buckets months as `floor(days / 30)` and years as
  `floor(days / 365)`. Those two divisors do not meet. `diffMonths` reaches 12
  at **day 360**, which fails the `diffMonths < 12` guard and falls through to
  the year branch — where `floor(360 / 365)` is still `0`. So days 360 through
  364 render **"0 year ago"**.

  ```
  359 days → 11 months ago
  360 days → 0 year ago      ← wrong
  364 days → 0 year ago      ← wrong
  365 days → 1 year ago
  ```

  This surfaces wherever a rule or snapshot timestamp is shown, and "0 year ago"
  reads as _no elapsed time_ — the opposite of the truth, on data that is nearly
  a year stale. That inversion is why this is correctness and not polish.

- **Diagnosis note, because the obvious reading is wrong.** The line also uses
  `diffYears > 1 ? 's' : ''`, and it is tempting to call this a plural bug. It is
  not: `> 1` merely renders "0 year" rather than "0 years", and both are wrong
  because the **number** is wrong. Fixing the suffix would leave "0 years ago"
  shipping. The same `> 1` predicate on the four branches above it (`min`,
  `hour`, `day`, `month`) is **not independently reachable at zero** — each is
  guarded by the branch before it (`diffMins < 1` returns `just now`), so they
  are cosmetically inconsistent with `pluralSuffix` and nothing more.
  `RuleCard.tsx:214`'s `> 1` is likewise guarded by `hasConflicts`.
- **Done when:** no elapsed duration renders a leading `0`. Deriving both buckets
  from one calendar-aware source is the honest fix; if the 30-day month is kept
  for simplicity, the year branch must use the same divisor so the buckets abut.
  A test sweeps the boundaries (359/360/364/365) rather than sampling one value —
  sampling is what missed this.
- **Risk:** Low. Display-only, one function, no API or cache behaviour.
- **Status:** open
- **Related:** `I-024` (the shared `pluralSuffix` these predicates should adopt
  once the number is right), `D-112`

### D-112 · Forty-odd inline plural ternaries outlive the shared helper

- **Category:** cleanup
- **Priority:** P3
- **Size:** M
- **Files:** `src/shared/utils/plural.ts` (the helper to adopt); the call sites
  enumerated below
- **Verified:** 2026-09-02 — enumerated by the `I-024` writer, which shipped the
  helper and deliberately did not retrofit them.
- **Problem:** `I-024` added `src/shared/utils/plural.ts` (`pluralSuffix`,
  `pluralNoun`, `pluralize`, `NounForms` for irregulars) and converted its own
  call sites only. Three private helpers and roughly forty inline
  `=== 1 ? '' : 's'` ternaries remain, which is the exact condition — a recipe
  written many times — that the helper exists to end. Left un-retrofitted on
  purpose: it is a mechanical mass change, it would have collided with four
  agents working in parallel, and it belongs in its own commit.

  Private helpers: `groups/groupSourceSummary.ts:129`,
  `groups/detail/GroupOverviewPane.tsx:79-80`, `shared/utils/dateFormat.ts:64-65`.

  Inline ternaries span `AuthPoliciesTab` (the `Policy`/`Policies` irregular,
  which is why `NounForms` exists), `RuleImpactModal`, `AuditLogViewer`,
  `AuditLogUndoModal`, `RuleConsolidationModal`, `GroupMergeModal`,
  `BulkOperationsPanel`, `CrossGroupSearch`, `GroupCleanupPanel`,
  `GroupCollections`, `memberSourceBuckets`, `AttributeHealthCard`,
  `ClauseChecklist`, `MemberSourceNotes`, `GroupActionBar`, `CompareGroupModal`,
  `GroupMembersSection`, `GroupInsightsPane`, `MemberSourceMeter`,
  `ProfileSaveModal`, `RulesListActionBar`, `RulesDuplicatesPanel`,
  `MemberSourceFilterBar`, `ExportPreviewTable`, `AppListItem`,
  `useRuleConsolidation`, `useGroupMerge`, `profileOperations`, `undoManager`.

- **Done when:** no `? '' : 's'` / `? 's' : ''` ternary remains in `src/`, and the
  three private helpers are deleted rather than merely unused. **Do not sweep
  `ruleUtils.ts:218-228` or `RuleCard.tsx:214` as part of this** — those use a
  `> 1` predicate and `D-111` owns them; converting them here would bury a
  behaviour change inside a mechanical diff.
- **Risk:** Low per site, but wide. Mechanical mass change, so exempt from the
  plan gate (`CLAUDE.md`) — it still wants its own PR, because a diff this broad
  hides anything non-mechanical mixed into it.
- **Status:** open
- **Related:** `I-024` (shipped the helper), `D-111`

### D-113 · Home's totals caption still says "1 groups"

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/home/OrgSnapshotCard.tsx` (the `OrgBox`
  caption), `src/sidepanel/components/home/orgFigures.ts` (`OrgBox`'s type)
- **Verified:** 2026-09-02 — found by the `I-024` writer and left visible
  rather than silently half-fixed; the `SingleItemOrg` story's docblock states it.
- **Problem:** `I-024` fixed the _findings_ denominator, so a one-app org now
  reads "of 1 application". The **totals caption** above it is a separate
  string: `OrgBox.noun` is a bare plural rendered directly, so a single-group org
  still reads **"1 groups"** on the panel's landing surface. Same defect, one
  component over, outside `I-024`'s allowlist.
- **Done when:** the totals caption pluralises on its own count, using
  `pluralize` from `shared/utils/plural.ts` — `OrgBox` taking the same optional
  `singular` that `NamedSource` now carries is the consistent shape. The
  `SingleItemOrg` story asserts it, and its docblock note about the known
  residue is removed because the residue is gone.
- **Risk:** Low — display string, no API or cache behaviour.
- **Status:** open
- **Related:** `I-024` (fixed the sibling string and filed this one)

### D-114 · An attribute the profile lacks reads as "nobody matches"

- **Category:** correctness
- **Priority:** P1
- **Size:** M
- **Files:** `src/shared/ruleEvaluator.ts` (`resolveMember`),
  `src/shared/ruleEvaluator.test.ts`
- **Verified:** 2026-09-02 — found by the `I-026` writer while checking demo
  rules against the real evaluator, then re-confirmed at `resolveMember`'s
  source. Affects live orgs, not only the demo fixture.
- **Problem:** `resolveMember` collapses two different facts into one answer:

  ```ts
  const raw = (options.user.profile as Record<string, unknown>)[property.name];
  if (raw === undefined || raw === null) return null;
  ```

  An attribute **absent from the profile** and one **explicitly set to null**
  both resolve to `null`. Only the second licenses an answer; the first is the
  evaluator failing to understand the expression, which the module header says
  it must never report as `no-match`.

  The consequence is not subtle. `user.status` is a top-level Okta user field,
  not a profile field, so `user.status == "ACTIVE"` — an ordinary, common rule
  expression — reduces to `null == "ACTIVE"` → `false` for **every** user. The
  evaluator states with confidence that nobody matches a rule that in fact
  matches the whole org. The same holds for every `user.*` reference outside the
  profile object: `id`, `created`, `lastLogin`, `type`.

- **Done when:** an attribute missing from the profile returns `UNRESOLVED`
  (reaching the existing unevaluable path with a reason), while an attribute
  present and explicitly `null` keeps returning `null`. Tests pin the two apart,
  including `user.status == "ACTIVE"` specifically, since that is the shape that
  exposed it. The demo fixture's `EVALUATOR_CANNOT_REPRODUCE` single-entry
  allow-list in `src/sidepanel/demo/demoRuleCoverage.test.ts` is deleted as part
  of this fix and the ordinary equality check takes over — the test's failure
  message already says so.
- **Risk:** Medium — this moves answers, by design. Surfaces reading the
  evaluator (blast radius, member-source classification, the rule-impact
  preview) will show `unevaluable` where they previously showed a confident
  `no-match`. That is the honest reading and the reason the change is worth
  making, but it is a visible behaviour change on live data, so it wants the
  `okta-claim-check` skill run over a real org's rules before it lands.
- **Status:** open
- **Related:** `I-026` (found it), `ADR-0017` (parse, never guess)

### D-115 · One `error` field serves two independent loads

- **Category:** correctness
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useGroupSource.ts`,
  `src/sidepanel/components/groups/detail/GroupDetailView.tsx`
- **Verified:** 2026-09-02 — found by the `I-032` writer; the hook's rules load
  and member analysis both write the single `error` field.
- **Problem:** `useGroupSource` runs two independent loads — the cheap rules
  read and the gated member-source walk — and both report into one `error`
  string. Whichever fails last wins the message, so a member-walk failure can
  overwrite a rules failure that is still true, and the sections downstream can
  only disambiguate by their own status field. `I-032` had to work around this
  directly: `refreshRules` deliberately does **not** clear `error` on entry,
  because doing so would erase a member failure the reader is still looking at.
- **Done when:** the hook exposes `rulesError` and `memberError` separately,
  each cleared by its own load, and `GroupDetailView` routes each to the section
  that owns it. The `refreshRules` workaround comment goes away because the
  hazard it names no longer exists.
- **Risk:** Low — internal hook shape with one consumer.
- **Status:** open
- **Related:** `I-032` (found it and worked around it)

### D-116 · The blast radius predicts additions into app-mastered groups

- **Category:** correctness
- **Priority:** P3
- **Size:** M
- **Files:** `src/shared/membership/blastRadius.ts` (`additionEffect`)
- **Verified:** 2026-09-02 — found by the `I-029` writer, and now exercised by
  the demo org: `I-026` gave `Datadog - Engineering` a rule, and the reel's
  Ledger plate duly named that `APP_GROUP` as a predicted addition.
- **Problem:** `additionEffect` has no `APP_GROUP` gate, so it predicts a user
  will be **added** to a group that is mastered by an application. A group rule
  cannot add anyone to an app-mastered group — the upstream directory owns that
  roster — so the prediction is structurally impossible, not merely uncertain.
  The removal path enforces the distinction correctly; only the addition path
  does not. The gap is already recorded in the function's own docblock, with the
  reason: a group's type is unreachable for a group the user does not yet hold,
  because the type comes from the membership record being predicted.
- **Done when:** an addition into an `APP_GROUP` target is either suppressed or
  labelled as not-modelled, rather than presented beside ordinary predictions
  with equal confidence. Whichever is chosen, the reason is recorded in the
  docblock, since the next reader will otherwise re-derive the same dead end.
  Resolving the type lookup is the substance of the work — a fix that merely
  hides the row without knowing the type would suppress real predictions too.
  The demo org exercises this, so `demoRuleCoverage`-adjacent expectations and
  the reel's Ledger row count both move when it lands.
- **Risk:** Medium — this changes what a prediction surface claims, and the
  surface steers membership edits. It also re-films the Users and Rules
  chapters.
- **Status:** open
- **Related:** `I-029` (found it), `I-026` (made the demo exercise it)

### D-117 · `GroupsTab.tsx` is 731 lines, well over the ~300-line bar

- **Category:** structure
- **Priority:** P3
- **Size:** L
- **Files:** `src/sidepanel/components/GroupsTab.tsx`
- **Verified:** 2026-09-02 — 731 lines after `I-019`, which added 18 and
  reported the overrun rather than absorbing it.
- **Problem:** The tab holds list state, the cached/live mode switch, filter
  and search state, the working set, the deep-link effect, the detail-view
  push and the rung wrapper. `I-019` needed nine lines of that effect to make a
  deep link land on a named pane, and there was nothing to trim in exchange —
  every remaining line is load-bearing for a different concern. That is the
  signal the file is doing too many jobs, not that the last change was
  careless. It is now the largest component in the repo bar `App.tsx`.
- **Done when:** the deep-link/navigation effect and the cached-vs-live mode
  switch move into hooks beside the existing ones, leaving the component to
  compose. Land it tests-first, one concern per change, per the working
  agreement — `GroupsTab.test.tsx` (78) and `GroupsTab.navigation.test.tsx`
  (12) are the safety net and must stay green throughout without retargeting.
- **Risk:** Medium — no behaviour should change, but this is the tab with the
  most state and the deep-link path is easy to break silently. Pure refactor:
  if an assertion needs rewriting, the extraction is wrong.
- **Status:** open
- **Related:** `I-019` (grew it and reported it), `D-091`, `ADR-0024`

### D-118 · `App.tsx` is 732 lines and mounts its provider stack inline

- **Category:** structure
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/App.tsx`
- **Verified:** 2026-09-02 — 732 lines after `I-033`, which added 10 for a
  provider wrapper and reported the overrun rather than absorbing it.
- **Problem:** `App` composes four providers inline
  (`SchedulerProvider`, `ProgressProvider`, `NavigationProvider`,
  `OrgEntityIndexProvider`) around a render body that is already the largest
  component in the repo. Every new cross-cutting concern costs another nesting
  level in the file least able to afford one, and the reindent makes each such
  change look far larger in review than it is — `I-033`'s ten substantive lines
  showed up as 306 changed lines until read with `git diff -w`.
- **Done when:** the provider stack moves into an `AppProviders` component
  (its own file) taking the values it needs and rendering `children`, so
  `App.tsx` nests one level and adding a provider stops touching it at all.
  Pure refactor: no provider's `enabled` semantics change, and ADR-0018 gating
  stays bit-for-bit — `App.tabpersistence`, `App.contextengine` and the palette
  suites must pass untouched. If an assertion needs rewriting, the extraction
  is wrong.
- **Risk:** Low-medium. No behaviour change, but it moves the tree's root; the
  reindent hides mistakes, so review with `git diff -w`.
- **Status:** open
- **Related:** `I-033` (grew it and proposed this), `D-117`, `D-091`

### D-119 · Nothing checks the docs' context inventory against the code

- **Category:** tooling
- **Priority:** P4
- **Size:** S
- **Files:** `scripts/check-cited-paths.mjs`, `docs/state-management.md`,
  `docs/architecture.md`
- **Verified:** 2026-09-02 — found by the `I-033` writer: both docs asserted
  "exactly two contexts" and had been wrong since ADR-0030 added
  `NavigationContext`. Corrected in that commit; the absence of a check is not.
- **Problem:** Two specs state a closed inventory of React contexts, and a
  third context existed for months without either noticing. A closed list with
  nothing enforcing it is worse than no list: readers trust it, and it silently
  decays. The repo already has a path checker that fails the build on a stale
  citation — this is the same class of rot, unguarded.
- **Done when:** the checker counts `src/sidepanel/contexts/*Context.tsx`
  against the inventory the docs claim and fails when they disagree, so adding
  a context forces the doc update in the same commit. Prove it non-vacuously by
  adding a throwaway context file and confirming the check goes red.
- **Risk:** Low — build tooling; the failure mode is a false red, which is
  visible immediately.
- **Status:** open
- **Related:** `I-033` (found it), `ADR-0030`

### D-120 · `useExportTab.ts` carries every concern the Export tab has

- **Category:** structure
- **Priority:** P3
- **Size:** L
- **Files:** `src/sidepanel/hooks/useExportTab.ts`
- **Verified:** 2026-09-02 — 486 lines before `I-020`, which adds the
  snapshot-source branch on top. Found by that item's writer while scoping it.
- **Problem:** The hook owns descriptor selection, column selection and
  presets, the filter state, the debounced match-count probe, the export run
  and its progress, and the download. `I-020` adds a seventh concern — a row
  source that resolves synchronously from the org snapshot rather than
  fetching — and every one of those concerns has to know whether it is in the
  endpoint world or the snapshot world. That is the point at which a hook stops
  being a hook and becomes the tab.
- **Done when:** the probe and the run/download are separate hooks composed by
  a thin `useExportTab`, with the source distinction resolved once at the top
  rather than branched at each concern. Land it tests-first, one concern per
  change, per the working agreement. Behaviour must not move: the existing
  suites are the safety net and must pass without retargeting. If an assertion
  needs rewriting, the extraction is wrong.
- **Risk:** Medium — the Export tab is the surface where a mistake writes a
  wrong file rather than showing a wrong number, and the escaping and audit
  paths run through here. Pure refactor only; no change to what a cell
  contains.
- **Status:** open
- **Related:** `I-020` (found it and added to it), `ADR-0065`, `D-118`, `D-117`

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
- **D-007** — No session-expiry / 401 handling anywhere in the API path — umbrella, discharged: scoped 2026-08-24 into `D-007a`/`D-007b`/`D-007c`, all three now landed. The `401 ⇒ expired` decision this item recorded is ADR-0054, Accepted — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-007a** — A failure result that can say what failed — done:#102 ([82a5ce4](https://github.com/samdhenderson/okta-unbound/commit/82a5ce4))
- **D-007b** — One expired session, not thirty failed requests — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-007c** — A 429 is never retried, because it is not an error — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-008** — Confirm useEntityQuery.ts's abandoned-abstraction status — closed:refuted-2026-08-24 (investigated; the Problem no longer held, no code change)
- **D-009** — Modal content can render underneath ActivityBar — done:#68 ([808ab30](https://github.com/samdhenderson/okta-unbound/commit/808ab30))
- **D-010** — CI's `verify` job has been red on `main` since at least 2026-08-15, unrelated to any one PR — done:#66 ([25f5e45](https://github.com/samdhenderson/okta-unbound/commit/25f5e45))
- **D-011** — App.tabpersistence.test.tsx's tab-mount waits are under-budgeted — done:#67 ([9ea42a3](https://github.com/samdhenderson/okta-unbound/commit/9ea42a3))
- **D-012** — `conditionExpressionOf` is replicated in four files — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-013** — An audit entry can misattribute who changed a rule, silently — umbrella; decided 2026-08-24 and split into D-013a/b/c, all closed (no direct commit of its own — see those three entries)
- **D-013a** — The facade resolves an actor, or says it could not — done:#94 ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-013b** — The three hand-rolled copies use the facade — done:#94 ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-013c** — Tell the admin their identity could not be confirmed — done:#99 ([a5903c4](https://github.com/samdhenderson/okta-unbound/commit/a5903c4))
- **D-014** — useRuleLifecycle re-implements CoreApi.getCurrentUser — done:#94 (closed by D-013b) ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **D-015** — The ghost copy-id recipe is now duplicated in EntityLink and CopyableId — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-016** — Modal's a11y contract is only regression-tested on the fallback render path — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-017** — The `storybook` CI job is red on `main` — a story file dies on a mid-run dep re-optimization — done:#69 ([a7b72eb](https://github.com/samdhenderson/okta-unbound/commit/a7b72eb))
- **D-018** — `lint:cited-paths` cannot see the nightly ledgers, and three citations there are already dead — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-019** — The non-throwing half of app-label resolution is still silent — done:#72 ([de2ae3e](https://github.com/samdhenderson/okta-unbound/commit/de2ae3e))
- **D-020** — pushGroupOps reads an Okta app response unvalidated, one call away from a validated helper — done:#74 ([bcf5a39](https://github.com/samdhenderson/okta-unbound/commit/bcf5a39))
- **D-021** — `CONVENTIONS.md`'s mandated `pkill -9 -f vitest` kills the shell that runs it — done:#74 ([bcf5a39](https://github.com/samdhenderson/okta-unbound/commit/bcf5a39))
- **D-022** — Half of a React-warning assertion cannot fire under React 19 — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-023** — `lint-staged` stashes the working tree mid-commit, racing concurrent writer agents — done:#75 ([9d71a26](https://github.com/samdhenderson/okta-unbound/commit/9d71a26))
- **D-024** — `check-cited-paths` still cannot see any path that is not under `src/` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-025** — The vitest timeout recipe carries two different `alarm` values — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-026** — `getAppPushGroupMappings` interpolates an unencoded app id — closed:overtaken-by-f1e8def ([f1e8def](https://github.com/samdhenderson/okta-unbound/commit/f1e8def))
- **D-027** — `getAppById` cannot express why it failed, so callers that need to know can't use it — closed:overtaken-by-f1e8def ([f1e8def](https://github.com/samdhenderson/okta-unbound/commit/f1e8def))
- **D-029a** — Rule impact reads the snapshot — done:#95 ([3930f4b](https://github.com/samdhenderson/okta-unbound/commit/3930f4b))
- **D-029b** — User memberships derive their rules — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-030** — `lint:cited-paths` is red on `main` right now — done:#82 ([50c0743](https://github.com/samdhenderson/okta-unbound/commit/50c0743))
- **D-031** — `check-cited-paths` scans closed ledger items as if they were live prose — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-032** — Audit rows written before `actorResolution` contradict their own type — done:#95 ([3930f4b](https://github.com/samdhenderson/okta-unbound/commit/3930f4b))
- **D-033** — Two docs still cite `unknown@unknown.com` as current behavior — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-034** — `useGroupMerge` copies members with a hand-rolled loop, not `runOperation` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-035** — `currentUserSchema` lives in `core.ts`, away from every other Okta schema — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-038** — Rule impact trusts a snapshot that may be mid-walk — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-039** — `RuleCard`'s memo comparator omits the group props it renders — done:#97 ([59c1539](https://github.com/samdhenderson/okta-unbound/commit/59c1539))
- **D-041** — Decorative icons carry no `aria-hidden`, app-wide — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-042** — The `idb` fake is copy-pasted across four test files — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-043** — Nothing validates an audit row on the way out of IndexedDB — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-045** — Two more row comparators carry the drift `D-039` just removed — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-046** — The Rules tab re-creates every handler it hands to a `RuleCard` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-047** — A fully-walked org with no rules reads the same as a rule that hits nobody — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-048** — A rule's exclusion list never reaches the user-path classifier — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-049** — `RULE_INVENTORY_KEY` is a cache-key literal outside `keys.ts` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-050** — The group-rules fallback fetch validates nothing — done:#99 ([a5903c4](https://github.com/samdhenderson/okta-unbound/commit/a5903c4))
- **D-051** — Two always-on log calls pass a raw caught error — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
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
- **D-056** — `AlertMessage` hand-rolls two raw buttons inside `components/shared` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-058** — Three modals hand-roll the eyebrow recipe `Eyebrow` exists to own — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-059** — `handleGetAppInfo` fetches the app on every app page, even when the DOM already answered — done:#102 ([82a5ce4](https://github.com/samdhenderson/okta-unbound/commit/82a5ce4))
- **D-060** — Can `/api/v1/apps` report group assignments, or must the snapshot fan out? — closed:refuted-2026-09-02 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-061** — A rule can point at a group that no longer exists, and nothing says so — done:#112 ([a376dff](https://github.com/samdhenderson/okta-unbound/commit/a376dff))
- **D-062** — Two context engines probe the same page twice on every navigation — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-063** — `AppInfo` is declared twice, verbatim, in two files — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-064** — A non-ok response drops its headers, so a 429 arrives with no rate-limit headers — done:#108 ([e500796](https://github.com/samdhenderson/okta-unbound/commit/e500796))
- **D-065** — `fetchAndCacheAllGroupRules` walks a whole endpoint with no boundary schema — done:#107 ([069ef48](https://github.com/samdhenderson/okta-unbound/commit/069ef48))
- **D-066** — `groupIdsReferencedBy` carries the identical unguarded expression read `D-055` just fixed — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-068** — `createSchedulerPageRequest` drops the status the walk now has — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-069** — Two dead remnants around the app-lookup path — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-070** — `handleGetPolicyInfo`'s "mirrors handleGetAppInfo" is no longer true — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-071** — Two stale claims in `CONVENTIONS.md`'s messaging sections — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-072** — A backlog item that reserves an ADR number always loses it — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-073** — The `okta-api` skill documents rule deletion without `removeUsers` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-075** — A profile write invalidated the memberships and never re-read them — fixed 2026-08-28 on `feat/demo-org-writes` as its own commit, landed via PR #103 ([ee1ec88](https://github.com/samdhenderson/okta-unbound/commit/ee1ec88)); the ledger's own `done:#112-era` status was a label picked when the item was closed retroactively on 2026-09-02, not the PR that shipped the fix
- **D-078** — The `okta-api` skill denies a field Okta returns — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-079** — `expand=stats` embeds `hasAdminPrivlege`, spelled Okta's way — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-080** — `D-062` names two different items, and the ledger cannot tell them apart — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-081** — `RuleImpactModal`'s error state is not announced to a screen reader — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-082** — Five test fixtures build addresses on a real domain, not `example.com` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-085** — `oktaGroupRuleSchema` rejects the `INVALID` status Okta reports — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-086** — `RateLimitDetector.parseHeaders` has no `NaN` guard, so it fails open — done:#117 ([4c28cd2](https://github.com/samdhenderson/okta-unbound/commit/4c28cd2))
- **D-087** — The content script forwards the whole response header bag — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-088** — Two stale comments name `groupDiscovery` as the schema-less rules walk — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-089** — `useRuleConsolidation` never clears `RulesCache` after writing rules — done:#117 ([4c28cd2](https://github.com/samdhenderson/okta-unbound/commit/4c28cd2))
- **D-090** — `MAX_RULE_NAME` is declared twice — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-092** — Nine backlog items carry no `Status:` line, so no session can select them — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-093** — Eleven items are stranded at `claimed:` by branches that no longer exist — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-094** — A rate-limit budget of `0` still fails open, for a different reason than `D-086` — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-095** — `useRuleLifecycle` never clears `RulesCache` either — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-096** — Rule-write cache invalidation is remembered per caller, not enforced once — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-097** — `handleGetAppInfo` reads an Okta response with no zod boundary — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
- **D-103** — A bare `Expand` names no row — done:#118 ([PR #118](https://github.com/samdhenderson/okta-unbound/pull/118))
