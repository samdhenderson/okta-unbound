# ADR-0037: A user's profile source is on the app row, not in the schema

- Status: Accepted
- Date: 2026-08-20
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary), ADR-0020
  (a failed or silent lookup is never an attribution), ADR-0033 (the profile
  schema is the attribute inventory)
- Amends: [ADR-0035](./0035-the-first-profile-write.md) §3, whose per-user
  mastering check was correct in intent and inoperative in fact

## Context

ADR-0035 §3 established that mastering is a fact about a user rather than about
an org, and resolved a schema property's `master` block against the user's app
assignments. The reasoning was right. The mechanism could not work.

Okta's user-schema `master` block takes one of three types, and they are not
variations on a theme:

| `master.type`    | Means                                                        | Carries `priority` |
| ---------------- | ------------------------------------------------------------ | ------------------ |
| `OKTA`           | Okta owns the attribute.                                     | no                 |
| `PROFILE_MASTER` | The attribute follows the **org's** profile-source order.    | **no**             |
| `OVERRIDE`       | This attribute has its own source list, named per attribute. | yes                |

`master.priority` is populated for `OVERRIDE` and only for `OVERRIDE` — the
terraform provider documents it as _"Prioritized list of profile sources
(required when 'master' is 'OVERRIDE')"_. A `PROFILE_MASTER` block names no
sources at all, because the order it follows is org-level.

So the gate was inverted against the API. `PROFILE_MASTER` — the value orgs
actually carry on base attributes — reached a `priority` reader that always
returned `undefined` and fell straight through to the unconditional lock. The
per-user check ADR-0035 describes never executed. `OVERRIDE`, the one block with
a checkable list, was short-circuited into an unconditional lock before the
reader was reached. Every symptom ADR-0035 §3 set out to fix was still live: the
panel locked the HR-sourced attributes of every user the HR app had never heard
of, and of every user in an org with no profile source at all.

The missing signal was never in the schema. It is on the app row. Okta's Admin
Console answers "what is this user's profile source" from
`GET /api/v1/apps?filter=user.id eq "{id}"&expand=user/{id}` — **the request
`getUserApps` already makes** — by reading `features` off each row and looking
for `PROFILE_MASTERING`. This extension validated that response and discarded the
field.

This is worth stating plainly because the public record says otherwise: asked
whether a user's profile source is available through the API, Okta Support's
answer is _"currently, there is no API call to determine the user's profile
source."_ That is true of a dedicated endpoint and false of the question. The
documented apps call answers it, which is why the console uses it.

## Decision

**Resolve `PROFILE_MASTER` against the user's profile sources, and read those off
the app rows we already have.**

### 1. `features` is the signal; `orn` is corroboration

`oktaAppListItemSchema` names two more fields — `features` and `orn` — and
`isProfileSourceApp` reads the first. Both are `.catch(undefined)`, following the
`oktaAppUserSchema._links` precedent: `parseOktaList` **drops** a row that fails
validation, so a malformed `features` must degrade to "we cannot say whether this
app is a source", never to a missing app. Under-reporting a user's access to fix
a badge is the wrong trade.

`PROFILE_MASTERING` is the gate, not `IMPORT_PROFILE_UPDATES`. An app can import
profile updates without being anyone's source of truth, and accepting the two as
synonyms would lock attributes for every user of every provisioned app.

**Every field below `id` on that schema is now `.catch(undefined)`, and that is
the fix as much as `features` is.** `signOnMode` was `z.string().optional()`,
which accepts `undefined` and rejects `null` — and a Custom Identity Source app
has no sign-on mode, so Okta sends `signOnMode: null` and `parseOktaList` dropped
the row. The org's own profile source was therefore missing from every user's app
list before this ADR's check ever ran: the Apps pane had been quietly short an
app, and the gate resolved `PROFILE_MASTER` against a list that could not contain
the answer. The `_embedded` comment in that schema had already argued "a missing
badge is cheap; a missing app is not" — the field declarations simply did not
honour it. Enumerating which fields Okta may null is the losing move, so a bad
value now degrades to "not reported" rather than costing the application.

