---
name: okta-test
version: 1.0.0
description: >-
  How to write, change, and — the hard part — remove Vitest/Testing Library tests
  in Okta Unbound without tripping the test-governance ADRs or quietly destroying
  coverage. Covers where a test belongs (unit vs renderHook vs RTL vs story),
  mocking at the useOktaApi facade or a fake CoreApi instead of MSW (MSW is not
  used in this repo), the ADR-0022 removal decision procedure and its four
  legitimate carve-outs, retargeting a suite assertion-by-assertion when a unit is
  replaced, proving a new regression test is not vacuous by reverting the fix, the
  ADR-0023 list of what this repo deliberately does not test, and the mandatory
  hard-timeout wrapper for local vitest runs. Use when writing or fixing a test,
  when an existing test goes red after a change, when asked to delete, remove,
  retarget, or collapse a test or test file, when deciding whether a story can
  stand in for a test, when a vitest run hangs, or when asked "is this test still
  needed", "can I delete this test", "why is this test failing", "this test won't
  pass", or "does this component need a test or a story".
---

# Testing in Okta Unbound

## Scope and stance

Writing a new test is the easy 80%. The governance is what makes this repo
different: ADR-0012 bans weakening a test to make it pass, ADR-0022 names the only
legitimate ways to remove one, and ADR-0023 names what never gets a test in the
first place. Get the removal call wrong and you either destroy coverage silently
(ADR-0012 violation) or carry 920 dead LOC forever out of excess caution (the
`statusNormalizer.ts` case ADR-0022 exists to fix). This skill is mostly about
making that call correctly.

## Where a test goes

- **Pure logic / utils** → unit test. `ruleEvaluator`, `mfaUtils`, `auditStore`,
  `memberAnalytics` are the house bar.
- **Extracted hooks** → `renderHook`, tested directly, not through a mounted
  component.
- **Components with real behavior** → RTL test. Interactions, conditional states,
  error paths. Query by role/text, assert what the user sees.
- **Components whose whole contract is "renders these props"** → a `.stories.tsx`,
  not a test. Writing a render-only `.test.tsx` next to an existing story is
  already a policy violation at authoring time (`docs/testing.md`).

## Mock at the layer under test, never the network

