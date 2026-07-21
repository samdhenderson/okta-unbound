/**
 * @module sidepanel/export/descriptors/groups
 * @description The Groups (with stats) export descriptor.
 *
 * Exports every group in the org (optionally narrowed by a raw SCIM `search`
 * expression) with base identity, profile, and membership/app/push-mapping
 * counts. Counts are requested via `expand=stats`, which nests them under
 * `_embedded.stats` — a shape the shared {@link oktaGroupListItemSchema} does not
 * expose, so this descriptor extends it locally (below) rather than changing
 * anything shared.
 */

import { z } from 'zod';
import { oktaGroupListItemSchema } from '@/shared/schemas/okta';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport, ExportColumn } from '../types';

/**
 * Stats-aware extension of {@link oktaGroupListItemSchema}. Adds the timestamp
 * fields the base list carries plus the `_embedded.stats` block returned when the
 * request includes `expand=stats`. Kept local to the descriptor so nothing shared
 * has to learn about stats. Lenient/partial + passthrough so a group missing
 * `_embedded` (or an unexpected extra field) still validates.
 */
export const groupWithStatsSchema = oktaGroupListItemSchema.extend({
  created: z.string().nullish(),
  lastUpdated: z.string().nullish(),
  _embedded: z
    .object({
      stats: z
        .object({
          usersCount: z.number().optional(),
          appsCount: z.number().optional(),
          groupPushMappingsCount: z.number().optional(),
        })
        .partial()
        .passthrough()
        .optional(),
    })
    .partial()
    .passthrough()
    .optional(),
});

/** A validated group row including optional `expand=stats` counts. */
export type GroupWithStats = z.infer<typeof groupWithStatsSchema>;

/**
 * Base identity + profile + stats columns available when exporting groups.
 *
 * Accessors are typed against {@link GroupWithStats}, so `_embedded.stats` reads
 * are type-safe (no casts, no `any`). `base` columns come from the top-level
 * group object; `profile` columns from `group.profile`; `custom` columns from
 * the `expand=stats` counts under `_embedded.stats`.
 */
export const groupColumns: ExportColumn<GroupWithStats>[] = [
  { id: 'id', label: 'Group ID', group: 'base', defaultEnabled: true, accessor: (g) => g.id },
  { id: 'type', label: 'Type', group: 'base', defaultEnabled: true, accessor: (g) => g.type },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (g) => g.created,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated',
    group: 'base',
    defaultEnabled: false,
    accessor: (g) => g.lastUpdated,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'name',
    label: 'Group Name',
    group: 'profile',
    defaultEnabled: true,
    accessor: (g) => g.profile?.name,
  },
  {
    id: 'description',
    label: 'Description',
    group: 'profile',
    defaultEnabled: true,
    accessor: (g) => g.profile?.description,
  },
  {
    id: 'memberCount',
    label: 'Member Count',
    group: 'custom',
    defaultEnabled: true,
    accessor: (g) => g._embedded?.stats?.usersCount,
  },
  {
    id: 'appsCount',
    label: 'Apps Count',
    group: 'custom',
    defaultEnabled: false,
    accessor: (g) => g._embedded?.stats?.appsCount,
  },
  {
    id: 'pushMappings',
    label: 'Group Push Mappings',
    group: 'custom',
    defaultEnabled: false,
    accessor: (g) => g._embedded?.stats?.groupPushMappingsCount,
  },
];

/** Whole-org Groups export with `expand=stats` counts, a raw `search` filter, and deep links. */
export const groupsDescriptor: EntityExport<GroupWithStats> = {
  id: 'groups',
  displayName: 'Groups',
  icon: 'building',
  description: 'All groups in the org with membership, app, and push-mapping counts.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/groups',
  defaultQuery: { limit: 200, expand: 'stats' },
  schema: groupWithStatsSchema,
  filter: {
    kind: 'search',
    placeholder: 'type eq "OKTA_GROUP"',
    help: 'Optional Okta `search` expression (SCIM). Leave blank to export all groups.',
  },
  linkify: { entityType: 'group', idColumnId: 'id' },
  columnCatalog: groupColumns,
};

export default groupsDescriptor;
