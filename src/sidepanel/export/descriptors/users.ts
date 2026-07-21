/**
 * @module sidepanel/export/descriptors/users
 * @description The Users export descriptor — the reference whole-org descriptor.
 *
 * Exports every user in the org (optionally narrowed by a raw SCIM `search`
 * expression) with base identity + profile columns. Serves as the worked example
 * every other descriptor follows.
 */

import type { EntityExport } from '../types';
import { userColumns, exportUserSchema, type ExportUser } from '../columns/userColumns';

/** Whole-org Users export with a raw `search` filter and per-row deep links. */
export const usersDescriptor: EntityExport<ExportUser> = {
  id: 'users',
  displayName: 'Users',
  icon: 'user',
  description: 'All users in the org with identity and profile attributes.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/users',
  defaultQuery: { limit: 200 },
  schema: exportUserSchema,
  filter: {
    kind: 'search',
    placeholder: 'status eq "ACTIVE" and profile.department eq "Sales"',
    help: 'Optional Okta `search` expression (SCIM). Leave blank to export all users.',
  },
  linkify: { entityType: 'user', idColumnId: 'id' },
  columnCatalog: userColumns,
};

export default usersDescriptor;
