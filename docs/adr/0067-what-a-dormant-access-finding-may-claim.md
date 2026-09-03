# ADR-0067: What a dormant-access finding may claim

- Status: Proposed
- Date: 2026-09-02
- Relates to: ADR-0036 (never asserted), ADR-0040 (delta plus drift), ADR-0056
  (snapshot depth), ADR-0006 (untrusted responses). Implements the wording gate
  on `I-028`; depends on `D-076`; interacts with `D-077`

## Context

`findUnmaintainedAppAccess` (`ruleOrphans.ts`) lists groups that hold an app open
and that no group rule fills. Its honest reading is **"we see nothing filling
this"** — the module header says so, and `APP_ACCESS_CAVEAT` carries
`INVISIBLE_MAINTAINERS` verbatim precisely because Workflows, SCIM, HR
provisioning, direct API writes and IdP sync are all invisible to a rule join.

`I-028` proposes a second report over the same rows, filtered by
`lastMembershipUpdated`. That field is the one signal in this app that **does**
see every one of those write paths: per the `okta-api` skill it is
default-returned on `GET /api/v1/groups`, and it moves whenever _any_ membership
on the group changes, whoever changed it. So the new report can say something the
rule-based ones structurally cannot: not "we see nothing filling this", but
**"nothing filled it"**.

That is a claim about the world rather than about the app's visibility, and it is
the kind of claim an admin revokes access on. Three things make the naive version
of it false:

1. **A quiet roster is not an absent maintainer.** The field records writes, not
   attention. A reviewer who checked the group last quarter and correctly changed
   nothing leaves the timestamp exactly where an abandoned group leaves it.
2. **The snapshot's copy of the field can be arbitrarily old (`D-076`).** The
   groups delta queries `lastUpdated gt "<watermark>"` only, so a group whose
   membership changed but whose profile did not is never re-read and its stored
   `lastMembershipUpdated` freezes at the last full walk. The error is not random:
   **every false "dormant" is a group that is actually churning** — exactly the
   rows the admin most needs excluded. A caveat cannot repair a finding whose
   false positives are its worst cases.
3. **The threshold is inherited from the wrong clock (`D-077`).**
   `STALE_AGE_DAYS = 365` was reasoned about the _profile_ clock and has never
   been re-derived against this one.

## Decision

### 1. The report asserts "no membership write landed", never "nobody maintains it"

The finding's subject is the roster's silence, not an absence of care, and no
string in the report may say otherwise. The narrowed caveat replaces
`INVISIBLE_MAINTAINERS` for this report — repeating "anything could be filling
this invisibly" under a finding that specifically rules that out would undersell
it. Implementers copy these verbatim; do not improvise them.

```ts
/** Replaces INVISIBLE_MAINTAINERS for the dormant report — narrower, and true. */
export const DORMANT_MAINTAINERS =
  'Okta Workflows, SCIM and HR provisioning, direct API writes and IdP group sync ' +
  'all move a group’s membership date, so none of them has written to this group ' +
  'either. What the date cannot show is a maintainer who reviewed the roster and ' +
  'correctly changed nothing.';

/** Why an app-sourced row is a different fact. */
export const APP_SOURCED_NOTE =
  'Rows marked app-sourced are mastered by another directory: the quiet is that ' +
  'directory’s, not an administrator’s.';

/** The anchor. `when` is the formatted date of the last complete group read. */
export const dormantClockNote = (when: string): string =>
  `Measured from the last complete read of your groups, ${when} — not from today. ` +
  `A membership change since then is not yet visible here.`;

export const dormantAccessCaveat = (when: string): string =>
  `${dormantClockNote(when)} ${DORMANT_MAINTAINERS} ${APP_SOURCED_NOTE} ${PUSH_APPS_ONLY}`;
```

`PUSH_APPS_ONLY` is kept unchanged: the population still comes out of the
`appGroups` collection, and that limit is unaffected by the clock.

Rejected wordings, and why they lose:

| Rejected                                | Why                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| "Nobody has touched this group since X" | "Touched" reads as _looked at_. The field only knows writes.                                  |
| "Abandoned access" / "Orphaned access"  | A verdict. `homeReports` states the rule: a report reports, it never recommends.              |
| "Unused app access"                     | We read no sign-in data. A dormant roster says nothing about whether the app is used.         |
| "Safe to revoke" / any list framing     | Banned outright, as for the two existing reports.                                             |
| `INVISIBLE_MAINTAINERS` pasted in       | Now false in spirit here — the invisible fillers it names all leave this timestamp. (`I-028`) |
| "Dormant since `<date>`", unhedged      | Only true as of the anchor; see §3.                                                           |

The row label states the threshold rather than a mood, and is derived from the
constant so it cannot drift from it: **"App access with no membership change in
6 months"**.

### 2. `APP_GROUP` rows are labelled, not excluded

An `APP_GROUP` is mastered by the app that sources it, so its silence means the
upstream directory is quiet — a different fact, but not a lesser one: an app group
granting access from a dead source directory is among the more serious findings
this report can make. Excluding them would also silently narrow the population
relative to the sibling report, which does not exclude them.

So they stay, carrying a `· app-sourced` marker in the detail line, with
`APP_SOURCED_NOTE` explaining it. Detail lines:

- ordinary — `12 members · Salesforce, Jira · no membership change in 2 years`
- app-sourced — `12 members · Salesforce · no membership change in 2 years · app-sourced`

