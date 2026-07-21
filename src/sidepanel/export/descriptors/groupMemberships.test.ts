/**
 * @module sidepanel/export/descriptors/groupMemberships.test
 * @description Unit tests for the Group Memberships export descriptor — asserts its
 * identity, `search-to-select` context + endpoint builder, and that it reuses the
 * shared user column catalog and user schema. Pure objects; no MSW.
 */

import { describe, it, expect } from 'vitest';
import { oktaUserListItemSchema } from '@/shared/schemas/okta';
import { groupMembershipsDescriptor } from './groupMemberships';
import { userColumns } from '../columns/userColumns';

describe('groupMembershipsDescriptor', () => {
  it('has the stable registry id', () => {
    expect(groupMembershipsDescriptor.id).toBe('group-memberships');
  });

  it('scopes via search-to-select', () => {
    expect(groupMembershipsDescriptor.context.kind).toBe('search-to-select');
  });

  it('builds the group members endpoint from the chosen group id', () => {
    const { context } = groupMembershipsDescriptor;
    if (context.kind !== 'search-to-select') throw new Error('expected search-to-select context');
    expect(context.endpoint('00gFAKE1')).toBe('/api/v1/groups/00gFAKE1/users');
  });

  it('reuses the shared user column catalog', () => {
    expect(groupMembershipsDescriptor.columnCatalog).toBe(userColumns);
  });

  it('validates rows with the user list-item schema', () => {
    expect(groupMembershipsDescriptor.schema).toBe(oktaUserListItemSchema);
  });
});
