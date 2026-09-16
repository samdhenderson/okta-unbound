import{j as e}from"./iframe-tAvKsVeF.js";import{u as s,M as a,c as i}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const r=`# 0006 — A saved collection stores ids; a display name is the admin's choice, and only for users

Status: Accepted — 2026-09-12

## Context

\`docs/security.md\` §7 refuses to persist the selection basket, and gives a reason
that is about to be tested:

> \`workingSetStore\` is entitled to persist because it is bounded at twenty rows
> per org by construction; a basket has no such bound — the driving use case banks
> around 1,200 display names, which in this app are usually email addresses — and
> \`chrome.storage\` is plaintext with no TTL.

The same paragraph names the sanctioned alternative — _"a cohort worth keeping is
kept deliberately as a named saved set, not as a by-product of ticking boxes"_ —
and this change builds it. So the record has to answer the obvious objection: a
saved collection persists the same rows the basket is forbidden to persist, and
at twenty collections of two thousand rows it persists **twenty times more** of
them.

The retired \`GroupCollections\` avoided the question by storing group ids only.
That was not a decision about PII; it was a consequence of the feature only ever
handling groups. A kind-aware collection cannot inherit the accident.

## The forced choice

A collection has to render a row a human can read — a bare \`00uFAKE…\` is not a
cohort, it is a hex dump. So every id must resolve to a name at load time, and
there are only two places a name can come from: disk, or the org.

**Store the name.** Reopening is instant and works with no live Okta tab. It also
writes up to 40,000 email addresses per org into plaintext storage with no TTL,
which is a real posture change and is most of why this record exists.

**Store the id and re-fetch.** Nothing readable is written down. But the cost is
not uniform across kinds, and that asymmetry is the whole decision:

| Kind             | Where a name comes from                                     | Cost to recover      |
| ---------------- | ----------------------------------------------------------- | -------------------- |
| group, rule, app | \`useOrgEntityIndex.lookup\` — O(1) over the org snapshot     | none                 |
| policy           | the Policies rung's cached list, one read for the whole set | one request, shared  |
| user             | nothing — the snapshot holds **no user rows**, by design    | **one request each** |

Every \`GET /api/v1/users/{id}\` keys to the same scheduler bucket, and
\`maxConcurrentPerBucket\` is **4** — not the \`maxConcurrent: 10\` the config leads
with. A 1,200-person cohort is therefore ~300 sequential rounds of four: tens of
seconds of sustained traffic, very likely enough to drive
\`X-Rate-Limit-Remaining\` under \`minRemainingThreshold\` and trip a 30-second
cooldown that stalls every interactive request sharing that bucket. Ids-only is
free for four kinds and punitive for the fifth.

**Batching was investigated and is not available to us.** \`searchUsersRequest.ts\`
already proves OR-ed \`search=\` expressions work, but the \`okta-api\` skill never
documents \`id\` as a queryable property on \`/api/v1/users\`, and warns that an
unsupported filter _may be ignored rather than rejected_ — returning \`200\` with
the wrong rows. Under the house never-guess rule that is \`[unverified]\`, and
nothing here may depend on it.

## Decision

**Ids are always stored. A display name is stored only for users, and only if the
admin leaves \`Remember display names\` ticked.**

The schema makes the name optional per row, so this is one flag rather than two
shapes:

\`\`\`ts
interface CollectionRow {
  kind: SelectionKind;
  id: string;
  name?: string;
}
\`\`\`

The modal offers the choice only when users are in scope — it changes nothing for
any other kind — and states each side as a fact rather than a warning:

- on → _"Names are stored unencrypted on this device."_
- off → _"Reopening will look up 1,200 names."_

A count of requests is a fact. A duration would be a guess, and \`docs/claims.md\`
does not allow one.

**Two bounds, enforced in the writer and re-applied in \`normalizeFile\`:** twenty
collections per org, two thousand rows per collection — the latter equal to
\`SELECTION_LIMIT\`, so a basket that fits can always be saved. Over-cap is
**refused whole**, never truncated, following \`applyAddMany\`. There is no TTL: a
saved collection is a decision the admin made, and only they should undo it, which
is the argument \`workingSetStore\` already makes for \`pinned\`.

**Loading is all-or-nothing.** If any row cannot be named, the load is refused
entire and the surface says how many and why. Partially loading a cohort silently
shrinks it, and the next thing that happens to a cohort is a bulk write.

## Consequences

**The posture change is real and is registered, not argued away.** Worst case per
org is 20 × 2,000 = 40,000 display names in plaintext. \`docs/security.md\` §7 and
\`docs/security-risks.md\` #9 both state it. Three things separate this from the
basket the same doc refuses to persist, and none of them is "it is smaller":

- it is **bounded and stated**, where a basket's size is whatever ticking
  produced;
- it is **deliberate** — a named row the admin created and can delete, not a
  by-product of ticking boxes;
- the admin can **decline the names entirely** and pay in requests instead. The
  basket offers no such lever because it is never written down at all.

**Org-origin scoping is not optional.** \`GroupCollections\` had none, so org B
showed org A's collection names with ids that could not resolve — a cross-tenant
leak in the UI, not merely a bug. The new store keys by origin the way
\`workingSetStore\` does, and \`select(file, origin)\` is the only read path.

**Users can move to the free side with no migration.** Because the name is already
optional per row, verifying OR-ed \`id eq\` on \`/api/v1/users\` — filed as \`I-056\`,
and it needs a live org — would let the name be dropped by changing a default,
not a schema. That is the main reason the flag sits on the row rather
than on the collection.

**The legacy data is dropped, not converted.** Sam confirmed nobody uses the old
feature. \`okta_unbound_group_collections\` is removed on boot rather than migrated,
because a converter for data with no org scoping would have to guess which org
each collection belonged to — and guessing is the thing this record is about
refusing to do.
`;function o(n){return e.jsxs(e.Fragment,{children:[`
`,e.jsx(a,{title:"Documentation/ADRs/0006 Saved Collections"}),`
`,e.jsx(i,{children:r})]})}function l(n={}){const{wrapper:t}={...s(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(o,{...n})}):o()}export{l as default};
