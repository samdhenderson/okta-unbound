/**
 * @module sidepanel/export/descriptors/appGroups
 * @description The App Groups export descriptor — groups assigned to a chosen app.
 *
 * A `search-to-select` descriptor: the admin first picks an app (resolved by the
 * Export tab via `deps.searchApps`, since its context `label` matches `/app/i`),
 * then the engine lists that app's assigned groups. Rows are app-group assignments,
 * validated with the shared lenient `oktaAppGroupSchema`, with a small base column
 * catalog of its own.
 */

import { formatDateForCSV } from '@/shared/utils/csvUtils';
import { oktaAppGroupSchema, type OktaAppGroup } from '@/shared/schemas/okta';
import type { EntityExport } from '../types';

/**
 * The shared lenient app-group assignment schema (ADR-0006 boundary validation).
 * Re-exported here so existing consumers and `appGroups.test.ts` stay put.
 */
export const appGroupSchema = oktaAppGroupSchema;

/** A validated app-group assignment row (the app's assigned group). */
export type AppGroup = OktaAppGroup;

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
