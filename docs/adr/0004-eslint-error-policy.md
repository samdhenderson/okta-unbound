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
- **`@typescript-eslint/no-explicit-any` (done):** moved `warn` → **`error`**. The
  message/API-layer `any`s were burned down (60→4 intentional) and the god
  components decomposed in §7, clearing the ~19 that lived there; the last
  production holder (`BulkOperationsPanel`'s `executeBulkOperation` prop) was typed
  against the shared `BulkOperation`/`BulkOperationResult`. The 4 intentional
  survivors carry reason-annotated inline `eslint-disable`s: the `OktaUser.profile`
  index signature, the `ApiResponse`/`MessageResponse` `<T = any>` defaults, and
  `RequestResult.data` — all raw payloads validated at the zod boundary. Exceptions:
  test/setup files (mocks/fixtures) via a config override (mirrors `no-console`).
- Also added **`no-restricted-syntax`** (`error`) forbidding raw
  `chrome.tabs.sendMessage` (rate-limit bypass); existing holders grandfathered via
  a config override (see `eslint.config.js`).
- Track each still-pending flip here until cleared.

Both flips (`no-console`, `no-explicit-any`) have now landed as `error`, so a new
`console.*` or `any` fails `npm run lint` (non-zero exit) and cannot merge — the
gate is live without needing `--max-warnings=0`. The stricter `--max-warnings=0` CI
mode stays deferred until the remaining warn-level debt (`no-non-null-assertion`,
`exhaustive-deps`, `react-refresh/only-export-components`, `ban-ts-comment`,
`no-undef`, `no-unescaped-entities`, `no-unused-vars`) is cleared; until then CI runs
`eslint` without that flag so legacy warnings don't block merges.

## Consequences

- New `console.*` and `any` cannot merge once each stage lands.
- Requires the logger util and zod boundary work to be complete before the
  corresponding rule flips, so the sequencing is enforced.
