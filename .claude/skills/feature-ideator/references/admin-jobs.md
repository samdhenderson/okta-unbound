# Okta admin jobs-to-be-done

What Okta administrators actually spend their time on, each mapped to what Okta Unbound
does today and where the gap is. Ideas anchored to a job here are grounded in real
work; ideas that map to no job are usually a solution looking for a problem.

Marker: **Gap** = nothing in the app addresses it · **Partial** = addressed for one
entity or one direction · **Covered** = shipped.

## 1. Joiner — is the new hire's access right?

**The job.** Confirm a new user landed in the right groups, picked up the right apps,
and enrolled the required authenticators. Failures are usually silent: the user simply
cannot do something on day three.

**Today.** **Partial.** The Users tab shows a user's memberships with per-rule clause
attribution, and Compare diffs one user against another — which is exactly how admins
check a joiner in practice ("give them what Dana has"). The comparison already groups
differences by the remedy that closes them.

**The gap.** No notion of _expected_ access. Comparison is against a peer, chosen by
hand. A saved "role profile" — the access a peer cohort shares — would turn a manual
comparison into a check.

## 2. Mover — what should have been removed and wasn't?

**The job.** Someone changes team. New access is granted promptly because they ask for
it; old access lingers because nobody is prompted to remove it. Accumulated
mover-residue is the single largest source of over-provisioning.

**Today.** **Gap.** Nothing detects a role change or surfaces its residue.

**What the API supports.** The System Log records `user.account.update_profile`, and
group membership changes appear as `group.user_membership.add` / `.remove`. A
department change followed by _no_ group removals is a detectable signature.

**Constraint worth knowing:** Okta exposes **no group-membership timestamp**. "When was
this user added to this group" is unanswerable from the entity API — only from the
System Log, and only within its 90-day window. Any idea that wants membership age must
say so.

## 3. Leaver — did offboarding actually complete?

**The job.** Deactivation is the easy half. The hard half is the residue: group
memberships that survive, app assignments still consuming a licence, admin roles still
granted.

**Today.** **Partial.** `removeDeprovisioned` clears DEPROVISIONED members from a
single group, and bulk ops extend that to selected groups including SUSPENDED and
LOCKED_OUT. Both are group-first: an admin must already suspect a group.

**The gap.** The user-first direction. "This person left — everything they still hold,
across groups, apps, and admin roles, in one view." The pieces exist
(`/users/{id}/groups`, `filter=user.id eq`, `/users/{id}/roles`); nothing composes them
into a leaver worklist.

## 4. Helpdesk triage — "why can't this person get into that?"

**The job.** The highest-volume admin question by a wide margin, and the one with the
worst tooling. Two variants: _why isn't this user in that group_, and _why can't this
user reach that app_.

**Today.** **Partial, and this is the app's strongest area.** `shared/ruleEvaluator.ts`
parses conditions with jsep and evaluates them clause by clause, returning match /
no-match / **unevaluable** — never guessing. `ClauseChecklist` renders per-clause
pass/fail with the resolved profile value. Group member attribution reads Okta's own
`expand=group-rules` embed.

**What Okta itself knows that the app never asks.** The System Log records
`group.rule.evaluate` with a `debugContext` carrying `evaluationResult` and
`conditionsEvaluated` — **Okta's own answer** for why a rule did or did not fire for a
user, including the values it actually saw. That is authoritative where client-side
evaluation is inference, and it closes the `unevaluable` cases the allow-list evaluator
cannot resolve.

**The two most common real causes**, per Okta's own troubleshooting guidance, and
neither is a logic error:

- **Case sensitivity** in attribute comparison
- **A blank attribute** because a profile mapping never populated it

The second points at `/api/v1/mappings`, which the app never calls. "This rule tests
`user.department`, and `department` is not mapped from the source that masters this
user" is a complete answer to a ticket that otherwise takes an hour.

**App-access triage** is thinner: `AppOverview` shows whether an app-specific access
policy is attached, but policy `conditions` and `actions` are deliberately not
rendered, so "what must this user satisfy" is unanswered.

## 5. Access review / certification

**The job.** Periodically confirm the right people hold the right access, and produce
evidence.

**Today.** **Partial.** Eleven CSV exports cover the raw material — memberships, app
users, app groups, group rules.

**The gap and the reason it matters.** Reviews fail in practice because _the evidence is
stale by the time a reviewer sees it_. An export is a snapshot with no provenance: it
does not say which memberships are rule-managed (and therefore not a human's decision to
revoke), which are manual, or which could not be attributed. The app computes exactly
that distinction on screen and drops it on the way to CSV.

Two under-served angles: **rule-managed vs manual** as an export column, and **change
since last review** rather than a full re-read.

## 6. License reclamation — who is paying for nothing?

**The job.** Find accounts and app assignments nobody uses, and reclaim them. Direct
budget impact, which makes it one of the few admin jobs with executive attention.

**Today.** **Gap.**

**The constraint that shapes every idea here** — and it is easy to get wrong:

- `user.lastLogin` on the profile is **Okta access**, not application access.
- **Per-app last login exists only in the System Log**, as `user.authentication.sso`
  events. There is no out-of-the-box report for it.
