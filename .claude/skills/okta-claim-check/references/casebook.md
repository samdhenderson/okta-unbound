# Casebook: seven claims that did not survive a check

Seven confident factual claims about this repo, made in a cleanup plan, an ADR, and a
doc, all within one week. Each is recorded here with the claim as written, what is
actually true, the command that settled it, and what would have shipped if nobody had
looked.

They are worth reading once, in order, because the _pattern_ across them is more useful
than any single case: aggregate numbers are often right while the composition is wrong,
and grep-based counts systematically over-count.

---

## 1. "14 verbatim copies of `makeCore()`"

**Claimed** (ADR-0023): `makeCore()` is redefined verbatim in **14**
`useOktaApi/*.test.ts` files.

**Actually true:** 14 files define something called `makeCore`, but they are **11
distinct definitions** — three pairs were byte-identical to each other
(`pushGroupOps`/`ruleImpact`, `groupDiscovery`/`ruleWrites`,
`appOperations`/`policyOperations`), and the remaining eight all differed. So
"verbatim in 14" was wrong in both directions: fewer files were duplicates of
_anything_, and the duplicates that did exist were pairs, not a single family.
Eleven are variants of a test helper. The other three —
`src/sidepanel/hooks/useOktaApi/core.runOperation.test.ts`,
`src/sidepanel/hooks/useOktaApi/core.getCurrentUser.test.ts`, and
`src/sidepanel/hooks/useOktaApi/core.makeApiRequest.test.ts` — build a **real** `CoreApi`
in order to test `src/sidepanel/hooks/useOktaApi/core.ts` itself. They were never copies
of anything; they are the system under test.

**Settled by:** hashing the extracted definitions (`claim-types.md` § equivalence).
One command, 14 files, 11 distinct hashes.

**Measure the state the claim describes.** Running that hash today gives 14 distinct
results, because the consolidation has since replaced each definition with a thin
per-suite wrapper — a number that would "confirm" the disproof for the wrong reason.
The 11 above comes from `git ls-tree`/`git show` against the commit before the
change. When a claim describes the past, recover the past; see `tooling.md`
§ git archaeology.

**Would have shipped:** a shared helper substituted into three suites whose entire
purpose is to exercise the real implementation — replacing the system under test with a
mock of itself, while the suites stayed green.

**Class:** equivalence. **Tell:** the word "verbatim" is a testable assertion, and
nobody had tested it.

---

## 2. "45 components could collapse from a test+story pair to one runner"

**Claimed:** 45 components ship both a test and a story that assert the same thing; keep
one runner.

**Actually true:** **zero** could. A story without a `play` function asserts exactly two
things — it renders without throwing, and it is axe-clean. It cannot absorb a behavioural
test. Only **6 of 115** story files have a `play` function, and even those cover
different ground than their tests.

**Settled by:** `git grep -l '  play:' -- '*.stories.tsx' | wc -l`.

**Would have shipped:** the deletion of 45 behavioural test files, replaced by smoke
renders. Coverage loss invisible in the suite, because the remaining runners still pass.

**Class:** count **and** equivalence — checked as the equivalence, which kills it
outright and makes the count moot.

**Second failure inside the first:** the 45 came from `grep -l 'play:'`, which returns
17 files, not 6, because `display:` in inline style objects matches it. A 3x inflation
that was published and had to be publicly corrected. See `tooling.md` § substring false
positives.

---

## 3. "`ruleEvaluator.parity.test.ts` is a superseded pin, retire it"

**Claimed:** the file was a characterization table written to prove the shared-AST
refactor changed no outcome. The refactor landed; the pin is spent.

**Actually true:** the file has two tables. Table 2's route _was_ superseded — ADR-0025
retired `canEvaluateClientSide` and the table now reaches the grammar gate through
`parseRuleExpression` + `checkRuleNodeSupport`. **Table 1 was never superseded.** It pins
`tryEvaluateRuleExpression`, a live API with a production caller in
`src/shared/utils/membershipAnalysis.ts`, and it is the primary coverage of the most
safety-critical function in `src/shared/ruleEvaluator.ts` — the one where a wrong answer
becomes a wrong access decision.

**Settled by:** `grep -rn "tryEvaluateRuleExpression" src | grep -v "^src/shared/ruleEvaluator"`,
plus reading the file's own header, which says all of this.

**Would have shipped:** deletion of the primary coverage of membership attribution,
under an ADR-0022 carve-out ("the assertion pins something superseded") that did not
apply. ADR-0022 requires a PR note saying what stays covered; no truthful one could have
been written.

**Class:** reachability. **Tell:** a file can be _half_ superseded. The filename described
the weaker half.

---

## 4. "3 structurally twin filter modules, unify them"

**Claimed:** `appFilters`, `groupFilters`, and `policyFilters` are the same shape across
366 lines; extract one generic filter module.

