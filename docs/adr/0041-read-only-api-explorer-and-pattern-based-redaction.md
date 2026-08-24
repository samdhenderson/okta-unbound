# ADR-0041: A read-only API Explorer, and redaction by pattern instead of by field name

- Status: Accepted
- Date: 2026-08-24
- Relates to: `docs/rockstar-parity-plan.md` Phase 4 ("API Console"), which scopes
  this feature and flags it ADR-gated

## Context

`docs/rockstar-parity-plan.md` already names this feature: a "Constrained API
Console: same-origin only, method allow-list, GET-default, writes confirmed +
audited," folding in a "fetch path → tree + table" JSON viewer. The plan's own
ADR-triggers section calls out "API Console write-surface widening" as needing a
decision record before a general request tool ships, because it turns the
same-origin-path guard from something only internal call sites exercise into
something a human types into directly.

The actual driving need is narrower than the full console the plan describes: the
ability to fire an arbitrary Okta `GET` and see the real response shape —
particularly `expand=...`/`_embedded` payloads, which routinely carry fields the
public docs don't list — so that shape can be understood and, when useful, handed
to an external tool (an LLM session) for help designing a zod schema or a column
catalog. That last step is the actual constraint this ADR exists to resolve: live
org responses carry real emails, phone numbers, and Okta entity ids (users,
groups, apps, policies) that should never leave the extension un-redacted, and no
redaction utility of any kind exists in this codebase yet.

## Decision

**Ship the read half of the API Console now, GET-only, reusing the existing
transport unchanged — and redact by value pattern, not by field name.**

### 1. Scope: GET-only, no new transport

`coreApi.makeApiRequest(endpoint, 'GET', undefined, 'interactive')`
(`src/sidepanel/hooks/useOktaApi/core.ts`) already accepts an arbitrary
same-origin path string and routes it through the background `ApiScheduler` and
the content script's existing guards — `isSameOriginPath` and the HTTP method
allow-list in `src/content/apiRequest.ts`, duplicated at the background layer in
`isValidScheduleRequest`. **No new message action, no background or
content-script change.** Restricting the Explorer UI to `GET` means it exercises
guards that already exist and are already exercised by every other feature in the
app; it adds no new write surface and therefore does not trigger the parity
plan's write-confirm/audit requirement. `POST`/`PUT`/`PATCH`/`DELETE` support is
explicitly **out of scope** here and is left for a future ADR when it's wanted —
that ADR is where confirm-on-write and audit logging for an arbitrary write get
designed, not retrofitted onto this one.

### 2. Redaction is pattern-based, not field-name-based

`src/shared/utils/redact.ts` walks a parsed response and, for every string leaf,
substring-replaces (not whole-value-matches, since an id or the org's own
hostname is typically embedded inside a longer URL string) in order: the live
org's hostname → `<OKTA_ORG>`; email-shaped substrings → `<EMAIL>`; phone-shaped
substrings (must carry a separator, to avoid flagging bare digit counts) →
`<PHONE>`; Okta-id-shaped substrings → a typed placeholder from a small
known-prefix table (`00u`→`<USER_ID>`, `00g`→`<GROUP_ID>`, `0oa`→`<APP_ID>`,
`00p`/`rst`→`<POLICY_ID>`, `aus`→`<AUTH_SERVER_ID>`), falling back to a generic
`<OKTA_ID>` for an id-shaped-but-unrecognized prefix. The id patterns are bounded
to Okta's actual 20-character id length (a 3-character lowercase-start prefix
plus a fixed 17-character body), not an open-ended minimum, so the fallback
doesn't relabel unrelated long tokens (session ids, JWT fragments) that merely
start with a lowercase letter.

Deliberately **not** denylisting by field name (flagging `firstName`,
`streetAddress`, etc. regardless of value shape): the concrete pain this feature
exists to solve — ids and emails buried unpredictably inside `_links`/`_embedded`
— is exactly what a value-pattern catches regardless of which key it sits under,
while a name sitting next to a key literally called `firstName` is something the
person about to paste this can eyeball-redact themselves. This is an accepted,
documented limitation, not a silent gap: a bare unstructured PII value with no
matching pattern (a plain city or person name with no adjacent marker) is **not**
caught by `redact.ts`, and this tool does not claim to be compliance-grade DLP —
it is a "good enough before I paste this" aid, and the person using it is the
same person who requested the data.

### 3. The values-free Shape view is the default, not a bonus mode

`src/shared/utils/shapeInference.ts` renders a response's structure — field
names, and whether a value is a string/number/boolean/null/array/object — with
**zero actual values**, merging array items into one representative shape and
marking a field optional when only some items carry it. Because it never touches
a value, this view is immune to every gap named in §2 above. `JsonViewer`
(`src/sidepanel/components/shared/JsonViewer.tsx`) opens on this view; Redacted
and Raw are one click away, with Raw carrying an explicit inline warning since it
is the one view that is fully unredacted. This ordering — safest view first,
progressively more revealing views behind explicit clicks — is the actual safety
posture of the feature, not the redaction pattern set alone.

## Consequences

- **The API Explorer tab (`src/sidepanel/components/ApiExplorerTab.tsx`) ships
  read-only.** Its `TabType` entry is `'explorer'`; there is no settings gate or
  "developer mode" toggle — the tab is always visible like every other tab, since
  it issues no traffic on its own (button-triggered only) and reuses guards every
  other feature already exercises.
- **`redact.ts` and `shapeInference.ts` are general-purpose, not Explorer-only** —
  they live in `src/shared/utils/` and take arbitrary JSON, so a future feature
  that also needs to show a raw Okta response (a debug panel, a support export)
  can reuse them without re-deriving the pattern set.
- **A future write-capable API Console is still gated exactly as
  `docs/rockstar-parity-plan.md` already says.** This ADR does not authorize
  `POST`/`PUT`/`PATCH`/`DELETE` through the Explorer UI; that remains a distinct,
  future ADR covering confirm-on-write and audit capture, per the parity plan's
  own trigger list.
- **The redaction pattern set is a known, incomplete list**, expected to grow as
  gaps are found in practice (e.g. a new Okta id prefix, a locale-specific phone
  format) — extending `KNOWN_OKTA_ID_PREFIXES`/`EMAIL_RE`/`PHONE_RE` in
  `redact.ts` is the sanctioned way to close a gap; adding a field-name denylist
  is not, per §2's reasoning, unless a future incident shows that reasoning wrong.
