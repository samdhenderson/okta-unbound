# System Log

`GET /api/v1/logs` is the only endpoint that answers _when_ and _by whom_. Every
other endpoint describes the world as it is now; the log is the only record of how
it got that way.

It is a time-series API with its own pagination contract. Applying the CRUD mental
model to it produces either a loop that never terminates or a report that silently
misses events.

Marker legend lives in `../SKILL.md`.

## The endpoint

```
GET /api/v1/logs?since={ISO8601}&until={ISO8601}&filter={expr}&limit=1000&sortOrder=DESCENDING
```

| Parameter         | Notes                                                      |
| ----------------- | ---------------------------------------------------------- |
| `since` / `until` | ISO 8601 bounds. Meaning differs by query mode — see below |
| `filter`          | SCIM-style expression over event properties                |
| `q`               | Free-text search across the event                          |
| `limit`           | Default 100, **maximum 1000** — higher than the usual 200  |
| `sortOrder`       | `ASCENDING` (default) or `DESCENDING`, on `published`      |
| `after`           | Opaque cursor, from the `Link` header only                 |

`[docs]`

**Retention is 90 days.** Events older than that are not returned, per Okta's data
retention policy. Any question of the form "when was this user added to this group"
is answerable only if it happened inside the window — and unanswerable, not
"never happened", if it did not. Say which. `[docs]`

## Two query modes

The same endpoint behaves differently depending on intent, and the difference is
not cosmetic.

**Bounded queries** — a historical window. `since`/`until` bound the event's
`published` time. Pagination terminates normally when the `next` link stops
appearing.

**Polling queries** — an ongoing stream. Events are ordered by **internal
persistence time**, meaning when the event was committed to the log, _not_ the
timestamp at which it occurred. `[docs]`

That distinction is the one that bites. An event that occurred at 10:00 but was
committed at 10:05 appears in the stream after events that occurred at 10:03. A
poller that filters on `published` to decide what is new will drop it. Track
position with the **cursor**, never with a remembered timestamp.

### The polling pattern

```
sortOrder=ASCENDING, no `until`, follow `rel="next"` forever
```

1. First call: `GET /api/v1/logs?sortOrder=ASCENDING&since={start}&limit=1000`.
2. Process the page.
3. Follow `rel="next"`. Persist that URL as the resume point.
4. When a page returns zero events, the stream is current — wait, then re-issue the
   **same** next URL.

**The `next` link always exists in System Log polling queries.** `[docs]` This is
the documented exception to the usual termination rule: an empty page with a `next`
link means "nothing new yet", not "you are done". A generic paginator that stops on
an empty page will silently end the stream; one that loops on the link without a
delay will spin against the rate limiter. Both are wrong — poll on an interval.

Persist the cursor, not a timestamp. It survives restarts and is immune to the
persistence-time reordering above.

## Filtering

`filter` uses the standard SCIM operator set (see `search-filter-syntax.md`), and
the System Log is the endpoint with the **widest** operator support: it is the only
one that supports `ew`, and its `co` has no 3-character minimum. Both remain
case-sensitive. `[docs]`

`eventType` is a hierarchical `parent.sublevel.action` string, which makes `sw`
the workhorse operator: `[docs]`

```
# All group membership changes
filter=eventType sw "group.user_membership."

# All user lifecycle events
filter=eventType sw "user.lifecycle."

# One event type, one target
filter=eventType eq "group.user_membership.add" and target.id eq "00gFAKE…"

# Failures only
filter=outcome.result eq "FAILURE"

# One actor's activity
filter=actor.id eq "00uFAKE…"
```

Combine with `since`/`until` rather than filtering client-side — the log is large,
and an unbounded query is a rate-limit problem rather than a slow one.

## The event object

Fields that matter for reporting: `[docs]`

| Field                       | Is                                                         |
| --------------------------- | ---------------------------------------------------------- |
| `eventType`                 | The hierarchical type string                               |
| `published`                 | When the event occurred                                    |
| `actor`                     | Who did it — `{ id, type, alternateId, displayName }`      |
| `target`                    | What it was done to — an **array**, often several entities |
| `outcome.result`            | `SUCCESS`, `FAILURE`, `SKIPPED`, …                         |
| `displayMessage`            | Human-readable summary                                     |
| `severity`                  | `DEBUG` … `WARN`, `ERROR`                                  |
| `client`, `securityContext` | IP, user agent, geo, ASN                                   |
| `authenticationContext`     | Session and authentication detail                          |

**`target` is an array, not an object.** A membership change names both the user and
the group in it, and reading `target[0]` blindly attributes the event to whichever
happens to be first. Select by `target.type` (`User`, `UserGroup`, `AppInstance`),
never by position.

**`actor` can be a system principal**, not a person — Okta itself, or a service app
acting via an API token. "Who changed this" must be able to answer "an automation"
without implying a human did it.

## Event types worth knowing

`[docs]` — the authoritative and complete list is at the Event Types reference in
the sources below; fetch it when an exact string matters.

| Prefix / type                           | Covers                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `group.user_membership.add` / `.remove` | Group membership changes — the timestamps the Groups API cannot give you |
| `group.lifecycle.*`, `group.rule.*`     | Group and group-rule create/update/delete/activate                       |
| `application.user_membership.*`         | App assignment changes                                                   |
| `user.lifecycle.*`                      | Create, activate, suspend, deactivate, delete                            |
| `user.session.start` / `.end`           | Sign-in and sign-out                                                     |
| `user.authentication.*`                 | Authentication attempts, including MFA challenges                        |
| `user.mfa.factor.*`                     | Factor enrolment, reset, deactivation                                    |
| `policy.lifecycle.*`, `policy.rule.*`   | Policy and policy-rule changes                                           |
| `system.api_token.*`                    | API token creation and use                                               |

## Composing with the rest of the API

The log is the answer to every "when/who" question the Management API cannot
answer, and the pattern is always the same: **current state from the entity API,
history from the log.**

- _"When was this user added to this group, and by whom?"_ — membership from
  `GET /api/v1/groups/{id}/users`, history from
  `eventType eq "group.user_membership.add" and target.id eq "{groupId}"`.
- _"Who changed this rule?"_ — `eventType sw "group.rule."` plus the rule id.
- _"Did anyone use this app last quarter?"_ — `application.*` events, bounded by
  `since`/`until`, subject to the 90-day window.

Two standing cautions:

- Log entries are not a substitute for current state. An `add` event does not prove
  the user is still a member; a later `remove` may exist. Reconcile against the
  entity API rather than replaying events.
- Absence of an event within 90 days is not absence of the action. Say "no event in
  the retention window" — never "it never happened".

## Sources

- System Log API —
  https://developer.okta.com/docs/api/openapi/okta-management/management/tags/systemlog
- System Log query guide, polling and bounded modes —
  https://developer.okta.com/docs/reference/system-log-query/
- Event Types reference (complete list) —
  https://developer.okta.com/docs/reference/api/event-types/
- Pagination and the always-present polling `next` link —
  https://developer.okta.com/docs/api/#pagination
- System Log filters and search —
  https://help.okta.com/en-us/content/topics/reports/syslog-filters.htm

See `search-filter-syntax.md` for the operator set and
`pagination-and-limits.md` for why this endpoint is the exception to the
empty-page termination rule.