**Actually true:** the 366 is exact — and useless.
`src/sidepanel/components/policies/policyFilters.ts` is 36 of those lines, has no sort
and no member count, and returns the **same array reference** for a blank query.
`filterAndSortGroups` in `src/sidepanel/components/groups/groupFilters.ts` **always
copies**. Both behaviours are pinned:

```
expect(filterPolicies(policies, '')).toBe(policies);   // policyFilters.test.ts
expect(out).not.toBe(input);                            // groupFilters.test.ts
```

`.toBe` against `.not.toBe`. No single implementation satisfies both. The policies
module's docstring also states the missing sort is **deliberate**: the Auth Policies tab
renders in the order Okta returns, which is priority order.

**Settled by:** `wc -l` on the three files, then grepping the sibling tests for
`.toBe(` / `.not.toBe(`.

**Would have shipped:** a generic module that breaks a memoized caller's reference
identity, or that sorts policies out of priority order, or both. Correct outcome: leave
all three alone.

**Class:** count, wearing an equivalence claim's clothes. **Tell:** an exact aggregate
(366) offered as evidence of similarity. An aggregate cannot show composition.

---

## 5. "Add `shared/status.ts` as the single 'error'→'danger' seam"

**Claimed:** the codebase needs one conversion point between the legacy `error` status
word and ADR-0002's `danger`.

**Actually true:** it already existed, at
`src/sidepanel/components/shared/status.ts` — and the alias it was proposed to convert
had already been fully migrated and removed. The work was done, twice over.

**Settled by:** looking for the file before proposing to create it.

**Would have shipped:** a second seam alongside the first, reintroducing the alias the
migration had just finished deleting.

**Class:** reachability, inverted — a claim that something is _absent_. The cheapest
possible check, and the one most often skipped, because "we need to add X" does not feel
like a factual claim. It is one.

---

## 6. "20 hand-rolled error states, 10 loading"

**Claimed:** 20 components hand-roll an error state and 10 hand-roll a loading state;
route them all through a shared component.

**Actually true:** **15 and 17** — wrong in _both_ directions. And composition, again,
was the real problem: most of the 15 were **mutation** state, which is ADR-0009's batch
runner's territory, not a render-time error state. Others were UI state that the proposed
shared component could never have absorbed.

**Settled by:** listing the sites and classifying each one, rather than accepting the
totals.

**Would have shipped:** a shared component adopted at roughly half its claimed call
sites, with the remainder either forced into a wrong abstraction or left behind — and a
plan item marked done while the actual inconsistency survived.

**Class:** count. **Tell:** errors in _both_ directions. A stale number drifts one way;
a number wrong in both directions was never derived from a list.

---

## 7. "Two visibility-gating patterns; `useAppsData` is the deferred re-arm"

**Claimed** (ADR-0018): two gating patterns exist, and `src/sidepanel/hooks/useAppsData.ts`
plus `src/sidepanel/components/AuthPoliciesTab.tsx` are instances of "deferred re-arm".

**Actually true:** there are **five** patterns, and both named hooks are the _other_
one — owed-load latches. Each holds a `useRef` of the last input it actually loaded and
returns early when it is unchanged, so a bare hide/show issues no request. That is the
defining behaviour of the pattern the ADR assigned them away from.

The ADR also **contradicted itself**: its warning under pattern 2 — "without the latch,
'gate on `isActive`' silently turns every tab revisit into a refetch" — describes exactly
the bug these two hooks avoid _by having a latch_.

**Settled by:** opening both files and reading the guard. Thirty seconds each. ADR-0026
records the corrected five-pattern taxonomy.

**Would have shipped:** a refactor built on the wrong taxonomy, folding latched hooks
into a re-arm abstraction and turning every tab revisit into a refetch.

**Class:** behavioral. **Tell:** the claim was a _classification_, and nothing in CI
tests a classification. Taxonomies in docs decay faster than the code they describe.

---

## What the seven have in common

1. **Every one was checkable in under five minutes.** None required a build, a run, or a
   deep read. The most expensive was `wc -l` plus two greps.
2. **Five of seven had a correct aggregate and a wrong composition.** The number was
   real; the set it described was not homogeneous.
3. **Three came from an unanchored grep.** `play:` matching `display:` is the clearest,
   but comments, doc references, and stories inflated the others.
4. **Two were wrong in a _published, immutable_ document.** ADR-0023 still says "14
   verbatim"; ADR-0018's taxonomy stood until ADR-0026 superseded it. Being written down
   — even in an ADR, even in this repo's own docs — is not evidence.
5. **Four would have destroyed something while leaving the suite green.** Deleted
   coverage, a broken reference-identity pin, a mocked-out system under test. The tests
   would not have caught any of them, because the tests were the thing being changed.

The last point is the whole argument for this gate. These are the failures CI cannot
find, because the change and the check are the same edit.
