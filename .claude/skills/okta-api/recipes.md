# Recipes

Multi-endpoint compositions for real admin questions. Each states the call
sequence, its cost in requests, the decision rules that turn responses into an
answer, and the gotchas that make a plausible answer wrong.

Read the recipe that matches the question, then the references it cites. Adapt
rather than copy — the decision rules matter more than the call list.

Marker legend lives in `SKILL.md`. Cost is given as request count, because that is
the constraint that decides whether a report is runnable.

**Standing rules for every recipe below.** Walk lists with `limit=200` and follow
the `Link` header. Re-append parameters Okta drops from `rel="next"`. Degrade
per-item failures to a marked-unknown row rather than failing the whole job. Label
any result that is partial, heuristic, or dependent on an internal API.

---

## 1. Who is in this group, and why

**Question.** For group G, split membership into rule-managed and manual, name the
feeding rule per member, and state confidence.

**Answer shape.** `{ member, attribution: 'rule' | 'manual' | 'unknown',
rules: {id,name}[], provenance: 'okta-asserted' | 'client-deduced' }`

**Call sequence.**

1. `GET /api/v1/groups/{G}?expand=stats` — identity, `type`, exact member count for
   a progress budget. _1 call._
2. `GET /api/v1/groups/{G}/users?limit=200&expand=group-rules` — members **and**
   Okta's own per-member attribution in one walk. Re-append `expand=group-rules` to
   every `rel="next"` URL; Okta drops it. _ceil(members/200) calls._
3. Only if step 2 returned `unknown` for some member, and only for those members:
   `GET /api/v1/groups/{G}/users/{userId}/group-rules` — the documented per-user
   answer. _1 call per unknown member._ For many unknowns, fall back instead to
   `GET /api/v1/groups/rules?limit=200`, keeping rules whose
   `actions.assignUserToGroups.groupIds` contains G, and evaluating their conditions
   — cheaper but heuristic. _ceil(rules/200) calls._

**Cost.** 500-member group, embed honoured: **4 calls**. Naive (members, then one
rule lookup each): **501**. Embed unavailable: 4 + rules pages.

**Decision rules.**

- Embed present and non-empty → `rule`, provenance `okta-asserted`. Two entries is
  a genuine multi-rule member, not an error.
- Embed present and **empty** → `manual`, authoritative.
- Key **absent** → `unknown`; run step 3. Never report `manual` from absence.
- `group.type === 'APP_GROUP'` → membership is application-managed and group rules
  never apply. Do not attribute it to a rule.

**Gotchas.**

- Two counts answer different questions: _attributions_ (a multi-rule member counts
  once per rule; sums exceed the member total) and _people_ (exclusive, safe to
  draw as a stacked bar). Pick deliberately and label it.
- No membership timestamp exists. "Added on" is not answerable here — see recipe 11.
- A malformed embed on one row degrades that row to `unknown`; it must never drop
  the member. Under-reporting membership is worse than mis-attributing it.
- `expand=group-rules` is documented and GA as of 3 June 2026. Older guidance calls
  it a private admin-console parameter — that is out of date.

**Verified.** `shared/membership/memberRuleAttribution` (three-state read),
`shared/membership/groupSource` (counting modes), `useOktaApi/groupMembers`
(the preserved-parameter walk). ADR-0020, ADR-0021.

---

## 2. What breaks if this rule is deactivated or edited

**Question.** For rule R, who loses access, and what actually happens on
deactivation?

**Answer shape.** `{ targetGroup, membersFedOnlyByR[], membersWithOtherPaths[],
retractionBehaviour }`

**Call sequence.**

1. `GET /api/v1/groups/rules/{R}` — condition and `actions.assignUserToGroups
.groupIds`. _1 call._
2. For each target group: `GET /api/v1/groups/{id}?expand=stats` — identity and
   size. _T calls._
3. For each target group: walk members with `expand=group-rules`.
   _sum of ceil(members/200)._
4. Partition members by whether their embed names R **only**, R **and others**, or
   not at all.

**Cost.** Rule with 2 targets of 300 members each: **1 + 2 + 4 = 7 calls**.

**Decision rules.**

- Embed names R only → this member's membership depends on R.
- Embed names R and another rule → keeps membership; the other rule still feeds it.
- Embed empty → manual member, unaffected by R.
- Embed absent → unknown; fall back to evaluating candidate rules, and mark the
  member's row as heuristic.

