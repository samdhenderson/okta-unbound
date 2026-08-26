# Nightly log

Append-only. Newest entry first. One entry per session, whether or not it
shipped a PR.

Entry format:

```
## YYYY-MM-DD

**Baseline:** green | red — <what was red, if anything>
**Items worked:** <I-NNN/D-NNN list, or "none — baseline repair only">
**PR:** <link, or "none">
**Backlog after:** <open>/<total> items — <N> IMPROVEMENTS, <N> DEBT, <N> blocked
**Notes:** <anything the next run or Sam should know>
```

---

## 2026-08-26 — three items shipped

**Baseline:** green, all nine gates, run against `main` at `ca07a02` before any
work. `type-check`; `lint` 0 errors / 155 warnings; `format:check`;
`test:coverage`; `knip:circular`; `lint:control-chars` 899 files;
`lint:cited-paths` 54 files; `test:storybook` 162 files / 1133 tests;
`build`. As the previous entry warned, `node_modules` was absent on a cold
container and `npm ci` had to run before any gate meant anything.

**Open PRs at step 2: zero.** No item ids claimed, no contended files, no
three-PR stop, no branch collision. `gh` is still unavailable in this
environment; the GitHub MCP tools stood in for it, which satisfies step 2's
requirement to distinguish in-flight work from open work.

**Items worked:** `I-003`, `D-029a`, `D-032`.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/95

**Branch:** `claude/stoic-gates-i8aob4` — harness-assigned, as `SESSION.md`
step 2 anticipates. It counts as an unattended run's branch for the three-PR cap.

**Backlog after:** 30 open / 67 total — 7 IMPROVEMENTS open (of 17), 23 DEBT
open (of 50), 6 gated (3 `blocked:`, 3 `research:awaiting-review`), plus the 3
`claimed:` by this PR. Seven new items were filed tonight, which is why the open
count rises even though three items close.

_On that count._ It is 2 higher on the DEBT side than the previous entry's
arithmetic predicts (42 + 6 filed = 48, not 50). The number above was produced by
parsing every `### D-NNN ·` heading and its `Status:` line, excluding the three
**parent headers** that carry no status of their own (`D-007`, `D-013`, `D-029`)
— so it counts 50 real items. I could not reproduce the previous entry's 42 by
any counting rule I tried, so tonight's figure is stated with its method rather
than carried forward from a number that may have been a slip. Next session:
either reproduce 50 the same way or say why not; do not average the two.

**Notes:**

_Selection._ `D-028` sorts to the top of P1 and was skipped for the **fourth**
consecutive night: it is an audit against a real Okta org, which an unattended
sandbox cannot reach. The previous entry asked for it to be re-gated
`blocked:needs-live-org`; repeating the request here rather than acting on it,
because re-gating is Sam's call. Four nights have now spent the same reasoning
on the same unreachable item.

`I-013` sorted second (P2, `IMPROVEMENTS.md`, ungated) and was **not** taken.
The item says which verb to add and where ADR-0039 puts it, but not what the
create-rule form asks for — a rule name, a condition expression, a target group.
That is design content a reviewer could disagree with after the code exists,
which is exactly `CLAUDE.md`'s plan-and-approval gate, and an unattended run has
nobody to take the go-ahead from. Left `open` and unmodified. If Sam wants it
reachable by a nightly, it needs either the form specified in the item or an
`research:awaiting-review` gate so a session writes the proposal instead.

`D-029b` was excluded not by contention but by `D-029`'s own header — "one
consumer per PR" — since `D-029a` is this PR's consumer.

_Re-verification._ All three selected items carried a `Verified:` date inside 14
days, so the `okta-claim-check` re-check was not mandated. Each **Problem** was
still spot-checked against the tree before claiming, and all three held.

_A review finding, fixed by amending._ `ui-reviewer` returned one **blocking**
item: `GroupPushSection`'s new id-only path was `text-sm` while its own named
path (`EntityLink`) is `text-xs`, putting two rows of one list a type size apart
— the exact inconsistency `docs/design-system.md` names. Fixed inside `I-003`'s
own commit per step 6, not as a fixup commit. Mechanically this needed the three
commits rebuilt, since the fix belonged to the first of three; nothing had been
pushed, so no force-push was involved. Worth recording for the next session:
`git reset --hard` is **denied** in this environment and `git rebase -i` is
unsupported, so the working route is `git reset --soft <base>` (which never
touches the working tree) followed by re-committing each item's file set against
its saved message. Save the messages with `git log --format=%B` **first**.

_`security-logging-reviewer` returned nothing blocking_, and did the useful thing
of independently checking the diff's own load-bearing claim rather than taking
it: `ruleImpact.ts` widens snapshot rows `as unknown as OktaGroupRule[]` on the
argument that `RULES_SPEC` zod-parsed them on write, and the reviewer verified
that against `snapshotSync.ts` — same schema as the fallback fetch path, so no
ADR-0006 gap. It also confirmed the origin read is an exact-match IndexedDB
index lookup, not a substring match, so `CLAUDE.md`'s hostname-parsing rule is
not in play.

_Scope beyond Files lists, all disclosed._ `D-029a` needed an origin that no
layer above it carried. Four files its **Files** list does not name were touched,
each forced by the item's own "needs one threaded from its caller":
`useOktaApi/types.ts` (one optional option), `useOktaApi.ts` (the wiring line),
`RulesTab.tsx` (one call site — that file already held `oktaOrigin`), and
`ruleImpact.test.ts`. `I-003` and `D-032` stayed inside their lists.

_Seven new items filed_ (`D-038`–`D-043`, `I-017`), none folded into tonight's
diff. Two are worth Sam's attention above the rest: **`D-038`** — the impact
preview now reads a snapshot that may be mid-walk and never checks `complete`,
so a not-yet-swept stale rule can make it _understate_ who loses access, which
is a confident wrong answer to an access question; it was raised independently
by the implementing agent and the security reviewer. **`D-039`** — `RuleCard`'s
`memo` comparator omits the group props it renders, which `I-003` turns from a
styling quirk into "the app does not know a group it does know".

_One thing not filed, deliberately._ `useOktaApi/types.ts` does not re-export
`PersistedAuditLogEntry`. It is a one-line follow-up that only matters when
something reads the audit trail from the hook layer — i.e. when `D-013c` or an
audit viewer lands — so it belongs to that work rather than to its own item.

_Also worth knowing._ Within the Rules tab, the impact preview now reads the
snapshot while the rule list still reads `RulesCache`. That is the disagreement
`D-029` exists to close and it is not newly introduced, but `D-029a` makes it
live on one screen. `D-029c`, which closes it, is `blocked:needs-human`.

---

## 2026-08-25 (second run) — three items shipped

**Baseline:** green, all nine gates. `type-check`; `lint` 0 errors / 155
warnings; `format:check`; `test:coverage` 225 files / 3199 tests;
`knip:circular`; `lint:control-chars` 896 files; `lint:cited-paths` 54 files;
`test:storybook` 161 files / 1123 tests; `build`. **The two story failures
that stopped the earlier run today are gone** — `#92` merged at 14:13Z and
repaired `RequestLogRow.stories.tsx` and `TabJumpPalette.stories.tsx` exactly
as that entry predicted it would. Note for the next session: `node_modules`
was absent on a cold container and `npm ci` had to run before any gate meant
anything; a `type-check` against a missing tree fails with
`Cannot find type definition file for 'chrome'`, which looks like a code
failure and is not one.

