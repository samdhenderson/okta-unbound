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

| Domain | Posture |
| --- | --- |
| Authentication | Reuses the existing Okta session; no credentials requested, stored, or transmitted |
| Secret handling | XSRF token read from the page DOM per request, never persisted/logged/messaged |
| Trust boundary | Same-origin + method allow-list enforced **independently** at the background entry and the content-script fetch site |
| Code execution | No `eval`/`new Function`/`innerHTML`/`dangerouslySetInnerHTML` in production; rule expressions use a real parser; MV3 default CSP |
| Data at rest | No credentials in storage; TTL'd caches, capped undo history, user-configurable audit retention |
| External surface | No `externally_connectable`, no `onMessageExternal`; host access scoped to three Okta domains |

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
integrity of admin operations (group/user/rule writes); cached tenant data (group/user
names, emails, memberships, audit history).

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
  else is rejected.
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
  deliberate PII guard). Applied on the hot single-entity read/write paths (user info,
  group name, rule read, rule create). **Coverage is partial by design** — see
  [§8](#8-residual-risks--known-gaps) and [ADR-0006](./adr/0006-zod-boundary-validation.md).
- **No dynamic code execution.** Rule expressions are evaluated by a hand-written
  lexer + recursive-descent parser
  ([`shared/ruleEvaluator.ts`](../src/shared/ruleEvaluator.ts)): input outside the grammar
  throws, function-call tokens resolve to `false` rather than executing, and
  `canEvaluateClientSide` gates unsupported expressions. Grep confirms **zero**
  `eval`/`new Function`/string-`setTimeout`/`innerHTML`/`document.write`/
  `dangerouslySetInnerHTML` in production code. MV3's default CSP (`script-src 'self'`)
  blocks dynamic execution at runtime.
- **Okta-origin validation.** [`shared/utils/oktaUrl.ts`](../src/shared/utils/oktaUrl.ts)
  `isOktaUrl()` **parses the hostname** (`new URL`), requires `https:`, and matches against
  a hardcoded domain list by exact or dot-suffix equality — never substring matching.
  Unit tests reject `okta.com.evil.com`, `evilokta.com`, and non-HTTPS URLs.
- **CSV / export injection.** [`shared/utils/csvUtils.ts`](../src/shared/utils/csvUtils.ts)
  `escapeCSV()` applies both RFC 4180 quoting **and** a spreadsheet-formula-injection guard
  (prefixes values leading with `= + - @ tab CR` with a quote); `generateCSV()` routes
  every cell and header through it. **One export path bypasses this** — see
  [§8](#8-residual-risks--known-gaps).
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
  notifications, sidePanel, alarms`, each mapped to a real consumer (with one review
  candidate — see [§8](#8-residual-risks--known-gaps)).
- **No secrets at rest.** No credential, cookie, session, or XSRF value is written to any
  storage API (grep-verified across every `chrome.storage.*.set` / IndexedDB write). Only
  cache payloads, group/rule/tab UI state, audit entries, and non-sensitive prefs are
  stored.
- **TTL'd / bounded storage.** [`shared/cache.ts`](../src/shared/cache.ts) evicts entries
  on read past a 5-minute default TTL; undo history is capped at 50 entries
  ([`shared/undoManager.ts`](../src/shared/undoManager.ts)); the audit trail
  ([`shared/storage/auditStore.ts`](../src/shared/storage/auditStore.ts)) has a
  user-configurable retention (default 90 days), can be disabled, and supports a full
  GDPR-style purge. Security-sensitive profile fields (password, credentials, recovery
  Q/A) are excluded from rendering via
  [`shared/utils/profileFields.ts`](../src/shared/utils/profileFields.ts).
- **Logging discipline.** [`shared/utils/logger.ts`](../src/shared/utils/logger.ts) gates
  `debug`/`info` to dev builds (compiled out in production); `no-console` is an ESLint
  `error` with the logger module as the only exception. Fetch call sites log path (query
  stripped), method, and `hasBody`/`present` booleans — never tokens, bodies, or PII.
- **Secrets hygiene.** No real secrets, org URLs, or tokens anywhere in source, tests,
  fixtures, or docs; placeholders are obviously fake (`00gFAKE…`, `*@example.com`).

---

## 8. Residual risks & known gaps

Ranked by severity. This section is deliberately not marketing-clean — it is what a
reviewer should scrutinize. Items marked **fix candidate** are tracked in
[`features-plan.md`](./features-plan.md) / the issue tracker.

| # | Severity | Finding | Location | Status |
| --- | --- | --- | --- | --- |
| 1 | **Medium** | **CSV formula-injection bypass.** One export path hand-builds CSV with RFC 4180 quoting but **no** formula-injection guard, interpolating the end-user-controllable `group.name`. A group named `=HYPERLINK(...)` exports a live formula. Violates the repo's own CSV hard rule. | [`GroupComparisonModal.tsx`](../src/sidepanel/components/groups/GroupComparisonModal.tsx) `handleExportResults` | **Fix candidate** — route through `generateCSV`/`escapeCSV` |
| 2 | Low–Med | **Content-script `onMessage` authenticates no sender.** Unlike the background, [`content/index.ts`](../src/content/index.ts) does not check `sender.id`/`sender.tab`. Mitigated by MV3 messaging semantics (no web-page delivery) and downstream same-origin/method re-validation, so no live exploit — but an asymmetry and the surface that would be exposed if `externally_connectable` were ever added. | [`content/index.ts`](../src/content/index.ts) | **Fix candidate** — add the `sender.id` guard for symmetry |
| 3 | Low | **Background "not-from-tabs" guard is API-only.** The `sender.tab` rejection covers `scheduleApiRequest` but not the scheduler-control (`pause`/`resume`/`clearQueue`) or tab-state actions. Impact is UI-state/DoS-style disruption, not data exposure. | [`background/index.ts`](../src/background/index.ts) | **Fix candidate** |
| 4 | Low | **List/search/membership/export paths bypass zod** (accepted [ADR-0006](./adr/0006-zod-boundary-validation.md) deferral). The highest-volume, end-user-controllable data — including the member data that feeds exports — is not schema-validated. | [`content/userHandlers.ts`](../src/content/userHandlers.ts), [`content/groupHandlers.ts`](../src/content/groupHandlers.ts) | **Deferred** (documented) |
| 5 | Low | **Non-attributable audit entries.** Rule-consolidation and group-merge audit records use a placeholder `performedBy: 'unknown@unknown.com'` instead of the real actor (other operations record the real user). | `useRuleConsolidation.ts`, `useGroupMerge.ts` | **Fix candidate** |
| 6 | Low | **Two `window.open` deep links omit `noopener`**, inconsistent with the `OpenInOktaLink` standard. Target is first-party Okta, so tabnabbing risk is minimal. | `groups/GroupListItem.tsx`, `users/GroupMembershipsList.tsx` | **Fix candidate** |
| 7 | Info | **`activeTab` has no strict consumer** beyond what the granted Okta `host_permissions` already cover — a least-privilege review candidate. | [`manifest.json`](../manifest.json) | Review |
| 8 | Info | **CSP is default-inherited, not explicitly pinned.** The MV3 default is the hardened posture; an explicit `content_security_policy` entry would guard against accidental future weakening. | [`manifest.json`](../manifest.json) | Consider |
| 9 | Accepted | **Plaintext at rest (platform-inherent).** `chrome.storage.local` and IndexedDB are unencrypted; cached emails/names and the audit trail are readable with local profile access. Not eliminable within MV3; mitigated by TTL, undo cap, retention, and the exclusion filter. | Chrome platform | Accepted |

---

## 9. How to verify independently

A reviewer can reproduce the core claims without trusting this document:

- **No external message surface:** `grep -rn "externally_connectable\|onMessageExternal" src manifest.json` → only comments/absence.
- **No dynamic execution / HTML injection:** `grep -rn "eval(\|new Function\|dangerouslySetInnerHTML\|innerHTML\|document.write" src` → production hits are zero (matches are tests/JSDoc).
- **No secrets:** `grep -rn "SSWS \|Bearer \|Authorization" src` → prohibition text only.
- **XSRF never stored/logged:** read `getXsrfToken` in [`content/apiRequest.ts`](../src/content/apiRequest.ts); run the regression test in [`content/index.test.ts`](../src/content/index.test.ts).
- **Quality gates:** every PR runs lint (0 errors), strict type-check, the 80/75 coverage
  gate, and the Storybook build/story tests
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
