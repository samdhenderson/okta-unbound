# ADR-0013: Lightweight plan-and-approval gate before bigger changes

- Status: Accepted
- Date: 2026-07-23

## Context

The ADR process (ADR-0001) captures a decision **after** it is made — it is a
durable record, not a checkpoint before work begins. Nothing in the working
agreement asks a contributor to surface a plan _before_ writing implementation code.
For small fixes that is correct: a plan gate on a one-liner is pure friction.

For larger changes the absence bites. A multi-file change or a feature pulled from
`docs/features-plan.md` / `docs/rockstar-parity-plan.md` commits to an approach, a set
of affected files, and a testing story the moment code starts landing. When that
approach is wrong or misaligned, the cost is a large diff to unwind and a review that
has to reverse-engineer intent from the code. An AI agent especially will otherwise
charge straight into implementation. Catching the disagreement at the plan stage —
files, approach, tests to check against, tests to add — is far cheaper than catching
it in review.

Claude Code already ships **plan mode**, which presents a plan and blocks edits until
it is explicitly approved. We have the mechanism; we lacked the stated expectation to
use it.

## Decision

For any change that touches **more than ~2 files**, or anything scoped from
`docs/features-plan.md` or `docs/rockstar-parity-plan.md`, **produce a short plan
first and stop for explicit go-ahead before writing implementation code.** The plan
states:

- the **affected files**,
- the **approach**,
- **which existing tests it should be checked against**, and
- **any new tests needed**.

**Small, single-file fixes are exempt.** Where relevant, use Claude Code's **plan
mode** as the enforcing mechanism — it holds edits until the plan is approved.

This gate is a **lighter-weight complement to the ADR process, not a replacement for
it.** The two operate at different times and granularities: this gate is about the
plan _before_ the work starts and applies to routine bigger changes; an ADR still
records a _significant_ decision after the fact. A change can need both, one, or
neither — many gated changes never warrant an ADR, and the gate never substitutes for
writing one when a decision is architecturally significant.

## Consequences

- Bigger changes get a cheap alignment checkpoint before a large diff exists;
  disagreements surface at the plan, not in review.
- The plan names the tests up front, reinforcing the tests-first working agreement and
  ADR-0012 (an existing test is a contract to check against, not to edit away).
- Small fixes stay frictionless — the exemption is explicit so the gate isn't applied
  where it only adds ceremony.
- This adds a habit, not tooling or CI enforcement; it lives in the working agreement
  in CLAUDE.md. It does not change when or how ADRs are written.
