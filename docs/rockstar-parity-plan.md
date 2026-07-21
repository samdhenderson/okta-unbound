# Rockstar-parity plan (living)

Goal: **stop needing [rockstar](https://gabrielsroka.github.io/rockstar/).** Replace the
_capability_, not the implementation. Rockstar decorates Okta's own DOM by injection;
Okta Unbound is a hardened side panel (all traffic through `ApiScheduler`, zod at the
boundary, no persisted tokens, audit + undo, shared components). So every rockstar
feature is triaged into one of three outcomes:

- **Port** — rebuild the capability, side-panel-native.
- **Re-scope** — deliver the same admin value a safer way (our security rules force it).
- **Drop** — a cosmetic tweak to Okta's pages that a side panel makes moot.

This doc owns the roadmap. The pre-existing backlog items **C (Bulk Attribute Editor)**
and **D (Bulk Lifecycle)** in [features-plan.md](./features-plan.md) are absorbed here as
Phase 5. Ground rules from that doc (scheduler-only traffic, Odyssey tokens, shared
components, zod, audit-every-mutation, TypeDoc) apply to everything below.

Status legend: `[ ]` todo · `[~]` partial · `[x]` done.

---

## Triage — rockstar feature → disposition

| Rockstar feature                                                                                                                             | Disposition      | Notes                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV export: Users / Groups(+stats) / Rules / Members / Memberships / Apps / App-Users / App-Groups / Network Zones / Devices / Admins / IdPs | **Port**         | The flagship gap. One generic export engine (below).                                                                                                                        |
| Users/Apps column picker + query box                                                                                                         | Port             | Config on the export engine; persist choices in `idb`.                                                                                                                      |
| Show SSO (decode SAMLResponse, pretty-print, highlight)                                                                                      | **Port**         | Signature feature → side-panel **SSO Inspector**.                                                                                                                           |
| SAML IdP cert expiry (days left, <30d red)                                                                                                   | Port             | Falls out of the IdP reader.                                                                                                                                                |
| Session expiry (minutes left)                                                                                                                | Port             | `/api/v1/sessions/me`; Overview badge.                                                                                                                                      |
| Show User (full profile dump)                                                                                                                | Port             | Users-tab detail (user already fetched).                                                                                                                                    |
| Show AD (AD app assignments)                                                                                                                 | Port             | From app assignments we already read.                                                                                                                                       |
| Show Linked Objects (manager/subordinate)                                                                                                    | Port             | `/users/{id}/linkedObjects/*`.                                                                                                                                              |
| Administrator Roles view / grant / revoke                                                                                                    | **Port (write)** | Audited + confirmed; new write surface.                                                                                                                                     |
| Set Password                                                                                                                                 | **Port (write)** | Audited + confirmed; gate hard.                                                                                                                                             |
| Verify Factors (Push poll, TOTP, SMS, Voice, Email, SecQ)                                                                                    | **Port (write)** | Interactive polling; hardest write, last.                                                                                                                                   |
| Search Users / Search Groups (regex)                                                                                                         | Port             | `searchUsers` exists; add group regex search.                                                                                                                               |
| Deleted-object browser (System Log mining)                                                                                                   | **Re-scope**     | Build the browser; **drop Backupta** (third-party data handoff breaks our privacy posture). Restore = native re-create where the log captured enough state; else read-only. |
| API Explorer (REST client)                                                                                                                   | **Re-scope**     | Constrained **API Console**: same-origin only, method allow-list, GET-default, writes confirmed + audited.                                                                  |
| Pretty-print JSON page                                                                                                                       | **Re-scope**     | Not a page rewrite; side-panel "fetch path → tree + table." Folds into API Console.                                                                                         |
| Omnibox `rs` group search                                                                                                                    | Port             | New `omnibox` permission + SW handler.                                                                                                                                      |
| App Notes / App Sign-On Policy HTML scraping                                                                                                 | **Drop/Park**    | Fragile settings-page scraping; conflicts with "responses are untrusted, no hand-built HTML." Revisit only if an API appears.                                               |
| YubiKeys / AD OU export                                                                                                                      | Park             | Narrow-org value.                                                                                                                                                           |
| OU tooltips / Tiny Apps / All Tiny Apps / Quick Access toggle / nav shortcuts / expand-all log rows                                          | **Drop**         | Cosmetic tweaks to Okta's own pages; the side panel supersedes the need.                                                                                                    |
| `X-Okta-User-Agent-Extended` header                                                                                                          | Port (trivial)   | Tag our content-script fetches.                                                                                                                                             |

---

## The two primitives that unlock most of it

Build these once; everything downstream is cheap.

1. **Generic Export Engine.** A declarative `EntityExport` descriptor —
   `{ endpoint, expand, columnCatalog, filterBox, idLinkify }` — driving: paginate on the
   scheduler (reuse `parseNextLink`, `coreApi.runOperation`) → column picker (persist in
   `idb`) → progress/cancel (`ProgressContext` + `ActivityBar`) → CSV via existing
   `csvUtils.generateCSV`/`escapeCSV`. **Adding an entity = writing a descriptor, not a
   pipeline.** This single build covers ~12 rockstar export features.
2. **Paginated collection reader + JSON render.** Reusable "fetch this Okta collection →
   sortable table + linkified tree." Powers export previews, the API Console,
   pretty-print, and the deleted-object browser.

New UI surfaces: an **Export/Reports** tab and a **Tools** tab (SSO Inspector, API
Console, Deleted-object browser). Both `TabType` additions in `TabNavigation`.

---

## Phase 0 — foundations `[ ]` (unblocks everything)

Prove the export pattern end to end on the safest entities.

- Export Engine + `EntityExport` descriptor type; paginated reader; `idb`-persisted
  column selections; add `X-Okta-User-Agent-Extended: okta-unbound` on content fetches.
- New **Export** tab shell.
- Ship first descriptors: **Users**, **Groups (+`expand=stats`)**, **Group Rules**,
  **Group Memberships** — each with column picker + query box.
- Zod-validate every new list response at the content boundary (ADR-0006). No new `any`.
- Done when: an admin picks columns, previews, and downloads a correctly-escaped CSV for
  those four entities, cancellable, with a progress bar — green + stories + docs.

**UX / implementation ideas (3 per open question — pick when building):**

_Column picker placement_

1. **Inline collapsible panel** above the preview — columns as toggle chips grouped
   base / profile / custom; always visible so the CSV shape is obvious. (Recommended:
   fewest clicks, reuses `CollapsibleSection` + `FilterPill`.)
2. **Modal "Configure export"** launched from a toolbar button — roomy for 40+ app/user
   attributes, keeps the tab uncluttered; reuses shared `Modal`.
3. **Two-pane transfer list** (available → selected, with reorder) — best when column
   _order_ matters for the CSV; highest build cost.

_Saved column sets_

1. **Named presets in `idb`** ("Offboarding audit", "License review") with a dropdown +
   save/overwrite/delete; auto-remember last-used per entity. (Recommended.)
2. **Implicit last-used only** — no naming UI; just persist the most recent selection per
   entity. Cheapest; loses multi-report reuse.
3. **Export/import preset JSON** — shareable across admins; layer on top of (1) later.

_Filter/query box syntax_

1. **Raw Okta `search`/`filter` passthrough** with inline syntax help + example chips and
   a live match-count. Powerful, matches rockstar's free-form box. (Recommended for v1.)
2. **Guided builder** (attribute · operator · value rows → compiles to Okta filter) —
   safer, discoverable, but more UI and never covers every operator.
3. **Saved queries** alongside saved column sets — reuse the preset store from above.

_Preview table density_

1. **Virtualized compact table**, first ~100 rows, "N total will export" banner —
   confirms shape without paging the whole set. (Recommended; reuse the paginated reader.)
2. **Full paginated preview** with Next/Prev mirroring the export pagination — truer, but
   more fetches before the user even downloads.
3. **Count-only "dry run"** (fetch total, skip rows) → download — leanest for huge orgs
   where preview isn't worth the calls.

## Phase 1 — reporting parity `[ ]`

The point at which reports stop pulling you back to rockstar.

- Remaining descriptors: **Apps** (+ column picker), **App-Users**, **App-Groups**,
  **Network Zones**, **Devices**, **Administrators**, **SAML IdPs**.
- **Group regex search** (side panel; clickable results).
- Entities needing new page-context detection (apps, devices, zones, IdPs) get
  content-script `pageContext` support and zod schemas.
- Done when: every "Port" export in the triage table is downloadable; group regex search
  returns links; all green.

**UX / implementation ideas (3 per open question — pick when building):**

_Entry flow_

1. **Unified export hub** — one "Export" tab: pick entity from a list → shared
   configure→preview→download flow. Consistent, one place to learn. (Recommended.)
2. **Contextual export buttons** on each tab (Groups tab exports groups, Users tab
   exports users) — zero navigation, but scatters the same UI five ways.
3. **Command-palette launcher** ("Export…" → fuzzy-pick entity) opening the hub — power
   users skip the list; layer on top of (1).

_Surfacing entity context (apps / idp / device / zone)_

1. **Search-to-select** inside the export config (type-ahead over the entity), independent
   of the current Okta tab. Works even off-page. (Recommended; reuse `SearchDropdown`.)
2. **Current-tab auto-detect** via `pageContext` — pre-fills the entity when you're on its
   Okta page; falls back to search. Best of both, more content-script work.
3. **"Whole org" default** — most exports (all apps, all devices) need no entity at all;
   only assignment exports (App-Users) require a picker. Make the picker appear only when
   the descriptor demands it.

---

## Later phases (committed direction; detail when Phase 1 lands)

- **Phase 2 — SSO & IdP diagnostics.** SSO Inspector (fetch SSO response → base64-decode
  `SAMLResponse` → **React-escaped** XML pretty-print + field highlight; no
  `dangerouslySetInnerHTML`, parse with `DOMParser`, treat as untrusted). IdP cert-expiry
  view. Session-expiry badge on Overview.
- **Phase 3 — person deep-dive (reads).** Show User / Show AD / Show Linked Objects,
  folded into the Users-tab detail. Low risk, high daily value.
- **Phase 4 — API Console + deleted-object browser** _(ADR-gated, see below)._
  Same-origin constrained REST console (method allow-list, write-confirm, audit) +
  pretty-print/table render. Deleted-object browser over the System Log (no Backupta).
- **Phase 5 — powerful writes** _(each audited, prior-state captured, hardest last)._
  Admin-role grant/revoke → Set Password → Verify Factors. Absorbs backlog **C** (Bulk
  Attribute Editor — profile write) and **D** (Bulk Lifecycle).
- **Phase 6 — convenience.** Omnibox `rs` group search (manifest + SW handler).

---

## ADRs this forces (our hard rules require them — write before the phase)

- **API Console path allow-list widening** (Phase 4): today the content script only
  fetches allow-listed methods/paths. An arbitrary console widens that — ADR must fix
  same-origin enforcement, a method allow-list, and confirm-on-write.
- **New write endpoints** (Phase 5): profile update, set-password, admin role
  grant/revoke, factor verify — each expands the write surface; each must audit + capture
  prior state so undo can _restore_.
- **`omnibox` permission** (Phase 6), and whether to add the `okta-gov.com` / `okta.mil`
  hosts rockstar covers — least-privilege ADR either way.
- **Backupta dropped** — record the privacy rationale (never hand data to a third party)
  so it isn't re-litigated.
- **HTML-scraping features dropped** — record the "treat every Okta response as untrusted;
  no hand-built HTML" rationale.

---

## Parked / dropped (rationale recorded so we don't re-litigate)

- **Backupta restore** — external service; violates the never-send-data-anywhere posture.
- **App Notes / App Sign-On Policy scraping** — DOM-scrapes settings pages Okta doesn't
  expose via API; fragile and against the untrusted-input rule.
- **Cosmetic page tweaks** (Tiny Apps, Quick Access, nav shortcuts, OU tooltips,
  expand-all log rows) — a side panel makes them unnecessary; not worth an in-page layer.
- **YubiKeys / AD OU exports** — narrow-org value; add a descriptor later if asked.