**Gotchas.**

- **Deactivating a rule does not remove existing members.** Access persists until
  something else removes them. A report that assumes retraction overstates the
  impact — state the behaviour explicitly rather than implying loss.
- Editing requires deactivating first; the rule is inert in between, so a long edit
  window is itself a change.
- Membership re-evaluation is not synchronous with the API call. Do not poll
  membership to confirm.

**Verified.** `shared/membership/ruleImpact`, `useOktaApi/ruleWrites`. See
`groups-and-rules.md`.

---

## 3. Which members of a group lack strong MFA

**Question.** For group G, who has no phishing-resistant authenticator enrolled?

**Answer shape.** `{ member, factors: {type,status}[], strongMfa: boolean,
readFailed: boolean }`

**Call sequence.**

1. `GET /api/v1/groups/{G}?expand=stats` — exact member count, to state the cost
   before starting. _1 call._
2. `GET /api/v1/groups/{G}/users?limit=200` — members. _ceil(members/200) calls._
3. For each member: `GET /api/v1/users/{userId}/factors`. _N calls, irreducible._

**Cost.** 500-member group: **504 calls**, essentially all in step 3. There is no
bulk factors endpoint. Report the estimate before running, run it at low priority,
and make it cancellable.

**Decision rules.**

- A factor counts only when `status === 'ACTIVE'`. Pending enrolment is not
  coverage.
- Exclude `factorType === 'password'` — it is not MFA.
- Phishing-resistant: `webauthn`, `u2f`, `fido`, `signed_nonce` (FastPass).
  Weak-but-present: `sms`, `call`, `email`, `question`.
- A failed factor read is `readFailed`, **not** "no MFA". Report the two separately.

**Gotchas.**

- **One Okta Verify enrolment produces up to three factor rows** (`signed_nonce`,
  `push`, `token:software:totp`). Counting rows over-reports enrolment — report by
  capability, not by count.
- `signed_nonce` is Okta FastPass. Nothing in the name says so, and missing it
  under-reports the strongest authenticator in the org.
- **Strength ranking is your policy, not Okta's.** The API returns no strength
  field. State the policy in the report.
- Enrolment is not enforcement — see recipe 8 for what the app actually requires.
- Consider filtering to `status eq "ACTIVE"` users first; scanning deactivated
  users spends the expensive call on people who cannot sign in.

**Verified.** `shared/utils/mfaUtils`, `useOktaApi/userOperations` (`scanGroupMfa`).

---

## 4. What does this app grant, and to whom

**Question.** For app A, who is assigned, and by which path?

**Answer shape.** `{ app, directUsers[], groupAssignments[], effectiveUsers[],
scopeCaveat }`

**Call sequence.**

1. `GET /api/v1/apps/{A}` — `label`, `status`, `signOnMode`, `_links.accessPolicy`.
   _1 call._
2. `GET /api/v1/apps/{A}/users?limit=200` — assigned users with `scope`.
   _ceil(users/200) calls._
3. `GET /api/v1/apps/{A}/groups?limit=200&expand=group` — group assignments with the
   group object embedded. _ceil(groups/200) calls._
4. Optional, for the effective set: walk each assigned group's members.
   _sum of ceil(members/200)._

**Cost.** App with 800 users and 5 groups: **1 + 4 + 1 = 6 calls** for the
assignment view. The effective-membership expansion in step 4 is what costs.

**Decision rules.**

- `scope === 'GROUP'` → derived from a group assignment.
- `scope === 'USER'` → **has** a direct assignment; may _also_ have a group path.
- Union the group members from step 4 with direct assignees for the effective set,
  de-duplicating by user id.
- `app.status === 'INACTIVE'` → assignments persist but nobody can use the app. Say
  which question the report answers.

**Gotchas.**

- The single-scope trap: Okta reports one scope and prefers `USER`. Do not conclude
  "no group path" from `scope === 'USER'` — see recipe 5.
- Use `label`, not `name`, in output. `name` is the catalogue type and repeats
  across instances.
- `credentials.userName` is the identity presented _to the app_ and often differs
  from the Okta login. Show both when they differ.
- App-group rows carry no activation status for push mappings.

