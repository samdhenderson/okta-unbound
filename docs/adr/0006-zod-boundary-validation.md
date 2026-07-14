# ADR-0006: Validate Okta API responses at the boundary with zod

- Status: Accepted
- Date: 2026-07-14

## Context

Okta API responses are cast, not parsed: `makeApiRequest(): Promise<any>`,
`MessageRequest.body: any`, `OktaUser.profile` has `[key: string]: any`, and
there are ~72 `any`s overall. A shape change from Okta fails silently or crashes
at a random dereference. There is no runtime validation.

## Decision

Adopt **zod** to define schemas for the Okta responses the app consumes, and
validate at the content-script fetch boundary (where the raw JSON enters the
app). Inferred types (`z.infer<>`) replace hand-written `any`-laden interfaces.
Roll out hot paths first (users, groups, memberships), then broaden. After the
core paths are validated, flip `no-explicit-any` → error (ADR-0004).

## Consequences

- Adds `zod` as a runtime dependency.
- Shape drift surfaces as a clear, localized validation error instead of a
  mystery crash.
- Most of the 72 `any`s are eliminated via inferred types.
- Small per-request parse cost, acceptable for this admin tool's volume.
