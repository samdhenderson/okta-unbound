# ADR-0004: Tighten ESLint from warn to error

- Status: Accepted
- Date: 2026-07-14

## Context

Many rules are downgraded to `warn` or `off` in `eslint.config.js`
(`no-explicit-any`, `no-console`, `no-non-null-assertion`, `set-state-in-effect`,
`ban-ts-comment`, etc.). Warnings are ignored in practice, so the rules provide
no real protection, and there is no CI gate.

## Decision

Move rules to `error` in stages, so a rule only flips once the code that would
violate it has been cleaned up (otherwise CI breaks on legacy debt):

- **`no-console` (done):** moved `off` → `warn` → **`error`**. All ~324 legacy
  `console.*` sites are migrated to the logger; the last holdouts (the three page-
  context hooks) were rewritten during the `useOktaTabContext` merge. Exceptions:
  the dedicated `logger` util (inline `eslint-disable`) and test files (may spy on
  console) via a config override.
- **`@typescript-eslint/no-explicit-any` (pending §7):** the message/API-layer
  `any`s are burned down (60→4 intentional), but ~19 remain in the god components,
  which decompose in §7. Flip to `error` once those clear.
- Also added **`no-restricted-syntax`** (`error`) forbidding raw
  `chrome.tabs.sendMessage` (rate-limit bypass); existing holders grandfathered via
  a config override (see `eslint.config.js`).
- Track each still-pending flip here until cleared.

Once both flips land, CI (`ci.yml`) runs `eslint` with `--max-warnings=0` to gate
on zero warnings. Until then CI runs `eslint` without that flag so legacy warnings
don't block merges.

## Consequences

- New `console.*` and `any` cannot merge once each stage lands.
- Requires the logger util and zod boundary work to be complete before the
  corresponding rule flips, so the sequencing is enforced.
