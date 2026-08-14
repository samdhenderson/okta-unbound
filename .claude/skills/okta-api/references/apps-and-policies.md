# Apps and policies

Apps are where access becomes visible; policies are where it becomes conditional.
Answering "who can get into this app, and what must they prove" needs both, because
assignment and enforcement are separate systems.

Marker legend lives in `../SKILL.md`.

## Apps

```
GET /api/v1/apps?limit=200                        # inventory
GET /api/v1/apps?q={query}&limit=20               # type-ahead
GET /api/v1/apps/{appId}                          # detail
GET /api/v1/apps/{appId}/users?limit=200          # assigned users
GET /api/v1/apps/{appId}/groups?limit=200         # assigned groups
GET /api/v1/apps?filter=user.id eq "{userId}"&limit=200   # one user's apps
```

`[verified: useOktaApi/appOperations]`

Useful list-row fields: `id`, `name` (the app _type_, e.g. `salesforce`), `label`
(the admin-visible instance name), `status`, `signOnMode`, `created`, `lastUpdated`.
`[verified: shared/schemas/okta → oktaAppListItemSchema]`

**`name` and `label` are different, and reports want `label`.** `name` identifies
the catalogue app type and repeats across instances; `label` is what an admin
recognises. Two Salesforce instances share a `name` and differ by `label`.

`status` is `ACTIVE` or `INACTIVE`. An `INACTIVE` app keeps its assignments — the
same assigned-versus-usable distinction as suspended users. `[docs]`

`signOnMode` (`SAML_2_0`, `OPENID_CONNECT`, `BOOKMARK`, `SECURE_PASSWORD_STORE`,
`AUTO_LOGIN`, …) determines which policy surface governs the app and whether
credentials are federated or stored. `[docs]`

Validate app rows leniently. `_links` and `_embedded` vary widely by app type, and
strict validation of those blocks drops whole apps from an inventory — a silent
under-report. Require `id`; let the rest pass through.
`[verified: shared/schemas/okta]`

### Two ways a user gets an app

**Direct** — assigned to the user. **Group-derived** — assigned to a group the user
is in. Assigning a group assigns the app to every member, and those app-user records
carry `scope: 'GROUP'`. `[docs]`

Read scope cheaply with `expand=user/{userId}`:

```
GET /api/v1/apps?filter=user.id eq "{userId}"&limit=200&expand=user/{userId}
```

Each app gains `_embedded.user` carrying the app-user record and its `scope`.

**The trap, restated because it silently inverts a conclusion:** Okta reports a
**single** `scope` per app-user and prefers `USER`. `scope: 'USER'` means "has a
direct assignment", **not** "direct only". A user assigned both directly and via a
group reports `USER`, and the group path is invisible.
`[verified: shared/schemas/okta → extractAppAssignmentScope]`

To establish that a user has _no_ group-derived path — the question that actually
matters before revoking a direct assignment — intersect the app's group assignments
with the user's groups:

```
GET /api/v1/apps/{appId}/groups?limit=200
GET /api/v1/users/{userId}/groups?limit=200
```

Removing the direct assignment while a group path exists changes nothing about the
user's access. Reports that skip this step produce revocations that quietly fail.

### App groups and push

```
GET /api/v1/apps/{appId}/groups?limit=200&expand=group
```

`expand=group` embeds the full group object per assignment, removing one lookup per
row. `expand=metadata` embeds assignment metadata. `[docs]`

Rows carry `id` (the group id), `priority`, and a `profile` whose contents depend on
the app. `[verified: shared/schemas/okta → oktaAppGroupSchema]`

**This listing carries no activation status for push-group mappings.** Presence is
not proof that a mapping is active; do not report it as such.
`[verified: useOktaApi/pushGroupOps]`

For push groups specifically, prefer the dedicated documented API, which exists
precisely because `/apps/{appId}/groups` could not answer the question: `[docs]`

```
GET /api/v1/apps/{appId}/group-push/mappings
```

Older tooling infers push mappings from the group assignment listing because this
endpoint did not exist. Use it for anything push-related now.

Note the direction: an `APP_GROUP` is a group _sourced from_ an app, while an app
group assignment grants an app _to_ a group. They are unrelated, and confusing them
inverts the access story. See `groups-and-rules.md`.

### App users

