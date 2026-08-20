# ADR-0033: The profile view is authored by the admin, per org

- Status: Accepted
- Date: 2026-08-19
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary), ADR-0016 /
  ADR-0018 (panes stay mounted), ADR-0020 (a failed read is never an assertion),
  ADR-0032 (the header owns identity; the body must not repeat it),
  `docs/security.md` §6

## Context

The old Users tab decided, in code, what a profile is. `userProfileSections.ts`
hard-coded four sections, a label per field, and a rule that dropped every empty
value. That is defensible for one org and wrong for the next one: Okta profile
schemas are **per tenant**. An org with fifteen custom attributes saw them all in
one undifferentiated "Custom Attributes" heap, ordered by whatever
`Object.entries` happened to yield, while the fields an admin actually reads —
`employeeNumber`, a cost centre, a joiner date — sat below three sections of
`honorificSuffix`-shaped padding they never look at.

Dropping empty values made it worse in a way that is easy to miss: it left the
view unable to answer "does this org even define X?". An attribute absent because
the org does not have it and an attribute absent because this one person has no
value for it rendered identically — as nothing at all.

So the ordering, the grouping and the labelling are not the app's to fix. They are
a **reading** of a tenant's schema, and the person doing the reading is the admin.

## Decision

**Ship a configuration the admin authors, keyed to the org, over an inventory read
from the org's own schema.**

### 1. Per org, not per user