The side panel makes **no `fetch` call of its own** — every Okta request goes
panel → background scheduler → content script, and the content script holds the
only `fetch` in the codebase. There is nothing for MSW to intercept, and MSW is
not used here: it was mandated by a doc for months while zero tests used it, and
the dependency and its vestigial handler array were removed
(`src/test/mocks/fixtures.ts`'s module header has the history). Mock at whichever
layer you're actually testing:

- **Component / hook tests** — mock the `useOktaApi` facade (or the specific
  operations module) returning resolved/rejected `ApiResponse` shapes.
- **`useOktaApi/*` operation tests** — pass a fake `CoreApi`. Use `makeFakeCore`
  from `src/test/factories/coreApi.ts`; pass per-suite defaults through its
  `overrides` argument rather than editing the factory's own defaults, which other
  suites rely on. Need a `runOperation` that really executes each task instead of
  the inert default? Use `sequentialRunOperation()` from the same file.
- **Scheduler / content-script tests** — `globalThis.fetch` is already a `vi.fn()`
  from `src/test/setup.ts`; set its resolved value per case.
- **Stories** — mock at the facade via `.storybook/mocks/useOktaApi.mock.ts`.

Shared fixtures (`mockUsers`, `mockGroup` in `src/test/mocks/fixtures.ts`) and any
fixture or factory used by three or more files belong in `src/test/`, not copied
per-file (ADR-0023(6)).

## The removal decision procedure

Run this whenever a test is a candidate for deletion, not just when one is red.

**Step 0 — is anything being silenced?** ADR-0012's line is between the
_observable contract_ (assertions, and the existence of a case) and the
_scaffolding around it_ (setup, mocks, fixtures). If code is wrong, fix the code.
If behavior legitimately changed, update setup/mocks/fixtures — that's
maintenance. If an assertion itself looks wrong, do not touch it: flag it in the
PR and stop. Nothing below authorizes rewriting an assertion to make it pass.

**Step 1 — does one of ADR-0022's four cases actually apply?**

1. **Subject deleted.** The module, export, or component the test exercised is
   gone. Delete the co-located test with it.
2. **Duplicate coverage collapsed.** A story and a test assert the _same_
   observable behavior. See the correction below before using this one — it is
   the one most often claimed incorrectly.
3. **Unit retargeted.** The unit under test was replaced, not removed. Move the
   suite onto the replacement **assertion-by-assertion** — see "Retargeting, done
   properly" below.
4. **Implementation-detail assertion banned by ADR-0023.** A `toHaveClass`, an
   `Object.is` identity check, a mocked-child prop capture, a test over a static
   literal table. Delete the assertion outright; see the list at the bottom of
   this file.

If none of the four apply, the test stays, red or not — investigate per Step 0.

**Step 2 — write the PR note.** Every removal under (1)-(4) needs a note naming
what was removed and what still covers the behavior. No note, and the diff is
indistinguishable from tampering once squash-merge collapses the history
(ADR-0012's Context explains why that matters here specifically).

### The correction that matters most: a story is not automatically enough

**"There's already a story" is not on its own grounds for carve-out (2).** A story
without a `play` function asserts exactly two things: it renders without
throwing, and it is axe-clean (`docs/testing.md`). It does not check that the
right text appeared, that a callback fired, or that a derived value is correct.

A 2026-08-13 audit checked all 45 components carrying both a `.test.tsx` and a
`.stories.tsx` against this question directly. **None was collapsible.** Only 6 of
115 story files have a `play` function at all, and the three of those that
overlap a same-component test still cover different ground than the test —
`AuthPoliciesTab`'s `play` expands a policy, while its test also pins
re-expansion caching and the ADR-0018 visibility deferral.

So applying carve-out (2) requires **reading the actual `play` function** (if the
story has none, stop — carve-out (2) does not apply) and naming in the PR note
specifically what it asserts and how that matches the test case being removed.
"There's a story for this component" is not that.

## Retargeting, done properly

Carve-out (3) is not licence to thin a suite. "Assertion-by-assertion" means:
before deleting the old suite, walk every one of its cases and place each
somewhere in the new suite — ported verbatim, ported with a name change, or
explicitly justified as already covered elsewhere. A dropped case is a deleted
case and needs its own justification under (1) or (2); it doesn't get a pass just
because it happened during a retarget.

A worked example: `docs/adr/0025-retire-boolean-rule-evaluation-apis.md` retired
`evaluateRuleExpression` and `canEvaluateClientSide` from `shared/ruleEvaluator.ts`
in favor of the three-valued `tryEvaluateRuleExpression`. The `describe`
block over the retired boolean APIs was deleted only after auditing all ten of
its cases: seven were already covered verbatim by the three-outcome suite, and
the three that were not were ported before the old block came out. Two of the
ported cases came out **stronger** than the originals — the boolean form had
asserted plain `false` for both "matched but conjunct false" and "could not
resolve"; retargeted onto the three-valued API they now assert
`{resolved: true, value: false}` and `{resolved: false}` respectively, the exact
distinction the module exists to preserve. Full case-by-case mapping in
`references/retargeting-worked-example.md`.

## Proving a new regression test is not vacuous

A regression test that passes before you've even applied the fix proves nothing —
it may be asserting something that was never broken, or asserting nothing at all.
Before trusting a new regression test, invert it:

1. Write the fix and the test together, confirm the suite is green.
2. Temporarily back out _only_ the fix — `git stash push -- <fixed-file>` (not the
   test file), or comment out the changed lines.
3. Re-run the single test file with the hard-timeout wrapper below. It must now
   **fail**, and fail for the reason you expect (read the assertion diff, not just
   the exit code — a test that fails on a `ReferenceError` from a bad stash isn't
   proving what you think).
4. Restore the fix — `git stash pop` — and re-run to confirm green again.

If step 3 doesn't fail, the test isn't exercising the fix; strengthen the
assertion (query a more specific role, assert the actual value, don't just assert
"no error was thrown") until it does.

## The mandatory timeout wrapper

Always wrap a local vitest run in a hard external timeout — `--testTimeout` does
not stop a render loop, since an infinite loop starves the timer that would
enforce it:

```
perl -e 'alarm 240; exec @ARGV' npx vitest run <file>
```

Then reap the runner in a **separate command, always last** — never chained
after the run and never chained before anything that still needs to happen:

```
pkill -9 -f 'node_modules/(\.bin/)?vitest'
```

`pkill -f` matches the full command line of _every_ process, so a shell
invocation that both runs vitest and pkills it matches its own parent shell and
SIGKILLs it: the rest of that command (a `git commit`, a `git checkout --`
restoring a file you mutated) silently never runs and you get a bare non-zero
exit with no output. Bare `vitest` and `node.*vitest` are both unsafe patterns —
the latter matches the pattern text in the invoking shell's own command line.
The path-anchored pattern above cannot self-match and still reaps the runner
(`node_modules/.bin/vitest`) and its worker forks
(`node_modules/vitest/dist/workers/forks.js`). It also reaps anyone else's
concurrent run, so if another agent may be testing, check
`pgrep -a -f 'node_modules/(\.bin/)?vitest'` first and kill only your own PIDs.

A hanging test file also poisons unrelated commits: the husky pre-commit hook
resolves `vitest related --run` against imports on disk. Never skip the
`storybook` project to dodge the Chromium requirement — point
`VITEST_BROWSER_EXECUTABLE` at the installed binary instead (`docs/testing.md`
has the exact invocation). The two vitest projects are defined in
`vitest.config.ts`: `unit` (jsdom, browser-free, feeds the coverage gate) and
`storybook` (headless Chromium, every story as a render test).

## What this repo deliberately does not test (ADR-0023)

Writing any of these is a policy violation, not just a style nit — greppable at
review, not a judgment call:

1. **No CSS class or inline-style assertions** — no `toHaveClass`, no
   `className).toContain`, no `[style*=]` selectors. Assert the user-visible
   consequence (a label, a role, an `aria-*` state) instead.
2. **No referential-identity assertions** — no `Object.is` on props, callbacks, or
   shared instances. Assert the behavior memoization exists to produce (a request
   not re-issued, a child not re-rendered), not the memoization itself.
3. **No mocked-child prop brokering** — don't replace a child with a double just
   to inspect what props it received. Render the real tree; if it's too heavy,
   that's a signal to decompose the component, not to mock its children.
4. **No tests over static literal tables** — a `const` array doesn't need a test
   proving its entries are unique. Types cover shape.
5. **One runner per pure-render component** — a story, not a story plus a test,
   unless there's interaction, conditional state, or logic worth naming.
6. **No copy-pasted setup** — a fixture/factory used by 3+ files lives in
   `src/test/`, not duplicated per file.

An assertion that violates (1)-(4) may be deleted outright under ADR-0022(4), with
a PR note. It's the one carve-out that doesn't require the subject to have moved
or vanished — the assertion itself is the thing being retired.

## Additional resources

- `references/retargeting-worked-example.md` — the full ruleEvaluator retirement:
  case-by-case disposition of all ten old cases, the two strengthened assertions,
  and the correction it forced onto ADR-0022 itself.
