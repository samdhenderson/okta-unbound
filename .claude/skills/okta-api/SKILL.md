---
name: okta-api
version: 1.0.0
description: >-
  Expert knowledge of the Okta Admin/Core APIs for admins and developers building
  reports, exports, and bulk actions — endpoint selection, call-collapsing query
  parameters (expand=stats, expand=group-rules, expand=user/{id}), q vs search vs
  filter semantics, Link-header pagination traps, rate-limit headers, group rules
  and Okta Expression Language, MFA factors vs authenticators, app assignment
  scopes, policy types, and the System Log. Use when working with the Okta API,
  /api/v1/ endpoints, an Okta org, group membership or group rules, Okta MFA
  factors, app assignments, access policies, system log events, Okta pagination or
  rate limits, or when asked "who is in this group and why", "which users lack
  MFA", "who has access to this app", "what breaks if I deactivate this rule", or
  to build an Okta report, export, or bulk operation.
---

# Okta API

## Scope and stance

Knowledge of the Okta Management API for building reports, exports, and bulk
actions: which endpoint answers a question, which parameters make it cheap, and
which traps make a plausible answer wrong.

Two assumptions govern everything below. **Every list call is paginated** until
proven otherwise. **Every per-item loop is collapsible** until the references say
it is not.

## Standing rules

1. Request `limit=200` on every list endpoint unless a smaller page is deliberate.
   The System Log takes `limit=1000`.
2. Never hand-construct an `after` cursor. Follow the `Link: rel="next"` header —
   Okta states cursor formats may change without notice.
3. Never URL-decode a cursor. A `+` in a base64-ish token decodes to a space and
   round-trips wrong.
4. Before writing any per-item loop, check the collapsing table below for a
   parameter that removes it.
5. Read `X-Rate-Limit-Remaining` on every response and throttle _before_ 429, not
   after.
6. Treat `q=`, `search=`, and `filter=` as three different features, never as
   synonyms.

## The decision procedure

Run this before issuing anything:

1. **Identify the entity** the answer is keyed on — user, group, app, policy, event.
2. **Pick the endpoint** (`references/endpoint-index.md` when unsure).
3. **Check for a collapsing parameter** before accepting any per-item loop.
4. **Pick the right query parameter** — `q` for typing humans, `search` for almost
   everything else, `filter` where `search` does not reach.
5. **Compute the call budget** — `ceil(entities / 200)` plus irreducible per-item
   calls. State it out loud when it is large.
6. **Read the domain reference's gotchas** before interpreting the response.

Ask separately whether the question is about **current state** (entity API) or
**history** (System Log). Most wrong answers come from asking one for the other's
answer.

## Call-collapsing cheat sheet

| Endpoint                               | Parameter                   | Embeds                            | Saves                 |
| -------------------------------------- | --------------------------- | --------------------------------- | --------------------- |
| `GET /api/v1/groups`                   | `expand=stats`              | Exact member count                | 1 call per group      |
| `GET /api/v1/groups`                   | `expand=app`                | Source app for app-sourced groups | 1 call per group      |
| `GET /api/v1/groups/{id}/users`        | `expand=group-rules`        | Per-member rule attribution       | 1 call per member     |
| `GET /api/v1/apps?filter=user.id eq …` | `expand=user/{id}`          | Assignment `scope`                | 1 call per app        |
| `GET /api/v1/apps/{id}/groups`         | `expand=group`              | The full group object             | 1 call per assignment |
| `GET /api/v1/devices`                  | `expand=user`               | The device's users                | 1 call per device     |
| Any list endpoint                      | `limit=1` + `x-total-count` | Exact total, in a header          | A full walk to count  |

Contracts, embed shapes, and per-parameter pagination behaviour are in
`references/request-optimization.md`.

`expand=group-rules` became **documented and GA on 3 June 2026**. Material written
before that date — including much community guidance and this repo's own code
comments — still calls it a private admin-console parameter. It is not, any more.

Parameters do not survive pagination uniformly: Okta preserves `expand=stats` in
the `rel="next"` link and **drops** `expand=group-rules`. Re-append what is dropped,
per page, or results silently degrade after the first 200 rows.

## Cost model

| Question                                        | Naive       | Optimized             |
| ----------------------------------------------- | ----------- | --------------------- |
| Attribute 500 group members to rules            | 501         | **4**                 |
| Group inventory with exact counts, 1,000 groups | 1,005       | **5**                 |
| One user's app assignments with scope, 60 apps  | 61          | **1**                 |
| Count a user's groups                           | ceil(n/200) | **1**                 |
| MFA factors for 500 users                       | 500         | **500 — irreducible** |