```
GET /api/v1/apps/{appId}/users?limit=200
```

Rows carry `id`, `status`, `scope`, `syncState`, `created`, `lastUpdated`, and
`credentials.userName` — the identity the user presents _to that app_, which is
frequently not their Okta login. Report both when they differ.
`[verified: shared/schemas/okta → oktaAppUserSchema]`

## Policies

```
GET /api/v1/policies?type={POLICY_TYPE}&limit=200
GET /api/v1/policies/{policyId}
GET /api/v1/policies/{policyId}/rules
```

**`type` is required.** There is no "list all policies" call; enumerate by iterating
the types. `[verified: useOktaApi/policyOperations → OKTA_POLICY_TYPES]`

| `type`               | Governs                                               |
| -------------------- | ----------------------------------------------------- |
| `ACCESS_POLICY`      | App sign-on / authentication policy (Identity Engine) |
| `OKTA_SIGN_ON`       | Global Okta sign-on policy                            |
| `MFA_ENROLL`         | Authenticator (MFA) enrolment policy                  |
| `PASSWORD`           | Password requirements                                 |
| `IDP_DISCOVERY`      | Routing rules to identity providers                   |
| `PROFILE_ENROLLMENT` | Self-service registration                             |

`[docs]`

`MFA_ENROLL` is the policy type whose **name did not change** across the Identity
Engine transition even though the concept did: the Admin Console calls it the
authenticator enrolment policy, and its `settings` contain _authenticators_ on
policies created after the upgrade but _factors_ on ones created before. Handle
both shapes. `[docs]`

**Policy endpoints are commonly 403 for non-super-admins.** Treat a policy read as
optional enrichment: degrade to "policy unknown" rather than failing the report. A
group or app report that dies on a policy 403 is more broken than one that omits the
policy column. `[verified: useOktaApi/policyOperations]`

Policy `conditions` and `actions` shapes vary substantially by type. Validate
loosely and read defensively — a schema tight enough for `ACCESS_POLICY` will drop
`PASSWORD` rules entirely. `[verified: shared/schemas/okta → oktaPolicyRuleSchema]`

Rules are ordered by `priority` and evaluated in order; the first match wins, and a
`system` rule is Okta-managed. Reporting a policy's effect means reporting its rules
**in priority order** — an unordered list misrepresents which one applies.

### Finding the policy that governs an app

The app object links to its access policy rather than naming it:

```
GET /api/v1/apps/{appId}
→ _links.accessPolicy.href = "https://…/api/v1/policies/rst…"
```

Take the trailing path segment as the policy id, then read the policy and its rules.

**Validate the extracted id before putting it in a request path.** It arrives inside
a response body, which is untrusted input; a policy id matches
`^(?:rst|00p)[A-Za-z0-9]{15,}$`. Interpolating an unvalidated href fragment into a
URL is how a response turns into a request you did not intend.
`[verified: useOktaApi/policyOperations → extractAccessPolicyId]`

Not every app exposes `_links.accessPolicy` — absence means this app is not governed
by a dedicated access policy, not that it is unprotected. Fall back to the org-level
`OKTA_SIGN_ON` policy.

### Enrolment is not enforcement

The most common wrong conclusion in MFA reporting: a user having enrolled a strong
authenticator does not mean any app _requires_ it, and an app requiring MFA does not
mean every assigned user has enrolled.

- "Which users enrolled what" → User Factors (`users-and-mfa.md`).
- "What must a user prove for this app" → `ACCESS_POLICY` rules for the app.
- "What must a user enrol at all" → `MFA_ENROLL` policy.

A defensible posture report needs at least two of the three, and should say which
question it answers.

## Sources

- Applications API — https://developer.okta.com/docs/reference/api/apps/
- Application Users —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationusers
- Application Groups —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgroups
- Group Push Mapping API —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgrouppushmapping
- Policies concepts — https://developer.okta.com/docs/concepts/policies/
- Configure an access policy —
  https://developer.okta.com/docs/guides/configure-access-policy/main/
- Authenticator enrollment policy after upgrade —
  https://developer.okta.com/docs/guides/oie-upgrade-mfa-enroll-policy/main/

See `request-optimization.md` for the `expand` contracts, `users-and-mfa.md` for
enrolment, and `recipes.md` for app-access compositions.
