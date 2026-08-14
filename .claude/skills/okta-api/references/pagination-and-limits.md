# Pagination and rate limits

Two cross-cutting concerns that apply to every list endpoint in the API. Getting
either wrong produces a job that hangs, floods, or silently truncates.

Marker legend lives in `../SKILL.md`.

## Pagination

Okta paginates with an opaque cursor delivered in an RFC 8288 `Link` response
header. `[docs]`

```
link: <https://{yourOktaDomain}/api/v1/logs?limit=20>; rel="self"
link: <https://{yourOktaDomain}/api/v1/logs?limit=20&after=1627500044869_1>; rel="next"
```

Relevant `rel` values are `self` (the current page) and `next` (the following one).

### The rule: follow the link, never build the cursor

Okta states it directly: _"It's important to follow these Link header values instead
of constructing your own URLs as query parameters or cursor formats may change
without notice."_ `[docs]`

The `after` value is an opaque cursor. It is not a user id, not a timestamp, and not
stable across endpoints, even where it looks like one.

**Never URL-decode a cursor.** Cursor values are base64-ish and can contain `+`. A
round trip through a decoder turns `+` into a space and the next request 400s or
silently returns the wrong page. Read the parameter as raw bytes and re-append it
unchanged. `[verified: shared/utils/oktaPagination → rawQueryParam]`

### Page size

`limit=200` is the practical maximum for most collection endpoints and is the right
default for any full walk — it minimises both request count and rate-limit
consumption. `[verified: shared/utils/oktaPagination → OKTA_PAGE_SIZE]`

Per-endpoint maxima are not published in one place, and endpoints differ in both
cap and **default**. Treat a smaller-than-requested page as normal, not as the end
of the collection — termination is decided by the `Link` header, never by page
length alone.

Two endpoints break the pattern and are worth remembering:

- **`GET /api/v1/groups/{groupId}/users` defaults to `limit=1000`**, not 200 — Okta
  describes the default as "very high for historical reasons" and recommends 200.
  Setting it explicitly is the difference between a predictable walk and 1000-row
  pages. `[docs]`
- **`GET /api/v1/logs` accepts `limit=1000`** with a default of 100. Use the higher
  value; the log is the one place where large pages are both allowed and wanted.
  `[docs]`

Always set `limit` explicitly rather than relying on a default that varies per
endpoint and has changed over time.

Use a small `limit` deliberately in exactly two cases: type-ahead search, where
latency matters more than completeness (`limit=20`), and count-only questions
(`limit=1` plus `x-total-count`).

### The three traps

**1. The self-referential final page.** Some endpoints return a `rel="next"` link on
an empty or final page that points back at the current URL. A `while (nextUrl)` loop
that trusts the link alone pages forever and floods the rate limiter. Stop when the
cursor did not advance. `[verified: shared/utils/oktaPagination → nextPageUrl]`

Terminate on **any** of: no `next` link; the page returned zero items; the next URL
equals the current one.

The System Log is the deliberate exception — its `next` link _always_ exists,
because polling is an intended use. See `system-log.md`; do not apply the
empty-page guard there without accounting for it. `[docs]`

**2. Dropped parameters on the next link.** Okta does not consistently echo
first-page query parameters into `rel="next"`. `expand=stats` survives;
`expand=group-rules` does not. `[verified: useOktaApi/groupMembers,
shared/utils/oktaPagination → preserveQueryParams]`

The failure is silent: pages 2+ come back without the embed, and a report that
looked correct for the first 200 rows degrades for everyone after. Re-append the
parameters a given endpoint drops, per page.

Re-appending interacts with trap 1 — compare the _preserved_ URL against the current
one when checking whether the cursor advanced, or the re-append defeats the guard
and the loop never terminates. `[verified: shared/utils/oktaPagination →
fetchAllPages]`

**3. Counting from pages.** Page count is not item count, and a full walk is the
wrong way to answer "how many". Use `limit=1` with the `x-total-count` response
header. Treat a missing header as "unknown", never as zero.
`[verified: useOktaApi/userOperations]`

### The walk

