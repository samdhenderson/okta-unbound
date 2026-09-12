# Security assessment

_A reviewer-facing description of Okta Unbound's security posture: the trust model,
the controls that enforce it (with links to the implementing code), and an honest
account of residual risks and known gaps. Written for security professionals
evaluating the extension before enterprise approval._

**Scope:** the extension source under [`../src/`](../src/) and [`../manifest.json`](../manifest.json).
**Status:** point-in-time, re-verified against source on **2026-09-09**; symbols are cited
by name (line numbers drift). Independently verifiable — see
[How to verify](./security-risks.md#2-how-to-verify-independently).

---

## 1. Posture summary

Okta Unbound is a Chrome **Manifest V3** side-panel extension that acts **only as the
signed-in administrator, only against that administrator's own Okta tenant, only for the
life of the browser session**. It has no backend, stores no credentials, and opens no
external message surface.

| Domain           | Posture                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication   | Reuses the existing Okta session; no credentials requested, stored, or transmitted                                                                                       |
| Secret handling  | XSRF token read from the page DOM per request, never persisted/logged/messaged                                                                                           |
| Trust boundary   | Same-origin + method allow-list enforced **independently** at the background entry and the content-script fetch site                                                     |
| Code execution   | No `eval`/`new Function`/`innerHTML`/`dangerouslySetInnerHTML` in production; rule expressions use a real parser; explicit pinned CSP                                    |
| Response data    | Every Okta response validated with zod at the content-script/handler boundary; only five allow-listed response headers cross the message boundary                        |
| Data at rest     | No credentials in storage; TTL'd caches, capped undo history (now holds prior profile values — risk #10), capped/redacted request log, user-configurable audit retention |
| External surface | No `externally_connectable`, no `onMessageExternal`; host access scoped to three Okta domains                                                                            |

Substantive gaps a reviewer should weigh are collected in
[§8 Residual risks & known gaps](./security-risks.md); none are credential- or
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

**The background is now also an originator of traffic, not only a router.** Two
background-owned callers schedule Okta requests with no side panel open: the org-snapshot
walk ([`background/snapshotBridge.ts`](../src/background/snapshotBridge.ts), armed by
[`snapshotScheduler.ts`](../src/background/snapshotScheduler.ts) on tab-navigation and a
`chrome.alarms` tick) and the once-per-org rate-limit-threshold probe
([`background/rateLimitThreshold.ts`](../src/background/rateLimitThreshold.ts)). Neither
widens the boundary: the background still cannot fetch Okta itself, so every one of those
requests exits through the same scheduler and the same content-script choke point, at
`low` priority, against a tab whose URL has been parsed and confirmed as an Okta origin
(`oktaOriginOf`). What changed is that authenticated traffic can happen without a user
gesture, which is why the snapshot walk is opportunistic (it no-ops when no logged-in Okta
tab exists) rather than scheduled.

**Content-script re-injection.** On install/update, MV3 orphans the content script in every
already-open Okta tab without injecting the new one.
[`background/reinjectContentScripts.ts`](../src/background/reinjectContentScripts.ts)
closes that gap — see §7 for the `scripting` permission it needs and the bound on where it
can inject. The re-injected script and any script Chrome injected itself are reconciled by
a liveness-probe claim (`window.__oktaUnboundClaim`) in
[`content/index.ts`](../src/content/index.ts), so a tab never ends up with two listeners
answering the same message.

The live session and XSRF token exist **only** in the content script and are never
persisted or passed across extension messages. Full architecture:
[`architecture.md`](./architecture.md).

---

## 3. Threat model

**Assets:** the administrator's authenticated Okta session (cookies + XSRF token); the
integrity of admin operations (group membership, rule lifecycle, user lifecycle, and
**user profile attribute writes**); cached tenant data (group/user names, emails,
memberships, audit history, the redacted API request log, and the prior/new attribute
values captured for undo).

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
- **Tab-origin rejection for every privileged action.** The same `rejectIfFromTab` guard
  fronts `pauseScheduler`, `resumeScheduler`, `clearSchedulerQueue`, `saveTabState`,
  `loadTabState`, `clearTabState`, and the two actions added since — `updateOperationPlan`
  and `syncSnapshot`. The unguarded actions are the two pure reads that expose no tenant
  data (`getSchedulerState`, `getSchedulerMetrics`). Pinned by `background/index.test.ts`
  ("rejects tab-originated privileged actions").
- **Structural validation.** `isValidScheduleRequest` requires `endpoint` to be a string
  beginning with a single `/` (rejects absolute and protocol-relative `//` URLs), an
  integer `tabId`, and — when present — a method in `{GET, POST, PUT, PATCH, DELETE}`, a
  priority in `{interactive, high, normal, low}`, and a `reason` that is a string no longer
  than `MAX_REASON_LENGTH` (80). The `reason` is the verbose request log's "why" and is
  persisted, so bounding it here bounds what a malformed caller can put in storage; the
  same cap is re-applied inside `shared/requestLog.ts` because background-internal callers
  never pass through this handler.
- **`updateOperationPlan` is advisory, and validated anyway.** `isValidPlanUpdate` caps the
  plan id (64), the plan name (80) and the leg count (16), and holds every leg `endpoint`
  to the same same-origin single-`/` shape a real request must satisfy. The ledger cannot
  gate, reserve, or redirect a request — the risk it guards is unbounded strings and arrays
  reaching the state broadcast, not privilege.
- **`syncSnapshot` validates the origin by parsing it.** `isValidSyncSnapshotRequest`
  requires `isOktaUrl(origin)` (a parsed hostname, never a substring match) and an integer
  `tabId`. Both are load-bearing: the origin keys the IndexedDB rows, so an arbitrary
  string would let one org's inventory be filed under another's key, and the `tabId`
  selects the content script whose authenticated session performs every fetch. The
  response relays counts, completion flags and an HTTP status per collection — never rows,
  which the panel reads back from IndexedDB itself.
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
  else is rejected. The extension's first user-profile write (`POST /api/v1/users/{id}`)
  needed **no allow-list change** at either boundary — `POST` was already permitted for the
  lifecycle and rule endpoints — so a new mutation class was added without widening the
  trust boundary. There is deliberately no path allow-list; the same-origin guard plus
  the method list is the whole contract.
- **Response-header allow-list (outbound).** Only five headers cross the message boundary
  back to the background: `FORWARDED_RESPONSE_HEADERS` = `link`, `x-rate-limit-limit`,
  `x-rate-limit-remaining`, `x-rate-limit-reset`, `x-total-count`, projected by
  `collectForwardedHeaders`. Previously the whole `Response.headers` bag was forwarded.
  That leaked nothing on its own — the Fetch API never exposes `set-cookie`, and no header
  value is logged anywhere — but it kept a bag of unfiltered response metadata one careless
  `log.debug` away from disclosure, on every response. Every allow-listed key has a named
  consumer (the three rate-limit counters feed
  `shared/scheduler/rateLimitDetector.parseHeaders`; `link` drives every paginated walk;
  `x-total-count` feeds `shared/snapshot/syncMeta.readTotalCount` and the app-assignment
  count probe), and adding a key means naming its consumer. The bag is carried on the
  failure arm too, deliberately: a 429 is a non-ok response, and its `x-rate-limit-reset` /
  `-remaining` are the only authoritative statement of when the scheduler may resume.
  Pinned by `content/apiRequest.test.ts` ("forwarded response headers", "rate-limit headers
  on a failure").
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
  items rather than failing the whole response (degrade-not-crash). The house rule is
  simply: **every Okta response is untrusted and is validated with zod at the boundary
  before any field is read or branched on.** `oktaUserSchema`'s `credentials` block is
  deliberately **not** `.passthrough()`, unlike its siblings: Okta returns
  `credentials.password` and `credentials.recovery_question` on that object, so passthrough
  would carry credential material past the boundary into side-panel state. Note the one
  stated exception — `oktaAppUserSchema` (app-assignment rows) keeps a `.passthrough()`
  `credentials` object so org-specific assignment extras survive; only
  `credentials.userName` is ever read or exported (`export/descriptors/appUsers.ts`), so
  the residual is unread payload held in memory, itemised at [risk #11](./security-risks.md).
- **The content script's own handlers validate too.** The page-context handlers make their
  own Okta reads, and both now parse before reading: `handleGetPolicyInfo` validates
  `GET /api/v1/policies/{id}` with `oktaPolicyListItemSchema`, and `handleGetAppInfo` —
  previously the last unvalidated read in `src/` — validates `GET /api/v1/apps/{id}` with
  `oktaAppListItemSchema` ([`content/index.ts`](../src/content/index.ts)). A validation
  miss degrades to the URL/DOM-derived data exactly as a failed request does; it never
  breaks page detection. The app read is also now conditional — it happens only when the
  DOM heading came up empty — so a masthead re-detect no longer costs a request per app
  page visited.
- **No dynamic code execution.** Rule expressions are end-user-authored, hence untrusted.
  Syntax is handled by [`jsep`](https://github.com/EricSmekens/jsep) — pinned exactly at
  `1.4.0`, MIT, no transitive dependencies — which builds an **AST only**: it evaluates
  nothing and generates no code. Semantics are first-party:
  [`shared/ruleEvaluator.ts`](../src/shared/ruleEvaluator.ts) walks that AST against an
  explicit **allow-list** of operators, fixed- and variadic-arity Okta EL functions
  (`SUPPORTED_FUNCTIONS`), unary minus on numeric literals, `?:` conditionals (eager
  three-valued/Kleene, so both branches are always walked), and `user.<attribute>` reads —
  dotted, or computed with a **string-literal** key (`user["cost center"]`; a
  non-literal computed key is not modelled and stays unevaluable). Anything outside
  that grammar — unknown function, unmodelled node, wrong argument count — is reported
  _unevaluable_, never approximated. The grammar gate is an **AST walk**, not a substring
  scan, so nothing can pass it and then fail inside the evaluator. To verify it directly,
  call `checkRuleNodeSupport()` on a node from `parseRuleExpression()` — that is the same
  walk `tryEvaluateRuleExpression` applies internally. (It replaced the boolean
  `canEvaluateClientSide()`, retired along with the whole two-valued surface, because a
  bare `false` could not say _why_ a gate rejected an expression.) Parsing is capped at 4096 characters to bound the work
  an adversarial tenant value can force, and expression text is **never logged**
  (literals can carry tenant PII) — only a reason code. Grep confirms **zero**
  `eval`/`new Function`/string-`setTimeout`/`innerHTML`/`document.write`/
  `dangerouslySetInnerHTML` in production code. The manifest pins an explicit CSP
  (`script-src 'self'; object-src 'self'`) matching the hardened MV3 default, so
  dynamic execution and remote scripts are blocked at runtime. The house rule behind this:
  **parse untrusted expressions with a real parser and walk the AST against an allow-list —
  never evaluate them.** Evaluating libraries (`jse-eval`, `expression-eval`) are rejected
  for this reason: they execute arbitrary JS semantics.
- **Tenant regexes never reach `RegExp`.** `isMemberOfGroupNameRegex`'s pattern is
  tenant-authored, so it is evaluated by
  [`shared/rules/safeRegex.ts`](../src/shared/rules/safeRegex.ts) (ADR-0002): a
  hand-written pattern parser → Thompson NFA → breadth-wise simultaneous-state
  simulation, which has no backtracking in its implementation and therefore no
  input that can trigger catastrophic backtracking. `new RegExp` is never called on
  tenant text — the refusal that ADR-0001 §3 originally stated for this function is
  superseded by building a matcher the refusal's own reasoning doesn't apply to, not
  by weakening the reasoning. Hard caps (pattern length, input length, NFA state
  count, total step budget) are enforced before and during simulation, and every
  guard failure is a structured decline (`unsupported-syntax`, `parse-error`,
  `pattern-too-long`, `input-too-long`, `too-many-states`, `step-budget-exceeded`,
  `internal-error`) collapsed into `unevaluable` with reason `regex-unsupported-syntax`
  or `regex-too-complex` — never a guess. Changes to `safeRegex.ts`, and its
  adversarial test corpus (nested quantifiers, alternation blowups at the caps),
  need `security-logging-reviewer` review.
- **"Cannot evaluate" is never reported as "does not match."**
  `tryEvaluateRuleExpression()` returns `match | no-match | unevaluable`, using
  three-valued logic so an unresolved operand poisons only the sub-expressions that
  depend on it. This is a correctness property with security weight: these answers drive
  membership attribution, so conflating "could not parse" with "did not match" would
  present a confidently wrong access answer. Group-membership functions
  (`isMemberOfGroup*`, including `isMemberOfGroupNameRegex`) resolve only when a
  caller supplies the user's complete group list (`RuleGroupContext`); without one
  they are `unevaluable`, never guessed. `app.*` context is always `unevaluable` — no
  caller supplies it — and callers render both as indeterminate rather than resolving
  either way.
- **A failed load is never reported as an attribution.** The same property one level up:
  classifying a user's groups against a rule list that could not be fetched makes every
  group look untargeted, which the heuristic reads as an _exactly known manual add_. The
  user path (`hooks/useUserMemberships`) therefore distinguishes "the org has no rules"
  from "we could not obtain the rules" and reports the latter as unclassified. The org
  snapshot carries the same property end to end: a walk that stops throws a
  `PaginatedFetchError` carrying the failing page's HTTP status
  ([`shared/utils/oktaPagination.ts`](../src/shared/utils/oktaPagination.ts)), the status
  rides `WalkOutcome` through the background relay into per-collection sync metadata, and
  Home distinguishes "you are not allowed to read this" (401/403) from any other failure
  instead of rendering a partial walk as a complete org. A successful walk carries no
  status, so a later success clears an earlier failure rather than merging with it. The
  status is an integer, never a response body. The two
  attribution paths — the group view's Okta-asserted `_embedded['group-rules']` and the
  user view's client-side heuristic — are reconciled by **stating provenance** rather than
  by silently differing, and where they are permitted to differ is pinned by
  `shared/membership/attributionParity.test.ts`. The same rule governs the org snapshot:
  a collection the snapshot never walked yields "nobody asked", never "no rows".
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
  only — no `<all_urls>`. `permissions` are the seven `activeTab, storage, contextMenus,
notifications, sidePanel, alarms, scripting`, each mapped to a real consumer:

  - `activeTab` — the toolbar-click flow (`chrome.action.onClicked`) reads the active tab's
    URL on non-Okta pages, which host permissions do not cover, to prompt navigation to
    Okta.
  - `alarms` — the daily audit-retention sweep, the hourly tab-state cleanup, and the
    periodic org-snapshot attempt; alarms survive MV3 worker suspension where `setInterval`
    would not.
  - `scripting` — **used in exactly one place**,
    [`background/reinjectContentScripts.ts`](../src/background/reinjectContentScripts.ts),
    to re-inject the manifest-declared content scripts into already-open Okta tabs after an
    install or update (MV3 orphans the old script and injects no new one, leaving the panel
    reading "Disconnected" until each tab is reloaded). Its blast radius is bounded by the
    manifest itself: both the script files and the tab query's match patterns are read back
    from `chrome.runtime.getManifest().content_scripts`, so nothing is hardcoded and
    injection can never reach a tab the manifest does not already match. No code string is
    ever injected — only the built files — and failures are per-tab and non-fatal. It logs
    tab ids and outcomes only, never URLs or page content.

  The manifest pins an explicit `content_security_policy` for extension pages.

- **No secrets at rest.** No credential, cookie, session, or XSRF value is written to any
  storage API (grep-verified across every `chrome.storage.*.set` / IndexedDB write). Only
  cache payloads, group/rule/tab UI state, audit entries, and non-sensitive prefs are
  stored.
- **TTL'd / bounded storage.** Cached entity data carries a TTL —
  [`sidepanel/cache/entityCache.ts`](../src/sidepanel/cache/entityCache.ts) (in-memory,
  5-minute default) and [`shared/rulesCache.ts`](../src/shared/rulesCache.ts)
  (`chrome.storage.local`, 5 minutes). A third, `groupsCache`, was deleted along with the
  `entityCache`-backed app inventory when the org snapshot replaced them (grep-verified:
  no `groupsCache` module remains in `src/`); `rulesCache` is the last hand-rolled cache
  and `D-029` retires it. The background-owned org snapshot is IndexedDB-backed and
  **not** TTL'd the same way — it is reconciled by walk-and-sweep rather than expiry, and
  whether it needs a TTL or a clear-on-sign-out is an open question tracked as `D-028`
  item 7. Worth stating for a reviewer weighing that gap: the snapshot's collections are
  `groups`, `apps`, `rules` and `appGroups`
  ([`shared/snapshot/types.ts`](../src/shared/snapshot/types.ts)) — **no user rows, so no
  emails or profiles** — and every row is a zod-parsed entity keyed by org origin, never a
  raw response body. `entityCache` treats TTL as a freshness verdict
  rather than a deletion, so it is **separately bounded** at `MAX_ENTRIES` (500) with
  eviction on write — expired entries first, then least-recently-read, and never a key
  with a live subscriber or an in-flight fetch, since dropping those would force the
  refetch the cache exists to avoid. Before that bound existed the in-memory store grew
  for the life of a panel session. Undo
  history is capped at 50 entries
  ([`shared/undoManager.ts`](../src/shared/undoManager.ts)) and its
  profile-update entries carry the **prior and new values** of the attributes a write
  touched — bounded inside that same module at `MAX_CAPTURED_ATTRIBUTES` (25) and
  `MAX_CAPTURED_VALUE_CHARS` (1024), with an over-cap value **omitted entirely rather
  than truncated** (a prefix is still PII with none of the restore utility). Unlike the
  audit trail it has **no time-based retention** — the 50-entry cap is the only bound;
  see [risk #10](./security-risks.md). The audit trail
  ([`shared/storage/auditStore.ts`](../src/shared/storage/auditStore.ts)) has a
  user-configurable retention (default 90 days), can be disabled, and supports a full
  GDPR-style purge. Security-sensitive profile fields (password, credentials, recovery
  Q/A) are excluded from rendering via `EXCLUDED_PROFILE_FIELDS`
  ([`shared/utils/profileFields.ts`](../src/shared/utils/profileFields.ts)) — and the
  **same set is refused at the write boundary**: `assertNoExcludedKeys`
  throws before any profile patch is scheduled, so no caller can reach the endpoint with
  a credential key by forgetting to filter, and none of those keys can be captured for
  undo.
- **Verbose API request log (bounded and redacted).**
  [`shared/requestLog.ts`](../src/shared/requestLog.ts) persists a rolling log of
  every settled Okta request to `chrome.storage.local` under `apiRequestLog`. Capture is
  unconditional (it happens in the scheduler, the one place that sees both side-panel and
  background traffic); only the History tab's display of it is opt-in. Three bounds
  matter to a reviewer: endpoint strings are run through
  [`shared/utils/redact.ts`](../src/shared/utils/redact.ts) **before they reach storage**
  (an admin-typed `q=`/`search=` value can carry PII, and Okta-id-shaped and email-shaped
  substrings are swapped for placeholders); the history is capped at 50 entries, with a
  batch of any size occupying one slot; and per-entry distinct endpoints are capped at
  `MAX_LOGGED_ENDPOINTS` (20), with truncation declared rather than hidden. Redaction is
  pattern-based, not field-name-based, so it catches identifiers wherever they appear but
  cannot catch unstructured PII with no matching shape — an accepted limitation, itemised
  at [risk #12](./security-risks.md). No request or response body is recorded; an entry holds a reason, method,
  redacted endpoint, counts and timings.
- **Working set (Home).** [`shared/storage/workingSetStore.ts`](../src/shared/storage/workingSetStore.ts)
  persists pinned and recently-viewed entities in one `chrome.storage.local` key. Entries
  are **scoped by org origin** — an admin working across two orgs must never see one org's
  names while connected to the other — and each holds only an id, a display name, an
  optional pane and a timestamp: no email, status, profile or member list. `recent` is
  capped at 5 per org and expires after 14 days; `pinned` is capped at 20 and does not
  expire.
- **Session-scoped rate-limit memo.**
  [`background/rateLimitThreshold.ts`](../src/background/rateLimitThreshold.ts) stores one
  integer (or `null`) per org in `chrome.storage.session` under `rateLimitThreshold:<origin>`
  — the org's own warning threshold, learned by one `GET /api/v1/rate-limit-settings` per
  org per browser session through the normal scheduler path. A failure is memoised too, so
  a non-super-admin's 403 costs one request rather than one per request. Session storage
  dies with the browser, and the key holds no tenant data. Covered by the existing
  `storage` permission — no manifest change.
- **Logging discipline.** [`shared/utils/logger.ts`](../src/shared/utils/logger.ts) gates
  `debug`/`info` to dev builds (compiled out in production); `no-console` is an ESLint
  `error` with the logger module as the only exception. Fetch call sites log path (query
  stripped), method, and `hasBody`/`present` booleans — never tokens, bodies, or PII.
- **Secrets hygiene.** No real secrets, org URLs, or tokens anywhere in source, tests,
  fixtures, or docs; placeholders are obviously fake (`00gFAKE…`, `*@example.com`).

---

## 8. Residual risks & known gaps

The findings register lives in its own doc: [`security-risks.md`](./security-risks.md).
It carries all twelve findings with severity, location, and what was re-verified on
2026-09-09, plus the reproducible checks a reviewer can run and how to report a
vulnerability.
