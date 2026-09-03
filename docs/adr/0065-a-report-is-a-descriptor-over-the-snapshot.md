# ADR-0065: A report is a descriptor over the snapshot

- Status: Proposed
- Date: 2026-09-02
- Relates to: [ADR-0040](./0040-the-background-owns-the-org.md) §7 (a partial walk
  is not a complete one; the background owns the sync),
  [ADR-0039](./0039-wrap-the-strip-and-ship-no-verb-without-a-wire.md) (no verb
  without a wire), [ADR-0059](./0059-one-bucket-is-not-the-org.md),
  [ADR-0006](./0006-zod-boundary-validation.md), `docs/security.md` (export
  escaping), `IMPROVEMENTS.md` I-020

## Context

Home's reports answer questions the org snapshot can already answer — _empty
groups nothing fills_, _app access no rule maintains_. Both are pure joins over
collections `useOrgEntityIndex` has already mounted, so both cost zero requests.
An opened report lists its first `REPORT_PREVIEW_LIMIT` (25) findings and says
that it is truncating. There is nowhere to send the admin who wants the other
112, and no way to get the list out of the panel — which is the whole point of a
finding like "empty groups nothing fills."

The Export tab already solves both halves. It is descriptor-driven
(`EntityExport`), the registry auto-discovers descriptor files through
`import.meta.glob`, `App.tsx` already owns the one-shot `ExportRequest` route
into the tab, and every cell already goes through `csvUtils.escapeCSV`.

The mismatch is where rows come from. All eleven shipped descriptors name an
Okta list endpoint — literally (`whole-org`) or built from a picked parent id
(`search-to-select`) — and the engine's `fetchAllRows` walks the `Link` header
from there. A report has no endpoint at all. Its rows come from a four-way join
over `groups`, `rules`, `apps` and `appGroups` rows already on disk, and its
number is only publishable when `resolveCount` says so: a `counted` collection
may be `partial` and still yield a floor, but any `gate` that is not `ok`
suppresses the count _and_ the list, because a half-read rule list does not
under-report — it reports every group those missing rules fed as unfilled.

So the question I-020 poses is real: what is a report-shaped descriptor?

## Decision

**Row acquisition becomes an explicit arm on `EntityExport`. Scoping does not
move.** A report is an ordinary descriptor whose `context` is `whole-org` and
whose rows come from a new optional `source` field:

```ts
source?: { kind: 'endpoint' } | { kind: 'snapshot'; … };
```

Absent `source` means `{ kind: 'endpoint' }`. **Every existing descriptor does
nothing.** No file under `descriptors/` changes, the registry does not change,
and `endpoint` / `defaultQuery` / `filter` keep their exact present meaning.

Four consequences of that shape are load-bearing:

**1. A new `EntityContextMode` would have been the wrong widening.** `context`
answers _what is this export scoped to_ — nothing, or a parent entity the reader
picks. It drives a picker in the tab's UI. A report is scoped to the org, so it
is `whole-org`; the fact that its rows arrive from IndexedDB rather than the wire
is orthogonal, and a future snapshot-sourced export scoped to one app would need
both axes at once. Folding them into one union makes that combination
unexpressible and forces the picker to grow a third, empty arm.

**2. The download path is already source-agnostic.** `runExport` takes
`{ descriptor, rows, enabledColumnIds, contextLabel }` — rows are handed to it,
not fetched by it. Column projection, `generateCSV`, `escapeCSV`, filename
building and the audit entry are untouched by this ADR. The branch lives in
exactly one place: where `useExportTab` today calls `buildExportEndpoint` +
`fetchExportRows`, a snapshot-sourced descriptor instead reads its mounted
collections and returns rows synchronously.

**3. A snapshot source reads; it never syncs.** It takes the already-mounted
collection handles read-only. It issues no request, mounts no second listener,
and triggers no top-up — `useOrgFigures` owns the one top-up Home is allowed to
spend per mount, and a second consumer deciding independently that the snapshot
looked stale would double it (ADR-0040). An unread collection is therefore not a
reason to fetch; it is a reason to say so (see §4). The export costs zero
requests, and still writes its `auditStore` entry — an export that read nothing
is still an export that left the panel.

**4. The schema field stays required, and the engine still validates.** Snapshot
rows are cached Okta responses sitting in plaintext IndexedDB. ADR-0006 treats
every Okta response as untrusted and nothing about a round-trip through disk
makes one trustworthy; group names and rule expressions are end-user-authored.
The join therefore parses its rows in memory with the same `parseOktaList` path
the wire uses, dropping and counting malformed rows identically.

### The honesty rules travel with the rows

This is the part that must not be re-derived at the export layer. A
snapshot-sourced descriptor declares its collections in the same vocabulary
`useHomeReports` uses today — `counted`, `gates`, `floors` as `NamedSource`s —
and the source returns rows **plus** the `CountResolution` that `resolveCount`
produces from them. One function, two surfaces, no second implementation.

