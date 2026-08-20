# ADR-0035: The first profile write — an unconfirmed outcome is never reported as a failure

- Status: Accepted
- Date: 2026-08-20
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary), ADR-0002
  (`danger`, never `error`), ADR-0033 (the profile schema is the attribute
  inventory), ADR-0036 (the access prediction shown before this write is
  committed), `docs/security.md` §5–§8
- Amends: `docs/features-plan.md` item C, whose "curated allow-list, no
  login/email footguns" is replaced by §3

## Context

Until this change the extension had never written a user profile. Everything it
knew about profiles it had read: ADR-0033 banked the org schema as the attribute
inventory, and ADR-0020/0031 spent two rounds establishing what the panel may
_say_ about a membership it did not observe directly.

A write inverts the problem. A wrong read shows a wrong screen; a wrong write
changes someone's directory. And a profile write is not an ordinary write, because
in an org with group rules **the attribute is the access control**: setting
`department` to `Finance` is a group grant issued through a field that looks like
HR metadata, applied asynchronously by a scheduler nobody in the panel can see.

So this slice had to answer three questions the codebase never had to. What may the
panel say about what a write **will do**, before an admin commits — answered by
[ADR-0036](./0036-a-predicted-access-change-is-never-asserted.md). About what it
**did**, when the transport never came back. And what it may **put back**, given
that Okta has no rollback. This ADR answers the last two, and covers the write
itself, the gate in front of it and the prior state captured behind it. One failure
mode sits behind all three, and ADR-0017 and ADR-0020 already named it: turning "we
could not tell" into a confident statement. It is merely more expensive here.

## Decision

**Ship the write, and make every claim around it carry its own certainty in its
type — not in a caption a caller can drop.**

### 1. A sparse patch, on merge semantics we have not verified

`updateUserProfile` (`useOktaApi/profileOperations.ts`) sends
`POST /api/v1/users/{id}` with `{ profile: patch }` containing **only the changed
attributes**, and validates the response with `oktaUserSchema` (ADR-0006) — that
user is rendered as the new truth, so an unvalidated body would put unverified
Okta data straight into the view.

The body is correct only if Okta merges rather than replaces. Okta's docs say it
merges, the `okta-api` endpoint index says it merges, and `features-plan.md` item C
was scoped on it merging — but **nothing here has exercised it against a live org,
and the skill row stays marked `U` (unverified) on purpose.** That check is
outstanding; this ADR does not close it.

Shipping on the assumption is acceptable because the fallback is one function body:
send the full profile (current attributes merged with the patch) with every
attribute whose schema `mutability !== 'READ_WRITE'` stripped, since Okta rejects
writes to those. No call site passes anything but a sparse patch, so that is one
edit rather than a migration.

