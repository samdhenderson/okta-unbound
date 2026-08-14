---
name: okta-claim-check
version: 1.0.0
description: >-
  How to verify a documented claim about this codebase before acting on it —
  classifying the claim as a count, an equivalence, a reachability assertion, or a
  behavioral one; finding the cheapest disproof instead of a confirming example;
  enumerating items rather than trusting an aggregate; working around grep's silent
  blind spots and substring false positives; using knip vs knip:production and git
  archaeology correctly; and proving a test is not vacuous. Use before deleting,
  merging, unifying, retiring, or "consolidating" anything a doc, ADR, plan, or code
  comment says is safe to touch, or when asked "is this still true", "verify this
  claim", "are these actually duplicates", "is anything still using this", "check
  before I delete", "the ADR says N of these", or when implementing a cleanup item
  scoped from docs/features-plan.md or a remediation plan.
---

# Checking a claim before acting on it

## Scope and stance

A plan, an ADR, a doc, or a code comment states a fact about this repo — _"14 verbatim
copies"_, _"nothing uses this"_, _"these three are structural twins"_ — and you are
about to act on it destructively. Verify it first.

This is not general skepticism. It is a gate on the specific claim you are about to
spend, and it exists because seven such claims collapsed in one week when someone
finally looked. Five were wrong in a way that would have deleted live coverage,
broken a pinned behaviour, or built an abstraction that already existed. The
verification in each case cost one to three commands. `references/casebook.md` has all
seven with their evidence.

Two rules govern everything below.

**Look for the disproof, not the confirmation.** A confirming example proves nothing —
"14 copies" survives finding two identical ones. One counterexample ends the question.
Design every check so that it _would_ fail loudly if the claim were false.

**Verify what you are about to act on, and stop.** A failed claim is not a licence to
re-audit the neighbourhood. Check the claim, act or report, move on.

## When this gate applies

Run it when the claim is load-bearing for a destructive or committing action:

- Deleting a file, test, export, or dependency
- Merging, unifying, or "consolidating" N things into one
- Retiring a test as superseded, or a module as dead
- Implementing a cleanup item whose scope is a number in a plan
- Writing an ADR that asserts a count or a taxonomy

Skip it when the action is additive and reversible, or when the work itself requires
reading every item anyway — the reading _is_ the check.

## Step 1 — Classify the claim

Every claim is one of four kinds, and each has a different cheapest disproof. Getting
the class right is most of the work.

| Class            | Sounds like                              | Cheapest disproof                                  | How it usually fails                               |
| ---------------- | ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| **Count**        | "20 hand-rolled error states"            | Enumerate and classify each item                   | Aggregate roughly right, composition wrong         |
| **Equivalence**  | "14 verbatim copies", "structural twins" | Hash or diff them; find the one that differs       | One member differs in a way that forbids the merge |
| **Reachability** | "nothing uses this", "superseded pin"    | Grep for callers **excluding** the definition site | The one live caller sits outside the searched glob |
| **Behavioral**   | "this hook re-arms on hide"              | Read the guard; find the ref/latch                 | Taxonomy asserted from a name, never from the code |

A claim that mixes classes — "45 components could collapse from a test+story pair to
one runner" is a count _and_ an equivalence — is checked as the harder class first.
That one dies on the equivalence half: a story with no `play` function asserts only
"renders without throwing, axe-clean", so it cannot absorb a test. The count is then
irrelevant. See `docs/testing.md`.

## Step 2 — Find the disproof

Per-class procedures with worked commands are in `references/claim-types.md`. The
shapes:

**Equivalence** — normalise, hash, sort, count distinct. If the claim says "verbatim",
one command settles it:

```
for f in $(grep -rl "makeCore" src/sidepanel/hooks/useOktaApi/); do
  printf "%s  %s\n" "$(awk '/const makeCore|function makeCore/,/^};/' "$f" | shasum | cut -c1-8)" "$f"
done | sort
```

Fourteen files, fourteen distinct hashes — the word "verbatim" is gone before you have
read a single one of them. Then read the outliers: three of those files
(`src/sidepanel/hooks/useOktaApi/core.runOperation.test.ts` and its siblings) build a
**real** `CoreApi` to test `src/sidepanel/hooks/useOktaApi/core.ts` itself. They were
never copies of anything.

**Count** — list the items, classify each into a column, then total. Never report the
total you were given. Classification is where the claim dies: of the "20 hand-rolled
error states", most were mutation state, which ADR-0009's batch runner owns and the
proposed fix could never have absorbed.

**Reachability** — the definition and its own tests will match your grep. Exclude them
explicitly, then look at what is left:

```
grep -rn "tryEvaluateRuleExpression" src | grep -v "^src/shared/ruleEvaluator"
```

One line of production code survives that filter
(`src/shared/utils/membershipAnalysis.ts`), which is why
`src/shared/ruleEvaluator.parity.test.ts` is not a retired pin — its first table is the
primary coverage of the most safety-critical function in the module.

**Behavioral** — open the file and find the mechanism. A `useRef` holding the last
processed input is an owed-load latch; a boolean cleared on hide is a deferred re-arm.
Do not infer the pattern from the hook's name, and do not trust a doc's assignment: the
whole of ADR-0018's taxonomy was wrong about `src/sidepanel/hooks/useAppsData.ts`, and
contradicted itself doing so. ADR-0026 corrects it to five patterns.

