# Groups and rules

Group membership is the backbone of Okta access. Nearly every "who has what"
question resolves to a group question, and nearly every wrong answer comes from
conflating _being in a group_ with _why you are in it_.

Marker legend lives in `../SKILL.md`.

## Group types

| `type`       | Source of membership                                    | Rules can target it |
| ------------ | ------------------------------------------------------- | ------------------- |
| `OKTA_GROUP` | Managed in Okta: manual adds and group rules            | Yes                 |
| `APP_GROUP`  | Pushed from an upstream app or directory (AD, Workday…) | No                  |
| `BUILT_IN`   | Okta-maintained, e.g. Everyone                          | No                  |

`[verified: shared/schemas/okta → groupTypeSchema]`

Read `type` before attributing membership. Attributing an `APP_GROUP` member to a
group rule is always wrong — its membership comes from the upstream source, and no
Okta rule feeds it. `BUILT_IN` groups are likewise not rule-fed.

Core endpoints:

```
GET /api/v1/groups?limit=200&expand=stats        # inventory + exact counts
GET /api/v1/groups?limit=200&expand=app          # + source app for APP_GROUPs
GET /api/v1/groups/{groupId}                     # one group
GET /api/v1/groups?q={query}&limit=20            # type-ahead
GET /api/v1/groups/{groupId}/users?limit=200     # members (default limit is 1000)
GET /api/v1/groups/{groupId}/users/{userId}/group-rules   # why this member is here
PUT    /api/v1/groups/{groupId}/users/{userId}   # add member
DELETE /api/v1/groups/{groupId}/users/{userId}   # remove member
```

Adding and removing members are idempotent `PUT`/`DELETE` with empty bodies.
Removing a user from a group that a rule feeds is futile — the rule re-adds them on
its next evaluation. To remove them for real, change the rule or the user's
attributes.

## Attribution: why a user is in a group

Three sources of membership, and the API surfaces them unevenly:

| Source      | How it happens                            | How to detect                           |
| ----------- | ----------------------------------------- | --------------------------------------- |
| Rule        | A group rule's condition matched the user | `expand=group-rules`, or evaluate rules |
| Manual      | An admin or API call added them directly  | Embed present and empty                 |
| App-sourced | Upstream push into an `APP_GROUP`         | `group.type === 'APP_GROUP'`            |

### The fast path

```
GET /api/v1/groups/{groupId}/users?limit=200&expand=group-rules
```

Documented and GA since 3 June 2026 (previously an undocumented admin-console
parameter — older guidance still says private). Contract in
`request-optimization.md`. It embeds `_embedded['group-rules']` per member, giving
Okta's own attribution at zero extra cost.

**Three states, never two:** populated → rule-fed; present-and-empty →
authoritative manual add; **key absent** → unknown, fall back. An absent key is not
evidence of a manual add.
`[verified: shared/membership/memberRuleAttribution, ADR-0020]`

Remember Okta drops this parameter from the `rel="next"` link — re-append it per
page or everyone past member 200 degrades to `unknown`.

### The fallback paths

When the embed is absent, the documented per-user endpoint is authoritative:

```
GET /api/v1/groups/{groupId}/users/{userId}/group-rules
```

It returns the rules managing that user's membership in that group. GA 3 June 2026.
`[docs]` One call per member, so use it to resolve stragglers rather than a whole
membership — it is the loop the embed exists to remove.

When even that is unavailable, or the member count makes it too expensive, derive
attribution heuristically:

1. `GET /api/v1/groups/rules?limit=200` — all rules in the org.
2. Keep rules whose `actions.assignUserToGroups.groupIds` contains the group.
3. Evaluate each candidate rule's condition against the member's profile.
4. A rule that matches explains the membership. No rule matches → probably manual,
   but say "probably" — a rule may reference attributes or functions the evaluator
   cannot resolve.

This is best-effort and must be labelled as such. It answers the same question at
lower confidence, which is the whole point of having it.
`[verified: shared/utils/membershipAnalysis, shared/ruleEvaluator]`

### What the API cannot tell you

**There is no membership timestamp.** `GET /api/v1/users/{userId}/groups` returns no
"added on" date, and neither does the group member listing. "When was this user
added to this group" is unanswerable from the Management API. Do not synthesise it
from `lastUpdated` or `created` — those describe the user and the group, not the
membership. `[verified: useOktaApi/getUserGroupsRequest]`

The System Log is the only route to that answer, within its retention window, via
`group.user_membership.add` events. See `system-log.md`.

**The user-side listing carries no attribution embed.** `GET /api/v1/users/{userId}/
groups` has no equivalent of `expand=group-rules`, so a user-centric view sees
`unknown` for every membership. A group-centric and a user-centric view of the same
membership may therefore legitimately disagree — but only where the group side said
`unknown`. `[verified: ADR-0020, ADR-0021]`

