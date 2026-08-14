# ADR-0022: Test lifecycle — when a test may be removed or retargeted

- Status: Accepted
- Date: 2026-08-13
- Amends: [ADR-0012](./0012-no-test-tampering.md)

## Context

ADR-0012 says an existing test may not be modified or deleted **in order to make it
pass**. That rule is sound and stays. But it was read in practice as "tests are
never removed," and that reading has cost real money.

An audit found `src/shared/utils/statusNormalizer.ts` — 396 LOC, 6 exports, **zero
production callers** — kept alive by nothing but its own 524-LOC test file. Roughly
920 LOC of module plus test, shipped and maintained, reachable from no entry point.
It was removable the whole time: deleting a test whose subject is deleted silences no
failure, so ADR-0012 never applied to it. Nobody was sure enough of that to act.

Three more situations hit the same ambiguity:

- **Duplicate coverage.** 45 components carry both a `.test.tsx` and a
  `.stories.tsx`. Since ADR-0011 every story runs as a headless-browser render test,
  so "renders / shows its label" is asserted twice in two runners. Removing one copy
  weakens nothing, but ADR-0012 read literally forbids it.
- **A vanished unit.** `hooks/useOktaApi.test.ts` is 690 LOC against a facade the
  data-layer consolidation deletes. The contract survives, relocated to the domain
  hooks. Retargeting is not deletion, but ADR-0012 offers no word for it.
- **A superseded pin.** `shared/ruleEvaluator.parity.test.ts` (863 LOC) states in its
  own header that it exists to prove a _planned_ refactor changes no outcome. That
  refactor landed. The suite now pins two APIs that only it calls.

The failure mode ADR-0012 guards is real and this repo is especially exposed to it:
PRs are squash-merged, so a weakened assertion is unrecoverable from history. The
answer is to name the legitimate cases precisely, not to loosen the rule.

## Decision

**ADR-0012's prohibition stands unchanged: a test may not be weakened to resolve a
failure.** In addition, the following are explicitly permitted, because in each the
test is not being silenced — its subject moved or vanished:

1. **Subject deleted → test deleted.** When a module, export, or component is
   removed, its co-located tests go with it. No failure is being silenced; there is
   nothing left to assert against.

2. **Duplicate coverage collapsed.** When a story and a test assert the same
   observable behavior, one may be removed. Keep the test where there is interaction
   logic; keep only the story for pure-render components.

3. **Unit retargeted.** When the unit under test is replaced rather than removed, the
   suite is **moved assertion-by-assertion** onto its replacement. Retargeting is not
   an opportunity to thin: a dropped case is a deleted case and needs its own
   justification under (1) or (2).

4. **Implementation-detail assertion removed.** An assertion that pins something
   ADR-0023 bans — a Tailwind class string, a callback's referential identity, props
   brokered to a mocked child — may be deleted outright. These assert how the code is
   built, not what it does.

**Every one of these requires a note in the PR description** naming what was removed
and what behavior remains covered. That note is the thing a reviewer checks. Without
it, the diff is indistinguishable from tampering after the squash.

**What still requires stopping and asking a human** is unchanged from ADR-0012: a
failing assertion that looks wrong. Flag it, explain why, stop.

**Behavior that legitimately changes** — as when a fix corrects a bug a test pinned as
correct — is still an assertion change under ADR-0012, still permitted, and still
must be called out. Prefer **inverting** such a case over deleting it: the inverted
case documents the fix. Land it in its own commit that changes nothing else.

## Consequences

- Dead code can now be removed without a governance argument each time. The 1,450 LOC
  the audit found unreachable is unblocked.
- The PR note becomes the reviewable artifact. "Removed 6 cases; the behavior they
  covered is asserted by `X.stories.tsx`" is checkable; a silent deletion is not.
- Reviewers still scrutinize any assertion diff with the weight of a behavior change.
  The carve-outs narrow _what needs arguing_, not _how carefully it is reviewed_.
- There is a real risk an agent over-applies carve-out (4) and deletes a meaningful
  assertion by labelling it an implementation detail. ADR-0023 exists to make that
  category greppable rather than a matter of taste.
- `npm run knip:production` (see [dead-code.md](../dead-code.md)) is the mechanism
  that finds carve-out (1) candidates; it is advisory, and a human decides.
