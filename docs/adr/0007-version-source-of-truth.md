# ADR-0007: Single source of truth for version

- Status: Accepted
- Date: 2026-07-14

## Context

Three different version strings exist: `manifest.json` = `0.4.0`,
`package.json` = `0.4.0-beta.1`, and `src/background/index.ts` hardcodes
`'0.3.0'` (lines ~210, 221) in storage writes and update logs. They drift
independently and mislead update logic.

## Decision

`package.json` `version` is the single source of truth. The manifest version is
derived at build time (via the CRXJS/manifest pipeline), and runtime code reads
the version from a single injected constant (e.g. a Vite
`define` such as `__APP_VERSION__`) rather than hardcoding it. Remove the
hardcoded `'0.3.0'` string entirely.

## Consequences

- Bumping `package.json` version propagates everywhere.
- Background update/migration logic compares against the real version.
- No more three-way drift.