`findCleanupCandidates` excludes `APP_GROUP` because it is a delete-adjacent list
and deleting an app-mastered group is wrong. This report proposes nothing, so
that reason does not transfer.

### 3. It ships before `D-076`, anchored to the last full walk

`D-076` is `research:awaiting-review` and blocks on an ADR of its own, so
"wait for it" means "never" on any near horizon. It is also not the only way to
be honest, because **`D-076` breaks deltas, not full walks**: a full walk re-reads
every group row, so every stored `lastMembershipUpdated` is exact as of
`groups.lastFullWalkAt`, and any delta since can only have made a row fresher.

Therefore:

- Dormancy is computed against **`groups.lastFullWalkAt`**, never `Date.now()`.
  A finding then states something the app actually observed.
- The caveat names that date (`dormantClockNote`), so the reader knows what the
  claim is anchored to.
- If `lastFullWalkAt` is `null`, or older than **30 days**, the report is
  suppressed the way an unread collection already is — em dash, no findings, the
  note saying which read is missing. 30 days is an order of magnitude below the
  dormancy window, so the anchor's lag can never be a material fraction of the
  silence it certifies.

Without the anchor the harm is specific: a group that gained fifty members
yesterday, whose profile was last edited in 2021, reads as _dormant with high
confidence_ forever, and an admin revokes app access from the org's most active
team on the strength of it. Anchoring turns a false claim into a stale-but-true
one, which the copy can handle. When `D-076` lands the anchor may move to `now`
and the 30-day gate relaxes to the snapshot's ordinary freshness treatment.

### 4. Its own threshold, at 180 days, shown per row

The report declares `DORMANT_ACCESS_DAYS = 180`; it does **not** import
`STALE_AGE_DAYS`. Sharing one constant across two clocks is what produced `D-077`,
and the two populations differ: clutter scores every group, while this report has
already narrowed to groups that grant app access and that no rule fills — a small,
high-consequence set where a shorter window is affordable.

The basis for 180, recorded in the constant's docblock: an access-granting group in
an org with any joiner–mover–leaver flow takes a write roughly per HR cycle, so
two consecutive cycles of silence is the first point at which silence is
_evidence_. This is reasoning, not a distribution, and the docblock must say so —
it inherits `D-077`'s obligation to be re-derived against a real org, and is
tightened or loosened only on that evidence.

The mitigation for a threshold that has not been measured is that the row shows
the **actual** age ("no membership change in 2 years"), so the reader judges the
interval instead of trusting the cutoff.

### 5. The rows navigate; they never mutate

No **mutating** verb, no selection, no path into the bulk machinery from these
findings — now or later. `D-076` already notes that a wrong number here is one
click from bulk action; the whole value of this report is a claim strong enough
to act on, which is exactly why the acting must happen somewhere the admin has
seen the group.

**Read-only egress is not a verb in this sense.** Exporting the findings under
ADR-0065 is explicitly permitted: it changes nothing in Okta, and the CSV carries
this ADR's caveat as a column, so the claim travels with the rows rather than
being stripped by the trip. The line this section draws is between _reading a
possibly-wrong list_ and _acting on one_ — only the second is forbidden here.

## Consequences

- The panel gains its first finding phrased as a fact about the org rather than
  about its own visibility. That is a genuine escalation in claim strength and the
  reason this ADR precedes the code; it also means any future report tempted to
  phrase itself this way must clear the same three tests (anchored clock, narrowed
  caveat, own threshold).
- Still zero requests, and no new machinery: `lastMembershipUpdated` is on the
  `RawOktaGroup` rows the snapshot holds, `lastFullWalkAt` is on `FigureSource`,
  and `buildReport` already blanks `findings` when `value` is `null`, so a stale
  anchor cannot leak a partial list of names.
- **If Okta changes what bumps the field, this report is the thing to re-check.**
  Two directions, one of which is dangerous: a field that starts moving more often
  (rule re-evaluation, profile push) only under-reports, which is safe; a write
  path that stops moving it — a bulk import, an async provisioning job — makes the
  report assert dormancy over a live roster. Re-verify with the `okta-claim-check`
  skill on the ordinary 14-day staleness cadence, and treat a change in the second
  direction as a reason to suppress the report, not to soften its wording.
- If Okta ever exposes per-member membership dates, this report is superseded
  rather than extended — that field answers a different, better question.
- The change is security-relevant — it steers revocation — so it is reviewed with
  `security-logging-reviewer`, and no finding, group name, or app name reaches the
  logger.

## Alternatives considered

- **Hold the report until `D-076` merges.** Rejected: `D-076` is research-gated
  behind its own ADR, and the anchored clock in §3 makes every finding true as
  stated without it. Revisit only if the anchor turns out to be unavailable.
- **Ship against `Date.now()` with a caveat naming the clock limitation.**
  Rejected. The caveat would be accurate and useless: the failure is systematic
  and inverted — the groups it mislabels are the actively-churning ones — and no
  sentence lets a reader tell which rows are affected.
- **Fold dormancy into `findUnmaintainedAppAccess` as a sort or a badge.**
  Rejected: the two carry different caveats and different claim strengths, and
  merging them drags the weaker caveat over the stronger finding.
- **Exclude `APP_GROUP` rows.** Rejected in §2 — it hides a real class of finding
  and narrows the population relative to the sibling report for no stated reason.
- **A per-clock constant inside `clutterAnalysis`.** Left to `D-077`: this
  report's threshold belongs beside this report's join, not in the module whose
  contract is "what is knowable from a group list alone".
