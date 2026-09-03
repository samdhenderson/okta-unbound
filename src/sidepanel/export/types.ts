/**
 * @module sidepanel/export/types
 * @description The declarative contract for the descriptor-driven Export Engine.
 *
 * An {@link EntityExport} fully describes one exportable Okta entity — where to
 * fetch it, how to validate each row, which columns are available, how it is
 * scoped, and how to deep-link a row back into the Okta Admin Console. The engine
 * ({@link module:sidepanel/hooks/useOktaApi/exportEngine}) and the Export tab are
 * 100% descriptor-driven: **adding a new export means writing a descriptor, not a
 * pipeline.** No entity-specific code lives in the engine or the UI.
 *
 * @see {@link module:sidepanel/export/registry} for how descriptors are assembled.
 */

import type { z } from 'zod';
import type { OktaAdminEntityType } from '@/shared/utils/oktaUrl';
import type { IconType } from '@/sidepanel/components/shared/Icon';
import type { CountResolution } from '@/sidepanel/components/home/orgFigures';
import type { OrgSnapshotView } from './snapshot';

/** Column grouping bucket shown in the picker (base identity vs. profile vs. org-custom). */
export type ColumnGroup = 'base' | 'profile' | 'custom';

/**
 * A CSV cell value the engine can serialize. Mirrors the cell type accepted by
 * {@link module:shared/utils/csvUtils.generateCSV} so column formatters can return
 * a value directly without an extra coercion step.
 */
export type CellValue = string | number | boolean | null | undefined;

/**
 * One exportable column: how to derive a single CSV cell from a validated row.
 *
 * @typeParam Row - The validated row shape (the descriptor's `z.infer<schema>`).
 */
export interface ExportColumn<Row> {
  /** Stable id — persisted in presets and last-used selections; never rename. */
  id: string;
  /** CSV header text and picker-chip label. */
  label: string;
  /** Which group the column is displayed under in the picker. */
  group: ColumnGroup;
  /** Whether this column is enabled by default when no preset/last-used applies. */
  defaultEnabled: boolean;
  /**
   * Pull the raw value for this column from a validated row.
   *
   * Declared as a method (not an arrow property) so `ExportColumn<Specific>` stays
   * assignable to `ExportColumn<unknown>` — the descriptor registry is a
   * heterogeneous collection, which requires bivariant parameter checking here.
   */
  accessor(row: Row): unknown;
  /**
   * Optional formatter turning the raw value into the final CSV cell. Defaults to
   * a safe string coercion (`null`/`undefined` → `''`). Use for dates
   * (`formatDateForCSV`), booleans (`'Yes'`/`'No'`), or arrays (`join`).
   */
  format?(value: unknown, row: Row): CellValue;
  /** Optional tooltip shown on the picker chip. */
  description?: string;
}

/** A pickable context entity (a specific group, app, …) in the search-to-select flow. */
export interface EntityContextOption {
  /** The entity's Okta id, used to build the list endpoint. */
  id: string;
  /** Human-readable label shown in the dropdown and used in the export filename. */
  label: string;
  /** Optional secondary line (e.g. group type). */
  sublabel?: string;
}

/**
 * How an entity is scoped before its rows are fetched.
 *
 * - `whole-org` — export everything (all users, all apps); no picker.
 * - `search-to-select` — the admin first picks a parent entity (a group, an app)
 *   via off-page search, and the list endpoint is built from that entity's id.
 */
export type EntityContextMode =
  | { kind: 'whole-org' }
  | {
      kind: 'search-to-select';
      /** Field label for the picker (e.g. `'Group'`). */
      label: string;
      /** Placeholder for the search input. */
      placeholder: string;
      /** Build the list endpoint once a context entity has been chosen. */
      endpoint: (contextId: string) => string;
    };

/**
 * Raw filter-box passthrough configuration (approved UX default Q3).
 *
 * The engine appends the admin's raw expression as the named query parameter on a
 * same-origin authenticated GET — no injection surface beyond what the admin can
 * already do in Okta's own API.
 */
export type FilterSupport =
  | { kind: 'none' }
  | {
      /**
       * Which query parameter the filter text is appended as:
       * - `search` — SCIM `search=` (users, most modern list endpoints)
       * - `filter` — legacy `filter=`
       * - `q` — starts-with `q=`
       */
      kind: 'search' | 'filter' | 'q';
      /** Inline help text shown under the box. */
      help: string;
      /** Example expression shown as the input placeholder. */
      placeholder: string;
    };