- **`status: 'unavailable'` (or `value === null`) ⇒ there is no export.** Not an
  empty CSV, not a partial one. The Download control is not rendered; the tab
  shows the same sentence the Home row shows (_Needs group rules, which have not
  been read._). ADR-0039's rule is exactly this rule: a verb whose result cannot
  be trusted is a verb with no wire, and shipping it `disabled`-forever or
  shipping it wrong are the same mistake wearing different clothes.
- **`status: 'partial'` ⇒ the rows ship, and the CSV says so on every row.** The
  descriptor contributes a completeness column whose cell is the resolution's
  own `note` (_At least — the last read of groups did not finish._), and the
  engine appends that column when the resolution is `partial` **even if the
  reader deselected it**. That is the one entity-agnostic behaviour this ADR
  adds to the engine, and it is deliberate: the incompleteness of the answer is
  not a column preference.
- **`status: 'reading'` ⇒ the tab waits.** Same as Home.
- The caveat (`INVISIBLE_MAINTAINERS`, `CLEANUP_CAVEAT`, `APP_ACCESS_CAVEAT`) is
  a column too, constant across rows. A report reports; it never recommends, and
  a CSV that drops "Okta membership can also be maintained by Workflows, SCIM,
  or an IdP" reads as a delete list the moment it lands in a spreadsheet.

**Why a column and not a preamble.** A `#`-prefixed comment line above the
header is the obvious cheap answer and it loses: it is not RFC 4180, it breaks
every naive parser including Excel's, and it is the first thing discarded when
someone sorts, filters, or pastes a subset into a ticket. The caveat has to
survive being sliced, so it rides the row. Both cells go through `escapeCSV`
like any other — they are cells, not chrome — which keeps the RFC 4180 quoting
and the formula-injection guard in force. Nothing is ever interpolated into CSV
text. The filename additionally carries a `-partial` marker so the file is
identifiable before it is opened.

### Scope carriage, and the 25

**`ExportRequest` does not change.** One report is one descriptor
(`report-group-cleanup`, `report-unmaintained-app-access`), not one `reports`
descriptor scoped by a report key, so opening a report pre-scoped is
`handleNavigateToExport({ descriptorId })` with no `contextId` — the shape the
whole-org `group-rules` route already uses. Splitting per report also earns each
one a row in the entity hub, so a report is findable without going through Home
first, and its columns and caveat can differ from its neighbour's without a
discriminated union inside a single descriptor.

`REPORT_PREVIEW_LIMIT` stays a Home presentation rule and does not follow the
rows anywhere. The join already computes all N before `buildReport` slices; the
snapshot source calls the same join and slices nothing, so the export is the
route to all of them. The Export tab's own preview cap applies as it does to any
descriptor.

### One catalog, one set of columns

The report row's `name` and `detail` on Home become a projection of two named
columns from the descriptor's `columnCatalog`, rather than the descriptor being
a second description of rows Home shapes independently. That is what makes
"its columns come from the same descriptor the preview reads" true rather than
aspirational: there is one column catalog, Home renders two of its columns, and
the CSV offers all of them.

## Alternatives rejected

- **A new `EntityContextMode` arm** (I-020's first guess). Conflates scoping with
  acquisition; see §1.
- **A synthetic endpoint** — point the report at `/api/v1/groups` and filter
  client-side. It cannot express the join at all (three further collections are
  needed to exclude and to name), and it re-fetches, over the rate limiter, rows
  already on disk. Hundreds of requests to answer a question that currently costs
  zero.
- **A "Download findings" button on Home.** Fastest to build, and it forks the
  export surface: a second escaping call site, no column picker, no presets, no
  audit entry, no hub discoverability. I-020 exists because that fork is the
  thing to avoid.
- **Ship the partial list unmarked**, on the theory that a floor is still useful.
  It is useful _labelled_; unlabelled it is the exact defect `resolveCount` was
  written to prevent, and a CSV outlives the screen that would have caveated it.
- **Make the honesty a descriptor-authored string.** Rejected because it would
  drift: the `note` is computed from which collection actually fell short, and a
  hand-written sentence cannot name that.

## Consequences

**Easier.** Any future question answerable from the snapshot is now an export
for the price of a descriptor file — no engine change, no registry edit, no
requests. The `gates`/`floors`/`counted` vocabulary becomes the repo's single
statement of when a derived number may be published, applied identically on Home
and in a downloaded file.

**Harder.** `EntityExport` now has two acquisition modes, so a reader of the type
must ask which one a descriptor is in. The registry test grows an invariant — a
descriptor resolves rows exactly one way — to keep that from becoming ambiguous.
The Export tab also gains a dependency on the mounted org snapshot, which it did
not have; that dependency is read-only by construction (§3), and a review should
check it stays that way.

**What a later descriptor author must know.** If your rows come from a list
endpoint, nothing here concerns you — omit `source`. If they come from the
snapshot: you declare the collections behind your answer in `counted` / `gates`
/ `floors` and you do not get to decide what happens next. `resolveCount` decides
whether your export exists at all, and an `unavailable` verdict is not an empty
file — it is no file, and a sentence. You may not fetch to repair it.
