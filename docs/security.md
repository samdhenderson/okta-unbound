# Security assessment

_A reviewer-facing description of Okta Unbound's security posture: the trust model,
the controls that enforce it (with links to the implementing code), and an honest
account of residual risks and known gaps. Written for security professionals
evaluating the extension before enterprise approval._

**Scope:** the extension source under [`../src/`](../src/) and [`../manifest.json`](../manifest.json).
**Status:** point-in-time; symbols are cited by name (line numbers drift). Independently
verifiable — see [How to verify](#how-to-verify-independently).

---

## 1. Posture summary

Okta Unbound is a Chrome **Manifest V3** side-panel extension that acts **only as the
signed-in administrator, only against that administrator's own Okta tenant, only for the
life of the browser session**. It has no backend, stores no credentials, and opens no
external message surface.

| Domain           | Posture                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication   | Reuses the existing Okta session; no credentials requested, stored, or transmitted                                                        |
| Secret handling  | XSRF token read from the page DOM per request, never persisted/logged/messaged                                                            |
| Trust boundary   | Same-origin + method allow-list enforced **independently** at the background entry and the content-script fetch site                      |
| Code execution   | No `eval`/`new Function`/`innerHTML`/`dangerouslySetInnerHTML` in production; rule expressions use a real parser; explicit pinned CSP     |
| Data at rest     | No credentials in storage; TTL'd caches, capped undo history (now holds prior profile values — §8 #10), user-configurable audit retention |
| External surface | No `externally_connectable`, no `onMessageExternal`; host access scoped to three Okta domains                                             |

Substantive gaps a reviewer should weigh are collected in
[§8 Residual risks & known gaps](#8-residual-risks--known-gaps); none are credential- or
session-exfiltration risks.

---

## 2. Trust model & architecture

The extension runs across three isolated contexts. Privilege decreases toward the page:
the side panel renders UI, the background service worker enforces policy and rate limits,
and the content script is the only component that touches the Okta API.

```
Side panel (useOktaApi)  →  Background (ApiScheduler)  →  Content script (fetch)  →  Okta API
   renders UI, no             validates + rate-limits,      holds the live session,
   direct Okta access         routes every API call         reads XSRF per request
```

- **Side panel** — [`src/sidepanel/`](../src/sidepanel/). Never calls Okta directly; all
  API traffic is emitted as a `scheduleApiRequest` message to the background via
  `makeApiRequest` ([`useOktaApi/core.ts`](../src/sidepanel/hooks/useOktaApi/core.ts)).
- **Background service worker** — [`src/background/index.ts`](../src/background/index.ts).
  Owns the `ApiScheduler` and is the message-policy boundary.
- **Content script** — [`src/content/`](../src/content/), injected **only** on Okta origins.
  Holds the authenticated session cookies + XSRF token; performs the only Okta `fetch`.

The live session and XSRF token exist **only** in the content script and are never
persisted or passed across extension messages. Full architecture:
[`architecture.md`](./architecture.md).

---

## 3. Threat model

**Assets:** the administrator's authenticated Okta session (cookies + XSRF token); the
integrity of admin operations (group membership, rule lifecycle, user lifecycle, and —
since [ADR-0035](./adr/0035-the-first-profile-write.md) — **user profile attribute
writes**); cached tenant data (group/user names, emails, memberships, audit history, and
the prior/new attribute values captured for undo).

**Trust boundaries:**

- Web page (the Okta admin console DOM) ↔ content script.
- Content script ↔ background ↔ side panel (extension-internal messaging).
- Extension ↔ Okta API (network).

**Adversaries considered:**

- A **malicious or compromised web page** attempting to drive authenticated Okta calls or
  read the session/XSRF token through the extension.
- **Another installed extension** attempting to message this extension.
- **Malicious tenant data** — Okta group names, rule expressions, and profile attributes
  are end-user-controllable and are treated as untrusted input (injection, XSS, CSV
  formula injection).
- **Local disk/profile access** to unencrypted extension storage.

**Out of scope:** the security of Okta itself; a fully compromised browser or OS; a
malicious administrator acting within their own granted privileges; supply-chain
compromise of pinned dependencies (mitigated by lockfile + review, not eliminated).

---

## 4. Message-passing & trust boundary

All controls below are in [`background/index.ts`](../src/background/index.ts) unless noted.

- **Foreign-sender rejection.** The `chrome.runtime.onMessage` listener opens with
  `sender.id !== chrome.runtime.id → reject`, before any action dispatch. Defends against
  other installed extensions. (Defense-in-depth: MV3 does not deliver web-page messages to
  `onMessage` absent `externally_connectable`.)
- **Tab-origin rejection for API calls.** `case 'scheduleApiRequest'` rejects any message
  where `sender.tab` is set, so a content script (which runs in a page context) can never
  drive an authenticated Okta request — only extension pages reach the scheduler.
- **Structural validation.** `isValidScheduleRequest` requires `endpoint` to be a string
  beginning with a single `/` (rejects absolute and protocol-relative `//` URLs), an
  integer `tabId`, and — when present — a method in `{GET, POST, PUT, PATCH, DELETE}` and a
  priority in `{interactive, high, normal, low}`.
- **Scheduler-routed transport.** Raw Okta traffic flows side panel → background
  ([`ApiScheduler`](../src/shared/scheduler/apiScheduler.ts)) → content script. `makeApiRequest`
  is the only emitter of `scheduleApiRequest`; the separate `sendMessage`
  ([`core.ts`](../src/sidepanel/hooks/useOktaApi/core.ts)) transport is documented as
  non-API only (e.g. streaming a CSV export to a download) and carries no Okta API calls.
- **No external surface.** No `externally_connectable` key in the manifest and no
  `onMessageExternal` listener anywhere in `src/` (grep-verified).

---

## 5. API fetch boundary: same-origin, method allow-list, XSRF isolation

Enforced at the single fetch choke point,
[`content/apiRequest.ts`](../src/content/apiRequest.ts) (`handleMakeApiRequest`):

- **Same-origin path guard.** `isSameOriginPath(endpoint)` rejects non-strings, anything
  not starting with a single `/`, and protocol-relative `//host`, then re-parses
  `new URL(endpoint, window.location.origin)` and requires the origin to match the current
  Okta page. This is a **second, independent** copy of the background's check — genuine
  defense in depth at the fetch site. The request URL is always
  `window.location.origin + endpoint`; the origin is never taken from the message.
- **HTTP-method allow-list.** `ALLOWED_METHODS = {GET, POST, PUT, PATCH, DELETE}`; anything
  else is rejected. The extension's first user-profile write
  ([ADR-0035](./adr/0035-the-first-profile-write.md), `POST /api/v1/users/{id}`) needed
  **no allow-list change** at either boundary — `POST` was already permitted for the
  lifecycle and rule endpoints — so a new mutation class was added without widening the
  trust boundary. There is deliberately no path allow-list; the same-origin guard plus
  the method list is the whole contract.
- **XSRF token isolation.** `getXsrfToken()` reads `#_xsrfToken` from the page DOM at fetch
  time and spreads it into the `X-Okta-Xsrftoken` header only when present. It is **never**
  written to `chrome.storage`/IndexedDB/`localStorage`, **never** returned across a
  message, and **never** logged — only a `{ present: boolean }` flag is logged. Backed by a
  regression test asserting the token string never reaches logged output
  ([`content/index.test.ts`](../src/content/index.test.ts)).

---

## 6. Input validation & injection defenses

- **Boundary validation (zod).** [`shared/schemas/okta.ts`](../src/shared/schemas/okta.ts)
  defines schemas for users, groups, and group rules; `parseOkta()` uses `safeParse` and
  throws on failure, logging only issue `path`/`code` (never the received value — a
  deliberate PII guard). Single-entity reads/writes validate strictly; list, search, and
  membership responses validate through `parseOktaList()`, which drops-and-logs malformed
  items rather than failing the whole response (degrade-not-crash). `oktaUserSchema`'s
  `credentials` block is deliberately **not** `.passthrough()`, unlike its siblings:
  Okta returns `credentials.password` and `credentials.recovery_question` on that object,
  so passthrough would carry credential material past the boundary into side-panel state.
  See [ADR-0006](./adr/0006-zod-boundary-validation.md).
- **No dynamic code execution.** Rule expressions are end-user-authored, hence untrusted.
  Syntax is handled by [`jsep`](https://github.com/EricSmekens/jsep) — pinned exactly at
  `1.4.0`, MIT, no transitive dependencies — which builds an **AST only**: it evaluates
  nothing and generates no code. Semantics are first-party:
  [`shared/ruleEvaluator.ts`](../src/shared/ruleEvaluator.ts) walks that AST against an
  explicit **allow-list** of operators, fixed-arity Okta EL functions
  (`SUPPORTED_FUNCTIONS`), and single-level `user.<attribute>` reads; anything else —
  unknown function, unmodelled node, computed access, wrong argument count — is reported
  _unevaluable_, never approximated. The grammar gate is an **AST walk**, not a substring
  scan, so nothing can pass it and then fail inside the evaluator. To verify it directly,
  call `checkRuleNodeSupport()` on a node from `parseRuleExpression()` — that is the same
  walk `tryEvaluateRuleExpression` applies internally. (It replaced the boolean
  `canEvaluateClientSide()`, retired by ADR-0025 along with the whole two-valued surface,
  because a bare `false` could not say _why_ a gate rejected an expression.) Parsing is capped at 4096 characters to bound the work
  an adversarial tenant value can force, and expression text is **never logged**
  (literals can carry tenant PII) — only a reason code. Grep confirms **zero**
  `eval`/`new Function`/string-`setTimeout`/`innerHTML`/`document.write`/
  `dangerouslySetInnerHTML` in production code. The manifest pins an explicit CSP
  (`script-src 'self'; object-src 'self'`) matching the hardened MV3 default, so
  dynamic execution and remote scripts are blocked at runtime. Rationale, and why
  `jse-eval`/`expression-eval` were rejected (they evaluate arbitrary JS semantics):
  [ADR-0017](./adr/0017-jsep-expression-evaluation.md).
- **"Cannot evaluate" is never reported as "does not match."**
  `tryEvaluateRuleExpression()` returns `match | no-match | unevaluable`, using
  three-valued logic so an unresolved operand poisons only the sub-expressions that
  depend on it. This is a correctness property with security weight: these answers drive
  membership attribution, so conflating "could not parse" with "did not match" would
  present a confidently wrong access answer. Group-membership functions
  (`isMemberOfGroup*`) and `app.*` context are always `unevaluable` — they need data this
  module is not given — and callers render that as indeterminate rather than resolving it
  either way.
- **A failed load is never reported as an attribution.** The same property one level up:
  classifying a user's groups against a rule list that could not be fetched makes every
  group look untargeted, which the heuristic reads as an _exactly known manual add_. The
  user path (`hooks/useUserMemberships`) therefore distinguishes "the org has no rules"
  from "we could not obtain the rules" and reports the latter as unclassified. The two
  attribution paths — the group view's Okta-asserted `_embedded['group-rules']` and the
  user view's client-side heuristic — are reconciled by stating provenance rather than by
  silently differing; the contract, and where they are permitted to differ, is
  [ADR-0020](./adr/0020-attribution-provenance-not-a-fourth-level.md), pinned by
  `shared/membership/attributionParity.test.ts`.
- **Okta-origin validation.** [`shared/utils/oktaUrl.ts`](../src/shared/utils/oktaUrl.ts)
  `isOktaUrl()` **parses the hostname** (`new URL`), requires `https:`, and matches against
  a hardcoded domain list by exact or dot-suffix equality — never substring matching.
  Unit tests reject `okta.com.evil.com`, `evilokta.com`, and non-HTTPS URLs.
- **CSV / export injection.** [`shared/utils/csvUtils.ts`](../src/shared/utils/csvUtils.ts)
  `escapeCSV()` applies both RFC 4180 quoting **and** a spreadsheet-formula-injection guard
  (prefixes values leading with `= + - @ tab CR` with a quote); `generateCSV()` routes
  every cell and header through it, and every export path builds its output via
  `generateCSV`/`downloadCSV` — no export string-interpolates cells.
- **XSS-safe rendering.** Rendering relies on React's escaping. External Okta links use the
  canonical builder
  [`OpenInOktaLink`](../src/sidepanel/components/shared/OpenInOktaLink.tsx) — a validated
  origin + validated ID, `target="_blank" rel="noopener noreferrer"`, rendering `null` if
  unbuildable.

---

## 7. Data handling, storage, logging & manifest

- **Least-privilege manifest.** [`manifest.json`](../manifest.json) scopes content-script
  `matches` and `host_permissions` to `*.okta.com`, `*.oktapreview.com`, `*.okta-emea.com`
  only — no `<all_urls>`. `permissions` are `activeTab, storage, contextMenus,
notifications, sidePanel, alarms`, each mapped to a real consumer (`activeTab` backs the
  toolbar-click flow that reads the active tab's URL on non-Okta pages to prompt navigation
  to Okta). The manifest pins an explicit `content_security_policy` for extension pages.
- **No secrets at rest.** No credential, cookie, session, or XSRF value is written to any
  storage API (grep-verified across every `chrome.storage.*.set` / IndexedDB write). Only
  cache payloads, group/rule/tab UI state, audit entries, and non-sensitive prefs are
  stored.
- **TTL'd / bounded storage.** Cached entity data carries a TTL —
  [`sidepanel/cache/entityCache.ts`](../src/sidepanel/cache/entityCache.ts) (in-memory,
  5-minute default) and [`shared/rulesCache.ts`](../src/shared/rulesCache.ts)
  (`chrome.storage.local`, 5 minutes). A third, `groupsCache`, was retired by
  ADR-0040 along with the `entityCache`-backed app inventory; `rulesCache` is
  the last hand-rolled cache and `D-029` retires it. The background-owned org
  snapshot that replaced them is IndexedDB-backed and **not** TTL'd the same
  way — it is reconciled by walk-and-sweep rather than expiry, and whether it
  needs a TTL or a clear-on-sign-out is an open question tracked as `D-028`
  item 7. `entityCache` treats TTL as a freshness verdict
  rather than a deletion, so it is **separately bounded** at `MAX_ENTRIES` (500) with
  eviction on write — expired entries first, then least-recently-read, and never a key
  with a live subscriber or an in-flight fetch, since dropping those would force the
  refetch the cache exists to avoid. Before that bound existed the in-memory store grew
  for the life of a panel session. Undo
  history is capped at 50 entries
  ([`shared/undoManager.ts`](../src/shared/undoManager.ts)) and, since ADR-0035, its
  profile-update entries carry the **prior and new values** of the attributes a write
  touched — bounded inside that same module at `MAX_CAPTURED_ATTRIBUTES` (25) and
  `MAX_CAPTURED_VALUE_CHARS` (1024), with an over-cap value **omitted entirely rather
  than truncated** (a prefix is still PII with none of the restore utility). Unlike the
  audit trail it has **no time-based retention** — the 50-entry cap is the only bound;
  see §8 #10. The audit trail
  ([`shared/storage/auditStore.ts`](../src/shared/storage/auditStore.ts)) has a
  user-configurable retention (default 90 days), can be disabled, and supports a full
  GDPR-style purge. Security-sensitive profile fields (password, credentials, recovery
  Q/A) are excluded from rendering via `EXCLUDED_PROFILE_FIELDS`
  ([`shared/utils/profileFields.ts`](../src/shared/utils/profileFields.ts)) — and, since
  ADR-0035, the **same set is refused at the write boundary**: `assertNoExcludedKeys`
  throws before any profile patch is scheduled, so no caller can reach the endpoint with
  a credential key by forgetting to filter, and none of those keys can be captured for
  undo.
- **Logging discipline.** [`shared/utils/logger.ts`](../src/shared/utils/logger.ts) gates
  `debug`/`info` to dev builds (compiled out in production); `no-console` is an ESLint
  `error` with the logger module as the only exception. Fetch call sites log path (query
  stripped), method, and `hasBody`/`present` booleans — never tokens, bodies, or PII.
- **Secrets hygiene.** No real secrets, org URLs, or tokens anywhere in source, tests,
  fixtures, or docs; placeholders are obviously fake (`00gFAKE…`, `*@example.com`).

---

## 8. Residual risks & known gaps

This assessment is deliberately not marketing-clean — it is what a reviewer should
scrutinize. The findings below were surfaced by reading the code; findings 1–8 were
**remediated on 2026-07-20** (each fix ships with tests; the full suite, strict
type-check, lint, and format gates pass). Findings 9 and 10 are accepted rather than
fixed: 9 is a platform property, and 10 is the deliberate cost of an undo that can
actually restore.

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Location                                                                                                                                   | Status                                                                                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | **CSV formula-injection bypass** — an export hand-built CSV with no formula-injection guard, interpolating the end-user-controllable `group.name` (a group named `=HYPERLINK(...)` exported a live formula).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`GroupComparisonModal.tsx`](../src/sidepanel/components/groups/GroupComparisonModal.tsx) `handleExportResults`                            | **Fixed** — now routes through `generateCSV`/`downloadCSV` (every cell escaped); regression test added                              |
| 2   | Low–Med  | **Content-script `onMessage` authenticated no sender** — asymmetry with the background listener.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [`content/index.ts`](../src/content/index.ts)                                                                                              | **Fixed** — added `sender.id === chrome.runtime.id` guard; test added                                                               |
| 3   | Low      | **Background "not-from-tabs" guard was API-only** — scheduler-control and tab-state actions were not tab-rejected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [`background/index.ts`](../src/background/index.ts)                                                                                        | **Fixed** — `rejectIfFromTab` now guards `pause`/`resume`/`clearQueue` + `save`/`load`/`clearTabState`; tests added                 |
| 4   | Low      | **List/search/membership paths bypassed zod** ([ADR-0006](./adr/0006-zod-boundary-validation.md) deferral) — the highest-volume, end-user-controllable data (incl. export member data).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [`content/userHandlers.ts`](../src/content/userHandlers.ts), [`content/groupHandlers.ts`](../src/content/groupHandlers.ts)                 | **Fixed** — `parseOktaList()` validates each item, drops-and-logs malformed ones (degrade-not-crash); ADR-0006 updated; tests added |
| 5   | Low      | **Non-attributable audit entries** — rule-consolidation and group-merge records used a placeholder `performedBy`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [`useRuleConsolidation.ts`](../src/sidepanel/hooks/useRuleConsolidation.ts), [`useGroupMerge.ts`](../src/sidepanel/hooks/useGroupMerge.ts) | **Fixed** — both resolve the real actor via `/api/v1/users/me` (matching `useRuleLifecycle`); tests added                           |
| 6   | Low      | **Two `window.open` deep links omitted `noopener`**, inconsistent with the `OpenInOktaLink` standard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `groups/GroupListItem.tsx`, `users/GroupMembershipsList.tsx`                                                                               | **Fixed** — `'noopener,noreferrer'` added to both                                                                                   |
| 7   | Info     | **`activeTab` permission** — verified it IS required: the `action.onClicked` handler reads `tab.url` on non-Okta tabs (host permissions cover only Okta), so it is not a dead permission.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [`manifest.json`](../manifest.json)                                                                                                        | **Resolved** — required; retained                                                                                                   |
| 8   | Info     | **CSP was default-inherited, not explicitly pinned.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`manifest.json`](../manifest.json)                                                                                                        | **Fixed** — explicit `content_security_policy` (`script-src 'self'; object-src 'self'`) pinned                                      |
| 9   | Accepted | **Plaintext at rest (platform-inherent).** `chrome.storage.local` and IndexedDB are unencrypted; cached emails/names and the audit trail are readable with local profile access. Not eliminable within MV3; mitigated by TTL, undo cap, retention, and the exclusion filter. The profile values this now also covers are itemised at #10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Chrome platform                                                                                                                            | **Accepted**                                                                                                                        |
| 10  | Low      | **Widened plaintext PII surface (undo capture).** Profile-update history entries persist the **prior and new values** of every attribute a write touched, in plaintext `chrome.storage.local`. Org-defined custom attributes can hold arbitrary content, so this is not limited to the well-known base fields. Bound: 50 entries × 25 attributes × 1024 characters, before and after. Mitigations: the caps are enforced inside `logProfileUpdateAction`, the single writer of the history key, so no caller can bypass them; an over-cap value is **omitted entirely rather than truncated**; and `EXCLUDED_PROFILE_FIELDS` is refused at the write boundary, so credential and security-question keys are never in a patch and therefore never captured. **Residual, stated plainly:** the values are readable by anything with access to the browser profile's extension storage, and retention is bounded only by the 50-entry cap — there is **no time-based expiry**, unlike the audit trail's configurable retention. Clearing the history is the only way to drop them early. | [`shared/undoManager.ts`](../src/shared/undoManager.ts), [ADR-0035](./adr/0035-the-first-profile-write.md) §4                              | **Accepted**                                                                                                                        |

---

## 9. How to verify independently

A reviewer can reproduce the core claims without trusting this document:

- **No external message surface:** `grep -rn "externally_connectable\|onMessageExternal" src manifest.json` → only comments/absence.
- **No dynamic execution / HTML injection:** `grep -rn "eval(\|new Function\|dangerouslySetInnerHTML\|innerHTML\|document.write" src` → production hits are zero (matches are tests/JSDoc).
- **No secrets:** `grep -rn "SSWS \|Bearer \|Authorization" src` → prohibition text only.
- **XSRF never stored/logged:** read `getXsrfToken` in [`content/apiRequest.ts`](../src/content/apiRequest.ts); run the regression test in [`content/index.test.ts`](../src/content/index.test.ts).
- **No credential key can be written or captured:** read `assertNoExcludedKeys` in [`useOktaApi/profileOperations.ts`](../src/sidepanel/hooks/useOktaApi/profileOperations.ts) and the caps in [`shared/undoManager.ts`](../src/shared/undoManager.ts) (`MAX_CAPTURED_ATTRIBUTES`, `MAX_CAPTURED_VALUE_CHARS`); both are covered by unit tests.
- **Quality gates:** every PR runs lint (0 errors), strict type-check, the coverage
  gate (thresholds in [`vitest.config.ts`](../vitest.config.ts)), and the Storybook build/story tests
  ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

The security-hardening rules these controls enforce are codified in
[`CLAUDE.md`](../CLAUDE.md); the rationale for each decision is in [`adr/`](./adr/README.md).

---

## 10. Reporting a vulnerability

Please report suspected vulnerabilities privately via a
[GitHub security advisory](https://github.com/samdhenderson/okta-unbound/security/advisories/new)
rather than a public issue, or through the contact in [`../PRIVACY.md`](../PRIVACY.md).
Include reproduction steps and affected version; please allow reasonable time for a fix
before public disclosure.
