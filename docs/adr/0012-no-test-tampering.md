# ADR-0012: Never modify or delete a test to make it pass

- Status: Accepted
- Date: 2026-07-23

## Context

Tests are the executable record of intended behavior. The most damaging failure
mode for an AI- or human-authored change is not a red suite — it is a green suite
that was made green by quietly weakening the test: deleting a failing case, relaxing
an assertion, or `it.skip`-ing the awkward one. The behavior regresses and the
safety net silently disappears.

This repo makes that failure mode especially hard to catch after the fact. PRs are
**squash-merged**, so the main-branch history collapses each PR to a single commit.
The intermediate ordering — whether a test existed and passed _before_ the
implementation change, or was edited in the same breath that "fixed" it — is not
preserved. There is no reliable way to audit test-first ordering or to tell a
legitimate test update from a tamper after the squash. The prohibition therefore has
to live as a rule enforced at authoring/review time, not something recoverable from
git archaeology.

We already say "write the test against current behavior first" for refactors
(`test-writer`, `architecture-refactor`), but nothing stated the inverse: that a
failing existing test may not be edited away.

## Decision

**An existing test is not to be modified or deleted in order to make it pass.** When
a change turns an existing test red:

- If the code is wrong, fix the code.
- If the **behavior legitimately changed**, updating the test's _setup, mocks, or
  fixtures_ to match the new inputs is acceptable — that is maintenance, not
  tampering.
- If the **assertion itself** looks wrong, do not rewrite or remove it unilaterally.
  Flag it in the PR description, explain why, and stop; a human decides.

The line is between _the observable contract_ (assertions, and the existence of a
case) and _the scaffolding around it_ (setup, mocks, fixtures). Scaffolding may move
with the behavior; the contract may not be quietly weakened to resolve a failure.

This is recorded as a CLAUDE.md hard rule and reinforced in the `test-writer` and
`architecture-refactor` agent definitions.

## Consequences

- A red existing test is a signal to investigate, never a nuisance to silence.
  "Made the suite pass" is not a sufficient PR justification for an assertion or
  deleted-case diff.
- Legitimate assertion changes still happen — when a contract genuinely changes —
  but they must be called out in the PR so a reviewer can see the contract move and
  approve it, rather than discovering it buried in a squash.
- Reviewers should scrutinize any diff that edits an assertion or removes/skips a
  test case with the same weight as a behavior change, since after squash-merge the
  two are indistinguishable from history.
