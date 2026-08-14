# Internal APIs

Okta has two surfaces. The **documented Management API** (`/api/v1/*`, versioned,
supported, in the changelog) and the **internal admin-console API** — the endpoints
and parameters the Okta Admin Console calls for itself.

Marker legend lives in `../SKILL.md`.

## Okta's position, stated plainly

> "Don't consume any Okta API not documented by this reference portal. All
> undocumented endpoints are considered private, subject to change without notice,
> and not covered by any agreements." `[docs]`

That is unambiguous, and this file does not soften it. Using the internal surface
means accepting that it can break at any time, that Okta Support will not help, and
that no agreement covers it.

## Why this file exists anyway

Because the trade is sometimes clearly worth making, and pretending otherwise
produces worse outcomes than pricing it honestly.

The question is never "documented or not". It is: _what does this buy, what breaks
when it goes, and what happens then?_ This file prices that.

### The case study: `expand=group-rules`

For years, per-member group rule attribution had no documented answer. The Admin
Console rendered an "assigned by rule" column using an undocumented `expand`
parameter, and tools that wanted the same data either used it or paid 1 call per
member — 501 calls for a 500-member group, versus 4.

Plenty of teams took that trade. It was the right call: the alternative was a report
that could not run at org scale.

**On 3 June 2026, Okta made it documented and GA**, and shipped a companion
endpoint (`GET /api/v1/groups/{groupId}/users/{userId}/group-rules`) for the
per-user case. `[docs]`

Three lessons, and they are the reason this file is structured the way it is:

1. **Internal use is often a leading indicator of demand.** Parameters the console
   relies on are the ones most likely to be promoted, because Okta is already
   maintaining them.
2. **Status changes silently in the useful direction too.** There was no
   deprecation notice to watch — the signal was a release note. Re-check the
   documented surface periodically; a workaround maintained past its need is pure
   cost.
3. **Stale "this is private" claims outlive the fact.** Community guidance, blog
   posts, and this repo's own code comments still describe `expand=group-rules` as
   an undocumented admin-console parameter. Verify status against current release
   notes before repeating it — including from this skill.

### What the community actually does

`rockstar`, the most widely used community Okta admin extension, calls **only
documented `/api/v1/*` endpoints**. Its `/admin/*` strings are UI deep links, not
API calls. `[verified: gabrielsroka/gabrielsroka.github.io, rockstar.js]`

That is worth knowing before assuming a task needs the internal surface: the
reference implementation for bulk Okta admin work does not use it. The documented
API is broader than its reputation, and the first move is always to check whether
the documented answer already exists.

## Clause zero: confirm it is still internal

Before treating anything as internal, check that it has not been documented since
whatever source called it private:

1. Search the current API reference for the endpoint or parameter.
2. Search the release notes for the resource name — promotions land there, and only
   there. Both engines carry the same entries:
   `okta-developer-docs/packages/@okta/vuepress-site/docs/release-notes/`.
3. Check the current SDK reference. Method signatures list documented parameters and
   their permitted values — `listGroups`, for instance, documents `expand` as
   accepting `stats` and `app`.

This step is cheap and it is the one most often skipped. `expand=group-rules` spent
years as folklore and is now supported; anything maintained as a workaround for it
today is pure cost.

## The four-clause rule

Every use of the internal surface satisfies all four. They are not guidelines.

1. **Reach for it only when the documented surface cannot answer the question, or
   answers it at an order-of-magnitude worse cost.** Convenience is not a reason.
   Neither is "the console does it this way".
2. **Every internal call ships with a documented-API fallback that produces the same
   answer**, even if slower or lower-confidence. No fallback means no use — because
   the day it breaks, the feature is simply gone.
3. **Probe, don't assume.** Internal parameters commonly fail _silently_: HTTP 200,
   parameter ignored, key absent. Detect absence at runtime and fall back. Never
   infer meaning from absence.
4. **Reads only, unless a human explicitly approved this specific write.** An
   undocumented read that breaks returns bad data you can detect. An undocumented
   write that breaks corrupts identity state.

## Risk tiers

"Internal" is not one risk. Assign a tier before deciding.

| Tier   | Profile                                                         | Fails by                                | Posture                                       |
| ------ | --------------------------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| **T1** | Undocumented _parameter_ on a documented endpoint               | Being ignored — 200, key absent         | Use with fallback                             |
| **T2** | Undocumented _endpoint_ the console calls, read-only            | Loudly — 404/403 — or by shape change   | Use with fallback + shape validation          |
| **T3** | Internal read whose unversioned _response shape_ is the product | Silently, with plausible-but-wrong data | Validate every field; prefer documented       |
| **T4** | Any undocumented mutation                                       | Corrupted state                         | **Do not.** Explicit human approval, recorded |

Tier ordering is by _detectability_, not by how undocumented something is. T1 is
safest because the failure is visible and local. T3 outranks T2 in danger despite
both being reads, because a shape change can produce a confident wrong answer where
a 404 merely produces an error.

## Catalogued internals

Only entries verifiable from this codebase or from Okta's own console behaviour.
No invented endpoints — an internal endpoint you cannot confirm is folklore, and
folklore in a skill is worse than a gap.

### `expand=group-rules` — GRADUATED, no longer internal

```
GET /api/v1/groups/{groupId}/users?limit=200&expand=group-rules
```

**Status: documented and GA since 3 June 2026.** Listed here only because so much
existing material — including this repo's code comments — still calls it private.
It is not. Use it as a normal documented parameter; full contract in
`request-optimization.md`.

