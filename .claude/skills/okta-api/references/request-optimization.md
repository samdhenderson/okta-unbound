# Request optimization

How to make one Okta call return what a naive implementation fetches in N calls.

Read this before writing any loop of the shape "for each item, call Okta". Most of
those loops have a query parameter that removes them entirely. The rest are
genuinely irreducible, and knowing which is which is the point of this file.

Marker legend lives in `../SKILL.md`.

## How to spot a collapsible loop

A loop is collapsible when the per-item call fetches something Okta already knows
while assembling the list. Three signals:

1. **The per-item call is a count.** Counts are almost always available as an
   `expand` or a response header.
2. **The per-item call fetches a relationship the list is already traversing** —
   the rule that put a member in a group, the scope of an app assignment. Okta's
   own admin console renders these columns without N calls, so the data is
   reachable in one.
3. **The per-item call re-fetches an object the list already returned in part.**
   Check whether an `expand` promotes the partial object to a full one.

A loop is genuinely irreducible when the per-item resource is a **subcollection with
its own identity** — a user's enrolled factors, a user's app-specific credentials.
No `expand` exists for these. Say so plainly and budget for the call count instead
of hunting for a parameter that is not there.

## The collapsing parameters

| Endpoint                                    | Parameter                   | Embeds                                     | Replaces                              |
| ------------------------------------------- | --------------------------- | ------------------------------------------ | ------------------------------------- |
| `GET /api/v1/groups`                        | `expand=stats`              | `_embedded.stats` incl. exact member count | One count call per group              |
| `GET /api/v1/groups`                        | `expand=app`                | The source app for app-sourced groups      | One app lookup per group              |
| `GET /api/v1/groups/{id}/users`             | `expand=group-rules`        | `_embedded['group-rules']` per member      | One attribution lookup per member     |
| `GET /api/v1/apps?filter=user.id eq "{id}"` | `expand=user/{id}`          | `_embedded.user` incl. assignment `scope`  | One app-user call per app             |
| `GET /api/v1/apps/{id}/groups`              | `expand=group`              | The full group object per assignment       | One group call per assignment         |
| `GET /api/v1/devices`                       | `expand=user`               | The device's users                         | One user call per device              |
| Any list endpoint                           | `limit=1` + `x-total-count` | Exact total in the response header         | Walking the whole collection to count |

### `expand=stats` on groups `[docs]`

```
GET /api/v1/groups?limit=200&expand=stats
```

Each group gains `_embedded.stats` carrying the exact member count. The count is
authoritative — it is not a page-length approximation.

**Echo behaviour: Okta preserves `expand=stats` in the `rel="next"` link.** A
straightforward `Link`-following walk keeps the embed on every page with no extra
work. `[verified: shared/utils/oktaPagination + useOktaApi/groupDiscovery]`

Contrast this with `expand=group-rules` below, which Okta drops. The two behave
differently on the same walk, and assuming either behaviour universally is a bug.

`_embedded.stats.hasAdminPrivileges` has a known accuracy defect for groups holding
custom admin roles. Do not report admin-privilege status from this field. `[docs]`

The documented `expand` values on `GET /api/v1/groups` are **`stats` and `app`**.
`expand=app` embeds the source application for app-sourced groups, removing a
lookup per `APP_GROUP` when reporting where a group comes from. `[docs]`

### `expand=group-rules` on group members `[docs]`

```
GET /api/v1/groups/{groupId}/users?limit=200&expand=group-rules
```

The single highest-value parameter in the skill: it turns per-member rule
attribution from 1-call-per-member into zero extra calls. It is what the Okta admin
console calls to fill its "assigned by rule" column.

**Status changed recently.** This was an undocumented admin-console parameter for
years. Okta made it **documented and GA in Production on 3 June 2026**, alongside a
new per-user endpoint (below). Guidance written before that date — including this
repo's own code comments — still describes it as private. Treat it as supported.

