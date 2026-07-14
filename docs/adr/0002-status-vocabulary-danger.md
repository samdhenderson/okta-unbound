# ADR-0002: Standardize status vocabulary on `danger`

- Status: Accepted
- Date: 2026-07-14

## Context

The codebase uses two vocabularies for negative status: `error` (29 sites, e.g.
`AlertMessage`) and `danger` (8 sites, e.g. `Button`). The Odyssey design tokens
in `src/sidepanel/tailwind.css` define `--color-danger*`, not `--color-error*`.
The split forces contributors to guess which word a given component expects.

## Decision

Standardize the status/severity union on **`'success' | 'warning' | 'danger' | 'info'`**
across all components and props. `danger` (not `error`) is canonical because it
matches the design tokens. Runtime "an error occurred" messaging still uses the
English word "error" in copy; only the _type/variant identifier_ is normalized.

## Consequences

- `AlertMessage` and any component using `'error'` as a variant are migrated to
  `'danger'` (codemod in Phase 3).
- A single shared `StatusType` union is exported and reused instead of each
  component redefining its own.
- Design-system and component specs reference `danger` exclusively.
