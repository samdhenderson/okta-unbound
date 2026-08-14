# Admin and org surfaces

Deliberately shallow coverage of the endpoint families outside this skill's deep
domains. Each entry gives enough to know whether it answers the question, and a
link to fetch when it does.

Anything below marked `[unverified]` has not been exercised in the okta-unbound
codebase. Treat the endpoint shapes as directionally right and the field-level
detail as needing confirmation — fetch the linked doc before depending on it.

Marker legend lives in `../SKILL.md`.

## Admin roles

The answer to "who can administer what" — a question no group or app listing
answers, and the one most often missed in an access review.

```
GET /api/v1/users/{userId}/roles         # a user's admin roles
GET /api/v1/groups/{groupId}/roles       # a group's admin roles
GET /api/v1/iam/roles                    # custom roles
```

`[docs]`

Two facts that change an access review: `[docs]`

- **Roles assigned to a group grant privileges to every member**, and are invisible
  in the user's own role listing. An admin-privilege report that only walks users
  misses everyone who is an admin by group membership.
- **Standard roles** (`SUPER_ADMIN`, `ORG_ADMIN`, `APP_ADMIN`, `USER_ADMIN`,
  `GROUP_MEMBERSHIP_ADMIN`, `READ_ONLY_ADMIN`, `HELP_DESK_ADMIN`, …) have fixed
  permissions. **Custom roles** pair a permission set with a resource set binding,
  so the role name alone does not tell you the scope.

Standard roles can be narrowed with **resource targets** — an app admin scoped to
specific apps, a group admin scoped to specific groups. Reporting the role without
its targets overstates the privilege. `[docs]`

Related: group rules cannot assign users to admin groups, and a group that is
already a rule target cannot later be granted admin privileges. See
`groups-and-rules.md`. `[docs]`

## Devices

```
GET /api/v1/devices?limit=200&expand=user
```

`expand=user` embeds the device's users, removing a lookup per device.
`[verified: sidepanel/export/descriptors/devices]`

Supports `search`. Useful for device-posture questions — managed versus unmanaged,
platform mix, registration status — and for correlating a sign-in with a device via
the System Log's `client` block.

## User types and schemas

```
GET /api/v1/meta/types/user              # user types in the org
GET /api/v1/meta/schemas/user/default    # default user schema
GET /api/v1/meta/schemas/user/{typeId}   # a specific type's schema
```

`[unverified]`

Read these to discover custom profile attributes rather than guessing at names —
the schema is authoritative about what exists and which attributes are indexed.

Remember the distinction: `profile.userType` is a **string field on the profile**;
a user _type_ is a separate object governing which schema applies. Group rules
validate only against the default user type. See `users-and-mfa.md`.

## Profile mappings

```
GET /api/v1/mappings?sourceId={id}&targetId={id}
GET /api/v1/mappings/{mappingId}
```

`[unverified]`

How attributes flow between a source (an app or IdP) and Okta Universal Directory,
or the reverse. This is the answer to "where does this user's `department` actually
come from" — a question neither the user object nor the app assignment answers, and
one that decides whether editing a profile field will stick or be overwritten on
next sync.

Mapping expressions use Okta Expression Language, with a wider function set than
group rule conditions allow. See `groups-and-rules.md`.

## Linked objects

```
GET /api/v1/meta/schemas/user/linkedObjects
GET /api/v1/users/{userId}/linkedObjects/{relationshipName}
```

`[unverified]`

User-to-user relationships — manager/subordinate being the built-in case, plus any
custom relationship the org defines. The relationship is **not** a profile
attribute, so it does not appear in a user's `profile` and is invisible to a report
that only walks users.

Relevant whenever a report needs an org chart, an approval chain, or "who reports to
this person" — and note `profile.manager` (a string) and a linked-object manager
relationship are different mechanisms that can disagree.

## Group push mappings

```
GET /api/v1/apps/{appId}/group-push/mappings
```

