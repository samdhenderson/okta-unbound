# ADR-0001: Record architecture decisions

- Status: Accepted
- Date: 2026-07-14

## Context

`okta-unbound` grew quickly without written decisions. Conventions live only in
people's heads (or Claude's context), so they drift. We need a lightweight,
durable record of significant choices.

## Decision

We record significant architectural and convention decisions as ADRs in
`docs/adr/`, numbered sequentially (`NNNN-title.md`). Each ADR states Context,
Decision, and Consequences. ADRs are immutable once Accepted; to change one, add
a new ADR that supersedes it.

## Consequences

- New contributors (human or Claude) can read the "why" without archaeology.
- The `docs-maintainer` agent is responsible for keeping ADRs current.
- ADRs are the source of truth for the hard rules in `CLAUDE.md`.
