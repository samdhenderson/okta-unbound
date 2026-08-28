---
name: export-descriptor
version: 1.0.0
description: >-
  How to add a new CSV export to Okta Unbound's descriptor-driven Export Engine —
  choosing whole-org vs search-to-select scoping, writing the lenient zod row schema,
  building the column catalog with the right group and defaultEnabled values, picking
  filter.kind (none / q / search / filter), setting defaultQuery, linkify and maxRows,
  and shipping the co-located descriptor test. Use when adding or changing an export,
  writing an EntityExport descriptor, working under src/sidepanel/export/, or when
  asked to "export network zones", "add a Trusted Origins export", "let admins
  download the admin roles", "add a column to the users export", or "why is my export
  missing rows".
---

# Adding an export descriptor

The Export Engine is fully descriptor-driven. Adding an export means writing **one
file** under `src/sidepanel/export/descriptors/` — the engine, the Export tab, and the
registry never change. `registry.ts` picks the file up through `import.meta.glob`, so
there is no barrel to edit and no shared file to conflict on.

The mechanical part is easy and there are eleven worked examples in the tree. The
decisions below are the part the examples do not explain.

## What the engine already does

Never reimplement any of this inside a descriptor:

- **Pagination** — walks the `Link` header via `nextPageUrl`, with a guard that stops
  on an empty page or a non-advancing cursor
- **Validation** — every page through `parseOktaList`, which drops malformed rows,
  counts them, and logs counts only (never field values — they carry PII)
- **CSV escaping** — `generateCSV` / `escapeCSV`, RFC 4180 plus a formula-injection
  guard
- **Row cap** — 50,000 by default, reported back as `capped`
- **Rate limiting** — reads go out at `'low'` priority so a bulk export never starves
  interactive UI, and cancellation is checked between pages
- **Audit** — a successful export writes an `auditStore` entry attributed to
  `/users/me`

A descriptor supplies data _shape_ and _policy_. It never formats CSV, never fetches,
never paginates.

## The six decisions, in order

**1. Can Okta answer this in one list endpoint?** If the answer needs per-row
follow-up calls, it is not a descriptor — the engine issues one paginated read and
nothing else. This is why the Administrators export is still unbuilt: admin roles are
per-user role assignments, not a list. Route the endpoint question to the **`okta-api`**
skill before writing anything.

**2. `whole-org` or `search-to-select`?** Whole-org sets a literal `endpoint` string.
Search-to-select omits `endpoint`, supplies `context.endpoint(contextId)`, and makes
the module default-export a **factory** `(deps: ExportApiDeps) => EntityExport` when it
needs a live search function. The Export tab picks the search function by matching
`context.label` — `'Group'` routes to `deps.searchGroups`, a label matching `/app/i`
routes to `deps.searchApps`.

**3. Which schema?** Reuse a shared schema from `src/shared/schemas/okta.ts` when one
fits the row (`oktaAppUserSchema`), or the shared user catalog
(`columns/userColumns.ts`) when the rows are users. Otherwise declare a **lenient local
schema** in the descriptor file. See `references/descriptor-contract.md` for why
leniency is mandatory rather than stylistic.

**4. Which columns, and which default on?** Group each as `base`, `profile`, or
`custom`. Turn on the handful an admin would expect in a default CSV; leave derived,
noisy, and diagnostic columns `defaultEnabled: false` — the picker exposes them.

**5. Which `filter.kind`?** `none`, `q`, `search`, or `filter`. **This is an Okta
semantics question, not a style choice** — `q`, `search`, and `filter` are three
different features with different operators and different endpoint support. Ask
**`okta-api`**; do not copy whichever neighbouring descriptor happens to be open.

**6. `linkify` and `maxRows`?** Add `linkify` when a column holds an id that maps to an
Admin Console entity. Set `maxRows` only to override the 50k default.

## Standing rules

- **Accessors must never throw.** `columnCatalogs.test.ts` calls every accessor with an
  empty row `{}`. Use optional chaining throughout.
- **Every `format` must return a string.** The `CellValue` type permits numbers and
  booleans, but the cross-descriptor suite asserts `typeof formatted === 'string'`. A
  formatter returning a number fails the suite; a column with no formatter is fine.
- **Column `id` is a persisted key.** Presets and last-used selections in IndexedDB are
  keyed on it. Renaming one silently drops that column from every saved preset.
- **Never pre-format a cell for CSV.** Quoting and escaping belong to the engine.
  Returning a value that is already quoted double-escapes it.
- **`icon` must be a member of the shared `IconType` registry** — `users`, `user`,
  `app`, `building`, `lock`, `key`, `shield`, `list`, `link`, `chart`, `settings`, and
  the rest in `shared/Icon.tsx`. Adding a glyph is a separate concern from
  adding an export.
- **Fake placeholders only** in tests and docstrings — `00uFAKE`, `00gFAKE`,
  `user@example.com`. Never a real org URL or id.
- **TypeDoc header on the file** plus doc comments on exports, per the repo's
  documentation rule.

## The test that ships with it

Co-locate `<name>.test.ts`. Existing descriptor tests pin three things: descriptor
identity and scoping config, the schema accepting a representative row, and any column
whose `accessor` or `format` does real work. Columns that are bare property reads are
already covered by `columnCatalogs.test.ts` walking the whole registry — do not
re-assert them per descriptor (ADR-0023 bans restating what another runner covers).

Then: `npm run type-check`, `npm run lint`, `npx prettier --write` on the touched
files, and `npx vitest run src/sidepanel/export`.

## Routing table

| If the task is…                                                           | Read                                  |
| ------------------------------------------------------------------------- | ------------------------------------- |
| Every `EntityExport` field, both context kinds worked end to end          | `references/descriptor-contract.md`   |
| Why schemas are lenient, and what strict validation silently breaks       | `references/descriptor-contract.md`   |
| Choosing the endpoint, or whether one list call can answer the question   | the **`okta-api`** skill              |
| Deciding between `q`, `search`, and `filter`, or writing filter help text | the **`okta-api`** skill              |
| Whether a collapsing `expand` belongs in `defaultQuery`                   | the **`okta-api`** skill              |
| What an export costs against a large org                                  | the **`okta-api`** skill (cost model) |
| Where exports sit in the roadmap, what is deferred and why                | `docs/rockstar-parity-plan.md`        |

## Additional resources

- `references/descriptor-contract.md` — the full `EntityExport` contract field by
  field, both context kinds, the engine's guarantees, and the schema-leniency
  rationale.

Source of truth in the repo: `src/sidepanel/export/types.ts` (the contract),
`src/sidepanel/export/registry.ts` (auto-registration),
`src/sidepanel/export/endpoint.ts` (how `defaultQuery` and the filter box combine), and
`src/sidepanel/hooks/useOktaApi/exportEngine.ts` (the engine). When this skill and the
code disagree, the code wins — and the skill needs fixing.
