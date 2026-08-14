# Search and filter syntax

`q`, `search`, and `filter` are three different features that happen to share a
slot in the query string. They support different properties, different operators,
and different consistency characteristics. Choosing the wrong one is the most
common cause of an Okta 400, and the second most common cause of a report that is
quietly incomplete.

Marker legend lives in `../SKILL.md`.

## Choosing between them

|            | `q`                                                   | `search`                                   | `filter`                                |
| ---------- | ----------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| Purpose    | Simple name lookup                                    | General-purpose query                      | Targeted query on a narrow property set |
| Properties | A fixed few (users: `firstName`, `lastName`, `email`) | Broad, including custom profile attributes | A documented subset                     |
| Operators  | None — it is a starts-with match                      | Full operator set                          | Full operator set, fewer properties     |
| Sorting    | No                                                    | Yes (`sortBy`, `sortOrder`)                | No                                      |
| Best for   | Type-ahead and people pickers                         | Almost everything else                     | Narrow lookups on supported properties  |

Okta's guidance is to prefer `search` over `filter` or `q` for retrieving users,
for performance reasons. `[docs]`

**Decision procedure.** Use `q` when a human is typing and latency dominates
completeness. Use `search` for anything programmatic, especially anything touching
a custom profile attribute — `filter` cannot see most of them. Fall back to
`filter` only for a property `search` does not support.

**The cascade.** When the input is free text from a human and no single parameter
is guaranteed to hit, try them in order and stop at the first non-empty result:
`q`, then `search`, then a `filter` on an exact property when the input's shape
justifies it (for example, only attempting `filter=profile.email eq "…"` when the
string contains `@`). This trades a little latency for recall on inputs whose type
is unknown. `[verified: useOktaApi/searchUsersRequest]`

## Operators

Drawn from the SCIM protocol specification. `[docs]`

| Operator            | Meaning     | Notes                                                |
| ------------------- | ----------- | ---------------------------------------------------- |
| `eq`                | equal       | Exact match                                          |
| `ne`                | not equal   | Poorly supported; express as `lt … or … gt`          |
| `gt` `ge` `lt` `le` | ordering    | Lexicographical for strings, chronological for dates |
| `pr`                | present     | Attribute has a non-empty value; takes no operand    |
| `sw`                | starts with | Prefix match                                         |
| `co`                | contains    | Substring; see the restrictions below                |
| `ew`                | ends with   | **System Log API only**                              |

Logical operators are `and`, `or`, `not`, with `()` for precedence. `[docs]`

**`co` is heavily restricted.** On the Users, Groups, Devices, and Realms APIs it
requires **at least 3 characters** in the operand and is **case-sensitive**. The
System Log API has no character minimum but is likewise case-sensitive. Most other
APIs do not support `co` at all. `[docs]`

**`ne` is the trap.** Where it is unsupported, the documented workaround is a
`lt … or … gt` pair. Simply omitting a negation and filtering client-side is often
the more honest option — but then the result set is whatever the server sent, so
paginate the whole collection rather than a filtered slice.

## Value formatting `[docs]`

| Type    | Form                                   |
| ------- | -------------------------------------- |
| String  | Double-quoted, and a valid JSON string |
| Date    | ISO 8601: `"YYYY-MM-DDTHH:mm:ss.SSSZ"` |
| Number  | Unquoted literal                       |
| Boolean | `true` / `false`, unquoted             |

**Attribute names are case-sensitive; operators are case-insensitive.** `[docs]`
`profile.firstName` works, `profile.firstname` does not, and the error message will
not always make that obvious.

Percent-encode special characters inside values, but **do not encode the delimiters**
that give the request its structure. `[docs]` In practice: build the query string
with a proper encoder, then confirm it has not mangled the spaces separating
operands from operators.

## Per-endpoint support is not uniform

Okta states plainly that not all objects support filtering, and that supported
attributes and operators vary per object. `[docs]` There is no single matrix
covering every endpoint.

Practical consequence: **a filter Okta does not support may be ignored rather than
rejected.** A 200 with more rows than expected is a signal to check whether the
parameter took effect — count the result against an unfiltered `x-total-count`
before trusting it. Do not assume a successful status means a successful filter.

Verify per endpoint against the endpoint's own documentation
(`references/doc-sources.md`) rather than generalising from the Users API.

## Consistency

`search` is widely understood to be served from an index that lags writes slightly,
so a user created or modified moments earlier may not appear in a `search` result
immediately, while a direct `GET /api/v1/users/{id}` reflects it at once.
`[unverified]` — Okta's public documentation does not state this explicitly, and it
is recorded here as an operational belief rather than a documented guarantee.

What follows from it regardless of the mechanism, and is safe advice either way:

- After a write, **do not** verify by searching for the object. Read it by id.
- A read-after-write loop that polls `search` until the object appears is a
  rate-limit hazard with no upper bound. Read by id, or accept the write response.
- For reports where completeness matters more than latency, prefer a full walk with
  `limit=200` over a `search` that might miss recent changes.

## Query recipes

```
# Users in a department, including custom attributes — search
GET /api/v1/users?search=profile.department eq "Engineering"&limit=200

# Users never activated
GET /api/v1/users?search=status eq "STAGED"&limit=200

# Users changed since a timestamp
GET /api/v1/users?search=lastUpdated gt "2026-01-01T00:00:00.000Z"&limit=200

# Combined, with grouping
GET /api/v1/users?search=(status eq "ACTIVE" or status eq "SUSPENDED") and profile.department eq "Sales"&limit=200

# Attribute is set at all
GET /api/v1/users?search=profile.managerId pr&limit=200

# Apps assigned to one user — filter, which this endpoint does support
GET /api/v1/apps?filter=user.id eq "00uFAKE…"&limit=200&expand=user/00uFAKE…

# Type-ahead for a people picker — q
GET /api/v1/users?q=ann&limit=20
```

Pair every one of these with the pagination rules in `pagination-and-limits.md`:
a filtered query is still a paginated query.

## Sources

- Filtering, operators, value formats, case sensitivity, `co` restrictions —
  https://developer.okta.com/docs/api/
- User query options, `q` vs `search` vs `filter` guidance —
  https://developer.okta.com/docs/reference/user-query/
- Pagination — https://developer.okta.com/docs/api/#pagination

See `users-and-mfa.md` for the user properties worth querying, and
`request-optimization.md` for combining a filter with an `expand`.
