# Okta Unbound

[![CI](https://github.com/samdhenderson/okta-unbound/actions/workflows/ci.yml/badge.svg)](https://github.com/samdhenderson/okta-unbound/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25-brightgreen)](vitest.config.ts)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0--beta.1-blue)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](package.json)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](package.json)

**Advanced group, user, and rule management for Okta administrators — delivered as a browser-local Chrome extension that never stores or transmits your credentials.**

Okta Unbound is a Chrome Manifest V3 side-panel extension that gives Okta administrators
bulk operations, intelligent filtering, rule-impact analysis, and audit logging directly
alongside the Okta admin console. It operates **entirely within the administrator's own
browser session** — no backend, no external servers, no stored secrets. Every API call
reuses the admin's existing, authenticated Okta session and is rate-limited to stay within
Okta's API budget.

- **Trust model in one line:** the extension acts only as the signed-in administrator, only
  against that administrator's own Okta tenant, and only for the duration of the browser
  session.
- **Audience:** Okta administrators, and the security teams who review extensions before
  approving them for enterprise use.

---

## Contents

- [Features](#features)
- [Architecture & trust boundary](#architecture--trust-boundary)
- [Security posture](#security-posture)
- [Permissions & rationale](#permissions--rationale)
- [Data handling & privacy](#data-handling--privacy)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Quality gates & CI](#quality-gates--ci)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Project status & versioning](#project-status--versioning)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Features

### Overview tab
Context-aware insights based on the current Okta page:
- Automatic detection of group, user, app, and admin pages
- Quick stats and relevant actions for each context

### Users tab
User search and membership analysis:
- Search by email, name, or login
- Comprehensive user profile display
- Group membership with type detection (`RULE_BASED`, `DIRECT`, `APP_GROUP`)
- Rule attribution analysis

### Groups tab
Hybrid search and bulk operations:
- **Live mode**: real-time API search with instant results
- **Cached mode**: load all groups once, then filter by type, size, staleness
- Multi-select with bulk operations (remove inactive users, export)
- Group collections for frequently used sets
- Compare 2–5 groups with Venn-diagram visualization
- Cross-group user search
- Cleanup triage: a fused "review score" surfaces empty, duplicate-named, and stale groups
- Group merge: consolidate membership into a survivor group, fully audited and reversible

### Rules tab
Group-rule inspection and consolidation:
- Load and cache all group rules
- Conflict and duplicate-condition detection between rules
- Rule condition parsing and display
- **Rule Impact Preview**: see who loses access *before* deactivating a rule
- Rule consolidation: add a target group or merge identical-condition rules via a safe
  create → activate → retire sequence

### History tab
Complete audit trail for compliance:
- Logs all administrative operations
- Configurable retention (30–365 days)
- Export to CSV for reporting
- Undo/redo support for reversible operations

---

## Architecture & trust boundary

All Okta API traffic flows through a single, rate-limited pipeline. The **live session and
XSRF token exist only in the content script**, are read fresh from the page per request, and
are never persisted or passed across extension messages.

```
Side panel (useOktaApi)  →  Background (ApiScheduler: rate limit)  →  Content script (fetch to Okta)
```

- The **side panel** renders the UI and requests operations; it never talks to Okta directly.
- The **background service worker** owns the `ApiScheduler` — 5 concurrent requests with a
  cooldown as Okta's rate-limit budget is consumed.
- The **content script** is the only component that calls the Okta API. It reads the XSRF
  token from the page DOM at fetch time, fetches same-origin Okta paths with an allow-listed
  HTTP method, and validates every response before returning it.

Full detail: [`docs/architecture.md`](docs/architecture.md).

---

## Security posture

This section is written for reviewers evaluating the extension before enterprise approval.
Each control is enforced in code and covered by the repo's non-negotiable hardening rules
([`CLAUDE.md`](CLAUDE.md)); the *why* behind each decision lives in [`docs/adr/`](docs/adr/).

> **Full assessment:** [`docs/security.md`](docs/security.md) — trust model, threat model,
> control-by-control evidence with links into the code, an honest residual-risk register,
> and steps to verify the claims independently.

| Control | How it's enforced |
| --- | --- |
| **Session-based auth, no stored credentials** | The extension reuses the admin's existing Okta session; it never asks for, stores, or transmits API tokens or passwords. |
| **XSRF token isolation** | The token is read from the page DOM per request in the content script only — never persisted (`chrome.storage`/IndexedDB/`localStorage`), never sent across messages, never logged. |
| **No dynamic code execution** | `eval`, `new Function`, string-arg `setTimeout`, and remotely loaded scripts are banned; MV3 CSP enforces this and the manifest CSP is never weakened. Rule expressions are parsed with a real parser, not `eval`. |
| **Boundary validation** | Every Okta response is treated as untrusted input and validated with [zod](https://zod.dev) at the content-script boundary before rendering or branching (ADR-0006). |
| **Validated message passing** | The background listener rejects foreign senders and tab-originated scheduling requests; the content script only fetches same-origin Okta paths with an allow-listed method. |
| **Hostname parsing, not substring matching** | Every "is this Okta?" decision parses the hostname (`shared/utils/oktaUrl.ts`); substring URL matching is banned. |
| **Least-privilege manifest** | Only Okta domains are in scope; any new permission requires an ADR justifying why a narrower alternative is insufficient. |
| **Export safety** | Every CSV cell is escaped through `csvUtils.escapeCSV` (RFC 4180 quoting + spreadsheet-formula-injection guard). |
| **XSS-safe rendering** | React escaping only; `dangerouslySetInnerHTML` and hand-built HTML strings are banned. External links are built from a validated Okta origin plus a validated ID, with `rel="noopener noreferrer"`. |
| **Minimal, TTL'd storage** | `chrome.storage` and IndexedDB hold no credentials or session material; cached PII is minimal and time-limited, and audit retention is user-configurable. |

Data-handling specifics are in [`PRIVACY.md`](PRIVACY.md).

---

## Permissions & rationale

The extension requests the narrowest set of permissions its features require. Host access is
scoped to Okta domains only.

| Permission | Why it's needed |
| --- | --- |
| `activeTab` | Interact with the Okta admin tab the administrator is actively viewing. |
| `storage` | Persist non-sensitive UI state, cached group/rule data (TTL'd), and audit history locally. |
| `sidePanel` | Render the extension UI in Chrome's side panel. |
| `contextMenus` | Provide right-click entry points into extension actions. |
| `notifications` | Surface completion/failure of long-running bulk operations. |
| `alarms` | Drive scheduled cache expiry and audit-retention cleanup. |

**Host permissions** (content script + API access) are limited to:

```
https://*.okta.com/*
https://*.oktapreview.com/*
https://*.okta-emea.com/*
```

No other origins are in scope, and the extension declares no `externally_connectable` surface.

---

## Data handling & privacy

- **Local only.** All data the extension reads stays in the browser. Nothing is sent to any
  server other than the administrator's own Okta tenant over their existing session.
- **No credential storage.** No API tokens, passwords, session cookies, or XSRF tokens are
  ever persisted.
- **Minimal, expiring caches.** Group/rule/user caches are stored in `chrome.storage.local`
  with a short TTL; audit logs store user *identifiers*, not emails, and honor a configurable
  retention window.
- **User-initiated exports.** CSV exports are generated locally on demand and escaped against
  formula injection.

Full policy: [`PRIVACY.md`](PRIVACY.md).

---

## Installation

### Option A — Download from Releases

1. Go to the [Releases](https://github.com/samdhenderson/okta-unbound/releases) page.
2. Download the latest `okta-unbound-*.zip`.
3. Extract the zip.
4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the extracted `dist/` folder

### Option B — Build from source

```bash
git clone https://github.com/samdhenderson/okta-unbound.git
cd okta-unbound
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension (steps under Option A).

---

## Usage

1. Log into your Okta admin console.
2. Click the Okta Unbound icon to open the side panel.
3. The extension automatically detects your current context (group, user, app).
4. Use the tabs to access different functionality.

---

## Development

Requires Node.js **≥16** (CI runs on Node 20).

```bash
npm run dev            # dev build with hot reload (load dist/ as an unpacked extension)
npm run build          # production build
npm run type-check     # tsc --noEmit (strict)
npm run lint           # eslint (0 errors required)
npm run format         # prettier --write
npm run format:check   # prettier --check (CI gate)
npm run test:run       # vitest jsdom unit project (browser-free)
npm run test:coverage  # unit tests with the enforced coverage gate
npm run test:storybook # run every story as a headless-browser test
npm run storybook      # component + docs explorer dev server (:6006)
npm run build-storybook # static docs site (components + Internals + Documentation)
npm run docs           # TypeDoc → Markdown for the Storybook Internals section
```

The message-passing model, module layout, and hard rules for contributors are documented in
[`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/README.md).

---

## Quality gates & CI

Every pull request and every push to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Format check** — `prettier --check`
- **Lint** — `eslint`, 0 errors required
- **Type-check** — `tsc --noEmit` under TypeScript `strict`
- **Test + coverage gate** — Vitest unit project with enforced thresholds
  (`vitest.config.ts`): **lines 80% · functions 80% · branches 75% · statements 80%**
- **Storybook** (parallel job) — builds the component explorer and runs every story as a
  headless-browser render test

Release automation ([`beta-release.yml`](.github/workflows/beta-release.yml)) builds and
publishes signed zip artifacts on `v*-beta*` tags, and the documentation site is deployed to
GitHub Pages ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml)).

---

## Documentation

- **Security assessment:** [`docs/security.md`](docs/security.md) — posture, threat model,
  controls, and residual risks for security reviewers.
- **Specs & contributor docs:** [`docs/`](docs/README.md) — a routing index of small,
  single-purpose specs (architecture, design system, components, testing, UX, state).
- **Architecture Decision Records:** [`docs/adr/`](docs/adr/README.md) — the *why* behind
  each convention.
- **Component explorer & API reference:** the Storybook site (built via `npm run
  build-storybook`, published to GitHub Pages).

---

## Contributing

1. Branch from `main`; open a pull request.
2. All CI gates above must pass before merge — format, lint (0 errors), type-check, the
   coverage gate, and the Storybook build/story tests.
3. Changes touching messaging, the manifest, storage, exports, logging, or Okta-response
   handling must respect the security-hardening rules in [`CLAUDE.md`](CLAUDE.md) and should
   be reviewed accordingly.
4. Any new permission, host permission, or broadened match pattern requires an ADR justifying
   why the narrowest alternative is insufficient.
5. New or changed shared/feature components ship a co-located `.stories.tsx`; exported
   modules carry TypeDoc comments.

---

## Project status & versioning

Current release: **0.4.0 (beta)**. The project follows semantic versioning, with
`package.json` as the single source of truth for the version (ADR-0007); the Chrome-compatible
numeric version in `manifest.json` is derived from it at build time.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Disclaimer

This is an unofficial tool, not affiliated with, endorsed by, or supported by Okta, Inc.