## Step 3 — Enumerate; never trust an aggregate

The recurring shape in this repo is **the total is right and the composition is
wrong**. `appFilters.ts`, `groupFilters.ts`, and `policyFilters.ts` really do total 366
lines — but `src/sidepanel/components/policies/policyFilters.ts` is 36 of them, has no
sort, and has no count. Unifying on the aggregate would have destroyed two pinned
behaviours:

- `filterPolicies` returns the **same reference** for a blank query, pinned with `.toBe`
  in `src/sidepanel/components/policies/policyFilters.test.ts`
- `filterAndSortGroups` **always copies**, pinned with `.not.toBe` in
  `src/sidepanel/components/groups/groupFilters.test.ts`

One implementation cannot satisfy both. An aggregate can never show you that; a
per-item table always does.

## Step 4 — Distrust the search itself

**Silence is not evidence of absence.** A literal NUL byte inside a template string
made `src/sidepanel/hooks/useAppsData.ts` _binary_ to `grep(1)`, and grep skips binary
files **silently** — no warning, no non-zero exit. Every grep-based scan of this tree
had a blind spot on that file for months. `npm run lint:control-chars` guards that
specific byte now, but the lesson generalises: **when a search returns nothing and you
expected something, verify the search before believing it.** `file -b <path>` is the
first check — anything other than a text description means grep never read it.

**Watch for substring false positives.** `grep -l 'play:'` over the story files returns 17. `grep -l '  play:'` returns 6. The difference is `display:` in inline styles, and
the 3x inflation produced a published conclusion that then had to be publicly
corrected. Anchor on the real token: leading whitespace, `\b`, or the full declaration.

Tool-by-tool failure modes — including why `npm run knip` structurally cannot see a
module kept alive only by its own test, and what `npm run knip:production` changes —
are in `references/tooling.md`.

## Step 5 — Prove the evidence is not vacuous

When a test is your evidence that behaviour is pinned, prove the test can fail. Break
the production code, not the test:

```
# invert the guard in the source: `if (!needle) return policies;` -> `return [...policies];`
perl -e 'alarm 180; exec @ARGV' npx vitest run src/sidepanel/components/policies/policyFilters.test.ts
git checkout -- src/sidepanel/components/policies/policyFilters.ts
```

Red means the pin is real and you may not merge past it. Green means the test asserts
nothing and the "pinned behaviour" you were protecting does not exist. Never edit the
assertion to find out — that is ADR-0012 territory.

The same technique recovers ground truth a refactor erased:
`git show <commit>^:<path>` prints a file as it was _before_ a commit, which settles
"was this always like that" without a checkout or a stash.

## Step 6 — Report the outcome

**If the claim survives:** say so in one line, cite the command, and proceed. Do not
expand scope.

**If the claim fails:** stop and report four things, in this order.

1. **What the doc says** — quote it, with the file and line.
2. **What is actually true** — the corrected fact, stated as precisely as the original.
3. **The evidence** — the command and its output, so the next reader can re-run it.
4. **What should happen instead** — the revised action, or "leave alone", plus whether
   the source doc needs fixing.

Point 4 has a repo-specific fork. A **doc or plan** gets corrected in place. An **ADR
does not** — `docs/adr/README.md` holds them immutable, so a wrong ADR is superseded by
a new one, never edited. ADR-0023 still says "14 verbatim"; ADR-0026 supersedes
ADR-0018's taxonomy rather than rewriting it. Both are correct handling.

## Standing rules

- One counterexample settles an equivalence claim. Stop looking after you find it.
- Never restate a number you did not enumerate yourself.
- A grep count is a hypothesis. A classified list is evidence.
- Exclude the definition site and its own tests before believing "nothing uses this".
- If the check is more expensive than the action is reversible, do the action instead.
- A surviving claim ends the gate. This skill is not a licence to audit.

## Routing table

| If the task is…                                      | Read                                       |
| ---------------------------------------------------- | ------------------------------------------ |
| Running the check for a specific claim class         | `references/claim-types.md`                |
| Choosing between knip, knip:production, and grep     | `references/tooling.md`                    |
| A search returning suspiciously little               | `references/tooling.md` (grep blind spots) |
| Recovering what a file looked like before a refactor | `references/tooling.md` (git archaeology)  |
| Wanting the precedent for why this gate exists       | `references/casebook.md`                   |
| Deciding whether a test may be removed at all        | `docs/testing.md`, ADR-0022, ADR-0023      |
| Whether a module is genuinely unreachable            | `docs/dead-code.md`                        |
| Writing the correction up as an ADR                  | `docs/README.md` + `docs/adr/README.md`    |

## Additional resources

- `references/claim-types.md` — the four claim classes, each with its disproof
  procedure, worked commands, and the false positives that class attracts.
- `references/tooling.md` — knip vs knip:production, grep's silent binary skip and
  substring traps, `file -b`, `git show <commit>^:<path>`, and the vacuity test.
- `references/casebook.md` — the seven failed claims, each with the claim, the truth,
  the command that settled it, and the cost had it shipped.
