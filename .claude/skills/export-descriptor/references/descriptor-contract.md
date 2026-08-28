# The `EntityExport` contract

Field-by-field reference for a descriptor, plus the two context kinds worked end to
end. The authoritative source is `src/sidepanel/export/types.ts`; this file explains
the parts the type signatures cannot.

## Identity

| Field         | Type       | Notes                                                                                                                                                                                                         |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`   | Registry key, preset key, and audit surrogate id. Kebab-case, matching the file stem (`network-zones` ← `networkZones.ts`). **Never rename** — presets and last-used selections in IndexedDB are keyed on it. |
| `displayName` | `string`   | Hub label and the CSV filename stem.                                                                                                                                                                          |
| `icon`        | `IconType` | Must already exist in `shared/Icon.tsx`.                                                                                                                                                                      |
| `description` | `string`   | One line in the entity hub. Say what the rows _are_, not that it exports them.                                                                                                                                |

## Scoping — `context`

### `whole-org`

```ts
context: { kind: 'whole-org' },
endpoint: '/api/v1/zones',
```

Exports everything; no picker. `endpoint` is required and is a literal
origin-relative path.

### `search-to-select`

```ts
context: {
  kind: 'search-to-select',
  label: 'App',
  placeholder: 'Search apps by name…',
  endpoint: (appId) => `/api/v1/apps/${appId}/users`,
},
```

The admin picks a parent entity first. Omit the top-level `endpoint` — it is ignored.
`buildExportEndpoint` throws if a `search-to-select` descriptor is resolved without a
`contextId`.

**`label` is load-bearing, not cosmetic.** The Export tab routes it to a search
function on `ExportApiDeps`: `'Group'` → `deps.searchGroups`, a label matching `/app/i`
→ `deps.searchApps`. A label with no matching dep leaves the picker unable to resolve
anything.

**When the module must export a factory.** If the descriptor needs a live search
function, default-export `(deps: ExportApiDeps) => EntityExport` instead of a plain
object. `buildRegistry` calls it with the deps the Export tab assembled. Members of
`ExportApiDeps` beyond `searchGroups` are optional precisely so the registry still
builds when an entity's search op has not shipped — a descriptor depending on a missing
dep simply does not register, rather than crashing the tab.

Descriptors whose context entity is already resolvable without a new search function
can stay plain objects (`groupMemberships.ts` is a plain object; its `'Group'` label is
enough).

## Query — `defaultQuery`

```ts
defaultQuery: { limit: 200 },
defaultQuery: { limit: 200, expand: 'stats' },
defaultQuery: { limit: 200, type: 'ACCESS_POLICY' },
```

Merged into the first page by `buildExportEndpoint` via `URLSearchParams`. Three uses:

1. **Page size.** `limit: 200` is the house default.
2. **Collapsing parameters.** An `expand` that embeds data the columns need turns N+1
   calls into N. Ask `okta-api` whether one exists — and whether it survives the
   `rel="next"` link, because the engine re-walks that URL.
3. **Required discriminators.** `/api/v1/policies` returns 400 without `type`.

Subsequent pages come from the `Link` header, so anything that must persist across
pages has to survive Okta's own next-link construction. Where it does not, the endpoint
is not descriptor-shaped.

## Validation — `schema`

Every page runs through `parseOktaList(schema, data, context)`, which `safeParse`s each
row, **keeps the valid ones, silently drops the rest**, and logs a count with no field
values.

### Why schemas are lenient, and what strict validation breaks

A dropped row is not an error the admin sees. It is a **missing line in a CSV that
otherwise looks complete** — an under-report that reads as a clean run. That failure
mode is why descriptor schemas are deliberately permissive:

```ts
const zoneSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    gateways: z.array(z.unknown()).optional(),
  })
  .passthrough();
```

The rules:

- **Require `id` and little else.** Everything a column reads is `.optional()`.
- **`.passthrough()`** so unmodelled fields survive rather than being stripped.
- **Never model `_links` or `_embedded` strictly.** They vary enormously by app type
  and by org; a schema tight enough for one tenant drops whole entities in another.
- **Prefer `z.string()` over an enum** for status and type fields. Okta adds values.
  An enum turns a new value into a vanished row.
- **`z.array(z.unknown())`** when only the length is needed.

This is not a relaxation of ADR-0006 — validation still happens at the boundary, and
`no new any` still holds. It is validating the fields actually read, at the strictness
the data warrants.

Reuse a shared schema when one fits (`oktaAppUserSchema`, `exportUserSchema` from
`columns/userColumns.ts`). Declare a local one otherwise; a descriptor that needs a
schema no other surface needs should own it.

## Columns — `columnCatalog`

```ts
{
  id: 'system',
  label: 'System',
  group: 'base',
  defaultEnabled: false,
  accessor: (z) => z.system,
  format: (v) => (v ? 'Yes' : 'No'),
}
```

| Field            | Notes                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | Persisted in presets. Stable forever.                                                                                                                                                           |
| `label`          | The CSV header and the picker chip.                                                                                                                                                             |
| `group`          | `base` (identity/config), `profile` (from `profile.*`), `custom` (org-specific attributes). Drives picker sections.                                                                             |
| `defaultEnabled` | On for the columns a default CSV should carry; off for derived, diagnostic, and long-tail ones.                                                                                                 |
| `accessor`       | Declared as a **method**, not an arrow property — bivariance is what lets `ExportColumn<Specific>` sit in the heterogeneous registry. Copying an arrow-property signature breaks assignability. |
| `format`         | Optional. Turns the raw value into the cell.                                                                                                                                                    |

### Two invariants the registry-wide suite enforces

`columnCatalogs.test.ts` walks every registered descriptor and exercises every column
against a populated row **and** an empty `{}`:

1. **Accessors must be null-safe.** They are called with `{}`. Optional-chain every
   step: `(u) => u.credentials?.userName`.
2. **Every `format` must return a string.** The suite asserts
   `typeof formatted === 'string'` for both rows. `CellValue` permits `number` and
   `boolean`, and the engine would serialise them fine — but a formatter returning a
   number fails this suite. Either omit `format` and let the engine coerce, or return a
   string. `format: (v) => (v ? 'Yes' : 'No')` passes; `format: (v) => Number(v)` does
   not.

### What the engine does with a column

```ts
const raw = column.accessor(row);
if (column.format) return column.format(raw, row);
return raw == null ? '' : String(raw);
```

No formatter means a safe string coercion with `null`/`undefined` → `''`. Reach for
`formatDateForCSV` for timestamps and `join` for arrays.

**Never emit CSV syntax from a column.** `generateCSV` quotes and escapes every cell
(RFC 4180 plus the formula-injection guard). A cell that arrives pre-quoted is escaped
twice.

## Filtering — `filter`

```ts
filter: { kind: 'none' },