The last row matters as much as the rest. There is no bulk factors endpoint. When a
job is irreducible, state the number and let the operator decide rather than
disguising the cost or hunting for a parameter that does not exist.

## ID prefixes

`00u` user · `00g` group · `0pr` group rule · `0oa` app · `rst` or `00p` policy ·
`0ha` identity provider · `00o` org

Check the prefix before putting an id in a path. Passing a rule id where a group id
belongs is a real and common bug, and the resulting 404 does not say which argument
was wrong.

## Three warnings that change answers

These cause silently wrong reports rather than errors, so they are stated here
rather than deferred.

**The group-rules embed has three states, not two.** Array present and populated →
rule-fed. Array present and **empty** → an authoritative manual add. Key **absent**
→ Okta said nothing; fall back to deriving attribution. Collapsing empty into
unknown, or unknown into manual, mis-states membership. An absent key is not
evidence of a manual add.

**App-user `scope: 'USER'` means "has a direct assignment", not "direct only".**
Okta reports a single scope per app-user and prefers `USER`. A user assigned both
directly and via a group reports `USER`, and the group path is invisible in that
response. Establishing that no group path exists requires intersecting the app's
group assignments with the user's groups.

**Okta exposes no group-membership timestamp.** Neither the group member listing nor
`GET /api/v1/users/{id}/groups` carries an "added on" date, and the user-side
listing has no attribution embed at all. "When was this user added to this group" is
unanswerable from the Management API — only the System Log answers it, and only
within its 90-day retention window. Never synthesise the date from `created` or
`lastUpdated`; those describe the entities, not the membership.

## Two API surfaces

The **documented Management API** (`/api/v1/*`) is versioned, supported, and in the
changelog. The **internal admin-console API** is what the Okta Admin Console calls
for itself. Okta's position on the latter is explicit: undocumented endpoints are
private, subject to change without notice, and not covered by any agreement.

The internal surface is nonetheless sometimes worth using, because the documented
surface does not always answer the question at a runnable cost. Price the trade
rather than pretending it does not exist — and re-check it periodically, since
Okta does promote internal parameters to documented ones (`expand=group-rules`
went GA in June 2026 after years as an admin-console-only parameter). Four clauses
govern every such use:

1. Reach for it only when the documented surface cannot answer the question, or
   answers it at an order-of-magnitude worse cost. Convenience is not a reason.
2. Ship a documented-API fallback producing the same answer. No fallback, no use.
3. Probe, do not assume — internal parameters fail _silently_, returning 200 with
   the key absent. Detect absence at runtime and fall back.
4. Reads only, unless a human explicitly approved that specific write.

Risk tiers, catalogued internals, safe discovery method, and the disclosure rule are
in `references/internal-apis.md`. Output that depends on an internal API says so.

## Verification markers

Every factual claim in this skill carries a marker. The marker states where the
claim comes from, so a reader can weigh it and a maintainer can re-check it.

| Marker                        | Means                                                        | Required companion                            |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `[verified]`                  | Proven by running code and tests in the okta-unbound repo    | Module name + ADR number, plus a `src/…` path |
| `[docs]`                      | Stated by Okta's public documentation                        | A `developer.okta.com` URL                    |
| `[private:T1]`–`[private:T4]` | Undocumented or admin-console-only; may break without notice | Risk tier **and** a stated fallback           |
| `[unverified]`                | Believed true; not tested here and no supporting doc found   | Nothing, but the marker is mandatory          |

Rules that keep the markers meaningful:

- A `[private:…]` claim without both a tier and a fallback is not permitted in this
  skill. State what to do when an org does not honour the call.
- `[verified]` cites paths, never copied code. This skill states the _contract_; the
  repo holds the _implementation_. Copying code creates a second source of truth
  that drifts.
- Repo citations name the module and ADR first, the `src/…` path second — the path
  is a convenience pointer and may move.
- Any reference file that is more than half `[unverified]` is paraphrased
  documentation. Shrink it to index rows plus links in `references/doc-sources.md`.

Check for stale repo citations with:

```
grep -rho 'src/[^ ,)`]*' .claude/skills/okta-api | sort -u |
  while read -r p; do test -e "$p" || echo "stale: $p"; done
