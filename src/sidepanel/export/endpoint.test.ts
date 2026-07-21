/**
 * @module sidepanel/export/endpoint.test
 * @description Unit tests for the pure `buildExportEndpoint` resolver.
 *
 * Covers query assembly from `defaultQuery`, the optional raw filter passthrough
 * (URL-encoded, trimmed, omitted when blank, never appended for `filter.kind:
 * 'none'`), and the `search-to-select` path that builds its endpoint from the
 * chosen context id (and throws when that id is missing).
 */
import { describe, it, expect } from 'vitest';
import { buildExportEndpoint } from './endpoint';
import type { EntityExport, FilterSupport } from './types';
import { oktaUserListItemSchema } from '@/shared/schemas/okta';

const searchFilter: FilterSupport = { kind: 'search', help: 'help', placeholder: 'ph' };

/** A minimal whole-org descriptor with a configurable filter. */
function wholeOrg(filter: FilterSupport): EntityExport {
  return {
    id: 'users',
    displayName: 'Users',
    icon: 'user',
    description: '',
    context: { kind: 'whole-org' },
    endpoint: '/api/v1/users',
    defaultQuery: { limit: 200 },
    schema: oktaUserListItemSchema,
    filter,
    columnCatalog: [],
  };
}

/** A minimal search-to-select descriptor building a group-members endpoint. */
function searchToSelect(): EntityExport {
  return {
    id: 'groupMembers',
    displayName: 'Group Memberships',
    icon: 'building',
    description: '',
    context: {
      kind: 'search-to-select',
      label: 'Group',
      placeholder: 'Search groups',
      endpoint: (id) => `/api/v1/groups/${id}/users`,
    },
    defaultQuery: { limit: 200 },
    schema: oktaUserListItemSchema,
    filter: { kind: 'none' },
    columnCatalog: [],
  };
}

describe('buildExportEndpoint whole-org', () => {
  it('merges defaultQuery and appends the trimmed, encoded filter as search=', () => {
    const url = buildExportEndpoint(wholeOrg(searchFilter), {
      filterText: 'status eq "ACTIVE"',
    });
    expect(url).toBe('/api/v1/users?limit=200&search=status+eq+%22ACTIVE%22');
  });

  it('URL-encodes special characters in the filter value', () => {
    const url = buildExportEndpoint(wholeOrg(searchFilter), {
      filterText: 'profile.department eq "R&D"',
    });
    expect(url).toBe('/api/v1/users?limit=200&search=profile.department+eq+%22R%26D%22');
  });

  it('omits the filter when the text is blank or whitespace-only', () => {
    expect(buildExportEndpoint(wholeOrg(searchFilter), { filterText: '   ' })).toBe(
      '/api/v1/users?limit=200',
    );
    expect(buildExportEndpoint(wholeOrg(searchFilter), {})).toBe('/api/v1/users?limit=200');
  });

  it('never appends a filter when filter.kind is "none", even with text', () => {
    const url = buildExportEndpoint(wholeOrg({ kind: 'none' }), {
      filterText: 'status eq "ACTIVE"',
    });
    expect(url).toBe('/api/v1/users?limit=200');
  });

  it('throws when a whole-org descriptor has no endpoint', () => {
    const descriptor = { ...wholeOrg(searchFilter), endpoint: undefined };
    expect(() => buildExportEndpoint(descriptor)).toThrow(/no endpoint/);
  });
});

describe('buildExportEndpoint search-to-select', () => {
  it('builds the endpoint from the chosen context id', () => {
    const url = buildExportEndpoint(searchToSelect(), { contextId: '00gFAKE1' });
    expect(url).toBe('/api/v1/groups/00gFAKE1/users?limit=200');
  });

  it('throws when the required context id is missing', () => {
    expect(() => buildExportEndpoint(searchToSelect())).toThrow(/requires a selected Group/);
  });
});
