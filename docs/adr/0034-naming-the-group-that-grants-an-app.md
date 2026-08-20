# ADR-0034: Naming the group that grants an app — embed first, intersect as fallback

- Status: Accepted
- Date: 2026-08-19
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary), ADR-0009
  (one batch runner for multi-call operations), ADR-0020 (provenance, and a failed
  lookup is never an attribution), ADR-0031 (per-membership proof, on demand),
  `docs/security.md` §6

## Context

"Which group gives this person Salesforce?" is the question the Apps surface
existed to answer and did not. It reported a **scope** — `USER`, `GROUP`, or
nothing — and where the scope was `GROUP` it said, in as many words, that naming
the group was not on offer: _"Which group grants it is not shown — naming it costs
an extra request per app"_ (`components/users/comparison/AppScopeIndicator.tsx`).

That sentence was untrue, and it had been untrue since the scope was first read.
`getUserApps` asks `GET /api/v1/apps?filter=user.id eq "{id}"` with
`expand=user/{userId}` (`useOktaApi/userOperations.ts:168`), and Okta answers with
an embedded app-user whose `_links.group.href` names the granting group.
`extractAppAssignmentScope` read `scope` out of that embed
(`shared/schemas/okta.ts:304`) and the surface discarded the rest of it — then
quoted the reader a price for the discarded half. The panel was preparing to
charge a request for an answer it had already been handed and thrown away.

The reason the price seemed unavoidable is real, and it is ADR-0031's. Okta has no
endpoint for "which group grants this app to this user"; the only way to compute it
is to walk `GET /api/v1/apps/{appId}/groups` and intersect with the user's
memberships — **one paginated walk per app**, linear in app count. ADR-0031
declined to spend exactly that shape of cost automatically for the per-membership
proof, and gated it behind a per-row click instead.

## Decision

**Read the answer off the embed we already pay for. Where the embed is silent, and
only there, intersect — visibly, cancellably, and only when Okta has said a group
is involved.**

### 1. Embed first, at zero cost

`extractAppGrantGroupId` (`shared/schemas/okta.ts:379`) is the sibling of
`extractAppAssignmentScope` over the same `_embedded` value, on the same page of
the same response: one reads _how_ the assignment was granted, the other _which
group_ granted it. `getUserApps` fills `UserAppAssignment.grantGroupId` from it on
the primary walk (`useOktaApi/userOperations.ts:181`–`186`).

No additional request, no fan-out, no button. For most rows on most orgs this is
the whole feature, and the fallback below never runs at all.

### 2. Intersect only as fallback, only where the scope is `GROUP`

Rows the embed left unnamed are filtered by `unresolvedGroupApps`
(`hooks/useUserApps.ts:131`), whose predicate is deliberately narrow:
`grantGroupId === undefined && scope === 'GROUP'`. A row with **no scope at all** is
unknown, and spending a paginated walk to narrow candidates for an assignment Okta
never said was group-granted is paying for a guess.

For the rows that survive that filter, `getAppGroupAssignments`
(`useOktaApi/appOperations.ts:187`) walks the app's assigned groups at `low`
priority, the result is cached under `cacheKeys.appGroups(appId)` at `TTL_LONG`
(`sidepanel/cache/keys.ts:145`), and the ids are intersected with the user's
memberships — which the detail rung already holds, so nothing re-fetches
`/users/{id}/groups` and no second copy can disagree with the Groups pane.

**This is the linear cost ADR-0031 gated its proof behind, and it runs here.** The
difference that makes it acceptable is that it is _visible_. It goes through
`coreApi.runOperation` (ADR-0009) as one named, tracked operation
(`hooks/useUserApps.ts:216`–`237`), so it appears in the ActivityBar with live
`completed/total` counts and a Cancel that actually stops it, and the pane caveats
the rows it has not finished resolving. ADR-0031's read had no such surface: it
would have fanned out silently on mount, spending an admin's rate limit on a
question nobody asked, with no way to see it happening or stop it. A cost an admin
can watch and cancel is a different object from a cost that happens to them.

Three things bound it further. It runs only when the Apps pane is asked for
(deferred re-arm, ADR-0018). It is latched per `(user, app set)`
(`hooks/useUserApps.ts:203`), so returning to the pane replays nothing. And each
underlying walk is cached, so a second visit costs nothing at all.

