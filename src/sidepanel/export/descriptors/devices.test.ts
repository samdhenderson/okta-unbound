/**
 * @module sidepanel/export/descriptors/devices.test
 * @description Unit tests for the Devices export descriptor — asserts its
 * declarative shape, lenient schema acceptance, and column derivation.
 */

import { describe, expect, it } from 'vitest';
import devicesDescriptor, { devicesDescriptor as named } from './devices';

describe('devicesDescriptor', () => {
  it('exposes the expected identity and fetch config', () => {
    expect(devicesDescriptor).toBe(named);
    expect(devicesDescriptor.id).toBe('devices');
    expect(devicesDescriptor.endpoint).toBe('/api/v1/devices');
    expect(devicesDescriptor.defaultQuery.expand).toBe('user');
    expect(devicesDescriptor.filter.kind).toBe('search');
  });

  it('validates a device row with a profile and derives the platform column', () => {
    const { schema } = devicesDescriptor;
    const row = schema.parse({
      id: 'guoFAKE1',
      status: 'ACTIVE',
      profile: { platform: 'MACOS', displayName: 'Fake MacBook' },
    });

    const platform = devicesDescriptor.columnCatalog.find((c) => c.id === 'platform');
    expect(platform?.accessor(row)).toBe('MACOS');
  });

  it('formats the registered column as Yes/No', () => {
    const registered = devicesDescriptor.columnCatalog.find((c) => c.id === 'registered');
    expect(registered?.format?.(true, {} as never)).toBe('Yes');
    expect(registered?.format?.(false, {} as never)).toBe('No');
  });
});
