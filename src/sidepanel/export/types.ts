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
import type { IconType } from '@/sidepanel/components/overview/shared/Icon';

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
