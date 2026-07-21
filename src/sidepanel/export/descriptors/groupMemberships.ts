/**
 * @module sidepanel/export/descriptors/groupMemberships
 * @description The Group Memberships export descriptor — members of a chosen group.
 *
 * A `search-to-select` descriptor: the admin first picks a group (resolved by the
 * Export tab via `deps.searchGroups`, since its context `label` is `'Group'`), then
 * the engine lists that group's users. Members are users, so this descriptor reuses
 * the shared {@link userColumns} catalog and the {@link OktaUserListItem} schema.
 */

import { oktaUserListItemSchema, type OktaUserListItem } from '@/shared/schemas/okta';
import type { EntityExport } from '../types';
import { userColumns } from '../columns/userColumns';

/** Members of a chosen group, with user identity + profile columns and per-row deep links. */
export const groupMembershipsDescriptor: EntityExport<OktaUserListItem> = {
  id: 'group-memberships',
  displayName: 'Group Memberships',
  icon: 'users',
  description: 'Members of a chosen group, with user identity + profile columns.',
  context: {
    kind: 'search-to-select',
    label: 'Group',
    placeholder: 'Search groups by name…',
    endpoint: (groupId) => `/api/v1/groups/${groupId}/users`,
  },
  defaultQuery: { limit: 200 },
  schema: oktaUserListItemSchema,
  filter: { kind: 'none' },
  linkify: { entityType: 'user', idColumnId: 'id' },
  columnCatalog: userColumns,
};

export default groupMembershipsDescriptor;