The configuration is stored under `oktaOrigin` and nothing else
(`shared/storage/profileDisplayStore.ts:121` — the object store's `keyPath`).

It describes how _this admin reads this tenant's schema_, and the schema is a
property of the org, not of the person on screen. A per-user config would be
wrong on its face: open the next user and the categories an admin spent five
minutes filing would be gone, and the same attribute would appear in two places
depending on whose page you were on. There is also nothing to key it to — the
panel's whole audience is one admin at one browser profile, and it holds no notion
of an author.

The consequence to accept is that an admin working two tenants configures each
one. That is the correct behaviour, not a cost: the two tenants have different
attributes.

### 2. IndexedDB, not `chrome.storage.sync`

`presetStore.ts` is the shape this copied — a lazily-opened, reused connection, an
`idb` `DBSchema`, one keyed store, and a singleton export. Every method is
fire-and-forget: a failed read returns `null`, which callers read as "no saved
config" and fall back to `DEFAULT_PROFILE_DISPLAY_CONFIG`
(`shared/storage/profileDisplayStore.ts:137`).

`chrome.storage.sync` was rejected on two independent grounds.

**Nothing reads it.** The extension contains exactly one `storage.sync` write —
`background/index.ts:326`, an `onInstalled` handler stashing `version`,
`operationDelay` and `defaultView` — and no reader anywhere. Adding the first real
consumer of a synced-preferences story that does not otherwise exist would be
committing to sync semantics (quota per item, quota per minute, cross-device
conflict resolution) to serve one screen.

**And it is not a preference.** A preference is small, scalar and portable. This is
an order array plus an assignment map over the org's entire attribute inventory —
it grows with the tenant's schema and approaches `sync`'s 8KB per-item cap in a
large org, and it is meaningless on a device signed in to a different tenant
anyway. It is per-org display state, and it belongs with the other per-org display
state.

### 3. An unknown stored key degrades to Uncategorized; it is never dropped

Two configs are kept and the distinction is the whole module
(`sidepanel/hooks/useProfileDisplayConfig.ts`):

- the **stored** config, written back verbatim
  (`profileDisplayStore.saveConfig`, `:156`), including placements for attributes
  that are not in the schema this session;
- the **reconciled** config, projected onto the attributes that exist right now
  (`reconcileConfig`, `useProfileDisplayConfig.ts:124`), which is the only one the
  UI ever sees.

The failure this avoids is specific. `getUserProfileSchema` returns `null` on a
rate limit, a transport failure, or a payload that does not validate — a routine,
transient outcome. If the reconciled view were also what got written back, one
degraded load would silently delete the admin's categorisation of every attribute
the app could not see that session, and the deletion would be invisible: the
categories would still be there, just empty. **An answer we failed to obtain is not
an answer that the attribute is gone** — the same posture ADR-0020 made the
attribution paths take when a rules fetch fails.

So a patch computed against the reconciled config is folded into the stored one
through mergers that treat currently-unknown entries as untouchable
(`mergeRecord` / `mergeOrder` / `mergeStoredConfig`,
`useProfileDisplayConfig.ts:57`–`114`): the known entries come from the patch, so a
deletion is a real deletion, while an unknown attribute keeps its category and its
slot in the order.

This is the `useExportPresets.ts` reconcile pattern —
`useExportPresets.ts:46` filters persisted column ids against the descriptor's
current catalog on read — with one addition: here the reconciliation must not
write back, because a column catalog is code and a profile schema is a network
read that can fail.

The other half of the rule runs at render. An attribute filed under a category the
admin has since deleted resolves to `''`, the Uncategorized key
(`useProfileDisplayConfig.ts:144`), and the Uncategorized block is never dropped
(`components/users/profileAttributeBlocks.ts:32`). Deleting a category is
therefore a reversible act that moves attributes, never one that hides them.

### 4. The inventory comes from the org's schema, not from a constant

`GET /api/v1/meta/schemas/user/default` (`useOktaApi/userOperations.ts:466`), read
once per org and cached under `cacheKeys.userSchema` at `TTL_LONG`
(`sidepanel/cache/keys.ts:129`), gated on the Profile pane being asked for.

It is the only source that knows an attribute exists when the user on screen has
no value for it, the only source of human titles for org-defined attributes, and —
decisively — the only source that is _right for this tenant_. Custom attributes
are per-org, so a hard-coded inventory is wrong for every org that has any, which
is most of them.

`BASE_PROFILE_ATTRIBUTES` (`shared/utils/profileFields.ts:104`) survives as the
**fallback only**. When the schema read returns `null`, the base attributes still
exist in the org, so emitting zero of them would be a worse answer than emitting a
stale-but-true list (`profileAttributes.ts:233`); custom attributes are then
discoverable only from the keys this particular user carries, which is a real loss
of _discovery_ and never a loss of the view.

Validation is lenient, per ADR-0006 and the `oktaAppListItemSchema` precedent:
every property is optional, unknown fields pass through, and a malformed
individual property is dropped with a counts-only warning rather than failing the
payload (`shared/schemas/okta.ts:632`). One bad org-defined attribute must not
empty the inventory.

### 5. The security filter runs where a descriptor is created, once

`allProfileAttributes` funnels every candidate — system field, schema base
property, schema custom property, and unmentioned key on the user's own profile —
through a single `emit()` that calls `isExcludedProfileField` before anything is
appended (`profileAttributes.ts:218`–`225`).

The alternative is a filter per source, and it rots by construction: the inventory
has four sources today, the fourth ("keys the schema never mentioned") exists
precisely to catch what the others miss, and a fifth is what an attribute editor
or an export path will add. A filter that has to be remembered at each new source
will eventually not be — and the failure mode is a recovery answer rendered on
screen, which is exactly the class of bug the exclusion set exists to prevent.
Guarding the one funnel makes it structurally impossible for a source to
re-introduce a key another source dropped, and it is the same argument
`getCustomProfileFields` already made for its own path.

The match is on the bare Okta name, never the prefixed `profile.<key>` — a
prefixed key would defeat the set lookup silently.

### 6. What is banked and deliberately unrendered

The schema property shape captures more than PR1 draws: `mutability`, `required`,
`type`, `enum`/`oneOf` and the `master` block
(`shared/schemas/okta.ts:588`), plus `AttributeDescriptor.raw`, the untouched
value beside the stringified one (`profileAttributes.ts:59`).

**PR1 renders none of it.** No mastering badge, no read-only marker, no enum
picker; nothing branches on any of these fields.

Capturing them now was cheaper than reopening the schema read later. The cost here
is a few optional fields on a schema that is already `.passthrough()` and already
being parsed — approximately zero. The cost of adding them later is re-opening the
boundary validator, re-deciding leniency for each field, re-running the read, and
re-testing the parse, in a change whose actual subject is an editor. And these are
exactly the fields "C. Bulk Attribute Editor" (`docs/features-plan.md`) is
specified against: `mutability` is what stops the editor offering a field Okta
will refuse to write, and `master` is its stated differentiator — skipping
externally-mastered profiles instead of failing against them.

`mutability`, `type` and `master.type` are `z.string()` rather than enums on
purpose: an unrecognized value from a future Okta release must survive validation
and be narrowed by its reader, not cost the whole property.

## Consequences

- `userProfileSections.ts` and `UserProfileCard` are deleted. Their labels were the
  hard-coding this replaces, and the header already names the entity (ADR-0032), so
  there is no identity card left for them to be the body of.
- The Profile pane can now show an attribute the user has **no value for**, flagged
  `isEmpty`, behind a toggle that is off by default. "This org does not define X"
  and "this person has no X" became different answers on screen.
- One extra org-wide request exists per session, and only if the Profile pane is
  opened: the schema read is gated on `pane === 'profile'` with the deferred re-arm
  (`hooks/useUserDetailPanes.ts`), and cached at `TTL_LONG` because an admin
  changing a profile schema is a rare, deliberate act.
- Writes are coalesced behind a 400ms timer and flushed on unmount
  (`useProfileDisplayConfig.ts:29`, `:234`), so dragging a reorder handle does not
  thrash IndexedDB and closing the modal cannot lose the last edit.
- **Nothing in this path logs a category name, an attribute name, or an attribute
  value.** Category labels are admin-authored and may echo org vocabulary;
  attribute names and values are tenant data and frequently PII. Identifiers,
  counts and outcomes only, per `docs/security.md`.
- IndexedDB is plaintext, so what is stored is deliberately a _view preference_ —
  names and category assignments — and never attribute values. Clearing the org's
  config (`clearConfig`) returns it to the defaults with no other effect.
- The `version: 1` field on each record buys forward migration without a DB version
  bump: a later shape can be detected and upgraded per record on read.
- **Not done here.** Nothing reads `mutability`, `master`, `required`, `type`,
  `enum`/`oneOf` or `raw`. The first reader is the attribute editor, and it inherits
  a validated schema rather than a new boundary to design.
