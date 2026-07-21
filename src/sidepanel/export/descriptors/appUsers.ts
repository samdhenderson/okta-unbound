/**
 * @module sidepanel/export/descriptors/appUsers
 * @description The App Users export descriptor — assignments of users to a chosen app.
 *
 * A `search-to-select` descriptor: the admin first picks an application (resolved by
 * the Export tab via `deps.searchApps`, since its context `label` matches `/app/i`),
 * then the engine lists that app's assigned users. App-user assignments are their own
 * shape (assignment status/scope/syncState plus embedded app credentials), so this
 * descriptor defines a local lenient schema and column catalog rather than reusing the
 * shared user catalog.
 */

import { z } from 'zod';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport, ExportColumn } from '../types';

/**
 * Lenient app-user assignment schema. Kept local (not in `shared/schemas/okta.ts`)
 * and `.passthrough()` so org-specific credential/profile fields survive validation
 * while the columns we surface stay strongly typed.
 */
const appUserSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    scope: z.string().optional(),
    syncState: z.string().optional(),
    created: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    credentials: z.object({ userName: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

/** A single user's assignment to an application, as returned by the app-users list endpoint. */
type AppUser = z.infer<typeof appUserSchema>;

/** The base columns available when exporting an app's assigned users. */
const appUserColumns: ExportColumn<AppUser>[] = [
  { id: 'id', label: 'User ID', group: 'base', defaultEnabled: true, accessor: (u) => u.id },
  {
    id: 'userName',
    label: 'User Name',
    group: 'base',
    defaultEnabled: true,
    accessor: (u) => u.credentials?.userName,
  },
  {
    id: 'status',
    label: 'Status',
    group: 'base',
    defaultEnabled: true,
    accessor: (u) => u.status,
  },
  {
    id: 'scope',
    label: 'Scope',
    group: 'base',
    defaultEnabled: true,
    accessor: (u) => u.scope,
  },
  {
    id: 'syncState',
    label: 'Sync State',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.syncState,
  },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.created,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.lastUpdated,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
];

/** Users assigned to a chosen application, with assignment status + per-row deep links. */
export const appUsersDescriptor: EntityExport<AppUser> = {
  id: 'app-users',
  displayName: 'App Users',
  icon: 'users',
  description: 'Assignments of users to a chosen application.',
  context: {
    kind: 'search-to-select',
    label: 'App',
    placeholder: 'Search apps by name…',
    endpoint: (appId) => `/api/v1/apps/${appId}/users`,
  },
  defaultQuery: { limit: 200 },
  schema: appUserSchema,
  filter: { kind: 'none' },
  linkify: { entityType: 'user', idColumnId: 'id' },
  columnCatalog: appUserColumns,
};

export default appUsersDescriptor;
