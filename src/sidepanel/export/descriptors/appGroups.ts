/**
 * @module sidepanel/export/descriptors/appGroups
 * @description The App Groups export descriptor — groups assigned to a chosen app.
 *
 * A `search-to-select` descriptor: the admin first picks an app (resolved by the
 * Export tab via `deps.searchApps`, since its context `label` matches `/app/i`),
 * then the engine lists that app's assigned groups. Rows are app-group assignments,
 * so this descriptor carries a self-contained lenient schema and a small base
 * column catalog rather than reusing a shared one.
 */

import { z } from 'zod';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport } from '../types';

/**
 * Lenient local schema for an app-group assignment row. Kept permissive
 * (`passthrough`, optional/nullish fields) because app-group payloads vary by
 * app type; only the group `id` is relied on for deep-linking.
 */
export const appGroupSchema = z
  .object({
    id: z.string(),
    priority: z.number().optional(),
    lastUpdated: z.string().nullish(),
    profile: z.record(z.unknown()).optional(),
  })
  .passthrough();

/** A validated app-group assignment row (the app's assigned group). */
export type AppGroup = z.infer<typeof appGroupSchema>;

/** Groups assigned to a chosen app, with per-row deep links back to each group. */
export const appGroupsDescriptor: EntityExport<AppGroup> = {
  id: 'app-groups',
  displayName: 'App Groups',
  icon: 'building',
  description: 'Groups assigned to a chosen app.',
  context: {
    kind: 'search-to-select',
    label: 'App',
    placeholder: 'Search apps by name…',
    endpoint: (appId) => `/api/v1/apps/${appId}/groups`,
  },
  defaultQuery: { limit: 200 },
  schema: appGroupSchema,
  filter: { kind: 'none' },
  linkify: { entityType: 'group', idColumnId: 'id' },
  columnCatalog: [
    { id: 'id', label: 'Group ID', group: 'base', defaultEnabled: true, accessor: (g) => g.id },
    {
      id: 'priority',
      label: 'Priority',
      group: 'base',
      defaultEnabled: true,
      accessor: (g) => g.priority,
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      group: 'base',
      defaultEnabled: false,
      accessor: (g) => g.lastUpdated,
      format: (v) => formatDateForCSV(v as string | null | undefined),
    },
  ],
};

export default appGroupsDescriptor;