Since June 2026 the user-side view has a documented way out, one call per
membership: `GET /api/v1/groups/{groupId}/users/{userId}/group-rules` for each group
the user is in. Authoritative but linear in group count — worth it for a single
user's detail view, not for a bulk report. `[docs]`

### Counting members

- Whole-org inventory with counts: `expand=stats` on the group listing.
- One entity: `limit=1` and read `x-total-count`.
- Never paginate purely to count.

When members can be fed by more than one rule, decide whether the report counts
**attributions** (sums above the member total) or **people** (exclusive, safe to
stack in a chart), and label it. `[verified: shared/membership/groupSource]`

## Group rules

### Object shape

```json
{
  "id": "0pr…",
  "type": "group_rule",
  "name": "Engineering by department",
  "status": "ACTIVE",
  "conditions": {
    "expression": {
      "value": "user.department == \"Engineering\"",
      "type": "urn:okta:expression:1.0"
    },
    "people": { "users": { "exclude": [] }, "groups": { "exclude": [] } }
  },
  "actions": {
    "assignUserToGroups": { "groupIds": ["00g…"] }
  }
}
```

`[docs]` `[verified: shared/schemas/okta → oktaGroupRuleSchema]`

`status` is `ACTIVE` or `INACTIVE`. An `INACTIVE` rule feeds nobody, but its former
members **remain in the group** — deactivation does not retract membership.

### Endpoints

```
GET    /api/v1/groups/rules?limit=200                    # list (paginated)
GET    /api/v1/groups/rules/{ruleId}                     # one rule
POST   /api/v1/groups/rules                              # create
PUT    /api/v1/groups/rules/{ruleId}                     # update
DELETE /api/v1/groups/rules/{ruleId}                     # delete
POST   /api/v1/groups/rules/{ruleId}/lifecycle/activate
POST   /api/v1/groups/rules/{ruleId}/lifecycle/deactivate
```

`[verified: useOktaApi/ruleWrites]`

There is no "rules for group X" endpoint. To find the rules feeding a group, list
all rules and filter client-side on `actions.assignUserToGroups.groupIds`. Cache
the listing — it is one walk that answers the question for every group.
`[verified: useOktaApi/groupDiscovery → fetchAndCacheAllGroupRules]`

**Only inactive rules can be edited.** Deactivate, modify, reactivate. `[docs]`
Target groups can be added or removed on an existing rule without deleting it, as
of Okta release 2026.07.0. `[docs]`

### Documented limits `[docs]`

| Limit                   | Value         |
| ----------------------- | ------------- |
| Rules per org           | 2,000         |
| Rule name length        | 50 characters |
| Target groups per rule  | 100           |
| Excluded users per rule | 100           |

The 50-character cap is easy to breach when generating names programmatically —
truncate deliberately rather than letting the API reject the create.
`[verified: shared/rules/consolidation → MAX_RULE_NAME]`

### Restrictions that change what is possible `[docs]`

- **Rules cannot assign users to admin groups**, and a group that is already a rule
  target cannot subsequently be granted admin privileges.
- **Rules validate only against the default Okta user type.** Custom user type
  attributes are not supported in rule conditions. A rule referencing one will not
  behave as written — this is a frequent cause of "the rule matches nobody".
- **Basic (non-expression) conditions accept string attributes only.**
- **Rules apply org-wide** and cannot be scoped to a realm or a subset of users.
- **Rules skip Deactivated and Deleted users.** They do evaluate against Locked Out,
  Staged, Suspended, Password Reset, and Pending User Action.

### Evaluation timing

Rules run on user create and profile update, not on a schedule you control, and not
synchronously with your API call. After changing a rule or an attribute, expect a
delay before membership reflects it. Do not write a tight poll loop against group
membership to confirm a rule fired — read the System Log, or accept the lag.
`[unverified]` — the precise trigger set and latency are not published.

## Okta Expression Language in rule conditions

Rule conditions are Okta Expression Language, type `urn:okta:expression:1.0`, and
**must evaluate to Boolean**. `[docs]`

### What is available

Okta states: _"Group rule conditions only allow String, Arrays, and user
expressions."_ `[docs]` Explicitly **not** available: the `Convert` and `Time`
function families. An expression such as `Convert.toInt("2018") == user.yearJoined`
is rejected in a rule condition even when the attribute exists. `[docs]`

> **Discrepancy worth knowing.** The okta-unbound evaluator's source comment states
> that `Arrays.*` is unavailable inside group-rule conditions, which contradicts
> Okta's current documentation above. The evaluator's _behaviour_ is still sound —
> it reports anything it cannot resolve as unevaluable rather than guessing — but
> treat the doc as authoritative on availability and the evaluator as authoritative
> on what it will compute. `[verified: shared/ruleEvaluator → SUPPORTED_FUNCTIONS]`