```

## Routing

Read the matching row(s) only. Reading every reference is context bloat and is not
the intended use of this skill.

| If the task is…                                                                                   | Read                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Not knowing which endpoint answers the question at all                                            | `references/endpoint-index.md`                           |
| Answering a named admin question end-to-end (a report)                                            | **`recipes.md` first**, then the files it cites          |
| Choosing params so one call returns what would take N                                             | `references/request-optimization.md`                     |
| Counting group members, or finding empty/stale groups                                             | `references/request-optimization.md`                     |
| Deciding between `q=`, `search=`, and `filter=`                                                   | `references/search-filter-syntax.md`                     |
| Getting HTTP 400 on a search or filter string                                                     | `references/search-filter-syntax.md`                     |
| Results look stale, or a just-written change is missing                                           | `references/search-filter-syntax.md` (consistency model) |
| Collecting more than one page of results                                                          | `references/pagination-and-limits.md`                    |
| A paging loop repeating, hanging, or losing an embed after page 1                                 | `references/pagination-and-limits.md`                    |
| Hitting 429, or budgeting a large scan before running it                                          | `references/pagination-and-limits.md`                    |
| Answering "why is this user in this group"                                                        | `references/groups-and-rules.md`                         |
| Creating, editing, or previewing the blast radius of a group rule                                 | `references/groups-and-rules.md`                         |
| Writing or reading an Okta Expression Language condition                                          | `references/groups-and-rules.md`                         |
| Determining MFA enrollment, factor strength, or FastPass usage                                    | `references/users-and-mfa.md`                            |
| Reading or filtering user profile attributes and custom schema                                    | `references/users-and-mfa.md`                            |
| Interpreting user status (STAGED vs PROVISIONED vs DEPROVISIONED)                                 | `references/users-and-mfa.md`                            |
| Determining who can access an app, and by which path                                              | `references/apps-and-policies.md`                        |
| Finding the sign-on or access policy that governs an app                                          | `references/apps-and-policies.md`                        |
| Listing policies or policy rules of any type                                                      | `references/apps-and-policies.md`                        |
| Investigating what changed, who changed it, or when                                               | `references/system-log.md`                               |
| Polling for new events, or backfilling an event window                                            | `references/system-log.md`                               |
| Working with admin roles, network zones, trusted origins, IdPs, behaviors, event hooks, or brands | `references/admin-and-org-surfaces.md`                   |
| Choosing or debugging authentication (SSWS / OAuth2 / session)                                    | `references/auth-modes.md`                               |
| Getting 401/403 on an endpoint that should work                                                   | `references/auth-modes.md` (scopes and mode limits)      |
| The documented API cannot answer the question at all                                              | `references/internal-apis.md`                            |
| Deciding whether an undocumented endpoint is worth the risk                                       | `references/internal-apis.md`                            |
| A call that used to work now 404s or returns a changed shape                                      | `references/internal-apis.md`                            |
| Replicating something the admin console can do but the API cannot                                 | `references/internal-apis.md`                            |
| Needing Okta detail this skill does not carry                                                     | `references/doc-sources.md`, then fetch the URL          |

<!-- Placeholder: add a row for references/okta-unbound-integration.md (the
     scheduler path, zod boundary, priority tiers) once the repo restructure
     settles. Deferred deliberately — v1 assumes no particular transport. -->

## Additional Resources

- `recipes.md` — 11 multi-endpoint compositions answering real admin questions, each
  with a call sequence, a call-count cost, decision rules, and gotchas.
- `references/endpoint-index.md` — flat path → "use when" → which reference lookup,
  including surfaces this skill covers only by link.
- `references/request-optimization.md` — the query parameters that collapse N calls
  into one, with exact embed shapes and per-endpoint echo behaviour.
- `references/pagination-and-limits.md` — `Link`-header walking, the pagination
  traps, rate-limit headers, and how to budget a large scan.
- `references/search-filter-syntax.md` — `q` vs `search` vs `filter`: operators,
  per-endpoint support, and the consistency model.
- `references/groups-and-rules.md` — group types, the membership attribution model,
  group rule lifecycle, and the Okta Expression Language subset rules accept.
- `references/users-and-mfa.md` — user statuses and lifecycle, profile schema, the
  factor vocabulary, and how factors relate to authenticators.
- `references/apps-and-policies.md` — app assignment scopes, app groups and users,
  policy types, and locating the policy that governs an app.
- `references/system-log.md` — `/api/v1/logs`: event taxonomy, time windows,
  retention, and the polling pattern.
- `references/admin-and-org-surfaces.md` — shallow but linked coverage of roles,
  network zones, trusted origins, behaviors, IdPs, event hooks, and brands.
- `references/auth-modes.md` — SSWS tokens, OAuth2 service apps with scopes, and
  browser-session auth; what each mode can and cannot reach.
- `references/internal-apis.md` — the undocumented admin-console surface, its risk
  tiers, and the rules for using it responsibly.
- `references/doc-sources.md` — topic → official Okta documentation URL, for
  fetching detail this skill does not include.