**Open PRs at step 2: zero.** No contention filter to apply, no three-PR
stop, and no branch collision — `#93` used `claude/stoic-gates-jlvx8n`, not
this run's branch. `gh` is not available in this environment; the GitHub MCP
tools stood in for it, which satisfies step 2's requirement to distinguish
in-flight work from open work.

**Items worked:** `D-013a`, `D-013b`, `I-002`. `D-014` closes as a side
effect of `D-013b`, as its own entry said it would.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/94

**Branch:** `claude/stoic-gates-1rt7to`, not `nightly/2026-08-25`. The
harness assigns the branch name in this environment; `SESSION.md` step 2
already anticipates that ("whatever the harness assigns in its place"). It
counts as an unattended run's branch for the three-PR cap.

**Backlog after:** 24 open / 58 total — 7 IMPROVEMENTS open (of 16), 17 DEBT
open (of 42), 6 gated (3 `blocked:`, 3 `research:awaiting-review`). Eight new
items were filed tonight (below), which is why open count rises even though
four items closed.

**Notes:**

_Selection._ The prepared list in the earlier entry was reused rather than
re-derived, since `#92`'s merge removed the only reason those items were
skipped. `D-028` sorts to the top of P1 again and was skipped again: it is an
audit against a **real Okta org**, which an unattended sandbox cannot reach.
That is now three consecutive nights spending the same reasoning on the same
unreachable item — it wants re-gating to `blocked:needs-live-org`, which is
Sam's call and not a session's.

_A deviation, resolved within the night._ `D-013a` could not ship
`actorResolution` as a required field on its own: doing so red-lines
`type-check` in `D-013b`'s three hooks, so the commit could not stand alone
or survive the per-commit hook. It shipped optional with a TypeDoc note
naming `D-013b` as the tightener, and `D-013b` tightened it. Both commits are
in this PR, so `main` never sees the optional state. Worth knowing that the
one-commit-per-item rule and a shared type change can genuinely conflict, and
that sequencing inside one PR is the way out.

_Scope beyond Files lists, all disclosed._ Four files were touched that no
item's **Files** list named, each forced rather than chosen:
`useOktaApi.ts` (+1 key — `coreApi.getCurrentUser` was never exposed on the
facade the three hooks consume, so `D-013b` was literally unreachable without
it); `auditStore.test.ts` (pinning coverage for `exportAuditLog`, which had
none, plus `actorResolution` on 12 fixtures once the field went required);
`test/factories/coreApi.ts` (`FAKE_ADMIN` must satisfy `Actor`); and
`RuleExpressionText.tsx` (a new sibling — the alternative was duplicating the
tokeniser across two call sites or pushing `ClauseChecklist.tsx` to ~350
lines).

_Reviews._ `security-logging-reviewer` and `ui-reviewer` both returned
**nothing blocking**; all findings were advisory and are in the PR body.
Worth recording that neither agent has a Bash tool in this environment, so
neither could run `git diff` — both reviewed the working tree at the named
paths instead, and both said so unprompted. That is a real limitation of
step 6 as written: a reviewer cannot see what _changed_, only what _is_. It
did not matter here because the tree and the branch head were identical, but
a future session should hand reviewers the diff as text rather than a command
they cannot run.

_A new lint warning, caught and closed._ The branch briefly took lint from
155 to 156 warnings: a new test helper needs `FileReader` (jsdom's `Blob` has
no `text()` — verified with a throwaway probe rather than assumed), and the
bare global is not in the eslint globals list. Reaching it through
`globalThis` returns the count to baseline. It was folded into `D-013b`'s
commit rather than `D-013a`'s, where it belongs, only because this
environment has no non-interactive rebase; the commit message says so.

_Eight items filed, none folded in._ `D-032` (audit rows written before
`actorResolution` contradict their own type — latent today, live the moment
`D-013c` or any audit UI reads the field), `D-033` (two docs still cite
`unknown@unknown.com`), `D-034` (`useGroupMerge` copies members with a
hand-rolled loop instead of `runOperation`), `D-035` (`currentUserSchema`
placement), `D-036` (`ClauseChecklist.tsx` now 309 lines), `D-037`
(`useOktaApi` has no explicit facade interface), `I-015` (`ClauseGroupList`
prints a raw uncopyable id, now the less capable half of the view `I-002`
cited as already correct), `I-016` (`RuleExpressionText` is consumed
cross-feature). `I-009` was **widened** rather than duplicated:
`ui-reviewer` found that `EntityLink`'s chip `aria-label` has no override
prop at all, so `I-002`'s explicit `copyIdLabel` moves that collision to the
open control rather than closing it.

_Recommended next pick._ `D-013c` is now unblocked and is the natural
follow-on — it is the third of the D-013 family and its dependency just
landed. `D-032` should be weighed first if `D-013c` will branch on
`actorResolution`, since that is exactly the read path `D-032` describes.

---

## 2026-08-25 — stopped: red baseline whose only repair sites belong to an open PR

**Baseline:** **red** — `npm run test:storybook`: 2 test files failed of 158,
2 tests of 1089. `RequestLogRow.stories.tsx > Expanded Batch` and
`TabJumpPalette.stories.tsx > Filtered`. Every other gate green:
`type-check`, `lint` (0 errors / 155 warnings, the legacy baseline),
`format:check`, `test:coverage`, `knip:circular`, `lint:control-chars`,
`lint:cited-paths` (54 tracked files).

**Items worked:** none — see below. Nothing was implemented and no ledger
item was claimed.

**PR:** none, deliberately.

**Backlog after:** 20 open / 50 total — 5 IMPROVEMENTS open (of 12), 15 DEBT
open (of 38), 6 gated (3 `blocked:`, 3 `research:awaiting-review`).
Unchanged from 2026-08-24; this session claimed nothing.

