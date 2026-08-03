/**
 * @module sidepanel/export/descriptors/authPolicies.test
 * @description Unit tests for the Auth Policies export descriptor.
 *
 * Pins the descriptor's identity and whole-org configuration, the resolved list
 * endpoint (the `type` selector must land in the query string exactly once), the
 * column accessors/formatters, and that every derived cell survives `escapeCSV`
 * unchanged in meaning — including a policy name crafted to trip the spreadsheet
 * formula-injection guard.
 */

import { describe, expect, it } from 'vitest';
import authPoliciesDescriptor, { authPoliciesDescriptor as namedDescriptor } from './authPolicies';
import { buildExportEndpoint } from '../endpoint';
import { escapeCSV } from '@/shared/utils/csvUtils';
import { oktaPolicyListItemSchema, type OktaPolicyListItem } from '@/shared/schemas/okta';
import type { CellValue } from '../types';

/** A representative validated policy row (obviously fake ids). */
const row: OktaPolicyListItem = {
  id: 'rstFAKE000000000001',
  name: 'Any two factors',
  status: 'ACTIVE',
  type: 'ACCESS_POLICY',
  priority: 2,
  description: 'Requires two factors for high-risk apps',
  system: false,
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2024-03-04T05:06:07.000Z',
};

/** Resolve one column to its final CSV cell, exactly as the engine would. */
function cellFor(columnId: string, source: OktaPolicyListItem): CellValue {
  const column = authPoliciesDescriptor.columnCatalog.find((c) => c.id === columnId);
  expect(column).toBeDefined();
  const raw = column?.accessor(source);
  return (column?.format ? column.format(raw, source) : raw) as CellValue;
}

describe('authPoliciesDescriptor', () => {
  it('has the expected identity and whole-org configuration', () => {
    expect(authPoliciesDescriptor.id).toBe('auth-policies');
    expect(authPoliciesDescriptor.displayName).toBe('Auth Policies');
    expect(authPoliciesDescriptor.icon).toBe('shield');
    expect(authPoliciesDescriptor.context.kind).toBe('whole-org');
    expect(authPoliciesDescriptor.endpoint).toBe('/api/v1/policies');
    expect(authPoliciesDescriptor.filter.kind).toBe('none');
    expect(authPoliciesDescriptor.linkify).toBeUndefined();
    expect(namedDescriptor).toBe(authPoliciesDescriptor);
  });

  it('resolves to the ACCESS_POLICY list endpoint with a single query separator', () => {
    const endpoint = buildExportEndpoint(authPoliciesDescriptor);

    // Exactly one `?`: the type selector must live in `defaultQuery`, not in the
    // base endpoint, or the engine would append a second query separator.
    expect(endpoint.match(/\?/g)).toHaveLength(1);
    expect(endpoint).toBe('/api/v1/policies?type=ACCESS_POLICY&limit=200');
  });

  it('validates a policy row with the shared Okta policy schema', () => {
    const parsed = authPoliciesDescriptor.schema.parse(row);
    expect(oktaPolicyListItemSchema.parse(row)).toEqual(parsed);
  });

  it('exposes the documented column set', () => {
    expect(authPoliciesDescriptor.columnCatalog.map((c) => c.id)).toEqual([
      'id',
      'name',
      'status',
      'type',
      'priority',
      'description',
      'system',
      'created',
      'lastUpdated',
    ]);
  });

  it('maps each column to the matching policy field', () => {
    expect(cellFor('id', row)).toBe('rstFAKE000000000001');
    expect(cellFor('name', row)).toBe('Any two factors');
    expect(cellFor('status', row)).toBe('ACTIVE');
    expect(cellFor('type', row)).toBe('ACCESS_POLICY');
    expect(cellFor('priority', row)).toBe(2);
    expect(cellFor('description', row)).toBe('Requires two factors for high-risk apps');
  });

  it('formats the system column as Yes/No', () => {
    expect(cellFor('system', { ...row, system: true })).toBe('Yes');
    expect(cellFor('system', { ...row, system: false })).toBe('No');
  });

  it('formats the timestamp columns and tolerates missing values', () => {
    expect(cellFor('created', row)).not.toBe('');
    expect(cellFor('lastUpdated', row)).not.toBe('');
    // Missing timestamps render as the shared placeholder, not an empty cell.
    expect(cellFor('created', { id: 'rstFAKE000000000002' })).toBe('N/A');
    expect(cellFor('lastUpdated', { id: 'rstFAKE000000000002' })).toBe('N/A');
  });

  it('accessors are null-safe on a sparse row', () => {
    const sparse = { id: 'rstFAKE000000000003' } as OktaPolicyListItem;
    for (const column of authPoliciesDescriptor.columnCatalog) {
      expect(() => column.accessor(sparse)).not.toThrow();
    }
  });

  it('escapes every derived cell through escapeCSV', () => {
    // A hostile, end-user-controllable policy name: leading `=` (formula injection),
    // an embedded comma, a quote, and a newline.
    const hostile: OktaPolicyListItem = {
      ...row,
      name: '=cmd|"/c calc"!A1',
      description: 'has, comma and "quotes"\nand a newline',
    };

    const name = escapeCSV(cellFor('name', hostile));
    // Neutralized: never starts the cell with a formula trigger, and it is quoted.
    expect(name.startsWith('=')).toBe(false);
    expect(name).toContain('cmd');

    const description = escapeCSV(cellFor('description', hostile));
    expect(description.startsWith('"')).toBe(true);
    expect(description.endsWith('"')).toBe(true);
    expect(description).toContain('""quotes""');

    // Plain values round-trip untouched.
    expect(escapeCSV(cellFor('status', row))).toBe('ACTIVE');
    expect(escapeCSV(cellFor('priority', row))).toBe('2');
  });
});