Documented `String` functions include `append`, `join`, `len`, `removeSpaces`,
`replace`, `replaceFirst`, `startsWith`, `stringContains`, `stringSwitch`,
`substring`, `substringAfter`, `substringBefore`, `toUpperCase`, `toLowerCase`.
`[docs]` Note `String.endsWith` does **not** appear in Okta's published list;
confirm against a live org before relying on it. `[unverified]`

Attribute reads take the form `user.<attribute>`, e.g. `user.department`,
`user.title`, `user.userType`. `app.*` and `session.*` are not resolvable in a group
rule condition.

### Group membership functions `[docs]`

```
isMemberOfGroup("00g…")                    # by group id
isMemberOfAnyGroup("00g…", "00g…")         # by group id, variadic
isMemberOfGroupName("Engineering")         # by name
isMemberOfGroupNameStartsWith("eng-")
isMemberOfGroupNameContains("contractor")
isMemberOfGroupNameRegex("^eng-.*$")
```

**`isMemberOfGroupName` matches across every group source.** If `sales` exists as an
Okta group, a Workday group, and a Salesforce group, `isMemberOfGroupName("sales")`
matches all three. To target exactly one, pass its id to `isMemberOfGroup` instead.
`[docs]` This is the most common source of a rule that over-matches.

Name matching is **case-sensitive**.
`[verified: shared/ruleEvaluator → GROUP_MEMBERSHIP_FUNCTIONS]`

Consequently, evaluating a membership function client-side requires the user's
_complete_ group list across all sources, not the Okta groups a screen happens to
have cached. A partial list produces confidently wrong answers.
`[verified: ADR-0021]`

`isMemberOfAnyGroupName` is implemented in the okta-unbound evaluator but does not
appear in Okta's published function list. `[unverified]`

### Operators

Comparison: `==`, `!=`, `<`, `<=`, `>`, `>=`. Logical: `AND`, `OR`, `NOT`/`!`, with
`()` for grouping. Okta's documentation names the word forms; the symbolic forms
`&&` and `||` are accepted in practice and appear in real tenant rules, so a parser
consuming existing rules must handle both.
`[verified: shared/ruleEvaluator → RULE_CONNECTIVE_OPERATORS]`

### Evaluating expressions client-side, safely

Predicting which users a rule will capture is genuinely useful — for previewing a
rule before activating it, and for the attribution fallback. Two rules make it safe:

**Parse, never `eval`.** Rule expressions are tenant-authored text. Use a real
expression parser. `[verified: ADR-0017]`

**Return three values, not two: match, no-match, and unevaluable.** An evaluator
that cannot resolve a construct must say so rather than guessing, because a wrong
answer here silently mis-states someone's access.
`[verified: shared/ruleEvaluator]`

**Never execute a tenant-authored regex.** `isMemberOfGroupNameRegex` takes a
pattern written by whoever authored the rule. Building a `RegExp` from it hands that
author a catastrophic-backtracking lever over your process, and JavaScript offers no
way to bound backtracking. Report it unevaluable and say the check was not
performed. `[verified: shared/ruleEvaluator]`

## Rule impact: blast radius before a change

Before deactivating, deleting, or editing a rule, establish who it currently feeds.

1. `GET /api/v1/groups/rules/{ruleId}` — the current condition and targets.
2. For each target group id, `GET /api/v1/groups/{groupId}?expand=stats` — identity
   and exact size.
3. For each target, walk members with `expand=group-rules` and keep those whose
   embed names this rule.

Members attributed to **this rule only** are the ones the rule holds up on its own.
Members also attributed to another rule, or added manually, are unaffected by
anything done to it.

That population is **not** "who loses access" — the verb decides what happens to
them, and only deleting the rule can take anybody out of a group. Deactivating
leaves every one of them a member, merely no longer explained by any rule.
`[verified: shared/membership/ruleImpact → classifyGroupImpact returns
heldSolelyByRule / unaffected, and never a set named for access loss]`

Two facts that change the answer, and are easy to get backwards:

- **Deactivating a rule does not remove existing members.** Access persists until
  something else removes them. A "what breaks" report that assumes retraction
  overstates the impact.
- Consolidating rules requires the **union** of target groups, and the union must
  still respect the 100-target and 50-character-name limits.
  `[verified: shared/rules/consolidation]`

## Sources

- Groups API — https://developer.okta.com/docs/reference/api/groups/
- Group Rules API —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/grouprule
- Group rules concepts —
  https://help.okta.com/en-us/content/topics/users-groups-profiles/usgp-about-group-rules.htm
- Group rule limitations and restrictions —
  https://support.okta.com/help/s/article/okta-group-rule-limitations-and-restrictions
- Okta Expression Language —
  https://developer.okta.com/docs/reference/okta-expression-language/

See `request-optimization.md` for the attribution embed's contract,
`system-log.md` for membership change history, and `recipes.md` for these composed
into reports.