Two refusals happen strictly **pre-flight**, as throws rather than results, so a
caller cannot confuse them with §2's unconfirmed outcome: an empty patch, and any
patch containing a security-sensitive key (`assertNoExcludedKeys` over
`EXCLUDED_PROFILE_FIELDS`, which counts offenders rather than naming them, so even
its error message obeys the module's "identifiers and outcomes only" rule). It sits
at the request boundary, not in the editing UI, because the UI's filtering is a
rendering decision — a bulk editor or a test harness must not reach the endpoint
with a credential field in hand by forgetting to filter.

The transport needed no change: `POST` was already in the method allow-list at both
the background entry and the content-script fetch site, so the extension's first
profile write widened no boundary (`docs/security.md` §4–§5).

### 2. Three outcomes, and `'unknown'` is not `'failed'`

`core.ts` retries a dropped MV3 message port **only for `GET`**: a port error is
ambiguous about whether the scheduled request already executed, and "a
double-execute is worse than a surfaced failure". A write that loses its port
therefore throws — and at that moment the content script may well have performed
it. We simply never heard the answer. So `UpdateProfileResult` is three-state:

- **`'saved'`** — Okta accepted the write and returned a user we could validate.
- **`'failed'`** — the transport returned `{ success: false }`. Okta was reached
  and said no; the profile is unchanged. Safe to report as "not saved".
- **`'unknown'`** — **the write may have applied.** Two origins, not one: the call
  threw, _or_ the transport reported success and the body failed `oktaUserSchema`.
  The second is still `'unknown'` rather than `'failed'`, because a validated-away
  response most likely means the write landed and we merely cannot state the
  resulting profile.

Reporting `'unknown'` as `'failed'` is a false statement about someone's data: the
admin would re-check nothing and walk away believing the old value stands. The
surfaces therefore say only what is true — `The result of this change is unknown.
Reload to check.` on the Users tab, the same fact at more length in Compare — as a
`warning`, never a `danger` (ADR-0002). This is the honesty rule ADR-0017 and
ADR-0020 apply to reads, moved to a write outcome: a state we could not observe
keeps its own name instead of being rounded to the reassuring neighbour.

**An `'unknown'` write is still recorded**, with `status: 'partial'`. Recording
nothing about a write that may have landed is worse than recording an ambiguous
outcome: the admin would have no trace at all of an edit that is now live. A
`'partial'` row offers **no Undo**, and says why — we do not know which values it
set, so we cannot know what to restore. A `'failed'` write is recorded nowhere:
Okta answered, and nothing changed.

### 3. The editability gate is mastering-aware, and that replaces the allow-list

`profileEditability.attributeEditability` returns, per attribute per user, either
_how_ to edit it or _why_ it is locked — as a discriminated union, so no caller can
read `control` without having established there is one. Six gates run in order,
first match wins: `system` field → not in the org schema → `login`'s account master
→ `mutability` → per-attribute `master.type` → value type. Three carry the
decision.

**No schema property is a lock (`not-in-schema`).** ADR-0033 made the schema the
inventory; here it becomes the licence. We do not blind-write an attribute whose
type, mutability and mastering are all unknown to us.

**Two mastering layers, not one.** A per-attribute `master.type` naming anything
but Okta means a write here is overwritten at the next import. The **account's**
`credentials.provider.type` is a different question, and the one that decides
`login`; a per-attribute `master` block cannot answer it. An absent provider type
also locks — an absence is not a confirmation that Okta owns the credential.

**And mastering is a fact about a user, not about an org.** This was the gate's
worst bug in practice. `master.type: 'PROFILE_MASTER'` on a schema property does
not mean "every user's copy of this attribute is owned elsewhere"; it means
"whichever of the sources in `master.priority` this user is attached to owns it",
and a user attached to none of them is Okta-mastered for that attribute and
editable in the Okta console. Reading the schema alone locked the HR-sourced
attributes of every user the HR app had never heard of — wrong in exactly the orgs
that have a profile source at all, which is to say the ones this feature is for.

`master.priority` names app instances (AD and LDAP are app instances too), so the
per-user half of the answer is the user's own app assignments. Both surfaces
already hold them — the Users tab through the same `cacheKeys.userApps` entry its
Apps pane walks, the comparison through `useComparisonApps` — so the check costs no
request the panel was not already making, and the Profile pane's walk is gated on
that pane like every other load (ADR-0018). It reaches the pure gate as
`ProfileMastering`, an app-id → label map; `profileEditability` still does no I/O.

The unlock stays narrow, because the claim being made is an _absence_. An attribute
unlocks only when the `master.type` is literally `PROFILE_MASTER`, every entry of
`priority` is an `APP` entry this module can test a user against, the user's app
list has loaded **and the pagination walk finished**, and none of the priority apps
is in it. A truncated walk answers "absent" for every app it never reached, so it is
discarded rather than trusted. Anything else — a mastering mode this module does not
model, an unparseable `priority`, a source kind it cannot check, no list yet — locks
exactly as before. When it does lock, it now names the _app_ rather than the string
`PROFILE_MASTER`, which named the mastering mode as though it were a system an admin
could go and look at.

**A value-type gate.** `string` (free text, or a `select` where the schema
enumerates values), `boolean` and `number`/`integer` are editable; `array`,
`object`, an absent type and an unrecognised type lock with the reason named. This
panel has no repeater UI and will not invent one silently.

This **supersedes item C's "curated allow-list, no login/email footguns"**.
`login` is editable when Okta masters the account. A blanket deny-list locks the
wrong set: it forbids a legitimate rename on an Okta-mastered account while saying
nothing about the case that actually breaks — an AD-mastered `department` that
accepts the write and reverts at the next import. Mastering locks exactly the
accounts where the write would be overwritten, or is not ours to make.

Only the literal `'OKTA'` permits a write; **every other value, recognised or not,
locks.** `mutability`, `type` and `master.type` stay `z.string()` rather than enums
precisely so a value from a future Okta release survives the boundary — and the
safe narrowing, when a reader meets a string it does not recognise, is deny. A
wrong lock costs a trip to the Okta console; a wrong unlock costs a failed write,
or a silently reverted one.

The gate is enforced twice on purpose: `useProfileEdit.confirmSave` rebuilds the
request body from the gate's **verdicts**, not from the draft, so a draft key for a
locked attribute is dropped on the way out even if earlier state let it in. Where
one bare name appears twice (a top-level `status` beside a custom `status`
attribute), the **locked** verdict wins.

One thing had to change for the account gate to exist: `oktaUserSchema` gained a
`credentials` block, **deliberately not `.passthrough()`** unlike its siblings in
that file. Okta returns `credentials.password` and `credentials.recovery_question`
there, and passthrough would carry credential material through the boundary into
React state, where anything serialising a user would pick it up.

### 4. Prior state is capped, and an over-cap value is absent rather than empty

Undo needs before-values, and before-values are tenant PII sitting in plaintext
`chrome.storage.local` until the 50-entry history cap evicts them. The capture is
bounded on both axes: `MAX_CAPTURED_VALUE_CHARS = 1024` and
`MAX_CAPTURED_ATTRIBUTES = 25` (`shared/undoManager.ts`), enforced inside
`logProfileUpdateAction` — the single writer of the history key — so no caller can
persist an unbounded value by forgetting to.

An over-cap value stores **no `beforeDisplay` and no `beforeRaw` at all** — not a
truncated prefix, which is still PII with none of the restore utility and would
silently corrupt the attribute if written back; and not an empty string, which is
indistinguishable from a genuinely empty prior value. `undefined` says "not
captured"; `''` says "was empty". Renderers branch on `restorable`/`omitted`, never
on the truthiness of `beforeDisplay`.

Nothing is dropped from the _record_: every attribute the write touched appears in
the entry, the over-cap ones marked unrestorable. **Partial restore is allowed and
announced** — the undo writes back what it holds and says "Restored 3 of 5
attributes on …". Stranding the three we can put back is not a kindness.

### 5. Undo is a forward write, not a rollback

Okta has no rollback, so `useUndoAction` issues a **new** write setting the prior
values. It can fail like any other write, through the same three-state result. It
earns **its own history entry**, linked to the original through
`metadata.undoOfActionId` and back through the original's `undoneByActionId` —
stored in both directions because the 50-entry cap can evict either side
independently. Nothing is erased, and the new entry captures the live value as
`beforeRaw`, which is what makes an undo itself undoable.

And it **re-reads the user first and refuses on drift**. The drift question is
_"is it still what we wrote?"_ — not _"does it still differ from before?"_. Those
come apart in the case that matters: a third party sets the attribute back to its
old value. The second question answers "no difference, nothing to do" and the undo
looks like a no-op success; the first correctly reports that the value we wrote is
gone and someone else owns the attribute now. The comparison runs through
`toDisplay`, the same stringifier the editor and the capture used, so `5` and `'5'`
cannot disagree and refuse a valid undo. A drift outcome carries attribute **names
only** — never values, because a constructed message eventually reaches a log.

Two implementation facts are load-bearing. **The dispatch table is an exhaustive
`Record`, not a `switch` with a `default:`** — `NOT_UNDOABLE` is keyed on
`Exclude<ActionType, 'UPDATE_USER_PROFILE'>` and spells out, per action type, why
undoing it here would be wrong. A `default:` arm would silently absorb the ninth
`ActionType` someone adds, classifying a brand-new mutating operation as "not
undoable" with a generic apology, and nobody would find out; as written, adding a
member to `ActionType` is a compile error until a human writes down what undoing it
means. And **`logAction` runs before `markActionUndone`, because reversing them is
data loss** — both are read-modify-write cycles over the same
`chrome.storage.local` key, so the mark would write the `'undone'` flag and then
the log, whose `getUndoHistory()` read happened before that write, would save its
stale copy back over the top. A test pins the order.

## Consequences

- The panel can change a directory now — a new class of risk, bounded by the gate,
  a pre-flight refusal of credential fields at the request boundary, a mandatory
  confirmation listing exactly what the write will send, and ADR-0036's prediction.
- **The merge assumption is a live, named risk.** `POST /api/v1/users/{id}` stays
  `U` in the skill's endpoint index, and the fallback is documented at the one
  function that would implement it. Verifying it against a real org is outstanding
  work, not a completed step.
- `features-plan.md` item C is **not** delivered. This is the single-user editor; it
  ships the write, the gate, the audit capture and the undo the bulk version depends
  on. Cohort resolution, `BulkTargetList`, preflight over many users and a CSV of
  results remain.
- History entries now hold profile values — new PII at rest in plaintext storage,
  bounded at 50 entries × 25 attributes × 1024 characters before and after, never
  logged. Unlike `auditStore` it has **no time-based retention**, only the entry
  cap; recorded as a residual in `docs/security.md` §8.
- No new message action, permission, cache key or allow-list entry: `POST` was
  already permitted at both boundaries. The only new Okta calls are the write and
  `getUserRaw`, deliberately separate from `userOperations.getUserById`, whose flat
  six-field projection three call sites depend on. Undo exists for exactly one
  action type, and the exhaustive `Record` keeps the next one from joining silently.
- **Residual.** A user assigned to a profile-source app whose _matching_ Okta has
  not confirmed is treated as mastered by it, because assignment is all the app
  list reports. That errs toward the lock, which is the direction this gate errs in
  everywhere else.
- **Residual.** An attribute whose schema `mutability` is _absent_ is not locked by
  gate 4 — only a present, non-`READ_WRITE` value locks. Okta emits it in practice,
  and the type and mastering gates still run, but the posture is strictly weaker
  there than the prose above suggests; if a real org is seen returning a property
  with no `mutability`, the honest answer is to lock it.
