# ADR-0015: Add the `scripting` permission to re-inject content scripts after install/update

- Status: Accepted
- Date: 2026-08-03
- Relates to: the least-privilege manifest rule (`CLAUDE.md`, `docs/security.md`)

## Context

Every API call this extension makes is issued by the content script, because that is
the only context holding the live Okta session and the page's XSRF token (see
`docs/architecture.md`). The content script is **manifest-declared only**
(`content_scripts` in `manifest.json`), which means Chrome injects it exactly once per
matching page load.

MV3 breaks that contract on every extension lifecycle event. When the extension is
installed, updated, or reloaded during development, Chrome tears the old extension
instance out from under the already-injected scripts: each open Okta tab is left with
an **orphaned** content script whose `chrome.runtime` is invalidated (every message
throws "Extension context invalidated"), and Chrome does **not** inject the new
script. The result is a side panel stuck on "Disconnected" in every open Okta tab —
one silent failure per tab, all at once, at the exact moment the user has just been
updated to a version they did not choose to install.

Alternatives considered:

- **Ask the user to reload the tab.** This is the status quo, and it is what the
  failure already does implicitly — the panel just says "Disconnected". Making the
  instruction explicit does not reduce the cost: an admin with a handful of Okta tabs
  open must reload each one, an auto-update can happen mid-task, and "reload the page"
  is indistinguishable from the extension being broken. Recovery guidance is a
  reasonable last resort, not a fix for a failure that fires on _every_ update.
- **`chrome.tabs.reload()` on the matched tabs.** Reloading a user's admin tabs
  without being asked is strictly more disruptive than re-running our own script: it
  discards unsaved form state and in-page navigation, and it needs the same tab
  reach. Worse outcome, no smaller permission.
- **`registerContentScripts` (dynamic registration).** Also lives under the
  `scripting` permission, so it buys no privilege reduction, and it still only affects
  _future_ page loads — it does not fix the tabs that are already open, which is the
  entire problem.
- **Have the side panel detect the dead content script and recover.** The side panel
  cannot inject anything without `scripting` either, so this ends at the same
  permission while adding a second failure path in the hot request loop.

## Decision

**Add `"scripting"` to `permissions` in `manifest.json`** and use it from one place
only: `src/background/reinjectContentScripts.ts`, called by the existing
`chrome.runtime.onInstalled` listener in `src/background/index.ts`.

The re-injection reads `chrome.runtime.getManifest().content_scripts` for both the
**built** script file paths (crxjs rewrites `src/content/index.ts` to a hashed bundle
at build time, so no filename is ever hardcoded) and the **match patterns**, queries
`chrome.tabs.query({ url: matches })`, and calls
`chrome.scripting.executeScript({ target: { tabId }, files })` per matching tab.

Scoping that keeps this least-privilege:

- **No new host reach.** Injection targets are derived from the manifest's own
  content-script match patterns, which are a subset of the existing
  `host_permissions` (`*.okta.com`, `*.oktapreview.com`, `*.okta-emea.com`). The
  permission cannot reach a page the extension could not already script on load. The
  URL-filtered `tabs.query` is likewise served by those host permissions — the broad
  `tabs` permission is **not** added.
- **One trigger, one call site.** `reinjectContentScripts()` runs only from
  `onInstalled`, and only for `details.reason === 'install' | 'update'`.
  `chrome_update` and `shared_module_update` do not replace our scripts, so they are
  skipped. Nothing message-driven and nothing user-facing can invoke injection — in
  particular, no side-panel or content-script message action reaches it, so the
  existing sender-validation surface is unchanged.
- **Files only, never code strings.** Only `files:` is used, never `func:` or any
  string-valued injection, so no dynamic code execution is introduced and the MV3 CSP
  stays as-is.
- **Fire-and-forget, failure-isolated.** Per-tab `executeScript` rejections
  (discarded tabs, tabs mid-navigation, edge-case restricted URLs) are caught and
  logged at `debug` with the tab id and the outcome only — no URLs, no page content,
  no PII. No matching tabs, or a manifest with no content scripts, is a clean no-op.

**Double-injection guard.** Re-injection can land in a tab whose content script is
still alive (e.g. a tab opened between the update and the injection), which would
leave two scripts answering every message — duplicate Okta API calls outside the
scheduler's accounting and a racing `sendResponse`. `src/content/index.ts` therefore
claims the page before registering anything — with a **liveness probe**, not a
static marker: a window-scoped closure (`window.__oktaUnboundClaim`, typed via a
`declare global`, no `any`) that returns `chrome.runtime.id` evaluated in the
_claimant's_ extension context. A static id (or id+version) marker cannot work
here: `chrome.runtime.id` is stable across updates and the version is unchanged on
a same-version dev reload, so a marker left by a pre-update orphaned script would
wrongly make the re-injected script bail — leaving the tab with no live listener,
the exact failure this ADR exists to fix. Calling the closure disambiguates: a live
script of the same extension returns the current id (genuine duplicate — the new
injection skips listener registration and indicator injection); an orphaned
claimant's invalidated context throws or returns `undefined` (stale claim — the new
injection proceeds and re-claims the page).

## Consequences

- The Chrome Web Store listing gains no new user-visible permission warning:
  `scripting` is not independently warned about, and the host access it can exercise
  is already disclosed by the existing Okta `host_permissions`.
- Users stop seeing "Disconnected" after an update; open Okta tabs keep working
  without a manual reload. Development reloads recover the same way.
- The manifest's least-privilege rule now has a live precedent: `scripting` was added
  for one bounded, non-message-driven caller. If that caller is ever removed, the
  permission goes with it. Any _new_ use of `chrome.scripting` — especially one
  reachable from a message or the side panel — is a fresh decision needing its own
  ADR, because the argument above rests entirely on the single `onInstalled` call
  site.
- New tests: `src/background/reinjectContentScripts.test.ts` (manifest-driven
  injection, per-tab failure isolation, empty-tab and empty-manifest no-ops) and a
  `double-injection guard` block appended to `src/content/index.test.ts`.
- **Deferred:** re-injection is not attempted on service-worker restart or on
  `chrome.management.onEnabled`. Those do not orphan content scripts, so the extra
  injection traffic would buy nothing; revisit only if a real orphaning path is found.