**Verified.** `useOktaApi/appOperations`, `shared/schemas/okta`.

---

## 5. Every group a user belongs to, with attribution

**Question.** For user U, which groups, how many, and why each?

**Answer shape.** `{ totalCount, groups: { group, attribution, confidence }[] }`

**Call sequence.**

1. `GET /api/v1/users/{U}/groups?limit=1` — exact total from `x-total-count`.
   _1 call._
2. `GET /api/v1/users/{U}/groups?limit=200` — the memberships.
   _ceil(groups/200) calls._
3. `GET /api/v1/groups/rules?limit=200` — all rules, cached org-wide.
   _ceil(rules/200) calls._
4. Evaluate each rule against U's profile; a matching rule whose targets include a
   group explains that membership.

**Cost.** User in 47 groups, org with 300 rules: **1 + 1 + 2 = 4 calls.**

**Decision rules.**

- `group.type === 'APP_GROUP'` → app-sourced. Stop; no rule explains it.
- `group.type === 'BUILT_IN'` → Okta-maintained (e.g. Everyone).
- A matching rule targeting the group → probably rule-fed, `confidence: heuristic`.
- No matching rule → probably manual, `confidence: heuristic`.

**Gotchas.**

- **The user-side listing has no attribution embed.** Unlike recipe 1, everything
  here is heuristic. Label it, and never present it with the same confidence as the
  group-side answer.
- A group-side and user-side view of the same membership may legitimately disagree,
  but only where the group side said `unknown`.
- Evaluating `isMemberOfGroupName*` needs U's **complete** group list across all
  sources — which step 2 provides. A partial list yields confident wrong answers.
- Never execute a tenant-authored regex from `isMemberOfGroupNameRegex`. Report it
  unevaluable.
- Cache step 3 across users; it is the same payload for every user in the org.

**Verified.** `shared/utils/membershipAnalysis`, `shared/ruleEvaluator`,
`useOktaApi/getUserGroupsRequest`. ADR-0021.

---

## 6. Org-wide group inventory with counts and emptiness triage

**Question.** Every group, its exact size, and which are empty or near-empty.

**Answer shape.** `{ group, type, memberCount, bucket: 'empty' | 'tiny' | 'normal' }`

**Call sequence.**

1. `GET /api/v1/groups?limit=200&expand=stats` — the whole inventory with exact
   counts embedded. Okta preserves `expand=stats` in `rel="next"`, so a plain walk
   keeps it. _ceil(groups/200) calls._

**Cost.** 1,000 groups: **5 calls**. Naive (list, then a count per group):
**1,005**. This is the cheapest high-value report in the skill.

**Decision rules.**

- `memberCount === 0` → empty; a cleanup candidate, but see the gotchas.
- Segment by `type` before judging: an empty `APP_GROUP` means the upstream source
  is empty, which is an integration finding, not an Okta hygiene finding.
- Cross-reference rule targets (recipe 7) before calling any group unused.

**Gotchas.**

- **Empty is not unused.** A group may be empty because its rule matches nobody
  today, or because it exists to receive an app assignment. Deleting on emptiness
  alone breaks access grants.
- Do not report `_embedded.stats.hasAdminPrivileges` — it has a known accuracy
  defect for groups with custom admin roles.
- `BUILT_IN` groups are not cleanup candidates.

**Verified.** `useOktaApi/groupDiscovery`, `sidepanel/export/descriptors/groups`.

---

## 7. Which groups are rule-fed, manual, empty, or orphaned

**Question.** Classify every group in the org by how its membership is maintained.

**Answer shape.** `{ group, type, memberCount, feedingRules[],
class: 'rule-fed' | 'manual' | 'empty' | 'orphaned-rule-target' }`

**Call sequence.**

1. `GET /api/v1/groups?limit=200&expand=stats` — inventory and counts.
   _ceil(groups/200) calls._
2. `GET /api/v1/groups/rules?limit=200` — every rule.
   _ceil(rules/200) calls._
3. Invert step 2 into a map of group id → rules targeting it, by reading each rule's
   `actions.assignUserToGroups.groupIds`.

**Cost.** 1,000 groups, 300 rules: **7 calls** for a whole-org classification. No
per-group calls at all.

**Decision rules.**

