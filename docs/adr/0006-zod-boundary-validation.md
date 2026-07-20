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
- The `no-explicit-any` → error flip has now landed (ADR-0004): the remaining
  production `any`s are the intentional raw-payload boundaries this ADR designed
  for (`OktaUser.profile` index signature, `ApiResponse`/`MessageResponse`
  `<T = any>` defaults, `RequestResult.data`), each validated with zod before use
  and carrying a reason-annotated `eslint-disable`.

## Deferred: list-path validation (accepted future work)

Strict `parseOkta` is wired into the two single-object read paths that already
degrade gracefully (`handleGetUserInfo` → `oktaUserSchema`, `handleGetGroupInfo`
→ `oktaGroupSchema`). The multi-item / non-standard-shape paths — search
users/groups, `getUserGroups`, and the `/admin/users/search` `aaData` DataTables
shape — are **intentionally not validated yet**, and must not be wired naively:

- **Do not point the current strict schemas at a list without `.passthrough()`
  first.** `oktaGroupSchema` is a bare `z.object` with no passthrough, so parsing
  a list item **strips** `type`/`_embedded`/`lastUpdated`/`created` — silently
  zeroing member counts and misclassifying every `APP_GROUP` as `DIRECT`. That is
  silent corruption, strictly worse than throwing.
- Throwing on one sparse item would also nuke the whole result, so a list path
  needs a **resilient per-item parse** decision, not `schema.parse(array)`.
- After the §8 transport unification, each list read now flows through one shared
  side-panel request helper (`searchUsersRequest`, `getUserGroupsRequest`,
  `fetchGroupRulesRequest`) — the sensible seam to add per-item validation, once
  the schemas gain `.passthrough()` (or explicit fields).

Revisit as its own change with those two guards in place.

## Update (2026-07-20): list-path validation implemented

The deferral above is now **closed**. Both guards it required are in place, and the
list/search/membership paths validate at the content-script boundary.

- **Degrade, never crash.** A new lenient helper, `parseOktaList(itemSchema, data,
context)`, validates each row with `safeParse`, keeps the valid ones, and drops
  (does not throw on) malformed ones. A single bad row can no longer nuke an entire
  search/membership result — the highest-traffic paths fail _open_ on individual
  items, not closed on the whole response. A non-array payload logs a warning and
  returns `[]`. Logs carry only `{ context, dropped, total }` and path/code style
  metadata — never field values or PII.
- **Resilient per-item shapes with `.passthrough()`.** Two list-item schemas back
  the helper: `oktaUserListItemSchema` (`oktaUserSchema.passthrough()`) and
  `oktaGroupListItemSchema`. The group list schema deliberately **keeps `type`** and
  passes unknown fields through, so `APP_GROUP`/`BUILT_IN` classification and
  `_embedded` member counts are preserved rather than silently zeroed — the exact
  corruption this ADR warned against. `description` is normalized `null → undefined`
  to match the `OktaGroup` domain type.
- **Applied at the flagged raw `response.data` seams:** `handleSearchUsers`,
  `handleGetUserGroups`, and `fetchAllGroupMembers` now flow through
  `parseOktaList`; `handleSearchGroups` likewise. `handleGetUserDetails` (a
  single-entity read) uses strict `parseOkta` like `handleGetUserInfo`. The
  `/admin/users/search` DataTables (`aaData`) hand-parse in `handleGetUserContext`
  is a different, non-standard shape and remains out of scope.
