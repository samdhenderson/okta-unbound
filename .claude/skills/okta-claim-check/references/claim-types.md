# The four claim classes

Each class asserts something different, so each has a different cheapest disproof and a
different characteristic way of being wrong. Classify first; the procedure follows from
the class.

---

## 1. Count claims

**Shape:** "20 hand-rolled error states, 10 loading." "45 components could collapse."
"3 structurally twin filter modules."

**What it actually asserts:** that a set has N members _and_ that all N are the same
kind of thing. The second half is the load-bearing half and is almost never checked by
whoever wrote the number.

### Procedure

1. **Reproduce the number.** Get the author's grep, or reconstruct the most plausible
   one. If your number differs from theirs, one of you is matching something the other
   is not — find out which before continuing.
2. **List the items, one per line.** Not a count. A list.
3. **Classify every item into a column** that answers the question the claim is being
   used for. If the claim is "these could all use a shared `ErrorState`", the columns
   are: _could_, _could not — mutation state_, _could not — different UX_, _not an error
   state at all_.
4. **Total the columns.** Report the classified table, not the total.

### How it fails here

The **aggregate is right and the composition is wrong.** This is the single most common
failure in this repo.

- "3 structurally twin filter modules, 366 LOC" — the 366 is exact. One of the three is
  36 lines, has no sort and no count.
- "20 hand-rolled error states, 10 loading" — actually 15 and 17, wrong in _both_
  directions, and most of the 15 were mutation state that ADR-0009's batch runner owns.

Two directions of error in one claim is the tell that nobody enumerated. A count off by
a little in one direction is a stale number; a count off in both directions is a number
that was never derived from a list.

### False positives this class attracts

- Comments and doc references matching the same grep as real code.
- Structurally different things that share a token (see substring traps in
  `tooling.md`).
- Test files and stories counted alongside production sites.

---

## 2. Equivalence claims

**Shape:** "14 verbatim copies of `makeCore()`." "These three are structural twins."
"This is a duplicate of that."

**What it actually asserts:** that the members are interchangeable _for the purpose of
the proposed merge_. Note the qualifier — two functions can be 95% identical and still
be unmergeable because of the 5%.

### Procedure

1. **Extract the thing being compared** from each site — the function body, the module,
   the component — into a normalised form.
2. **Hash them and count distinct hashes.** If the claim says "verbatim" and the count
   of distinct hashes is greater than one, the claim is already dead.
3. **Read the outliers**, not the cluster. The cluster tells you nothing; the one that
   differs tells you whether a merge is possible.
4. **Check what each member's tests pin.** Reference identity, ordering, and mutation
   are the three that silently forbid a merge. Grep the sibling test files for `.toBe(`,
   `.not.toBe(`, `toEqual` on arrays, and any assertion about input mutation.
5. **Ask whether a difference is deliberate.** Read the module docstring before calling
   a difference an inconsistency.

### Worked example

```
for f in $(grep -rl "makeCore" src/sidepanel/hooks/useOktaApi/); do
  printf "%s  %s\n" "$(awk '/const makeCore|function makeCore/,/^};/' "$f" | shasum | cut -c1-8)" "$f"
done | sort
```

Fourteen files, fourteen distinct hashes. "Verbatim" is disproved in one command.
Reading the outliers then finds the second, larger error: three of the fourteen —
`src/sidepanel/hooks/useOktaApi/core.runOperation.test.ts`,
`src/sidepanel/hooks/useOktaApi/core.getCurrentUser.test.ts`, and
`src/sidepanel/hooks/useOktaApi/core.makeApiRequest.test.ts` — build a **real** `CoreApi`
in order to test `src/sidepanel/hooks/useOktaApi/core.ts` itself. They are the subject
under test, not copies of a helper. A "deduplicate these" change would have replaced the
system under test with a mock of itself.

### Worked example: the differences that forbid a merge

Three filter modules, 366 lines total, all "the same shape":

| Module                                               | Lines | Sorts     | Blank query returns    |
| ---------------------------------------------------- | ----- | --------- | ---------------------- |
| `src/sidepanel/components/apps/appFilters.ts`        | 172   | yes       | —                      |
| `src/sidepanel/components/groups/groupFilters.ts`    | 158   | yes       | a **new array**        |
| `src/sidepanel/components/policies/policyFilters.ts` | 36    | **never** | the **same reference** |

