/**
 * @module sidepanel/export/columns/userColumns
 * @description Shared user column catalog reused by the Users and Group
 * Memberships descriptors (both export validated {@link OktaUserListItem} rows).
 *
 * Defined once so the two descriptors present an identical set of user columns.
 */

import type { OktaUserListItem } from '@/shared/schemas/okta';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { ExportColumn } from '../types';

/**
 * The base-identity + profile columns available when exporting users.
 *
 * `base` columns come from the top-level user object (id, status, timestamps);
 * `profile` columns come from `user.profile` (org-extensible, so accessors are
 * defensive about missing fields).
 */
export const userColumns: ExportColumn<OktaUserListItem>[] = [
  { id: 'id', label: 'User ID', group: 'base', defaultEnabled: true, accessor: (u) => u.id },
  {
    id: 'status',
    label: 'Status',
    group: 'base',
    defaultEnabled: true,
    accessor: (u) => u.status,
  },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.created,
    format: (v) => formatDateForCSV(v as string | undefined),
  },
  {
    id: 'lastLogin',
    label: 'Last Login',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.lastLogin,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated',
    group: 'base',
    defaultEnabled: false,
    accessor: (u) => u.lastUpdated,
    format: (v) => formatDateForCSV(v as string | undefined),
  },
  {
    id: 'login',
    label: 'Login',
    group: 'profile',
    defaultEnabled: true,
    accessor: (u) => u.profile?.login,
  },
  {
    id: 'email',
    label: 'Email',
    group: 'profile',
    defaultEnabled: true,
    accessor: (u) => u.profile?.email,
  },
  {
    id: 'firstName',
    label: 'First Name',
    group: 'profile',
    defaultEnabled: true,
    accessor: (u) => u.profile?.firstName,
  },
  {
    id: 'lastName',
    label: 'Last Name',
    group: 'profile',
    defaultEnabled: true,
    accessor: (u) => u.profile?.lastName,
  },
  {
    id: 'department',
    label: 'Department',
    group: 'profile',
    defaultEnabled: false,
    accessor: (u) => u.profile?.department,
  },
  {
    id: 'title',
    label: 'Title',
    group: 'profile',
    defaultEnabled: false,
    accessor: (u) => u.profile?.title,
  },
  {
    id: 'manager',
    label: 'Manager',
    group: 'profile',
    defaultEnabled: false,
    accessor: (u) => u.profile?.manager,
  },
];
