/**
 * @module sidepanel/export/descriptors/appUsers
 * @description The App Users export descriptor — assignments of users to a chosen app.
 *
 * A `search-to-select` descriptor: the admin first picks an application (resolved by
 * the Export tab via `deps.searchApps`, since its context `label` matches `/app/i`),
 * then the engine lists that app's assigned users. App-user assignments are their own
 * shape (assignment status/scope/syncState plus embedded app credentials), so this
 * descriptor uses the shared lenient `oktaAppUserSchema` and its own column catalog
 * rather than reusing the shared user catalog.
 */

import { formatDateForCSV } from '@/shared/utils/csvUtils';
import { oktaAppUserSchema, type OktaAppUser } from '@/shared/schemas/okta';
import type { EntityExport, ExportColumn } from '../types';

/** The shared lenient app-user assignment schema (ADR-0006 boundary validation). */
const appUserSchema = oktaAppUserSchema;

/** A single user's assignment to an application, as returned by the app-users list endpoint. */
type AppUser = OktaAppUser;

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