**Why the session stopped rather than repairing the baseline.**
`SESSION.md` step 1 makes a red baseline the whole night's work. Step 2's
contention filter then removes the only two files that repair could touch,
and its third hard stop ("no candidate survives the contention filter →
stop, open nothing") governs the collision. Both failing story files —
`src/sidepanel/components/RequestLogRow.stories.tsx` and
`src/sidepanel/components/TabJumpPalette.stories.tsx` — are changed by open
PR #92 (`feat/group-detail-parity`, Sam's own branch, 95 files), **and #92
already carries the correct fix for both**, reached independently and with
the same diagnosis. Repairing them here would have duplicated that commit
and guaranteed a merge conflict in two files Sam is actively editing, which
is exactly the harm the contention filter exists to prevent.

**The failures are real, not the known bystander flake.** `CONVENTIONS.md`
warns that a story-suite failure naming an untouched file is usually
`ActionBar.stories.tsx` dying on a mid-run dep-optimizer reload. That is not
this. Both were re-run **in isolation**, two files on their own, and failed
deterministically at the same two assertions — so ordering plays no part.
Both were introduced by #91 (`9c1d59c`, the current head of `main`):

- `TabJumpPalette > Filtered` asserts `'2 sections'` match the query `or`.
  #91 added `history` as a ninth section, so `or` now matches three —
  Exp**or**t, Expl**or**er, Hist**or**y. A bare count assertion rots
  silently every time a section is added, which is precisely how this broke.
- `RequestLogRow > Expanded Batch` asserts
  `getByText(/api\/v1\/groups\?limit=200/)`. The batch fixture's second
  endpoint is the _next page_ of the first (`…&after=…`), so the substring
  regex matches two spans and `getByText` throws on the ambiguity.

**What unblocks the next night — a human decision, both options Sam's.**
Merge #92 (which repairs `main` as a side effect of its last commit), or
cherry-pick that repair commit onto `main` ahead of it. Until one of those
happens, every unattended run will stop here at step 1, correctly and for
the same reason. This is the `D-017` failure mode restated: a red gate on
`main` that nobody can clear without contending with in-flight work.

**Selection that was prepared and not used**, so the next session need not
redo the analysis. Sorted per step 3 (P0→P3, UX-first on ties), with #92's
95 changed files applied as the contention filter:

- `D-028` (P1) — skipped as unreachable, not contended: it is an audit
  against a **real Okta org**, which an unattended sandbox has no access to.
  It will sort to the top of the P1 list every night and be skipped every
  night; worth Sam re-gating it (`blocked:needs-live-org`) so it stops
  costing each run the same reasoning. Left `open` — re-gating an item is a
  judgment call this session did not make on its own authority.
- `D-013a`, `D-013b` (P1, correctness) — the audit-attribution pair. Files
  disjoint from #92 and from each other. Note that `D-013a`'s "Done when"
  requires the literal `unknown@unknown.com` to be absent from all of `src/`,
  which is only true once `D-013b` lands too — they are one night's work, not
  two, and were selected as such.
- `I-002` (P2, ux) — `ClauseChecklist.tsx` and `CauseWorklistRow.tsx`, both
  clear of #92.
- `I-003` (P2, ux) — **contended**, skip: its `RuleCard.tsx` call site is in
  #92's diff, and the item says explicitly not to split off "the two easy
  ones".
- `D-029a` (P2) — `ruleImpact.ts`, clear of #92. Its caller is
  `useOktaApi.ts:180`, not `core.ts`, so the `origin` threading its
  **Done when** requires does not collide with `D-013a`.

No `Verified:` date needed re-checking — every candidate above was verified
2026-08-24, one day old against the 14-day rule.

---

## 2026-08-24 — gate-clearing session, not a nightly run

**Baseline:** **red** — `npm run lint:cited-paths` fails on
`adr-0040/org-snapshot` with six dead citations, five of them naming
`src/sidepanel/hooks/useOktaApi/pushGroupOps.ts`, which `f1e8def` deleted, and
one naming `groups/groupsCache.ts`. Reproduced by stashing all uncommitted work
and re-running on a clean head, so it is not this session's doing. Filed as
`D-030` rather than fixed here — this session was Sam-directed, not an
unattended run, and the red-baseline rule governs the latter.

**Items worked:** none implemented. Decisions recorded against `D-007`, `D-008`,
`D-013`, `D-027`, `D-029`, `I-002`, `I-003`, `I-008`, `I-012`.

**PR:** branch `docs/unblock-gated-backlog`, not yet opened.

**Backlog after:** the five manually-gated items are gone as a category. `D-008`
and `D-027` are closed as refuted/overtaken; `D-007` split into `a`/`b`/`c`,
`D-013` into `a`/`b`/`c`, `D-029` into `a`/`b`/`c`/`d`; `D-014` marked
superseded; `I-008` and `I-012` converted to `research:awaiting-review`;
`I-002` and `I-003` ungated. One new item (`D-030`). Nine items are now
claimable by a nightly that previously had none of them.

**Notes:**

**Three of the five gated items had gone stale under moving code**, which is the
finding that mattered most and the reason both ledgers now carry a `Verified:`
date and a 14-day re-check rule. `D-008` claimed `useEntityQuery.ts` had zero
production consumers; it has nine importers across eleven call sites and
ADR-0026 affirms them. A night that had picked up that P3 "cleanup" would have
deleted a hook nine surfaces depend on, and the ledger would have read as tidy
housekeeping while it happened. The lesson is narrower than "verify things":
**every one of the three was refuted by enumerating importers, and every one of
them would have survived a grep for mentions** — `D-029` named seven consumers
that only discuss `RulesCache` in prose, and one (`entityCache.ts`) that
references it in a single doc comment while never importing it.

**The Group Detail fence is lifted** (`CLAUDE.md`, `SESSION.md` step 3). No
`groups/detail/` v2 branch exists, and the directory's last change was `9ea42a3`
— a nightly, on 2026-08-20. The fence had cost `I-002` and `I-003` at least one
run each and was pushing toward shipping `I-003` two-thirds done. If Sam starts
v2, the rule goes back; it should not sit as a standing default.

**Repeat work on already-open PRs has a mechanical cause, now fixed.** Sam
reported nights redoing work that was already in an unopened-but-merged-pending
PR. The reason is in the sequence itself: an item is marked
`claimed:nightly/…` **inside the PR's own diff**, never pushed to `main`, so a
session that branches off `main` and reads the ledger sees every unmerged
night's work as `open` again. Nothing in the old step 2 said to look at the PR
list. New step 2 does exactly that, treats any `I-NNN`/`D-NNN` named in an open
PR as claimed, and **stops the session outright at three or more open nightly
PRs** — past that point the queue is the problem, not the backlog. Step 7 now
also requires every item to appear as a bare `I-NNN`/`D-NNN` token in the PR
body, because that token is what the next session greps for.

**The new step 2 was run once against reality and had to be tightened on the
spot.** Three PRs were open (#77, #78, #79) — all `feat/*` or `refactor/*`
branches naming **no backlog item at all**, so id-matching alone would have
cleared every one of them. Two contend anyway: #78 is editing inside
`src/sidepanel/components/groups/detail/` (the directory this same session
unfenced), and #77 is editing `src/sidepanel/hooks/useGroupSource.ts`, a
downstream consumer of the module `D-029d` exists to delete. So step 2 now
collects each open PR's **changed files** and treats them as contended
regardless of who opened the PR or whether it names an item. The stop rule was
also split: file contention applies to every open PR including Sam's own, while
the three-PR cap counts only PRs an unattended run would have opened.

**`research:awaiting-review` is a new status and a nightly may claim it.** The
deliverable is a Proposed ADR and the PR touches `docs/` only. `I-008`, `I-012`
and the new `D-007b` are seeded there, with target filenames named in each item
— `lint:cited-paths` cannot check a `docs/` path (`D-024`), so those filenames
are load-bearing and unverified by any gate.

**Next pick, and why:** `D-013a` and `D-029a` touch disjoint files
(`useOktaApi/core.ts` + `auditStore.ts` vs `useOktaApi/ruleImpact.ts`) and
neither has been touched by a recent nightly branch. `I-002` is the UX-first
tiebreak and is now unfenced. But **fix `D-030` first if the red gate is still
red** — the red-baseline rule makes that the whole session.

---

## 2026-08-24

**Baseline:** green — the whole ladder, run before anything was selected.
type-check 0 errors, lint 0 errors / 146 warnings, format clean, 213 test
files / 3010 tests with thresholds met, 0 cycles, control-chars clean over 839
files, cited-paths clean over 54, `test:storybook` 149 files / 1042 tests.

`node_modules` was absent again on this fresh container — fourth night
running. `npm ci` first, no diagnosis needed.

**Items worked:** `D-023`, `I-006`, `I-007`.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/75

**Backlog after:** 11 open / 38 total — 11 IMPROVEMENTS (5 open, 1 blocked, 5
done), 27 DEBT (6 open, 4 blocked, 17 done). 5 blocked (`I-008`, `D-007`,
`D-027` needs-breakdown; `D-008`, `D-013` needs-human). 3 closed tonight as
`done:#75`; 1 new item filed (`I-011`), so the open count nets down by two —
the first night it has fallen.

**Notes:**

**The branch is `claude/stoic-gates-ejqkew`, not `nightly/2026-08-24`** — the
harness assigns it and forbids pushing elsewhere, same as the 6th and 7th
runs. No other step deviated. This has now held for three consecutive nights;
`SESSION.md` step 3 still says `nightly/YYYY-MM-DD` and is worth either
amending or annotating, because a session that follows it literally is
choosing between two instructions that cannot both be obeyed.

**The 7th run's closing note picked tonight's first item, and it was right.**
It nominated `D-023` as the next pick on the grounds that `D-021` had already
laid down the parallel-writer wording in `CONVENTIONS.md`, so the diff would
be small. It was — a paragraph in each of two files. **A closing note that
names the next pick and says why is worth more than one that lists what is
left.**

**`D-023`'s filed mechanism was wrong, and it was caught only after the PR
was open.** The item says `lint-staged` stashes unstaged changes off disk for
the length of a hook run. It does not: the tree-clearing
`stash push --keep-index` branch is gated on `hideUnstaged`, which defaults
false and is not set here, so the branch that runs is `stash create` +
`stash store` — a snapshot that leaves the tree alone. The real hazard is the
failure path, `git reset --hard HEAD` in `restoreOriginalState`, which fires
on any task error and destroys an edit a live writer made after the snapshot.
The rule the item asks for is right; its reasoning was not, and `D-023`
explicitly requires the reasoning be recorded — so a wrong one is a defective
deliverable, not a cosmetic slip. Corrected in a follow-up commit rather than
by amending, since `CLAUDE.md` forbids force-pushing.
**The lesson is about what triggered the check.** The prompt was a CI-activity
wake that showed the branch's run history, which included PR #73 from
2026-08-22 — an earlier, unmerged nightly branch that had worked `D-023` and
recorded this same finding in its commit message. That PR never landed, so the
ledger never received it, and tonight's session re-derived the item from a
filing whose premise had already been disproved. **An unmerged nightly branch
is a place findings go to die. Before implementing an item, it is worth
checking whether a previous branch already attempted it** — `git log --all
--grep=<item-id>` is the cheap version. Nothing in `SESSION.md` step 2 says to
do this today.

**`D-023` is now self-enforcing, and tonight ran under it.** Writers were
serialized rather than parallelised, so the rule was never actually tested
against a live collision — but the wall-clock cost was real and the trade is
now written down where the next session reads it. Worth saying plainly: with
three small items there is nothing to parallelise anyway, and serial writers
also keep each item's vitest run off the others' heels (`D-021`'s
second-order concern). The parallel case is the one that still wants the rule.

**Routing `D-023` was the one judgment call.** `SESSION.md`'s roster sends a
`standards`-category `DEBT.md` item to `architecture-refactor`, but that row
is qualified "(dedupe, extraction)" — it describes code. `D-023`'s deliverable
was prose in `SESSION.md` and `CONVENTIONS.md`, so it went to
`docs-maintainer`. If that reading is wrong, the roster is the thing to fix:
as written it has no row for a `DEBT.md` item whose whole fix is documentation,
and there will be more of them (`D-025` is the next one).

**`I-007`'s Done-when had an escape hatch and it was worth checking.** The item
allowed "there is a deliberate reason for the current layout, so record it as a
comment instead". Three sources were checked — the module header, the two
commits touching the region, and `docs/` — and the evidence ran the other way:
the header already describes the row as "name, verdict, source line", and
`membershipVerdict.ts`'s short-label rule argues from the badge sitting beside
the name. **An escape hatch is a question, not a hint about the answer.**

**`I-006`'s constraint was the interesting part of a two-line change.** The item
says the default filter must stay `differences` and to check with Sam before
changing it. There is nobody to check with on an unattended run, so the rule is
simply "don't" — and the pre-existing tests that assert the default are what
proves it held. **When an item's guard rail says "ask Sam", an unattended
session reads it as a prohibition, not a deferral.**

**`I-002`/`I-003` skipped for a fifth consecutive night**, both still top of
the open ux list, both still reaching into `groups/detail/`. The 7th run's
suggestion stands unchanged and is now more pressing: either split `I-003`
(its two non-`detail/` sites are implementable today) or permit them by name.
Five nights is long enough that the off-limits window is now the single
biggest thing shaping what gets picked.

**What is left is genuinely cheap.** `D-012`, `D-015`, `D-022`, `D-024`,
`D-025`, `D-026` are all P3 and all small. `I-009` and `I-010` are the same
defect and the ledger says so — they should be picked **together** by one
writer, because whichever is done first silently decides the other's answer
(shared naming helper vs per-call-site convention). That is the one pairing in
the backlog a future session should not split across nights.

---

## 2026-08-23

**Baseline:** green — the whole ladder. type-check 0 errors, lint 0 errors /
146 warnings, format clean, 213 test files / 3010 tests with thresholds met, 0
cycles, control-chars clean over 839 files, cited-paths clean over 54,
`test:storybook` 149 files / 1042 tests. GitHub's run history shows `CI`
`success` on `main`'s tip (`de2ae3e`), so the local ladder and CI agree.

`node_modules` was absent again on this fresh container — third night running.
`npm ci` first. This is now reliable enough to expect rather than diagnose.

**Items worked:** `D-020`, `D-021`, `I-004`.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/74

**Backlog after:** 14 open / 37 total — 10 IMPROVEMENTS (6 open, 1 blocked, 3
done), 27 DEBT (8 open, 4 blocked, 15 done). 5 blocked (`I-008`, `D-007`,
`D-027` needs-breakdown; `D-008`, `D-013` needs-human). 3 closed tonight as
`done:#74`; 4 new items filed (`D-025`, `D-026`, `D-027`, `I-010`), so the
open count nets up by one.

**Notes:**

**The branch is `claude/stoic-gates-a5t654`, not `nightly/2026-08-23`** — the
harness assigns it and forbids pushing elsewhere, same as the 6th run. No other
step deviated.

**Two items shipped wider than their own Files list, for opposite reasons —
worth distinguishing, because the rule that governs them is not the same one.**
`D-021` gained `docs/testing.md`: that file repeats the same `pkill` recipe and
is the authority all three skill files cite as its source, so fixing four of
five copies would have left the booby-trap in the canonical doc. Same single
concern, so it belongs in that commit, not in a new item. `D-020` gained a
one-line fixture fix in `GroupsTab.test.tsx`: validating the app response turned
that suite red because its mock returned `{ label: 'Slack' }` with no `id`, a
shape real Okta never sends. That is `CLAUDE.md`'s sanctioned fixture edit, not
scope creep — but it is a test edit in a file the item never named, so it is
called out in the PR body rather than buried.
**The general lesson:** an item's **Files** list is a claim about where the
concern lives, and it can be wrong in both directions. Check it against the
Problem before handing it to a writer. (Mine was wrong here for a dumber
reason: the grep that produced `D-021`'s file list was truncated by a
`head -20`, which is how `docs/testing.md` went missing from it. Don't `head`
a grep whose whole purpose is completeness.)

**`D-020` declined its own Done-when's preferred route, and that was right.**
The item says to adopt `getAppById`. Doing so would have dropped the `low`
priority this bulk phase runs at, and discarded the HTTP `status` that
`D-019`'s test asserts by value — i.e. it would have forced deleting a field
from a live assertion, which is the ADR-0012 stop condition. The writer parsed
inline instead and recorded why in the module's `@remarks`. The consequence —
a validated single-app read the one caller who most wants it cannot use — is
filed as `D-027` rather than papered over. **A Done-when is a proposal, not an
order; when following it literally would require weakening a test, stop and say
so.** Same family as the 6th run's `D-018` lesson.

**`D-021`'s suggested pattern was wrong and only a live test caught it.** The
item proposed `pkill -9 -f 'node.*vitest'`. It still matches the invoking
shell, because the recipe's own `pkill` argument puts both words on that
shell's command line. The `[n]ode` bracket trick fails too, on any
`node_modules/…vitest` path. What works is anchoring to a command line that
_starts_ with a node binary: `^[^ ]*node[^ ]* .*vitest`. Verified on both
halves — a chained probe ran its trailing echo and exited 0, and `pgrep` found
a real runner plus its fork workers, which the kill then reaped. **A pattern
that looks obviously narrower is not evidence; run it against a live process
list.**

**`D-023` bit again, and its own mitigation held.** Three writers ran in
parallel and nothing was committed until all three reported, so no agent's
edits were stashed out from under it. That cost wall-clock — the lead sat idle
through the longest writer — but it is the cheap half of the trade. Separately,
the `D-021` writer's own live `pkill` verification fired one unscoped `pkill`
while another agent's `pushGroupOps.test.ts` run may have been alive; it
reported this unprompted rather than leaving a mystery `Killed` for someone to
misdiagnose. Nothing was lost. **That is the behaviour to keep: an agent that
reports its own possible collateral damage is worth more than one that reports
only successes.**

**`D-023` and `D-021` are two halves of one problem** (parallel writers
stepping on each other) and are now the two cheapest open items. `D-023` was
skipped tonight only because its Done-when reaches `CONVENTIONS.md`, which
`D-021` was already rewriting; it should be the next pick, and its diff will be
small now that `D-021` has laid down the parallel-writer wording.

`D-026` and `D-025` are both trivial. `D-012`, `D-015` and `D-022` remain the
cheap cleanup tail. The `I-002`/`I-003` off-limits note stands unchanged — both
still sort to the top of the open ux list and both still reach into
`groups/detail/`. That is now four consecutive nights they have been skipped
for the same reason; if Group Detail v2 is not close, they are worth either
splitting (I-003's two non-`detail/` sites are implementable today) or
explicitly permitting by name.

---

## 2026-08-21 (sixth run)

**Baseline:** green — the whole ladder. type-check 0 errors, lint 0 errors /
147 warnings, format clean, 213 test files / 2995 tests with thresholds met, 0
cycles, control-chars clean over 839 files, cited-paths clean over 50,
`test:storybook` 149 files / 1042 tests. GitHub's own run history shows the
`CI` workflow `success` on `main`'s tip (`c2d0109`), so the local ladder and
CI agree for once — worth stating, because the last two nights they did not.

`node_modules` was absent again on this fresh container. `npm ci` first; the
previous entry's note about that saved a false alarm.

**Items worked:** `D-018`, `D-019`, `D-016`.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/72

**Backlog after:** 14 open / 33 total — 9 IMPROVEMENTS (6 open, 1 blocked, 2
done), 24 DEBT (8 open, 3 blocked, 13 done). 4 blocked, unchanged (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 3 closed tonight as `done:#72`; 2 new items filed (`D-023`,
`D-024`), so the open count nets out flat at 14.

**Notes:**

**The branch is `claude/stoic-gates-w2uo22`, not `nightly/2026-08-21`.** This
session's harness assigns it a branch and forbids pushing anywhere else, which
overrides `SESSION.md`'s naming. No other step deviated. It also sidesteps a
collision that `nightly/YYYY-MM-DD` would have hit anyway — this is the sixth
run under one date.

**`D-018` would have shipped hollow if the Done-when had been read literally.**
Its text asks for the ledgers in `IN_SCOPE` and the gate green with them there.
Doing exactly that passes — and catches nothing, because `SRC_PATH_RE`'s
character class has no `:` and the ledgers cite `path.ts:311` almost
everywhere. All three dead citations the item was filed about carried a `:NN`
suffix, so the literal fix would have left the gate structurally unable to see
its own motivating examples while reporting green over four more files. That is
worse than not fixing it. **Read an item's Problem section for what the fix is
_for_, and check the Done-when can actually be satisfied non-vacuously before
handing it to a writer.** The probe that settles it is cheap: append a citation
of a nonexistent path in the form the corpus really uses, and confirm the gate
goes red.

**`D-024` is the same gap one step out** and is filed rather than folded in:
nothing outside `src/` is checked at all, including `D-018`'s own Files list.

**Two commits ran while another writer agent was still live**, because the lead
commits each item as its agent reports and the others keep working. `lint-staged`
opens every run by stashing the whole unstaged working tree and restoring it
afterwards, so those agents' edits were briefly off disk. Everything restored
cleanly and nothing was lost, but it is a live race and the failure mode is
silent. Filed as `D-023`. Until it lands: **don't commit while a writer agent is
still running**, or accept that its file may be missing under it for the length
of a `vitest related` run.

`D-021`'s `pkill` trap was avoided by instructing every agent not to run `pkill`
at all — three ran concurrently and a stray `pkill -f vitest` from any one would
have killed the others' runs and its own shell. That worked; the item is still
open and still worth fixing properly.

**A push before the review step cost a commit.** `SESSION.md` step 5 says to fix
review findings by amending the item's own commit. The `D-016` commit had
already been pushed by then, so amending it would have needed a force-push,
which `CLAUDE.md` forbids outright. The fix went in as a fourth commit with the
deviation stated in its message and the PR body. **Don't push item commits
before step 5 has run** — or accept the extra commit.

On the work itself: every claim in this PR is backed by mutation, not
inspection. `D-019`'s two log lines each go red only for their own test;
`D-016`'s branch assertions were proved by disabling the portal lookup in
`Modal.tsx` and confirming exactly the portal-configuration cases fail and zero
fallback cases do. `D-016` also turned up something the item did not mention:
the file had **no Tab-trap test at all**, despite the focus trap being part of
the contract `CLAUDE.md` names. It has one now, in both configurations.

`D-020` is the obvious next pick — it is the other half of `D-019` and the
ledger says to take them in that order. `D-021` and `D-022` are both cheap. The
`I-002`/`I-003` off-limits note from the previous entry still stands.

---

## 2026-08-21 (fifth run)

**Baseline:** green — the whole ladder, including `test:storybook` (149 files
/ 1042 tests). type-check 0 errors, lint 0 errors / 147 warnings, format
clean, 209 test files / 2962 tests with thresholds met, 0 cycles,
control-chars clean over 835 files, cited-paths clean over 50. GitHub's own
run history for `main` shows CI green on `a7b72eb`, so **`D-017` stays
closed** — its filing said to reopen it if `storybook` did not go green after
#69 landed, and it did.

One environment note that cost a false alarm: `node_modules` was absent on a
fresh container, so the first `npm run lint` died with
`Cannot find package '@eslint/js'` and the first `npm run type-check` exited
without doing anything. That is not a red baseline, it is an uninstalled
sandbox — `npm ci` first, then read the ladder. Worth checking before
diagnosing anything at step 1.

**Items worked:** `D-003`, `D-005`, `D-006`.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/70

**Backlog after:** 15 open / 31 total — 9 IMPROVEMENTS (6 open, 1 blocked, 2
done), 22 DEBT (9 open, 3 blocked, 10 done). 4 blocked, unchanged (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 3 closed tonight as `done:#70`. **5 new items filed**
(`D-018`–`D-022`), which is why the open count went up despite closing three.

**Notes:**

**The previous entry's recommended pick was wrong, and the reason is the
lesson.** It named `I-003` as the next run's second item. `I-003` cited
`src/sidepanel/components/groups/GroupPushSection.tsx`, which does not exist —
the file is at `groups/detail/GroupPushSection.tsx`. The missing `detail/`
segment is the entire question, because it is what puts the item inside the
off-limits Group Detail v2 window. A path typo in the ledger silently
promoted an ineligible item to the top of the sort, and the previous session
recommended it without ever resolving the path.

That generalises past this one item. A nightly session selects work **by the
item's Files list** — it is how disjointness is checked, how the off-limits
rule is applied, and what the writer agent is handed as its scope. A stale
path defeats all three at once. `lint:cited-paths` exists to catch exactly
this and structurally cannot: its `IN_SCOPE` predicate admits `CLAUDE.md`,
`AGENTS.md`, `docs/` and `.claude/`, and none of `DEBT.md`,
`IMPROVEMENTS.md`, `SESSION.md`, `CONVENTIONS.md` or `NIGHTLY.md`. Filed as
`D-018`; a sweep of all five ledgers found three dead citations, all in
`IMPROVEMENTS.md` (`I-003`'s, plus `I-004`'s `PolicyCard.tsx` and
`AppListItem.tsx`, which now live under `policies/` and `apps/`). All three
corrected in place tonight. **Resolve an item's paths before trusting the
sort.**

`I-002` and `I-003` were therefore both skipped as off-limits and each now
carries a note saying so, so the next run does not re-derive it. If Sam wants
`I-003` sooner, its two non-`detail/` call sites are implementable today and
the item says so.

**`CONVENTIONS.md`'s own `pkill -9 -f vitest` instruction is booby-trapped**
(`D-021`). `pkill -f` matches full command lines, so when it is chained after
a vitest run in one shell invocation, the shell's own command line contains
"vitest" and the pkill SIGKILLs its parent. Everything sequenced after it is
skipped, and the only symptom is a bare non-zero exit with no output. It bit
twice tonight, independently: the `D-005` writer had a mutation run truncated
and briefly left a mutated `useRuleImpact.ts` on disk, and the session lead
lost a `git commit` chained after it — discovered only because a follow-up
`git status` still showed the file untracked. Until `D-021` lands: **make the
`pkill` its own final command and check `git status` after any command you
chained behind one.** It gets worse the moment a night runs writers in
parallel, which `SESSION.md` step 4 permits and this one did.

On the work itself: every guard closed tonight is proven non-vacuous by
mutation, not by inspection — full table in #70. One honest limitation is
recorded in the code rather than the log: React 19 drops a `setState` aimed at
an unmounted tree silently, so the unmounted side of `useSearchWithDropdown`'s
three `isMounted` guards has no state-visible consequence and cannot be made
to go red by removing the guard. Those cases assert what is actually
observable instead, and the suite header says so.

`D-019`/`D-020` are the unfinished half of `D-003` and should be taken
together, in that order — `D-020` swaps the raw request for `getAppById`,
which changes what `D-019`'s failure paths look like, so doing them apart
means writing the logging twice.

**Recommended next pick** (P-order, disjoint Files, all outside
`groups/detail/`): `D-018` (P2 — it protects the selection step itself, and is
one predicate in a lint script), `D-021` (P2 — same argument, it protects the
verification step), then `I-004` (P3, ux, and its paths are now correct). If a
larger item is wanted instead of the two housekeeping ones, `D-016` (P2,
Modal a11y on the portal branch) is the next real one, but note its file was
touched by #68.

---

## 2026-08-21 (fourth run)

**Baseline:** red — the `storybook` CI job on `main` @ `ceddca8`. Every other
gate was clean locally (type-check 0 errors, lint 0 errors / 147 warnings,
format clean, 209 test files / 2962 tests passed with thresholds met, 0
cycles, control-chars clean over 835 files, cited-paths clean over 50). The
red one was `D-017`, and it was caught **by running `test:storybook` at
baseline** rather than by claiming the item by name as the filing suggested
would be necessary — GitHub's own run history for `main` confirmed `storybook`
failing on `808ab30` and `ceddca8` while `verify` passed on both.

Per `SESSION.md` step 1 this repair was the entire session. **No backlog items
were selected or implemented alongside it.** For the record, had the baseline
been green the sort would have opened `D-017` (P1) → `I-003` (P2, ux; `I-002`
still skipped, its files are under the off-limits `groups/detail/`) → `D-003`
(P2) — three disjoint **Files** lists. That is the next run's starting pick.

**Items worked:** `D-017` — baseline repair only.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/69

**Backlog after:** 13 open / 26 total — 9 IMPROVEMENTS (6 open, 1 blocked, 2
done), 17 DEBT (7 open, 3 blocked, 7 done). 4 blocked, unchanged (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 1 closed tonight as `done:#69`. Nothing new filed.

**Notes:**

`ActionBar.stories.tsx` is the **first** file the story run processes, not the
last — the filing had it backwards, and it matters. Vitest orders test files
largest-first and ActionBar is the biggest story file in the tree; the local
run's completion order puts it at 1 of 149. So the file that dies is simply
whatever is in flight when the dep optimizer reloads the page at startup, which
is what makes a file that imports neither `react-dom` nor `Modal` the standing
victim of a `react-dom` import added to `Modal.tsx` in #68. `D-017`'s named
fallback hypothesis ("the run's tail behaviour") is therefore the wrong place
to look if this fix does not take.

**The fix is unprovable locally and was not proven locally.** The suite passes
here with and without it — 149 files / 1042 tests green both ways, run on the
branch before and after the change. That is the second time in four nights
(`D-010` was the first) that the honest answer was "the variable is the
runner." Both times the temptation was to call the gate environmental. It was
not, either time.

`test:storybook` is now an **unconditional** baseline gate in `CONVENTIONS.md`,
with the `VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
pin it needs in this sandbox. It was previously listed as conditional on what
the diff touched, and three consecutive sessions skipped it — which is how a red
gate sat on `main` across two nights. The full-suite storybook run costs roughly
2 minutes here, and `build-storybook` about 40 seconds; neither is expensive
enough to justify the conditional.

Still true from the last entry, and it bit again: `pkill -9 -f vitest` matches
the shell running it, so a command that runs vitest and then pkills in the same
line kills itself. Keep them in separate invocations.

**Deviation from `SESSION.md`, for the record:** this session's branch is
`claude/stoic-gates-3izrje`, not `nightly/2026-08-21`. The harness that starts
these runs pins the branch name and forbids pushing anywhere else; the branch
name is the only part of the sequence that differs.

**Still unfiled, carried forward from the last entry** (it needs a look before
it is worth an item number): `UserAppsList` (`UserDetailPanel.tsx:237`) takes
the same `memberships` array as the Groups pane but gates on `isLoadingApps`
rather than `isLoadingMemberships`, so it may render membership-derived content
mid-load.

---

## 2026-08-21 (third run)

**Baseline:** green — full `CONVENTIONS.md` ladder clean on `main` @ `9ea42a3`
(type-check 0 errors, lint 0 errors / 147 warnings, format clean, 207 test
files passed with coverage thresholds met, 0 cycles, control-chars and
cited-paths clean).

**Items worked:** `D-009`, `I-005`, `I-001` — the top of the sorted list with
disjoint **Files** (P1 first, then P2 with UX ahead of debt). `I-002` was
skipped despite sorting above `I-005`: its files are under
`src/sidepanel/components/groups/detail/`, still off-limits. `I-003` sorts in
the same tie as `I-005` on every key `SESSION.md` defines; `I-005` was taken
because `I-003` carries `Depends on: I-001` and shipping a dependent item in
the same PR would mean one review objection invalidating two commits.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/68

**Backlog after:** 13 open / 25 total — 9 IMPROVEMENTS (6 open, 1 blocked,
2 done), 16 DEBT (7 open, 3 blocked, 6 done). 4 blocked (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 3 closed tonight as `done:#68`; 3 new items filed from the
review (`D-015`, `D-016`, `I-009`).

**Notes:**

**The browser story suite does run in this sandbox — future sessions should
run it.** Both writer agents reported `test:storybook` as impossible
("Playwright's browser binary is absent"), and the previous two sessions
skipped it as well. It is not absent: Chromium is pre-installed at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, and `vitest.config.ts`
already has the seam for it —
`VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:storybook`
runs the full suite (149 story files, 0 failures tonight). `npx playwright
install` is the thing that fails, and reaching for it is what made this look
unavailable. Set the env var instead; a hard CI gate should not be taken on
faith three nights running.

**`pkill -9 -f vitest` kills more than its own run.** `CONVENTIONS.md`'s test
recipe ends with `pkill -9 -f vitest` "regardless of outcome". With a writer
agent working while the session runs its own ladder, that pattern matches the
_other_ run too — three full `test:coverage` runs died at `SIGKILL` mid-suite
before the cause was clear, and the pattern also matches the invoking shell's
own command line. Worth narrowing the recipe (a PID-scoped kill, or dropping
it now that the `perl alarm` wrapper already bounds the run); filed here as a
note rather than as a backlog item because it is a change to `CONVENTIONS.md`
itself.

**Branch name deviated again, same reason as the second run.** `SESSION.md`
step 3 says `nightly/YYYY-MM-DD`; the execution environment pins this session
to `claude/stoic-gates-apffyc` and forbids pushing anywhere else, so the
`claimed:` markers named that branch. This is now two of three runs — worth
either amending `SESSION.md` or fixing the launcher, rather than logging the
same deviation every night.

**D-014 is not actually pickable.** It sorts as an open P3, but its own body
says "sequence it after `D-013`", and `D-013` is `blocked:needs-human`. A
future run following the sort mechanically will pick it up and then have to
put it back down; consider marking it `blocked:needs-D-013`.

**Recommended next pick** (P-order, disjoint files, none under
`groups/detail/`): `D-016` (P2, small, closes the coverage gap this PR
opened), then `D-003` (P2, one-line logging fix in `pushGroupOps.ts`), then
`I-003` — now unblocked, since `I-001` shipped tonight.

---

## 2026-08-21 (second run)

**Baseline:** green — full `CONVENTIONS.md` ladder clean on `main` @ `25f5e45`,
and CI's `verify` job green there too, for the first time since 2026-08-15.
D-010's fix landing with #66 did what it claimed.

**Items worked:** `D-002`, `D-001`, `D-004` as planned, plus `D-011` — filed
and closed the same night because it blocked the commit path (see below).
`D-012`, `D-013`, `D-014` filed, not worked.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/67

**Backlog after:** 13 open / 21 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 13 DEBT. 4 blocked (`I-008` needs-breakdown, `D-007`
needs-breakdown, `D-008` needs-human, `D-013` needs-human). 4 closed tonight
as `done:#67`.

**Notes:**

**Branch name deviated, and it matters for next time.** `SESSION.md` step 3
says `nightly/YYYY-MM-DD`; this run was launched into an environment that
pins its own push target and forbids pushing elsewhere, so the work is on
`claude/stoic-gates-v1ccfh`. Consequences: the ledger's `claimed:` values
named that branch, and step 2's "prefer files untouched by the last 3
`nightly/*` branches" tie-break will not see this branch. Either reconcile
`SESSION.md` with how these runs actually get launched, or widen that
tie-break's branch glob.

**Selection deviated once, deliberately.** The P1 tier was `D-001`, `D-004`,
`D-009`. `D-002` is P3, but `D-001`'s own ledger entry says to do it "before
or alongside" so `D-001` reuses the shared helper instead of adding a fourth
copy — so it was treated as part of `D-001`'s path rather than as a
priority-order jump. `D-009` (modals under `ActivityBar`) was passed over:
its "Done when" asks for a _structural_ fix across ~15 call sites and names
two viable approaches, which is exactly the plan-and-approval gate's "would a
reviewer disagree with the approach after the code exists?". It stays open
and wants a decision from Sam before a night takes it, or it will keep being
the P1 nobody picks up.

**The night's real lesson: the ladder is not the commit path.** `SESSION.md`
step 1 verifies `CONVENTIONS.md`'s ladder. That passed. What did not pass was
the pre-commit hook — `lint-staged` runs `vitest related --run --project unit`
over _staged_ files, which pulled in `App.tabpersistence.test.tsx` as related
to an unrelated staged change and went red on a clean tree. So a green
baseline by step 1's definition can still be a repo where nothing can be
committed. Consider adding a staged-commit smoke check to step 1, or noting
in `CONVENTIONS.md` that `vitest related` selects a set the ladder never runs
in isolation.

**And the same lesson as last night, from the other end.** Last night: "passes
locally, fails in CI" was speed, not environment. Tonight: "passes in the
suite, fails alone" was _also_ speed — a lazy tab chunk's `import()` against
Testing Library's 1s default `findBy*` budget, cheap only because some earlier
file in a full-suite run had already warmed it. Both times the variable was
how long a load took and both times the fix was to give a wait the budget it
always meant. Worth treating "green here, red there" as a timing question by
default.

**`test:storybook` is runnable in this sandbox** — prior sessions recorded it
as blocked on missing Playwright browsers. It needs
`VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
the default resolution looks for a build that is not installed. 149 story
files pass. If the sandbox is stable this belongs in `CONVENTIONS.md`, since
two agents tonight independently concluded the gate could not be run.

**Also worth knowing:** `pkill -9 -f vitest` (which `CONVENTIONS.md` mandates
after a local run) matches any shell whose own command line contains the
string — so a loop that runs vitest and then pkills it kills itself. It ate
several runs tonight before I spotted it, and a subagent independently lost
three full-suite runs to another agent's pkill. Run one vitest invocation per
shell command, and keep concurrent agents off it.

**Unfiled observation for Sam:** `UserAppsList` (`UserDetailPanel.tsx:237`)
takes the same `memberships` array as the Groups pane but gates on
`isLoadingApps` rather than `isLoadingMemberships`, so it may render
membership-derived content mid-load. Noticed while wiring `D-001`, not
investigated, not filed — it needs a look before it is worth an item number.

---

## 2026-08-21

**Baseline:** red — `npm run test:coverage` failed intermittently in a full-suite
run: `UsersTab.navigation.test.tsx > hides the profile body without unmounting
it, so its state survives` (passed every time run in isolation; failed
identically on 2 consecutive full-suite runs). Root cause: the tab-level user
search debounce was gated only on `isActive`, not on `nav.isRoot` — a query
typed just before navigating into a user's detail/comparison rung could still
commit after the push and clear `selectedUser`, unmounting both rungs. Fixed
by gating the debounce on `nav.isRoot && isActive`, mirroring the comparison
rung's own `searchEnabled` gate. Per `SESSION.md`, this repair was the whole
session — no backlog items were selected or implemented.

**Items worked:** baseline repair, plus `D-010` (filed _and_ closed tonight —
the pre-existing CI failure; picked up mid-session on Sam's instruction).
**PR:** https://github.com/samdhenderson/okta-unbound/pull/66
**Backlog after:** 14 open / 18 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 10 DEBT (6 correctness, 2 cleanup, 2 standards). 3
blocked (`I-008` needs-breakdown, `D-007` needs-breakdown, `D-008`
needs-human) — unchanged from the prior entry; `D-010` was filed tonight and
closed the same night as `done:#66`.
**Notes:** `test:coverage` is green on `main` again once PR #66 lands.
Separately — PR #66's GitHub Actions `verify` check came back red even
though the local ladder was green twice. Confirmed via GitHub's own run
history that `main`'s `verify` job had been failing identically on every
push since at least 2026-08-15 (4 commits), including on PR #66's own
unmodified base commit — pre-existing, not introduced by PR #66. Filed as
`D-010`, then (on Sam's instruction, mid-session) diagnosed and fixed it in
the same PR rather than leaving it for a later night.

The "only reproduces on GitHub" framing turned out to be wrong, and that
mattered: the failures don't depend on GitHub at all, only on the membership
fetch being slow. Injecting a delay into the `/users/{id}/groups` route
reproduces the same 5 failures locally and deterministically. Root cause was
a **wait that never waited** — `await findByText('Engineering')` resolved
against the user's `department` (the fixture uses `Engineering` for both the
department and the group name, and all three detail panes stay mounted per
ADR-0018), so it returned while zero `<h4>`s existed and the row lookup
raced the load. A probe pinned this exactly: matched node was a `SPAN` in a
`<dd>`, one `Engineering` node total, `queryAllByRole('heading', {level: 4})`
empty. The second symptom was a genuine production bug — two uncancelled
`setTimeout`s in `useRulesData.ts` firing `completeProgress()` after unmount.
**Lesson for future nights:** "passes locally, fails in CI" is a hypothesis,
not a diagnosis — find the variable CI actually changes (here: speed) and
reproduce on it locally before calling something environmental.

Re-verify the baseline is still green at the start of the next session before
picking up backlog items. The previous entry's recommended starting items
(`D-001`, `D-009`, `I-005`) are still the reasonable next pick — none of
tonight's diff touches their files.

---

## 2026-08-20 — system setup, not a work session

**Baseline:** green.

```
npm run type-check          # 0 errors
npm run lint                # 0 errors, 147 warnings (legacy debt, allowed)
npm run format:check        # clean
npm run test:coverage       # green — thresholds: lines 75 / fn 70 / branch 65 / stmt 75
npm run knip:circular       # 0 cycles
npm run lint:control-chars  # clean, 825 tracked files
npm run lint:cited-paths    # clean, 49 tracked docs/skill files
```

`npm run knip` / `knip:production` (advisory) show a modest backlog, mostly
barrel duplicate-exports on `export/descriptors/*` — not itemized in
`DEBT.md` tonight, low severity, re-triage if it grows. `test:storybook` and
`build` were not run tonight (browser/bundle cost) — both are hard CI gates
and belong in every future session that touches UI or entry points, per
`CONVENTIONS.md`.

**Items worked:** none — this session built the system itself
(`CONVENTIONS.md`, `IMPROVEMENTS.md`, `DEBT.md`, this file, `SESSION.md`,
the `.claude/agents/bugfix.md` agent, and the nightly rules section in
`CLAUDE.md`). No product code changed.

**PR:** none — setup lives on `setup/nightly-system` for Sam's review, not
merged.

**Backlog after:** 14 open / 17 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 9 DEBT (6 correctness, 2 cleanup, 1 standards).
3 blocked (`I-008` needs-breakdown, `D-007` needs-breakdown, `D-008`
needs-human) — none of the 14 open items are blocked.

**Notes for the first real night:** don't touch
`src/sidepanel/components/groups/detail/` beyond what `D-001`/`D-002`
require — Sam is about to start his own v2 of Group Detail and asked for it
left alone otherwise. Recommended starting items (P-order, disjoint files):
`D-001`, `D-009`, `I-005`. Full reasoning in the setup session's final report
to Sam, not repeated here — this log only tracks what actually ran.