- The System Log holds **~90 days**. Beyond that, the data does not exist to be queried.
- User statuses consume licences differently, so a status-only report over- or
  under-counts.

So "unused app assignments" is a System Log aggregation with a hard 90-day ceiling,
and any feature must state that ceiling in the UI rather than implying completeness.

## 7. Group hygiene

**The job.** Orgs accumulate empty groups, near-duplicate names, stale groups, and
overlapping rules until nobody can tell which group grants what.

**Today.** **Covered, and it is the flagship.** Cleanup triage fuses empty /
duplicate-name / stale / missing-metadata into a review score; membership-source
analysis shows manual vs rule-fed vs unattributed; rule consolidation merges
identical-condition rules through a safe create → activate → retire sequence; merge
consolidates memberships; rule impact preview answers "who loses access" before a
deactivation.

**The remaining gap** is recorded as tech debt rather than missing: `analyzeClutter`
could add a real **orphan** category now that `hasRules` / `ruleCount` are populated
from the rules cache.

## 8. MFA rollout and the enforcement gap

**The job.** Move an org to stronger authenticators, and find who is behind.

**Today.** **Partial.** `scanGroupMfa` reads per-user factors for a group behind a
confirm gate, with factual factor labels and no invented risk scoring. Filters cover
has/missing per factor.

**The gap, and the distinction that decides whether a report is defensible:**
**enrolment is not enforcement.** Three different questions, and the app answers only
the first:

- _What has each user enrolled?_ → `/users/{id}/factors` — **covered**
- _What must a user enrol at all?_ → `MFA_ENROLL` policy — not read
- _What must a user prove for this app?_ → `ACCESS_POLICY` rules — fetched, but
  `conditions`/`actions` are not rendered

A posture report built on enrolment alone will confidently report users as compliant
when no policy requires anything of them.

**Cost note:** per-user factor reads are **1 call per user and irreducible** — no
collapsing parameter exists. That is why the scan is confirm-gated, and any extension
inherits the same constraint.

## 9. Admin privilege audit — who can administer what?

**The job.** The question every auditor asks and no group or app listing answers.

**Today.** **Gap.** `/users/{id}/roles`, `/groups/{id}/roles`, and `/api/v1/iam/roles`
are never called. The Administrators export is explicitly deferred in the parity plan
because admin roles are per-user assignments rather than one paginated list.

**Two facts that make a naive version wrong:**

- **Roles assigned to a _group_ grant privileges to every member, and are invisible in
  a user's own role listing.** An audit that walks users misses everyone who is an
  admin by membership.
- Standard roles can be narrowed by **resource targets** (an app admin scoped to
  specific apps). Reporting the role without its targets overstates the privilege.

Related and already enforced by Okta: group rules cannot assign users to admin groups,
and a group that is a rule target cannot later be granted admin privileges.

## 10. App assignment cleanup

**The job.** Establish who can reach an app and by which path, before revoking
anything.

**Today.** **Partial.** App Users and App Groups export; the user comparison carries
per-row assignment-scope provenance.

**The trap that silently inverts a conclusion.** Okta reports a **single** `scope` per
app-user and prefers `USER`. `scope: 'USER'` means _"has a direct assignment"_ — **not**
_"direct only"_. A user assigned both directly and through a group reports `USER`, and
the group path is invisible. Removing the direct assignment changes nothing about their
access. Establishing "no group-derived path" requires intersecting the app's group
assignments with the user's groups.

## 11. Incident response — what did this account touch?

**The job.** An account is suspected compromised. What did it access, what changed, what
must be revoked.

**Today.** **Gap**, and the sharpest one. There is **no System Log surface at all**, so
every question containing _when_, _who did it_, or _what changed_ is unanswerable.

Containment is also partial: suspend exists, but there is no session revocation, and —
per the audit trail — **user lifecycle actions record neither an audit entry nor an
undo entry**, unlike every other mutation.

## 12. Audit evidence and change history

**The job.** Show an auditor what changed, who changed it, and when.

**Today.** **Partial, and it overstates itself.** The History tab lists locally recorded
actions. But `UndoAction.status` supports `'undone'` and **nothing ever writes it** —
there is no revert action anywhere. `auditStore.exportAuditLog()`, `getStats()`, and
`updateSettings()` have no UI caller, so the documented CSV export and configurable
30–365 day retention do not ship. The undo history is also capped at 50 actions.

**The gap.** The recorded history covers only what _this extension_ did. Org-wide change
history lives in the System Log, unread. And `features-plan.md`'s ground rule — "capture
prior state so undo can _restore_, not just log" — is currently unmet by the app's own
history surface.

## Cross-cutting notes

- **The System Log is the single largest unexploited surface.** It is the only answer to
  _when_, _who_, and _what changed_, and it underpins jobs 2, 6, 11, and 12. One
  endpoint, `/api/v1/logs`, 90-day retention, its own pagination contract. See the
  **`okta-api`** skill.
- **90 days is a hard ceiling** on every historical question. State it in any feature
  that depends on it rather than implying completeness.
- **Attribution honesty is this app's differentiator.** It already distinguishes an
  answer Okta gave from an inference, and surfaces `unevaluable` and `cannot-determine`
  as first-class outcomes. Ideas that would collapse that distinction to look tidier
  are regressions, however much better they demo.
