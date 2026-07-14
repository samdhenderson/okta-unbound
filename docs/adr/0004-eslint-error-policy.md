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

- **Phase 3 (done):** `no-console` moved from `off` → `warn` (was silently off).
  It flips to `error` — with a narrow exception for the dedicated `logger` util —
  once the ~324 legacy `console.*` sites are migrated to the logger.
- **After the `any` burndown (Phase 4):** `@typescript-eslint/no-explicit-any`
  → `error`.
- Track each still-pending flip here until cleared.

Once both flips land, CI (`ci.yml`) runs `eslint` with `--max-warnings=0` to gate
on zero warnings. Until then CI runs `eslint` without that flag so legacy warnings
don't block merges.

## Consequences

- New `console.*` and `any` cannot merge once each stage lands.
- Requires the logger util and zod boundary work to be complete before the
  corresponding rule flips, so the sequencing is enforced.