### 3. `scope: 'USER'` and a named group are not contradictory

Okta reports **one** scope per app-user and prefers `'USER'`. A user who is both
directly assigned _and_ reached by an assigned group therefore reports `'USER'`,
and the group path is invisible in that field — while the same embed may still
carry the group link.

So a row can truthfully carry `scope: 'USER'` **and** a `grantGroupId`, and the
pane states both: the `Direct` badge and a `Through {group}` line together
(`components/users/appSourceSummary.ts:257`–`292`). Treating the two as
complementary — reading `'USER'` as "not via a group" — would be the panel
inventing a negative Okta never asserted. That combination is precisely what the
old comparison surface could not express, and a large part of why this pane exists.

### 4. What it refuses to conclude

- **More than one candidate group narrows without naming.** The intersection
  resolves a row only when exactly one of the app's assigned groups is a group the
  user is in (`hooks/useUserApps.ts:234`). Two or more and the row stays
  unresolved. Picking the most plausible one would be an attribution invented in
  the client, which is the line ADR-0020 drew and this does not cross.
- **A failed walk (`null`) is not an empty one (`[]`).**
  `getAppGroupAssignments` returns `null` when the walk failed and `[]` when Okta
  positively reported no assigned groups, and neither becomes an answer about this
  user. Collapsing them would manufacture a confident "no group grants this" out of
  a transport failure — the same defect ADR-0020 removed from the attribution
  paths.
- **An absent `grantGroupId` is unknown, and stays unknown.** It is never rendered
  as "assigned directly" and never as "no group path exists"; the row keeps saying
  so in words, in italic, so a stated absence cannot read as a stated fact.
- **A partial primary walk surfaces as `complete: false`, never as a shorter
  list** (`useOktaApi/userOperations.ts:194`, surfaced at
  `hooks/useUserApps.ts:287`). A transport failure rendered as "fewer apps" is a
  confident wrong statement about someone's access.

### 5. The id is pattern-validated before it can reach a request path

The group id is a trailing path segment of an href inside an **untrusted response
body**, and callers interpolate it into a request path. It is therefore checked
against `/^00g[A-Za-z0-9]{15,}$/` (`shared/schemas/okta.ts:328`) before
`extractAppGrantGroupId` will return it; anything that fails is discarded and the
row reports unknown.

This is the posture `POLICY_ID_PATTERN` already applies to the `_links.accessPolicy`
href, and the same reason `shared/utils/oktaUrl.ts` parses hostnames instead of
substring-matching them (`docs/security.md` §6). The href itself is never logged —
it carries tenant identifiers.

## Consequences

- The common case got **cheaper and better at once**: rows that used to say "via a
  group, which one is not shown" now name the group for no request at all, and the
  Groups pane gains the inverse (`Also grants: …`) from the same derivation
  (`indexAppsByGroup`), so the two panes cannot drift into two answers about one
  assignment.
- `AppScopeIndicator`'s `GROUP` caveat is still the copy of record for a row the
  fallback could not resolve, and `APP_SOURCE_COPY` reuses those strings verbatim
  rather than inventing a second vocabulary for the same facts; a test renders the
  real indicator and compares, so the two cannot silently diverge.
- The fallback's derived answers are held **beside** the cached list, not written
  into it (`hooks/useUserApps.ts:154`). The cached value stays what Okta returned;
  a client-side narrowing must not masquerade as part of that response.
- ADR-0031 is untouched. Its per-membership proof is a different question against a
  different endpoint, still user-initiated, still uncached. Nothing here makes a
  membership claim; this names an _app_ grant, and only when one group can account
  for it.
- One new low-priority read (`getAppGroupAssignments`) and one new cache key
  (`cacheKeys.appGroups`). No new message action, no new permission, and everything
  rides the existing scheduler path.
- App labels, group names and hrefs are end-user-controllable Okta data. Nothing on
  this path logs any of them — the fallback logs attempted/resolved/failed/cancelled
  counts and nothing else.
- **Residual.** An app assigned through two of the user's groups is unresolvable by
  construction: the intersection cannot say which one Okta credits, and Okta's embed
  did not say. Those rows stay in the honest unknown state rather than being
  resolved by a tiebreak the client would have to invent.