`[docs]`

Push Groups mapped to an app, as a first-class documented API. This filled a
long-standing gap: before it, push mappings had to be inferred from
`GET /api/v1/apps/{appId}/groups`, which carries no activation status. Prefer this
endpoint for any push-group question. See `apps-and-policies.md`.

## Network zones

```
GET /api/v1/zones?limit=200
```

`[verified: sidepanel/export/descriptors/networkZones]`

IP allow/deny lists and geolocation zones, referenced by policy rules. When a policy
rule's condition names a zone id, resolve it here — a policy report that prints zone
ids instead of names is unreadable.

## Trusted origins

```
GET /api/v1/trustedOrigins?limit=200
```

`[unverified]`

CORS and redirect allow-lists. A security-review surface: unexpected entries are
worth flagging, and it is small enough to enumerate in full.

## Identity providers

```
GET /api/v1/idps?limit=200
```

`[verified: sidepanel/export/descriptors/samlIdps]`

External IdPs for federation and social login. Relevant to "how do users actually
authenticate" — an org with federation means Okta's password policy is not the whole
story, and `IDP_DISCOVERY` policies route between them.

## Behaviors

```
GET /api/v1/behaviors?limit=200
```

`[unverified]`

Behavioural detection rules (new device, new geolocation, velocity) referenced by
risk-based policy conditions. Needed to explain _why_ a policy rule triggered.

## Event hooks and inline hooks

```
GET /api/v1/eventHooks?limit=200
GET /api/v1/inlineHooks?limit=200
```

`[unverified]`

Outbound webhooks. Event hooks are the documented alternative to polling the System
Log — Okta's own rate-limit guidance recommends them over aggressive polling.
`[docs]` Worth proposing whenever a design starts with "poll every minute".

Inline hooks additionally _modify_ Okta flows in-flight; an unexpected one is a
significant finding in a security review.

## Brands and customisation

```
GET /api/v1/brands
```

`[unverified]`

Sign-in page and email customisation. Rarely relevant to access reporting; listed so
its absence elsewhere is not read as an oversight.

## Sessions

```
GET /api/v1/sessions/me            # the current session
DELETE /api/v1/sessions/{sessionId}
```

`[unverified]`

`sessions/me` is useful in browser-session mode to check whether the session is
still valid and when it expires, so a long job can warn before it fails mid-run.

There is no endpoint listing all active sessions org-wide. "Who is signed in right
now" is not directly answerable; approximate it from System Log
`user.session.start` / `.end` events, and label the approximation.

## Org

```
GET /api/v1/org
```

`[unverified]`

Org settings and metadata. Mainly useful for recording _which_ org a report came
from — worth stamping into any exported artifact so results are not later attributed
to the wrong tenant.

## Not covered here

These are real surfaces this skill does not describe. Fetch from
`doc-sources.md` when needed:

- **SCIM provisioning** — inbound and outbound user sync; a protocol in its own
  right, not a Management API endpoint family.
- **OAuth 2.0 / OIDC runtime** (`/oauth2/*`) — authorisation servers, token
  minting, introspection. `auth-modes.md` covers only the service-app slice.
- **Okta Identity Governance** — access certifications, requests, entitlements. A
  separate product surface with its own API.
- **Workflows** — no Management API equivalent; automation lives in its own console.

## Sources

- Roles in Okta —
  https://developer.okta.com/docs/api/openapi/okta-management/guides/roles
- Role assignment concepts — https://developer.okta.com/docs/concepts/role-assignment/
- User role assignments —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/roleassignmentauser
- Group role assignments —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tag/RoleAssignmentBGroup/
- Core Okta API index — https://developer.okta.com/docs/reference/core-okta-api/
- Rate limits, event hooks over polling —
  https://developer.okta.com/docs/reference/rate-limits/

See `endpoint-index.md` for the flat lookup and `doc-sources.md` for fetching
beyond this skill.