filter: {
  kind: 'search',
  help: 'SCIM filter over user attributes.',
  placeholder: 'profile.department eq "Engineering"',
},
```

`kind` is the literal query parameter name the admin's raw text is appended as.
`buildExportEndpoint` sets it through `URLSearchParams`, so the value is encoded — a
same-origin authenticated GET the admin could already issue against Okta's own API.

**Choosing the kind is a domain question.** `q`, `search`, and `filter` differ in
operator support, which properties they cover, and which endpoints accept them; the
same word means different things on different endpoints. The shipped descriptors split
between `q` (apps) and `search` (users, groups, devices) for real reasons. Ask
**`okta-api`** rather than pattern-matching a neighbour.

`help` and `placeholder` are the entire in-product documentation for the filter box.
Make the placeholder a valid expression that would actually run.

## Deep links — `linkify`

```ts
linkify: { entityType: 'user', idColumnId: 'id' },
```

`entityType` is an `OktaAdminEntityType` from `shared/utils/oktaUrl.ts`; `idColumnId`
names the `columnCatalog` column holding the target id. URLs are built from the
validated `oktaOrigin` plus that id — never string-concatenated from a response field.

Omit it when no column holds a linkable id.

## Cap — `maxRows`

Optional. Defaults to 50,000 in the engine. The result carries `capped: true` when the
cap is hit, so the UI can say the export is partial. Set a lower value only for an
entity where a huge result indicates a mistake.

## Worked skeleton

```ts
/**
 * @module sidepanel/export/descriptors/trustedOrigins
 * @description The Trusted Origins export descriptor — a whole-org descriptor.
 *
 * Exports every CORS/redirect allow-list entry in the org. Self-contained: it
 * defines a local, lenient schema rather than depending on the shared Okta module.
 */

import { z } from 'zod';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport, ExportColumn } from '../types';

/** Lenient local schema — only the fields the columns read are typed. */
const originSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    origin: z.string().optional(),
    status: z.string().optional(),
    scopes: z.array(z.unknown()).optional(),
    created: z.string().optional(),
  })
  .passthrough();

/** A validated trusted-origin row. */
type TrustedOrigin = z.infer<typeof originSchema>;

/** Base configuration columns for a trusted origin. */
const originColumns: ExportColumn<TrustedOrigin>[] = [
  { id: 'id', label: 'Origin ID', group: 'base', defaultEnabled: true, accessor: (o) => o.id },
  { id: 'name', label: 'Name', group: 'base', defaultEnabled: true, accessor: (o) => o.name },
  { id: 'origin', label: 'Origin', group: 'base', defaultEnabled: true, accessor: (o) => o.origin },
  { id: 'status', label: 'Status', group: 'base', defaultEnabled: true, accessor: (o) => o.status },
  {
    id: 'scopeCount',
    label: 'Scope Count',
    group: 'base',
    defaultEnabled: false,
    accessor: (o) => o.scopes?.length ?? 0,
  },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (o) => o.created,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
];

/** Whole-org Trusted Origins export. */
export const trustedOriginsDescriptor: EntityExport<TrustedOrigin> = {
  id: 'trusted-origins',
  displayName: 'Trusted Origins',
  icon: 'shield',
  description: 'CORS and redirect allow-list entries configured in the org.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/trustedOrigins',
  defaultQuery: { limit: 200 },
  schema: originSchema,
  filter: { kind: 'none' },
  columnCatalog: originColumns,
};

export default trustedOriginsDescriptor;
```

Both a named export and a default export: the registry reads `default`, and the named
export is what the co-located test imports and pins.

## Failure modes worth recognising

| Symptom                                            | Cause                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Export runs clean but rows are missing             | Schema too strict — `parseOktaList` dropped them. Check the `Dropped malformed items` warning for the count.                    |
| The export is empty                                | Endpoint requires a discriminator (`type` on `/policies`), or the filter text is invalid — the live match count shows 0 first.  |
| A column is blank for every row                    | Accessor path wrong; it returns `undefined` rather than throwing, so nothing surfaces.                                          |
| Only the first page has embedded data              | An `expand` was dropped from the `rel="next"` URL. Ask `okta-api` — this is a known Okta behaviour, and it varies by parameter. |
| A saved preset lost a column                       | A column `id` was renamed.                                                                                                      |
| `columnCatalogs.test.ts` fails on a new descriptor | A formatter returned a non-string, or an accessor threw on the empty row.                                                       |
| The descriptor never appears in the hub            | It is a factory whose required `ExportApiDeps` member is absent, or the file default-exports nothing.                           |
