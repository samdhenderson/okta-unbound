# ADR-0003: Adopt Prettier for formatting

- Status: Accepted
- Date: 2026-07-14

## Context

There is no formatter configured. Formatting is unmanaged, producing noisy,
inconsistent diffs and bikeshedding. ESLint is not configured as a formatter.

## Decision

Adopt **Prettier** as the single source of formatting truth. Configuration:

- Semicolons: yes
- Single quotes: yes
- Trailing commas: `all`
- Print width: 100
- Tab width: 2 (spaces)

Wire Prettier into `lint-staged` (`prettier --write`) so it runs on staged
`*.{ts,tsx,js,json,md,css}`. ESLint keeps only code-quality rules; formatting
rules that conflict with Prettier are disabled via `eslint-config-prettier`.

## Consequences

- Adds `prettier` + `eslint-config-prettier` dev deps and a `format` script.
- One-time repo-wide reformat commit (kept separate from logic changes).
- Diffs shrink and formatting stops being a review topic.