The failure mode is still worth knowing, because it is the one an undocumented
parameter has: an org that does not honour it returns a normal 200 with the key
absent, not an error. Keep the absence handling regardless of status.

Each member row gains:

```
_embedded: { "group-rules": [ { "id": "0pr…", "name": "Engineering by dept" } ] }
```

Note the key is **hyphenated** (`group-rules`), not `groupRules`.
`[verified: shared/membership/memberRuleAttribution → GROUP_RULES_EXPAND]`

**Three states, never two.** This is the contract that makes or breaks a membership
report:

| Embed state              | Means                                              | Confidence          |
| ------------------------ | -------------------------------------------------- | ------------------- |
| Array present, non-empty | Rule-fed; the entries name the feeding rules       | Okta-asserted       |
| Array present, **empty** | Okta says no rule feeds this member — a manual add | Okta-asserted       |
| Key **absent**           | Okta said nothing                                  | Unknown — fall back |

Collapsing "present and empty" into "unknown", or "unknown" into "manual", is
precisely the mis-reporting this parameter exists to remove. An absent key is not
evidence of a manual add.
`[verified: shared/membership/memberRuleAttribution, ADR-0020]`

**Fallbacks, in order of preference.** When the key is absent:

1. `GET /api/v1/groups/{groupId}/users/{userId}/group-rules` — the documented
   per-user endpoint, GA 3 June 2026. Returns the rules managing that user's
   membership in that group. Authoritative, but costs one call per member, which is
   exactly the loop the embed exists to remove. Use it to resolve the _stragglers_,
   not the whole membership. `[docs]`
2. List the org's group rules (`GET /api/v1/groups/rules?limit=200`), keep those
   whose `actions.assignUserToGroups.groupIds` contains the group, and evaluate
   their conditions against the member. Cheap and org-wide, but heuristic — label
   it as such.

Option 1 did not exist before June 2026, which is why older implementations jump
straight to the heuristic. Prefer it now for small numbers of unknown members.

**Echo behaviour: Okta drops `expand=group-rules` from the `rel="next"` link.**
Re-append it to every subsequent page URL, or attribution silently degrades to
`unknown` for everyone after member 200 — a failure that looks like data, not like
an error. `[verified: shared/utils/oktaPagination → preserveQueryParams]`

**Probe before relying on it.** One cheap call tells you which path you are on:

```
GET /api/v1/groups/{knownGroupId}/users?limit=1&expand=group-rules
```

If the returned row has no `_embedded['group-rules']` key, the org does not honour
the parameter — take the fallback path for the whole job rather than discovering it
per-member.

Two entries for one member is a genuine multi-rule membership, not an error.

Multi-rule membership also forces a **counting decision**: counting _attributions_
lets a multi-rule member count once per rule, so totals exceed the member count;
counting _people_ is exclusive and safe to stack in a chart. Pick deliberately and
label which one the report shows. `[verified: shared/membership/groupSource]`

### `expand=user/{userId}` on apps `[docs]`

```
GET /api/v1/apps?filter=user.id eq "{userId}"&limit=200&expand=user/{userId}
```

Returns the user's assigned apps _and_, per app, `_embedded.user` carrying the
app-user assignment `scope`. Without it, determining how each assignment arrived
costs one `GET /api/v1/apps/{appId}/users/{userId}` per app.

`scope` is `USER` for a direct assignment and `GROUP` for one derived from group
membership. `[docs]`

**The trap: `scope: 'USER'` means "has a direct assignment", not "direct only".**
Okta reports a **single** scope per app-user and prefers `USER` when both apply. A
user assigned directly _and_ through a group reports `USER`, and the group-derived
path is invisible in this response. Never report "this user does not get the app
from any group" on the strength of `scope === 'USER'`; to establish that, enumerate
the app's group assignments and intersect with the user's groups.
`[verified: shared/schemas/okta → extractAppAssignmentScope]`

### `expand=group` and `expand=metadata` on app groups `[docs]`

