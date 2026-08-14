# ADR-0023: Test value policy — what we don't test

- Status: Accepted
- Date: 2026-08-13

## Context

The suite is 34,270 LOC of tests plus 12,345 LOC of stories against 46,840 LOC of
production code — 99.5% overhead. Volume was never the goal, but nothing in the
working agreement ever said what _not_ to test, so every convention pushed one way.

The cost is not the line count. It is that a large share of those lines assert **how
the code is built** rather than **what it does**, which makes ordinary refactoring
expensive and makes a red test an unreliable signal. Concretely, from the audit:

- `UsersTab.navigation.test.tsx:229` asserts
  `toHaveClass('max-w-7xl', 'mx-auto', 'px-6', 'py-6')` — changing layout padding
  breaks a navigation test.
- `GroupsTab.test.tsx:1336` asserts
  `Object.is(captured.props.GroupExportModal.onFetchMembers, fetchMembers)` — a test
  for `useCallback` memoization identity, not for anything a user can observe.
  `:1476` asserts two components receive the same `Map` instance.
- `GroupsTab.test.tsx:47-90` replaces five child components with `vi.mock` doubles
  that capture props into a bag; the file is 1,760 LOC against a 509-LOC component.
  `UserComparisonModal.test.tsx` is 992 LOC against a 91-LOC component (10.9×).
- `GroupListItemSignal.test.tsx:70` queries `span[style*="width"]` — an assertion
  against an inline style string.
- `tabs.test.ts:38-41` asserts a hardcoded 8-element literal array has unique ids: a
  test that can only fail if someone types the same string twice in the file next to
  it.
- 45 components carry **both** a `.test.tsx` and a `.stories.tsx`. Since ADR-0011
  every story runs as a browser render test, so "renders / shows its label" is paid
  for in two runners.
- `makeCore()` is redefined verbatim in **14** `useOktaApi/*.test.ts` files.

None of this was unreasonable in isolation. Together it is a suite that resists the
changes it exists to enable.

## Decision

The following are **not** tested. Each is greppable, so this is enforceable at review
rather than a matter of taste.

1. **No CSS class or inline-style assertions.** No `toHaveClass`, no
   `className).toContain`, no `[style*=]` selectors. Assert the user-visible
   consequence — a label, a role, an `aria-*` state, presence or absence — or let the
   story and its axe run cover the visual contract.

2. **No referential-identity assertions.** No `Object.is` on props, callbacks, or
   shared instances. Memoization is an implementation strategy; assert the behavior
   it exists to produce (a request not re-issued, a child not re-rendered) or don't
   assert it.

3. **No mocked-child prop brokering.** Do not replace a child component with a double
   in order to assert what props the parent passed it. Render the real tree and
   assert what appears. If the tree is too heavy to render, that is a signal to
   decompose the component, not to mock its children.

4. **No tests over static literal tables.** A `const` array in the same repo does not
   need a test proving its entries are unique or well-formed. Types cover shape.

5. **One runner per pure-render component.** A component whose whole contract is
   "renders these props" gets a **story**, not a story and a test. Add a `.test.tsx`
   when there is interaction, conditional state, or logic worth naming. Where both
   already exist and assert the same thing, ADR-0022(2) permits collapsing them.

6. **No copy-pasted setup.** A fixture or factory used by three or more test files
   lives in `src/test/`, not in each of them.

What this policy does **not** touch: behavior tests, interaction tests, hook tests,
boundary/validation tests, the characterization suites' genuine behavioral
assertions, and the executable contracts (`attributionParity.test.ts`). Coverage
thresholds are unchanged and remain a ratchet ([ADR-0019](./0019-coverage-threshold-recalibration.md)).

## Consequences

- Refactoring gets cheaper, which is the point: the data-layer consolidation would
  otherwise pay a tax at every mocked-child boundary it moves.
- Removing an existing assertion under (1)-(4) is authorized by
  [ADR-0022](./0022-test-lifecycle.md)(4) and needs a PR note. The two rules are
  designed to be used together — 0023 says what qualifies, 0022 says what removing it
  requires.
- Some genuine coverage will be lost when a class assertion was the only thing
  pinning a state (a `border-primary` that means "selected"). The fix is to assert
  the state properly — `aria-selected`, `aria-current`, a visible label — which is
  better coverage than the class string was.
- Enforcement is by review, not lint. A future `no-restricted-syntax` rule for
  `toHaveClass` in test files would make (1) mechanical; not worth the churn until
  the existing violations are cleared.
- `test-writer` and `component-builder` agent definitions must carry this policy, or
  they will keep generating exactly what it bans.
