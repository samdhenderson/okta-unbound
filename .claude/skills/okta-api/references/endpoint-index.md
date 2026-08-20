# Endpoint index

Flat lookup for "which endpoint answers this". Routing metadata only — no
parameter contracts and no gotchas, so it stays scannable end to end. Follow the
_Depth_ column for anything beyond identification.

`M` marks the marker that applies to the row's detail elsewhere: `V` verified in the
okta-unbound codebase, `D` documented by Okta, `P` private/internal, `U` unverified.

Marker legend lives in `../SKILL.md`.

## Users

| Endpoint                                     | Use when                                             | Depth                       | M   |
| -------------------------------------------- | ---------------------------------------------------- | --------------------------- | --- |
| `GET /api/v1/users`                          | Listing or querying users org-wide                   | `search-filter-syntax.md`   | V   |
| `GET /api/v1/users/{id}`                     | One user's full detail                               | `users-and-mfa.md`          | V   |
| `GET /api/v1/users/me`                       | Identifying the calling admin                        | `auth-modes.md`             | V   |
| `GET /api/v1/users/{id}/groups`              | A user's memberships (no attribution, no dates)      | `groups-and-rules.md`       | V   |
| `GET /api/v1/users/{id}/factors`             | A user's enrolled MFA — 1 call per user, irreducible | `users-and-mfa.md`          | V   |
| `GET /api/v1/users/{id}/roles`               | A user's directly assigned admin roles               | `admin-and-org-surfaces.md` | D   |
| `GET /api/v1/users/{id}/appLinks`            | Apps as the user sees them                           | `apps-and-policies.md`      | U   |
| `POST /api/v1/users/{id}/lifecycle/{action}` | Activate, suspend, deactivate, unlock, reset         | `users-and-mfa.md`          | V   |
| `POST /api/v1/users`                         | Creating a user                                      | Okta docs                   | U   |
| `POST /api/v1/users/{id}`                    | Partial profile update — merge assumed, not verified | Okta docs                   | U   |

`POST /api/v1/users/{id}` stays `U` deliberately: okta-unbound now **depends** on the
merge behaviour — it ships a sparse `{ profile }` patch — but nobody has checked it
against a live org. `useOktaApi/profileOperations.ts` owns the write and documents the
full-profile fallback (strip every `mutability !== 'READ_WRITE'`) at the one function
that would implement it. See ADR-0035 (`0035-the-first-profile-write.md`); flip this row to `V` only after a real org
confirms unlisted attributes survive.

## Groups

| Endpoint                                             | Use when                                                                   | Depth                       | M   |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------- | --- |
| `GET /api/v1/groups`                                 | Group inventory; `expand=stats` for counts, `expand=app` for source        | `request-optimization.md`   | V/D |
| `GET /api/v1/groups/{id}`                            | One group's identity and type                                              | `groups-and-rules.md`       | V   |
| `GET /api/v1/groups/{id}/users`                      | Members; add `expand=group-rules` for attribution. Default `limit` is 1000 | `request-optimization.md`   | V/D |
| `GET /api/v1/groups/{id}/users/{userId}/group-rules` | Why one member is in one group (GA Jun 2026)                               | `groups-and-rules.md`       | D   |
| `PUT /api/v1/groups/{id}/users/{userId}`             | Adding a member                                                            | `groups-and-rules.md`       | V   |
| `DELETE /api/v1/groups/{id}/users/{userId}`          | Removing a member (a rule will re-add)                                     | `groups-and-rules.md`       | V   |
| `GET /api/v1/groups/{id}/roles`                      | Admin roles granted via this group                                         | `admin-and-org-surfaces.md` | D   |
| `GET /api/v1/groups/{id}/apps`                       | Apps assigned to this group                                                | `apps-and-policies.md`      | U   |

## Group rules

| Endpoint                                              | Use when                                          | Depth                 | M   |
| ----------------------------------------------------- | ------------------------------------------------- | --------------------- | --- |
| `GET /api/v1/groups/rules`                            | All rules; filter client-side for a group's rules | `groups-and-rules.md` | V   |
| `GET /api/v1/groups/rules/{id}`                       | One rule's condition and targets                  | `groups-and-rules.md` | V   |
| `POST /api/v1/groups/rules`                           | Creating a rule                                   | `groups-and-rules.md` | V   |
| `PUT /api/v1/groups/rules/{id}`                       | Editing — rule must be INACTIVE first             | `groups-and-rules.md` | D   |
| `DELETE /api/v1/groups/rules/{id}`                    | Deleting (members remain)                         | `groups-and-rules.md` | V   |
| `POST /api/v1/groups/rules/{id}/lifecycle/activate`   | Activating                                        | `groups-and-rules.md` | V   |
| `POST /api/v1/groups/rules/{id}/lifecycle/deactivate` | Deactivating (members remain)                     | `groups-and-rules.md` | V   |

There is no "rules for group X" endpoint. List all and filter.

## Apps

| Endpoint                                    | Use when                                                 | Depth                  | M   |
| ------------------------------------------- | -------------------------------------------------------- | ---------------------- | --- |
| `GET /api/v1/apps`                          | App inventory; `filter=user.id eq …` for one user's apps | `apps-and-policies.md` | V   |
| `GET /api/v1/apps/{id}`                     | App detail incl. `_links.accessPolicy`                   | `apps-and-policies.md` | V   |
| `GET /api/v1/apps/{id}/users`               | Who is assigned, and by which scope                      | `apps-and-policies.md` | V   |
| `GET /api/v1/apps/{id}/groups`              | Group assignments; `expand=group` embeds the group       | `apps-and-policies.md` | V   |
| `GET /api/v1/apps/{id}/group-push/mappings` | Push-group mappings, with status — prefer over `/groups` | `apps-and-policies.md` | D   |
| `GET /api/v1/apps/{id}/users/{userId}`      | One assignment's detail                                  | `apps-and-policies.md` | U   |