`GET /api/v1/apps/{appId}/groups?expand=group` embeds the full group object per
assignment, removing a group lookup per row. `expand=metadata` embeds assignment
metadata.

The app-group listing carries **no activation status** for a push-group mapping.
Do not infer that a mapping is active from its presence.
`[verified: useOktaApi/pushGroupOps]`

### Exact counts via `x-total-count` `[verified]`

```
GET /api/v1/users/{userId}/groups?limit=1
→ x-total-count: 47
```

One call, one row of payload, an exact total. Use it for progress budgeting and for
count-only questions. Prefer it over `expand=stats` when the count is for a single
entity rather than a listing.
`[verified: useOktaApi/userOperations]`

Header availability is not universal across endpoints. Treat a missing
`x-total-count` as "count unknown", never as zero — and **probe rather than
assume**, per collection, with the full walk as the fallback. This repo does that
for `/api/v1/apps/{id}/users` and `/api/v1/apps/{id}/groups`, whose header
availability is not independently confirmed: the probe path saves ~50 requests on
a 10,000-user app where the header is sent, and costs nothing where it is not.
`[verified: useOktaApi/appOperations → getAppAssignmentCounts, ADR-0059]`

One asymmetry worth stating when you report a probed count: a walked count can be
filtered (dropping rows that fail boundary validation), a probed count is Okta's
own total and cannot. The two can disagree by exactly the rows an org sends that
do not validate.

## Anti-patterns

**Fetching a full object to read one field it already gave you.** List rows are
often complete enough. Check the list payload before adding a detail call.

**Paginating to count.** If the question is "how many", use `limit=1` +
`x-total-count`, not a full walk.

**Assuming `expand` survives pagination.** It depends on the parameter. `stats`
survives; `group-rules` does not. Verify per parameter, and re-append what is
dropped. `[verified: shared/utils/oktaPagination]`

**Using a large page size as an optimization for a targeted question.** A filter
that returns 3 rows beats a 200-row page you post-process. See
`search-filter-syntax.md`.

**Treating an absent embed as a negative answer.** Absence means Okta did not
answer, which is not the same as answering "no". This is the single most common way
an optimized report becomes a confidently wrong one.

## Cost math

State call counts before running a job. Establishing the number is what makes an
expensive job a decision rather than a surprise.

| Question                                        | Naive       | Optimized | Why                                                  |
| ----------------------------------------------- | ----------- | --------- | ---------------------------------------------------- |
| Attribute 500 group members to rules            | 501         | **4**     | `expand=group-rules` on a 3-page walk + 1 group read |
| Group inventory with exact counts, 1,000 groups | 1,005       | **5**     | `expand=stats`, 200 per page                         |
| One user's app assignments with scope, 60 apps  | 61          | **1**     | `expand=user/{id}`                                   |
| Count a user's groups                           | ceil(n/200) | **1**     | `limit=1` + `x-total-count`                          |
| MFA factors for 500 members                     | 500         | **500**   | Irreducible — no bulk factors endpoint               |

The last row matters as much as the others. When a job is irreducible, say so, give
the number, and let the operator decide — do not disguise it, and do not keep
hunting for a parameter that does not exist.

## Sources

- Groups API, `expand=stats`, group object —
  https://developer.okta.com/docs/reference/api/groups/
- `expand` on List all member users + the new per-user group-rules endpoint, GA
  3 June 2026 —
  https://developer.okta.com/docs/release-notes/2026-okta-identity-engine/
- List all group rules for a user —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/group/other/listgrouprulesforuseringroup
- Application Users, assignment `scope` —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationusers
- Application Groups, `expand=group` / `expand=metadata` —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgroups
- Pagination and `Link` header — https://developer.okta.com/docs/api/#pagination

See `pagination-and-limits.md` for the walk itself, `internal-apis.md` for the rules
governing undocumented parameters generally, and `recipes.md` for these parameters
composed into whole reports.