- Rules target it, members > 0 → `rule-fed`.
- Rules target it, members = 0 → `orphaned-rule-target`: a rule exists but matches
  nobody. Usually a broken condition, and the highest-value finding here.
- No rules target it, members > 0 → `manual`.
- No rules, no members → `empty`.
- Only `OKTA_GROUP` can be rule-fed; classify other types by `type` and stop.

**Gotchas.**

- An **inactive** rule still names its targets. A group fed only by an inactive rule
  is effectively manual — check rule `status`, not just existence.
- A rule can target up to 100 groups, so step 3 is a fan-out, not a 1:1 map.
- Membership counts are point-in-time; a rule that runs on user update may populate
  an `orphaned-rule-target` later.

**Verified.** `useOktaApi/groupDiscovery`, `shared/rules/groupRuleIndex`.

---

## 8. Which access policy governs this app, and what it requires

**Question.** For app A, what must a user satisfy to sign in?

**Answer shape.** `{ app, policy, rules: { name, priority, conditions, actions }[] }`

**Call sequence.**

1. `GET /api/v1/apps/{A}` — read `_links.accessPolicy.href`. _1 call._
2. Extract the trailing path segment as the policy id and **validate** it against
   `^(?:rst|00p)[A-Za-z0-9]{15,}$` before using it in a request path.
3. `GET /api/v1/policies/{policyId}` — the policy. _1 call._
4. `GET /api/v1/policies/{policyId}/rules` — its rules. _1 call._
5. If step 1 exposes no `accessPolicy` link:
   `GET /api/v1/policies?type=OKTA_SIGN_ON&limit=200` for the org-level policy.
   _1 call._

**Cost.** **3 calls**, or 4 via the fallback.

**Decision rules.**

- Present rules **in `priority` order**; first match wins, and an unordered list
  misrepresents which one applies.
- `system: true` marks an Okta-managed rule.
- No `accessPolicy` link → not governed by a dedicated access policy. That is not
  "unprotected"; the org-level sign-on policy applies.

**Gotchas.**

- **Policy reads are commonly 403 for non-super-admins.** Degrade to "policy
  unknown" and keep the rest of the report. Failing the whole job on a policy 403 is
  the worse outcome.
- The id comes out of a response body — untrusted input. Validate before it enters a
  URL.
- `conditions` and `actions` shapes vary by policy type. Read defensively; a schema
  tight enough for `ACCESS_POLICY` drops `PASSWORD` rules entirely.
- Policy zone conditions reference zone ids — resolve them via `GET /api/v1/zones`
  or the report is unreadable.

**Verified.** `useOktaApi/policyOperations` (`extractAccessPolicyId`).

---

## 9. Overlapping or duplicate group rules

**Question.** Which rules are consolidation candidates?

**Answer shape.** `{ cluster: rule[], sharedTargets[], relationship:
'identical-condition' | 'identical-targets' | 'subset' }`

**Call sequence.**

1. `GET /api/v1/groups/rules?limit=200` — every rule. _ceil(rules/200) calls._
2. Normalise each condition (whitespace, connective word forms `AND`/`&&`) and
   index by normalised condition and by target set.
3. Optionally `GET /api/v1/groups/{id}?expand=stats` for named clusters, to show
   what a merge would affect. _1 call per group of interest._

**Cost.** 300 rules: **2 calls** for the whole analysis. Cheap enough to run
routinely.

**Decision rules.**

- Identical normalised condition, different targets → merge candidate: one rule with
  the **union** of targets.
- Identical targets, different conditions → possible `OR` merge; higher risk, since
  it changes which users match.
- One condition's matched set is a subset of another's → redundancy, but prove it by
  evaluation rather than by string comparison.

**Gotchas.**

- **Respect the limits when merging:** 100 target groups per rule, 50 characters per
  rule name, 2,000 rules per org. A merge that breaches the name cap fails at create
  time — truncate deliberately.
- Normalise connectives before comparing, or `AND` and `&&` read as different rules.
- Merging changes attribution: members previously attributed to two rules become
  attributable to one. Recipe 1's output changes as a result — expected, and worth
  saying.
- Never merge across rules with different `status`; an inactive rule contributes no
  members today.

**Verified.** `shared/rules/consolidation`, `shared/rules/similarity`,
`shared/ruleEvaluator` (`RULE_CONNECTIVE_OPERATORS`).

