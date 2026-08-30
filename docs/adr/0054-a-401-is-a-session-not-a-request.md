# ADR-0054: A 401 is a session, not a request

- Status: Proposed
- Date: 2026-08-29
- Scoped by: `D-007b`
- Relates to: [ADR-0008](./0008-activity-bar-and-cancellation.md) (the one
  cancellation path this suspension must not fight),
  [ADR-0042](./0042-verbose-api-request-audit-log.md) (what an interrupted
  operation records), [ADR-0002](./0002-status-vocabulary-danger.md) (the banner's
  status vocabulary), `D-007c` (429 backoff, the other status the scheduler must
  stop treating as an ordinary error)

> **Numbering note.** `D-007b` reserved `0041` for this ADR on 2026-08-24. That
> number was taken by the API-explorer ADR before the item was picked up. See
> `D-072` for why reserving a number in a backlog item is a habit worth dropping.

## Context

When an admin's Okta session ends mid-use — signed out in another tab, or simply
timed out — the panel does not notice. Every queued request comes back as an
ordinary "request failed", so a dozen unrelated surfaces break at once and the
honest conclusion a user draws is *the extension is broken*, not *I need to sign
in again*. Nothing stops the scheduler draining a full queue into the same 401
thirty times over, and each of those thirty failures paints its own error state.

The diagnosis is no longer the hard part. PR #102 (`D-007a`) made every failure
carry a non-optional `status` and shipped the predicate this ADR needs:

```ts
// shared/scheduler/requestResult.ts
export function isSessionExpired(result: RequestResult): boolean {
  return !result.success && result.status === HTTP_UNAUTHORIZED;
}
```

That module already argues the discrimination this ADR depends on, and the
argument is not repeated here: **401 only.** 403 is a permission the admin does
not have and re-authenticating returns the same 403; 429 is a live session being
throttled and wants backoff; `NO_HTTP_STATUS` is a transport failure that knows
nothing about the session at all. Each of those has a different remedy, and
folding them together prescribes the wrong one.

What is missing is everything after detection: who is told, what stops, what the
admin sees, and how it ends.

## Decision

### 1. The scheduler owns the signal

The scheduler is the only layer that sees every request, and the only one that
can stop the next one. The content script sees a request at a time and has no
queue to pause; the panel sees its own call sites and cannot speak for the eight
surfaces that did not happen to be mounted. Session state is therefore scheduler
state.

On the first result for which `isSessionExpired()` holds, the scheduler enters a
**suspended** state and broadcasts it. Suspension is per Okta origin — an admin
with two orgs open has not lost both sessions because one expired.

### 2. Queued work is failed fast, not drained and not retried

Everything already queued for that origin is settled immediately with the same
session-expired failure, without being sent. In-flight requests are left to
land; cancelling a request that may already have reached Okta is worse than
letting it finish, particularly for writes.

This is the "thirty failed requests" half of the item: the queue does not get to
discover the same 401 thirty times. It discovers it once, and the rest are
short-circuited against a fact already known.

**Nothing is auto-retried.** A retry queue that replays writes after a
re-authentication would re-issue an operation the admin may have abandoned. Work
interrupted this way is reported, not resumed.

### 3. The panel renders it once, globally

Session expiry is a property of the connection, not of any one surface, so it
renders where the connection is already described: a banner in the masthead
region, alongside `ContextBar`. Per-surface error states are actively wrong here
— they multiply one fact into nine, which is the symptom that started the item.

While suspended, surfaces show their last-known content rather than an error.
The data on screen was true when it was fetched and does not become false
because the session ended; blanking nine panes tells the admin less than leaving
them up under a banner that says why nothing is refreshing.

The banner states the cause and the remedy in the vocabulary of ADR-0002
(`danger`, never `error`): the Okta session has ended, sign in again in the Okta
tab.

### 4. It clears on evidence, never on a timer

The panel does not poll to see whether the session came back — polling a dead
session is exactly the wasted traffic this ADR exists to stop. Suspension clears
on one of two things:

- **The admin acts.** The banner carries a *Retry* control that issues a single
  cheap probe. Success clears the suspension and resumes normal scheduling;
  another 401 leaves it suspended and says so.
- **The Okta tab reloads or navigates.** A document load installs a fresh
  content script and is the strongest available evidence that the session may
  have changed. `useOktaTabContext` already treats a reload as a forced re-probe
  past its same-entity latch, and the same signal arms one probe here.

### 5. An interrupted operation is audited as interrupted

This is where `D-013`'s policy and this one meet. An operation that was
mid-flight when the session ended records an audit entry whose outcome is
**interrupted**, not failed and not succeeded — because for a write already sent
to Okta, the panel genuinely does not know which it was. The entry names the
last request that landed and says the session ended, so an admin reconciling
afterwards knows exactly where to look rather than trusting a verdict the panel
was not in a position to make.

Entries for queued work that was short-circuited before sending record
**not attempted**, which is knowable and is a different fact.

## Consequences

An expired session becomes one legible statement with one remedy, instead of a
dozen unrelated breakages. The queue stops spending requests against a session
that cannot serve them.

The cost is a new global state that every surface is implicitly subject to, and
a `danger` banner that must not be mistaken for the rate-limit or offline
banners; the three need to be visually distinguishable and mutually exclusive.
The interrupted audit outcome is a new value in the audit vocabulary and needs a
migration story for rows persisted under the old two-outcome shape.

Untested against a real expiry: whether Okta reliably returns 401 rather than a
302 to a sign-in page for the endpoints this app calls. If a session-expired
response arrives as an opaque redirect, `isSessionExpired` never fires and this
whole mechanism sits idle. **That check belongs in `D-028`'s live-org audit and
is added to it as item 11.**

## Alternatives considered

**Detect in the content script.** It is closest to the response and would need
no new message. But it sees one request at a time with no queue to pause, so the
thirty-requests half of the problem stays unsolved.

**Let each surface handle its own 401.** No new global state, and it is what
happens today. It is the defect.

**Auto-retry after re-authentication.** Attractive for reads, unacceptable for
writes: it would silently re-issue a bulk operation the admin walked away from.
Rejected wholesale rather than split by verb, because the split would put the
riskiest case behind the subtlest rule.