Both blank-query behaviours are pinned:

```
expect(filterPolicies(policies, '')).toBe(policies);        // policyFilters.test.ts
expect(out).not.toBe(input);                                 // groupFilters.test.ts
```

`.toBe` and `.not.toBe` on the same question. One implementation cannot satisfy both,
and the policies module's docstring states the missing sort is deliberate — Okta returns
policies in priority order. Correct outcome: leave all three alone.

---

## 3. Reachability claims

**Shape:** "Nothing uses this." "This is a superseded pin, retire it." "Dead since the
refactor."

**What it actually asserts:** that no live path reaches the symbol — where "live" has to
be defined before the claim means anything. Production only? Production plus tests? Is a
test-only consumer alive or dead?

### Procedure

1. **Decide what counts as a consumer, out loud.** For a _production_ module, its own
   test is not a consumer. For an exported API, a test in a _different_ module is
   evidence of a contract.
2. **Grep for the symbol, then exclude the definition site and its own test files.**
   What remains is the real caller set.
3. **Run `npm run knip:production`, not `npm run knip`.** The default config counts
   tests and stories as entry points, so a module kept alive only by its own test looks
   used. The production config drops them. See `tooling.md`.
4. **Check the search itself** if the result is zero — `file -b` on the file that should
   have matched.
5. **For a test:** ask what the test pins, not what it is named. A file named
   `*.parity.test.ts` sounds like a migration artefact. Read its imports.

### Worked example

```
grep -rn "tryEvaluateRuleExpression" src | grep -v "^src/shared/ruleEvaluator"
```

One production line survives: `src/shared/utils/membershipAnalysis.ts` calls it to
attribute group membership. So `src/shared/ruleEvaluator.parity.test.ts` — proposed for
retirement as "a superseded pin from the shared-AST refactor" — holds the primary
coverage of the function on which every membership attribution depends. Its second table
genuinely did migrate when ADR-0025 retired `canEvaluateClientSide`; its _first_ table
never did. Retiring the file for the reason given would have deleted the coverage that
matters most, and ADR-0022 requires a PR note saying what stays covered — which nobody
could have written truthfully here.

### The general trap

Claims of this class are usually true for the _reason given_ and false for the _file
named_. A file can be half superseded. Check tables, exports, and describe blocks
individually, not the filename.

---

## 4. Behavioral claims

**Shape:** "`useAppsData` is the deferred re-arm." "This hook refetches on every show."
"That effect resets state on hide."

**What it actually asserts:** a mechanism. Mechanisms are readable in about thirty
seconds and are wrong in docs more often than any other class, because they get
propagated by name rather than re-read.

### Procedure

1. **Open the file. Find the guard.** Not the hook's name, not the doc's table.
2. **Identify the state the guard keys on.** A `useRef` holding the last-processed input
   is an _owed-load latch_: it refuses to re-run for an unchanged input, so a bare
   hide/show issues no request. A boolean flag cleared on hide is a _deferred re-arm_:
   it will re-run on the next show.
3. **Predict the observable difference** and check it against a test, or run it. "Does a
   bare hide/show with an unchanged target fire a request?" separates the two patterns
   completely.
4. **Check the doc for self-contradiction.** A doc that is wrong about a mechanism
   usually also states the correct mechanism somewhere else, in the general prose.

### Worked example

ADR-0018 assigned `src/sidepanel/hooks/useAppsData.ts` and
`src/sidepanel/components/AuthPoliciesTab.tsx` to "deferred re-arm". Both hold a ref to
the last-loaded target and return early when it is unchanged — the defining behaviour of
the _other_ pattern. The ADR's own warning under pattern 2 ("without the latch, 'gate on
`isActive`' silently turns every tab revisit into a refetch") describes exactly the bug
these two hooks avoid _by having a latch_. The document contradicted itself, and a
refactor was about to be built on the wrong half.

A full audit then found **five** patterns, not two. ADR-0026 records them.

### The general trap

Taxonomies in docs decay faster than the code they describe, because nothing tests a
taxonomy. Treat every "X is an instance of pattern P" as unverified until you have read
X's guard. Never propagate a classification you did not derive yourself.