Two behaviours carry over and still need handling, because they are properties of
the parameter rather than of its documentation status: Okta drops it from the
`rel="next"` link, so re-append it per page; and an org that does not honour it
returns 200 with the key absent rather than an error, so absence stays a state to
handle rather than an exception to catch.

**Verified.** `shared/membership/memberRuleAttribution` (three-state read),
`shared/utils/oktaPagination` (`preserveQueryParams`), ADR-0020.

### `/admin/users/search` status labels — T2

**Gives you.** The Admin Console's user search. Its practical significance here is
narrower and worth knowing even if you never call it: it returns **UI display
labels** rather than canonical API status names.

| API status         | Console label           |
| ------------------ | ----------------------- |
| `STAGED`           | Staged                  |
| `PROVISIONED`      | **Pending User Action** |
| `ACTIVE`           | Active                  |
| `RECOVERY`         | **Password Reset**      |
| `PASSWORD_EXPIRED` | Password Expired        |
| `LOCKED_OUT`       | Locked Out              |
| `SUSPENDED`        | Suspended               |
| `DEPROVISIONED`    | **Deactivated**         |

**Tier.** T2.

**Why it matters even without calling it.** Any comparison between a console export
and an API result must normalise these first. `PROVISIONED` versus "Pending User
Action" and `DEPROVISIONED` versus "Deactivated" are the pairs that silently
mismatch — a naive join drops or double-counts exactly the users an access review
cares about most.

**The fallback.** `GET /api/v1/users?search=…` with canonical statuses. It is the
better path for automation regardless.

**Verified.** Formerly `shared/utils/statusNormalizer`, which carried this mapping
table until it was deleted as unreachable dead code (ADR-0022, `docs/dead-code.md`).
The mapping itself is unchanged — but nothing in the codebase pins it any more, so
treat it as `[unverified]` and re-confirm against a console export before relying on it.

### `/admin/*` URLs — not an API

```
/admin/group/{groupId}
/admin/user/profile/view/{userId}
/admin/app/{appName}/instance/{appId}
```

Deep links into the Admin Console UI, for sending a human to the right page. Not
endpoints and not called programmatically.

They still carry one rule: build them from a **validated** org origin plus a
**validated** id, and never by string-concatenating values out of a response.
Interpolating an unvalidated id into a URL is how a response becomes a request you
did not intend. `[verified: shared/utils/oktaUrl]`

## Discovering internals safely

Endpoint lists go stale; method does not.

1. Open the Okta Admin Console in **your own org**, signed in as an admin whose
   access you are entitled to use.
2. Open browser DevTools → Network, filter to XHR/fetch.
3. Navigate to the console page that already shows the data you want. Console
   features map closely to single calls, so the page rendering the column you need
   is the page issuing the call that produces it.
4. Read the request: path, query parameters, and which response fields carry the
   data. Note whether the parameter is an addition to a documented endpoint (T1) or
   a wholly separate path (T2/T3).
5. Reproduce it read-only, against a small target, and compare against the
   documented equivalent to confirm it means what you think.

Rules for this process, not optional:

- **Stay on read-only pages.** Do not capture a mutation by performing one.
- **Never replay a captured request containing credentials or an XSRF token.** Those
  are per-session values; capture the _shape_, not the secrets.
- **Never record real org URLs, ids, tokens, or user data** into notes, code, or
  documentation. Use placeholders (`00gFAKE…`, `user@example.com`).
- **Do this only in an org you administer or are authorised to test.** Probing
  someone else's tenant is not research.

## The non-technical costs

Underweighted because they arrive later than the technical ones:

- **No support.** Okta Support will not troubleshoot an undocumented endpoint, and
  raising a ticket that depends on one reveals the dependency.
- **No changelog.** Documented endpoints get deprecation notices. These do not — the
  first signal is production behaviour changing.
- **Invisible to rate-limit documentation.** Internal endpoints may sit in different
  buckets with different quotas that are not published.
- **Terms of service.** Automated access to undocumented endpoints may exceed what
  an org's agreement permits. That is a question for whoever owns the contract, not
  an engineering judgement call.
- **Audit and compliance.** If a report's provenance includes an unsupported API,
  say so in the report. An auditor discovering it later is a much worse conversation
  than disclosing it up front.

## Disclosure

When output depends on an internal API, the output says so. A one-line provenance
note is enough:

> Rule attribution sourced from Okta's undocumented `expand=group-rules` parameter
> (unsupported; may change without notice). Members shown as _unknown_ were derived
> from the documented group-rules listing instead.

This is what makes the trade defensible rather than merely convenient. A reader who
knows which parts rest on an unsupported call can judge them accordingly; one who
does not has been misled about the report's reliability.

## Sources

- Undocumented endpoints policy — https://developer.okta.com/docs/api/
- Core Okta API — https://developer.okta.com/docs/reference/core-okta-api/
- Rate limits — https://developer.okta.com/docs/reference/rate-limits/
- Groups API enhancements GA, 3 June 2026 (the `expand=group-rules` promotion) —
  https://developer.okta.com/docs/release-notes/2026-okta-identity-engine/
- Release notes source, both engines —
  https://github.com/okta/okta-developer-docs/tree/master/packages/%40okta/vuepress-site/docs/release-notes
- rockstar, community reference implementation —
  https://github.com/gabrielsroka/gabrielsroka.github.io

See `request-optimization.md` for the `expand=group-rules` contract and
`groups-and-rules.md` for the attribution model it feeds.
