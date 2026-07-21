/**
 * @module sidepanel/export/descriptors/networkZones.test
 * @description Unit tests for the Network Zones export descriptor — validates the
 * descriptor shape, the local zone schema, and the derived column accessors.
 */

import { describe, expect, it } from 'vitest';
import networkZonesDescriptor, { networkZonesDescriptor as namedDescriptor } from './networkZones';
import { z } from 'zod';

// Re-declare the schema locally so the test exercises the same lenient shape the
// descriptor uses without exporting internal implementation details.
const zoneSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    system: z.boolean().optional(),
    usage: z.string().optional(),
    gateways: z.array(z.unknown()).optional(),
    proxies: z.array(z.unknown()).optional(),
  })
  .passthrough();

describe('networkZonesDescriptor', () => {
  it('has the expected identity and whole-org configuration', () => {
    expect(networkZonesDescriptor.id).toBe('network-zones');
    expect(networkZonesDescriptor.endpoint).toBe('/api/v1/zones');
    expect(networkZonesDescriptor.filter.kind).toBe('none');
    expect(namedDescriptor).toBe(networkZonesDescriptor);
  });

  it('validates a zone row with gateways via the descriptor schema', () => {
    const row = {
      id: 'nzoFAKE1',
      name: 'Corp IPs',
      type: 'IP',
      status: 'ACTIVE',
      usage: 'POLICY',
      gateways: [{}, {}],
    };
    const parsed = networkZonesDescriptor.schema.parse(row);
    expect(zoneSchema.parse(row)).toEqual(parsed);
  });

  it('derives gatewayCount from the gateways array length', () => {
    const row = { id: 'nzoFAKE1', gateways: [{}, {}] };
    const col = networkZonesDescriptor.columnCatalog.find((c) => c.id === 'gatewayCount');
    expect(col).toBeDefined();
    const raw = col?.accessor(row);
    expect(raw).toBe(2);
    const cell = col?.format ? col.format(raw, row) : raw;
    expect(cell).toBe(2);
  });

  it('formats the system column as Yes/No', () => {
    const col = networkZonesDescriptor.columnCatalog.find((c) => c.id === 'system');
    expect(col?.format?.(true, { id: 'nzoFAKE1' })).toBe('Yes');
    expect(col?.format?.(false, { id: 'nzoFAKE1' })).toBe('No');
  });
});
