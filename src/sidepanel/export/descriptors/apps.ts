/**
 * @module sidepanel/export/descriptors/apps
 * @description The Applications export descriptor — a whole-org descriptor for
 * `GET /api/v1/apps`.
 *
 * Exports every application in the org (optionally narrowed by a `q` prefix
 * search) with base metadata and profile identity columns. Follows the worked
 * example in {@link module:sidepanel/export/descriptors/users}.
 */

import { oktaAppListItemSchema, type OktaAppListItem } from '@/shared/schemas/okta';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport } from '../types';

/** Whole-org Applications export with a `q` prefix filter and per-row deep links. */
export const appsDescriptor: EntityExport<OktaAppListItem> = {
  id: 'apps',
  displayName: 'Applications',
  icon: 'app',
  description: 'All applications in the org with metadata and identity attributes.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/apps',
  defaultQuery: { limit: 200 },
  schema: oktaAppListItemSchema,
  filter: {
    kind: 'q',
    help: 'Search apps by name/label (prefix match).',
    placeholder: 'salesforce',
  },
  linkify: { entityType: 'app', idColumnId: 'id' },
  columnCatalog: [
    { id: 'id', label: 'App ID', group: 'base', defaultEnabled: true, accessor: (a) => a.id },
    {
      id: 'status',
      label: 'Status',
      group: 'base',
      defaultEnabled: true,
      accessor: (a) => a.status,
    },
    {
      id: 'signOnMode',
      label: 'Sign-On Mode',
      group: 'base',
      defaultEnabled: true,
      accessor: (a) => a.signOnMode,
    },
    {
      id: 'created',
      label: 'Created',
      group: 'base',
      defaultEnabled: false,
      accessor: (a) => a.created,
      format: (v) => formatDateForCSV(v as string | null | undefined),
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      group: 'base',
      defaultEnabled: false,
      accessor: (a) => a.lastUpdated,
      format: (v) => formatDateForCSV(v as string | null | undefined),
    },
    {
      id: 'label',
      label: 'App Name',
      group: 'profile',
      defaultEnabled: true,
      accessor: (a) => a.label,
    },
    {
      id: 'name',
      label: 'App Key',
      group: 'profile',
      defaultEnabled: false,
      accessor: (a) => a.name,
    },
  ],
};

export default appsDescriptor;
