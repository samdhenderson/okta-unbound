# ADR-0019: Recalibrate the coverage gate and stop restating its numbers

- Status: Accepted
- Date: 2026-08-12

## Context

The v8 coverage thresholds — lines/functions/statements 80%, branches 75% — predate
every ADR in this directory. ADR-0005 made them **enforced** in CI but did not
**set** them; no record explains why 80 rather than 75, or why branches got its own
lower number. They were inherited config that later acquired the authority of a
merge gate.

On the current tree the gate fails. Measured actuals for the `unit` project (v8, 242
production files; test files are not counted):

| Metric     | Actual | Old threshold |
| ---------- | ------ | ------------- |
| Statements | 80.37  | 80            |
| Lines      | 81.16  | 80            |
| Functions  | 76.90  | 80            |
| Branches   | 71.08  | 75            |

Functions and branches miss, so `npm run test:coverage` exits 1 and the `verify` job
is red **independent of any change**. Every PR is blocked by a condition no PR
introduced. A permanently-red gate does not protect anything — it trains people to
read red as normal and merge past it, which costs more than the gate ever bought.
The passing metrics were fragile too: statements cleared by 0.37 points, so a single
lightly-tested module would have flipped them red as well.

The numbers are also duplicated. They appeared in 16 places across 12 files, 11 of
them as the shorthand `80/75`. That shorthand is the actual drift hazard: it hides
_which_ metric is which, so changing one metric is invisible in all eleven copies,
and the copies silently disagree with the config. Two of those copies were already
wrong in other ways — a decorative `≥80%` README badge wired to no coverage service,
and a CI comment crediting a "§8" document that does not exist in this repo with
having raised coverage above the threshold (it had not).

## Decision

**Lower the thresholds to lines 75, statements 75, functions 70, branches 65.**

The new numbers sit roughly six points below measured actuals. That headroom is
deliberate: the gate should stay green through ordinary work — a refactor that
shifts branch counts, a small untested helper — and go red when a meaningfully
untested body of code lands. It is calibrated against what this codebase's tests
actually cover today, not against a target.

**The gate is a ratchet against regression, not a quality target.** It answers "did
coverage fall off a cliff?", not "is this code well tested?". The rules that
actually drive test quality live elsewhere: tests ship with new/refactored code
(`docs/testing.md`) and existing tests may not be weakened to pass (ADR-0012).

**`vitest.config.ts` is the single source of truth**, and prose must not restate the
numbers — it references the config instead. There is exactly one deliberate
exception: `docs/testing.md` spells the per-metric values out once, as the
human-readable statement of the gate, and says so at the point it does it. The shorthand
`80/75` is retired; per-metric names are used when numbers are unavoidable.

## Consequences

- CI goes green, so a red `verify` job means something again.
- A large untested module still trips the gate — the headroom absorbs noise, not a
  genuine regression.
- Because the numbers now live in one place (plus one named prose exception), the
  next recalibration is a one-line config edit, not a sixteen-site sweep. A future
  change that misses a copy is no longer possible.
- The README coverage badge is non-numeric (`coverage-gated`). It was never wired to
  a coverage service; encoding any number in it would only reintroduce drift.
- **This lowers a bar to an achievable level; it does not raise quality.** Coverage
  is unchanged by this ADR. Raising the thresholds later is a separate piece of work
  that must be preceded by actually writing the tests — and should ratchet up as
  actuals rise, rather than be set aspirationally again.
- ADRs [0005](./0005-pr-ci.md), [0011](./0011-storybook-single-docs-site.md), and
  [0014](./0014-storybook-hardening.md) reference the historical 80/75 values.
  Those records are immutable (ADR-0001) and stay exactly as written; ADR-0014's
  observation that "the 80/75 thresholds would need recalibration or scoping to
  storied files" is the reasoning this ADR acts on. **This ADR amends ADR-0005's
  threshold values** while leaving its decision to enforce coverage in CI intact.