`orn` carries `custom_identity_source` for a Custom Identity Source app, which is
how one org's source was first identified — but Active Directory, LDAP and HR
apps are profile sources without it, so it names the _kind_ of source and does
not decide whether there is one.

### 2. The three modes, each on its own terms

`masteringLock` branches on `master.type` the way Okta defines it:

- **`OKTA`, or absent** — editable, unchanged.
- **`PROFILE_MASTER`** — locked **iff** the user is attached to at least one
  profile source. Attached to none, Okta owns their profile: _"If an external
  profile source isn't identified, Okta is the source for all profiles."_ This
  is the unlock, and it is the whole fix.
- **`OVERRIDE`, and any mode a future release adds** — locked unconditionally.
  `OVERRIDE` _could_ be resolved per user from its `priority` list at no extra
  cost, and deliberately is not: an admin who singles one attribute out for its
  own source has expressed an intent this panel is the wrong place to
  second-guess, and a second mastering model would have to be maintained for a
  case neither surface needs. Locking is the same behaviour the attribute had
  before this ADR.

### 3. Deny-by-default survives the change

The unlock rests on an **absence** — no profile source among this user's apps —
so it requires the app walk to have both **returned** and **completed**.
`ProfileMastering.profileSources` is `undefined` in either case and locks;
an empty map is a real answer and unlocks. `profileMastering` only admits an app
to the map on `isProfileSource === true`, so an app whose `features` we could not
read is never silently treated as "not a source".

Two surfaces feed the gate, and one of them was answering with a shape it had not
earned. `useComparisonApps` seeded both app arrays as `[]` with `appsIncomplete`
false, which is byte-identical to a completed walk that found nothing — so the
Compare view unlocked every mastered attribute for the whole loading window and
again after every reset. It now publishes `appsLoaded`, the same distinction
`useUserApps.hasLoaded` already draws, and the memos pass `undefined` until a
walk returns. The Users-tab path was never affected; it passed `data?.apps`.

### 4. Naming the source, and declining to

A single attached source is named in the verdict. **Several are not.** Okta
permits one profile source per user at a time and resolves the contest with an
org-level priority order it does not expose, so the explanation lists the
candidates and the verdict carries no `source` — ADR-0020's rule applied to a
mastering claim rather than a membership one.

The copy no longer says a write "would be overwritten at the next import". That
sentence predicted Okta's behaviour on a write this panel refuses to make, which
is one claim more than the gate can support. It now states the fact and where the
attribute is changed instead.

## Consequences

- **The bug ADR-0035 §3 describes is actually fixed.** In an org with no profile
  source, every `READ_WRITE` base attribute is editable. In an org with one, only
  the users attached to it are locked.
- **No new request, endpoint, permission or cache key.** Two fields on a response
  already fetched, validated and cached. The Profile pane's walk stays gated on
  that pane (ADR-0018) and still shares `cacheKeys.userApps` with the Apps pane.
- `parseOkta` now leaves the schema's _input_ type unconstrained
  (`z.ZodType<T, z.ZodTypeDef, unknown>`). Zod defaults it to the output type,
  which stops inference on any schema using `.catch()`, `.transform()` or
  `.default()` — making a schema more lenient became a compile error at every
  call site, which is pressure in the opposite direction to ADR-0006's.
- **Residual, carried over from ADR-0035 and narrowed but not closed.** A user
  assigned to a profile-source app whose _matching_ Okta has not confirmed is
  still treated as mastered by it. The `expand=user/{userId}` embed already
  carries `syncState` and `externalId`, which would close it at no extra cost;
  the value vocabulary is not verified here, and guessing it would reintroduce
  exactly this ADR's failure mode.
- **Residual, new.** `getUserProfileSchema` reads
  `/api/v1/meta/schemas/user/default` for every user, so a user on a custom user
  type is gated by another type's `mutability` and `master` blocks — the same
  class of error from a different direction. `oktaUserSchema` does not parse
  `user.type`, so the id needed to fix it is dropped at the boundary. Untouched
  here; one concern per PR.
- The `okta-api` skill carried the gap that produced this bug — it documented the
  schema endpoints but not the mastering model, and treated the profile source as
  unavailable. It now states both, and the call-collapsing table names `features`.