```
url = "/api/v1/groups?limit=200&expand=stats"
while url:
    page = GET(url)
    handle(page.items)
    next = parseNextLink(page.headers["link"])     # rel="next", origin-relative
    if not next: break
    if len(page.items) == 0: break                 # trap 1
    next = reappendDroppedParams(next, url)        # trap 2
    if next == url: break                          # trap 1, post-re-append
    url = next
```

Decide up front whether a failed page aborts the job or degrades it. Aborting gives
a clean error; accumulating what succeeded gives a partial answer that must be
**labelled partial**. An unlabelled partial result is a wrong result.
`[verified: shared/utils/oktaPagination → fetchAllPages]`

## Rate limits

### Headers

Every response carries the current budget: `[docs]`

| Header                   | Contains                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| `X-Rate-Limit-Limit`     | The ceiling applicable to this request                           |
| `X-Rate-Limit-Remaining` | Requests left in the current window                              |
| `X-Rate-Limit-Reset`     | When the window resets — **UTC epoch seconds**, not milliseconds |

Exceeding a limit returns **HTTP 429**. `[docs]`

Header names are conventionally matched case-insensitively; normalise the key before
reading. `[verified: shared/scheduler/rateLimitDetector]`

### Throttle before 429, not after

The headers make the limit knowable in advance, so treating 429 as the signal is a
choice to hit the wall first. Okta's own guidance is to _"implement throttle logic
and retries with backoff"_ and to _"avoid aggressive, unnecessary polling"_. `[docs]`

A working strategy, proven on large scans: `[verified: shared/scheduler/apiScheduler]`

- Track `remaining / limit` per endpoint family from every response.
- Enter a cooldown when the projected remainder after in-flight requests falls below
  ~10%, waiting until `X-Rate-Limit-Reset` (capped, so a bad clock cannot stall the
  job indefinitely).
- Cap concurrency — around 5 in-flight requests is a reasonable default. Concurrency
  is the variable that turns a safe job into a 429 storm.
- Retry with exponential backoff, bounded (2s, 4s, give up).
- Coalesce identical in-flight GETs so a fan-out cannot issue the same request twice.
- Prioritise: user-facing lookups ahead of bulk scans, so an export cannot starve an
  interactive search.

Subtract in-flight requests from `remaining` before deciding. Requests already sent
but not yet answered have consumed budget the header has not counted.

### How limits are scoped

Limits are bucketed hierarchically rather than as one org-wide number: `[docs]`

- Org-wide buckets, the broadest scope.
- Nested per-client buckets (a specific app's quota inside the org quota).
- Authenticated-user buckets, tracked independently rather than nested.

Quotas vary by subscription, endpoint, HTTP method, and add-ons such as
DynamicScale, and Okta does not publish a single per-tier table. `[docs]` Do not
hardcode a number — read `X-Rate-Limit-Limit` from the org you are actually talking
to.

Consequences worth planning around: a burst against one endpoint family does not
necessarily consume another's budget, so a scan can be spread across families; and
concurrent jobs in the same org share a bucket, so a scheduled export can 429 an
interactive session that was fine a moment ago.

### Budgeting a scan

Before a large job, state the call count and the wall-clock floor:

```
calls  = ceil(entities / 200) + irreducible_per_entity_calls
floor  = calls / sustainable_rate_per_minute
```

An MFA scan over 5,000 users is ~5,000 irreducible calls. At a conservative
600/minute that is roughly 8 minutes of sustained traffic against the org. That is a
decision for an operator to make knowingly, not a surprise to discover halfway
through. Report the estimate first; see the cost table in
`request-optimization.md`.

Make long jobs cancellable, and make cancellation abort requests waiting in backoff
rather than only those queued. `[verified: shared/scheduler/apiScheduler]`

## Sources

- Pagination, `Link` header, opaque cursors —
  https://developer.okta.com/docs/api/#pagination
- Rate limit headers, 429, epoch-seconds reset —
  https://developer.okta.com/docs/reference/rl-best-practices/
- Rate limit bucket model and quota variability —
  https://developer.okta.com/docs/reference/rate-limits/

See `request-optimization.md` for removing calls before budgeting them, and
`system-log.md` for the log's distinct pagination contract.