---

## 10. Deprovisioned or suspended users still holding access

**Question.** Which non-active users still have group memberships or app
assignments?

**Answer shape.** `{ user, status, groups[], apps[], riskNote }`

**Call sequence.**

1. `GET /api/v1/users?search=status eq "DEPROVISIONED" or status eq "SUSPENDED"&limit=200`
   — the population. _ceil(users/200) calls._
2. Per user: `GET /api/v1/users/{id}/groups?limit=1` — count via `x-total-count`,
   to triage cheaply before expanding. _N calls._
3. Only for users with a non-zero count: `GET /api/v1/users/{id}/groups?limit=200`.
   _M calls._
4. Optionally per user:
   `GET /api/v1/apps?filter=user.id eq "{id}"&limit=200&expand=user/{id}`. _M calls._

**Cost.** 200 non-active users, 60 holding access: **1 + 200 + 60 (+60)** ≈
**321 calls**. The `limit=1` triage in step 2 is what keeps steps 3 and 4 small.

**Decision rules.**

- Deactivating a user does **not** strip group memberships or app assignments. Their
  presence is expected, not anomalous — the finding is the residue, not a bug.
- Separate `SUSPENDED` (reversible, retaining access is often intentional) from
  `DEPROVISIONED` (usually offboarded, where residue is the finding).
- Group rules skip deprovisioned users, so a rule will not re-add them — but it also
  will not remove them.

**Gotchas.**

- This is an assignment report, not an access report. These users cannot sign in;
  the risk is reactivation restoring access silently, and stale entitlement data in
  downstream reviews.
- `BUILT_IN` groups such as Everyone will appear for everyone. Filter them out or
  the report is noise.
- Consider `search` result freshness: a just-deactivated user may not appear
  immediately. For an audit, prefer a full walk.

**Verified.** `useOktaApi/userOperations`, `useOktaApi/groupCleanup`.

---

## 11. What changed, by whom, and when

**Question.** For an entity, reconstruct its recent change history.

**Answer shape.** `{ event, published, actor, targets[], outcome }`

**Call sequence.**

1. Establish current state from the entity API — group members, app assignments, or
   user profile.
2. `GET /api/v1/logs?filter={expr}&since={ISO}&until={ISO}&limit=1000
&sortOrder=DESCENDING` — the history. _ceil(events/1000) calls._

Filters by question:

```
# Membership changes for one group
filter=eventType sw "group.user_membership." and target.id eq "00gFAKE…"

# Everything about one rule
filter=eventType sw "group.rule." and target.id eq "0prFAKE…"

# One user's lifecycle
filter=eventType sw "user.lifecycle." and target.id eq "00uFAKE…"

# One actor's activity
filter=actor.id eq "00uFAKE…"
```

**Cost.** Usually **1–3 calls**. `limit` here is 1000, not 200.

**Decision rules.**

- Select from `target` **by `type`** (`User`, `UserGroup`, `AppInstance`), never by
  array position — a membership event names both user and group.
- `actor` may be a service principal or Okta itself. "An automation did it" is a
  valid and important answer.
- Check `outcome.result` — a `FAILURE` event is an attempt, not a change.

**Gotchas.**

- **90-day retention.** Older events are simply absent. Report "no event in the
  retention window", never "it never happened".
- **Events are not state.** An `add` event does not prove current membership; a later
  `remove` may exist. Always reconcile against the entity API.
- For continuous consumption, use the polling pattern: `sortOrder=ASCENDING`, no
  `until`, follow `rel="next"` and persist the **cursor**. The polling `next` link
  always exists, so an empty page means "nothing new", not "done".
- Polling order is internal persistence time, not event time — never track position
  by remembered timestamp.
- For ongoing needs, event hooks beat polling and are Okta's own recommendation.

See `system-log.md`.

---

## Composing further

These cover the common shapes. For a question not listed:

1. Identify the entity the answer is keyed on — that picks the primary endpoint.
2. Check `request-optimization.md` for a parameter that removes a per-item loop.
3. Decide whether the question is about _current state_ (entity API) or _history_
   (System Log). Most confusion comes from asking one of them for the other's
   answer.
4. Compute the call count before running. If it is large, say so first.
5. Decide what an item-level failure means, and label partial results as partial.