## Policies

| Endpoint                           | Use when                                  | Depth                  | M   |
| ---------------------------------- | ----------------------------------------- | ---------------------- | --- |
| `GET /api/v1/policies?type={type}` | Listing policies — `type` is **required** | `apps-and-policies.md` | V   |
| `GET /api/v1/policies/{id}`        | One policy                                | `apps-and-policies.md` | V   |
| `GET /api/v1/policies/{id}/rules`  | Its rules, in `priority` order            | `apps-and-policies.md` | V   |

Types: `ACCESS_POLICY`, `OKTA_SIGN_ON`, `MFA_ENROLL`, `PASSWORD`, `IDP_DISCOVERY`,
`PROFILE_ENROLLMENT`. Commonly 403 for non-super-admins — degrade, do not fail.

## System Log

| Endpoint           | Use when                                         | Depth           | M   |
| ------------------ | ------------------------------------------------ | --------------- | --- |
| `GET /api/v1/logs` | Anything asking _when_, _who_, or _what changed_ | `system-log.md` | D   |

90-day retention. `limit` max 1000. Distinct pagination contract — the polling
`next` link always exists.

## MFA and authenticators

| Endpoint                               | Use when                              | Depth                  | M   |
| -------------------------------------- | ------------------------------------- | ---------------------- | --- |
| `GET /api/v1/users/{id}/factors`       | Per-user enrolment (both engines)     | `users-and-mfa.md`     | V   |
| `GET /api/v1/authenticators`           | Org-level authenticator configuration | `users-and-mfa.md`     | D   |
| `GET /api/v1/policies?type=MFA_ENROLL` | What users are _required_ to enrol    | `apps-and-policies.md` | V   |

## Org and admin surfaces

| Endpoint                                      | Use when                                                                          | Depth                       | M   |
| --------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- | --- |
| `GET /api/v1/devices`                         | Device posture; `expand=user` embeds users                                        | `admin-and-org-surfaces.md` | V   |
| `GET /api/v1/zones`                           | Network zones referenced by policy rules                                          | `admin-and-org-surfaces.md` | V   |
| `GET /api/v1/idps`                            | Federation and social IdPs                                                        | `admin-and-org-surfaces.md` | V   |
| `GET /api/v1/trustedOrigins`                  | CORS/redirect allow-lists                                                         | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/behaviors`                       | Behavioural detection rules                                                       | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/eventHooks`                      | Outbound webhooks — the alternative to polling                                    | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/inlineHooks`                     | Hooks that modify flows in-flight                                                 | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/iam/roles`                       | Custom admin roles                                                                | `admin-and-org-surfaces.md` | D   |
| `GET /api/v1/mappings`                        | App↔Okta attribute mapping expressions — NOT how you find a user's profile source | `users-and-mfa.md`          | U   |
| `GET /api/v1/users/{id}/linkedObjects/{name}` | Manager/report relationships (not a profile field)                                | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/meta/types/user`                 | User types in the org                                                             | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/meta/schemas/user/default`       | Custom profile attributes + per-attribute `master`                                | `users-and-mfa.md`          | V   |
| `GET /api/v1/sessions/me`                     | Is the browser session still valid                                                | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/brands`                          | Sign-in page customisation                                                        | `admin-and-org-surfaces.md` | U   |
| `GET /api/v1/org`                             | Org metadata — stamp it into exports                                              | `admin-and-org-surfaces.md` | U   |

> **Do not reach for `/api/v1/mappings` to find a user's profile source.** It
> answers a different question — which expression populates an app-user attribute
> — and costs a list call plus a fetch per mapping. The profile source is on the
> app row already returned by
> `GET /api/v1/apps?filter=user.id eq "{id}"&expand=user/{id}`: an app whose
> `features` contain `PROFILE_MASTERING`. See `users-and-mfa.md` § Profile
> sourcing, and ADR-0037 for the bug that came of getting this wrong.

## Auth

| Endpoint                | Use when                           | Depth           | M   |
| ----------------------- | ---------------------------------- | --------------- | --- |
| `POST /oauth2/v1/token` | Minting a service-app access token | `auth-modes.md` | D   |

## Internal

| Endpoint / parameter  | Use when                                           | Tier | Depth              |
| --------------------- | -------------------------------------------------- | ---- | ------------------ |
| `/admin/users/search` | Console-label statuses; normalise before comparing | T2   | `internal-apis.md` |
| `/admin/*` deep links | Sending a human to a console page (not an API)     | —    | `internal-apis.md` |

`expand=group-rules` used to belong in this table and no longer does — Okta
documented it on 3 June 2026. Check status before treating anything here as
permanently internal; see clause zero in `internal-apis.md`.

## Covered only by link

Real surfaces this skill does not describe. Start from `doc-sources.md`.

| Surface                  | Why it is out of scope here                                   |
| ------------------------ | ------------------------------------------------------------- |
| SCIM provisioning        | A protocol in its own right, not a Management endpoint family |
| `/oauth2/*` runtime      | Authorisation servers, introspection, token lifecycle         |
| Okta Identity Governance | Separate product surface — certifications, access requests    |
| Workflows                | No Management API equivalent                                  |
| Okta Privileged Access   | Separate product surface                                      |

## Cross-cutting

Applies to nearly every row above:

- Every list endpoint paginates — `pagination-and-limits.md`.
- Every list endpoint may have a call-collapsing parameter —
  `request-optimization.md`.
- `q` / `search` / `filter` are not interchangeable — `search-filter-syntax.md`.
