/**
 * @module sidepanel/export/descriptors/apps.test
 * @description Unit tests for the Applications export descriptor. Exercises the
 * descriptor as pure data: identity/endpoint/filter/linkify config and the
 * accessor + date-formatting behavior of representative columns.
 */

import { describe, expect, it } from 'vitest';
import type { OktaAppListItem } from '@/shared/schemas/okta';
import appsDescriptor from './apps';

/** A fully-populated fake app row (obviously-fake id). */
const app: OktaAppListItem = {
  id: '0oaFAKE1',
  name: 'salesforce',
  label: 'Salesforce',
  status: 'ACTIVE',
  signOnMode: 'SAML_2_0',
  created: '2026-03-05T14:30:00Z',
  lastUpdated: '2026-04-01T09:00:00Z',
};

describe('appsDescriptor', () => {
  it('declares whole-org Applications identity and endpoint', () => {
    expect(appsDescriptor.id).toBe('apps');
    expect(appsDescriptor.endpoint).toBe('/api/v1/apps');
  });

  it('uses a `q` prefix filter', () => {
    expect(appsDescriptor.filter.kind).toBe('q');
  });

  it('deep-links rows as apps', () => {
    expect(appsDescriptor.linkify?.entityType).toBe('app');
  });

  it('the label column accessor returns the app label', () => {
    const labelColumn = appsDescriptor.columnCatalog.find((c) => c.id === 'label');
    expect(labelColumn).toBeDefined();
    expect(labelColumn?.accessor(app)).toBe(app.label);
  });

  it('the created column formats to a YYYY-MM-DD string', () => {
    const createdColumn = appsDescriptor.columnCatalog.find((c) => c.id === 'created');
    expect(createdColumn?.format).toBeDefined();
    const cell = createdColumn?.format?.(createdColumn.accessor(app), app);
    expect(cell).toBe('2026-03-05');
    expect(cell).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