/**
 * What a snapshot-sourced descriptor produced: the rows, and the verdict on
 * whether they may be published at all.
 *
 * The resolution is not advisory. `status: 'unavailable'` (equivalently
 * `value === null`) means **there is no export** — not an empty CSV and not a
 * partial one — and the source returns no rows in that state, so an
 * `unavailable` verdict cannot leak a list of names even if a caller ignored it
 * (ADR-0065, "The honesty rules travel with the rows").
 *
 * @typeParam Row - The row shape this descriptor's columns read.
 */
export interface SnapshotRows<Row> {
  /** Every matching row. Uncapped: `REPORT_PREVIEW_LIMIT` is a Home rule and does not follow the rows. */
  rows: Row[];
  /**
   * The {@link module:sidepanel/components/home/orgFigures.resolveCount} verdict
   * over the collections behind these rows. One function, two surfaces — Home's
   * row and this export apply the identical rule.
   */
  resolution: CountResolution;
  /** Snapshot rows dropped for failing schema validation (ADR-0065 §4). */
  dropped: number;
}

/**
 * Where a descriptor's rows come from.
 *
 * **Absent means `{ kind: 'endpoint' }`.** Row acquisition is an explicit arm on
 * {@link EntityExport} rather than a new {@link EntityContextMode}, because
 * `context` answers *what is this export scoped to* and drives a picker, while
 * this answers *where do the rows arrive from*. They are orthogonal: a future
 * snapshot-sourced export scoped to one app needs both axes at once, and folding
 * them into one union would make that unexpressible (ADR-0065 §1).
 *
 * @typeParam Row - The row shape this descriptor's columns read.
 */
export type EntityRowSource<Row> =
  | {
      /** Rows are walked from `endpoint` over the rate-limited scheduler path. */
      kind: 'endpoint';
    }
  | {
      /** Rows are joined out of the mounted org snapshot. Zero requests. */
      kind: 'snapshot';
      /**
       * The `columnCatalog` id of the column carrying the resolution's own
       * completeness `note`.
       *
       * The engine appends this column whenever the resolution is `partial`,
       * **even if the reader deselected it**: the incompleteness of the answer
       * is not a column preference, and a CSV outlives the screen that would
       * have caveated it.
       */
      completenessColumnId: string;
      /**
       * Join the rows out of the snapshot, synchronously.
       *
       * Read-only by construction — {@link module:sidepanel/export/snapshot.OrgSnapshotView}
       * exposes no `sync`. Declared as a method (not an arrow property) for the
       * same bivariance reason as {@link ExportColumn.accessor}: the registry is
       * a heterogeneous collection of `EntityExport<unknown>`.
       *
       * @param snapshot - The already-mounted collections.
       * @returns The rows and the verdict over them.
       */
      read(snapshot: OrgSnapshotView): SnapshotRows<Row>;
    };

/** Deep-link configuration for turning a row into an "Open in Okta" link. */
export interface IdLinkify {
  /** Entity kind passed to {@link module:shared/utils/oktaUrl.oktaAdminEntityUrl}. */
  entityType: OktaAdminEntityType;
  /** The `columnCatalog` column id whose cell value is the link target id. */
  idColumnId: string;
}

/**
 * The single source of truth for one exportable entity. One descriptor ≈ one
 * export. The engine and Export tab consume nothing entity-specific beyond this.
 *
 * @typeParam Row - The validated row shape produced by `schema` (`z.infer`).
 */
export interface EntityExport<Row = unknown> {
  /** Stable registry key; also the preset/last-used key and audit surrogate id. */
  id: string;
  /** Display name in the entity hub and the CSV filename stem. */
  displayName: string;
  /** Icon for the hub list (a member of the shared `Icon` registry). */
  icon: IconType;
  /** One-line description shown in the hub list. */
  description: string;

  /** How the entity is scoped before fetching. */
  context: EntityContextMode;

  /**
   * Where the rows come from. **Omit for a list endpoint** — absent is
   * `{ kind: 'endpoint' }`, which is why widening this contract changed no
   * existing descriptor (ADR-0065).
   */
  source?: EntityRowSource<Row>;

  /**
   * Base list endpoint for `whole-org` entities. Ignored for `search-to-select`,
   * which builds its endpoint from the chosen context id.
   */
  endpoint?: string;
  /** Default query params merged into the first page (e.g. `limit`, `expand`). */
  defaultQuery: Record<string, string | number>;

  /** Zod list-item schema; each fetched row is validated with `parseOktaList`. */
  schema: z.ZodTypeAny;

  /** The grouped catalog of available columns. */
  columnCatalog: ExportColumn<Row>[];

  /** Raw filter-box behavior. */
  filter: FilterSupport;

  /** Optional deep-link column. */
  linkify?: IdLinkify;

  /**
   * Hard cap on total rows fetched, as a memory/runaway guard. The engine applies
   * a default (50k) when omitted.
   */
  maxRows?: number;
}
