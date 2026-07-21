/**
 * @module sidepanel/export/descriptors/samlIdps.test
 * @description Unit tests for the Identity Providers export descriptor — pins its
 * registry contract (id/endpoint/filter), that the lenient schema accepts a nested
 * SAML trust issuer, and that the `issuer` column accessor reads it out.
 */

import { describe, expect, it } from 'vitest';
import samlIdpsDescriptor from './samlIdps';

describe('samlIdpsDescriptor', () => {
  it('has the expected registry contract', () => {
    expect(samlIdpsDescriptor.id).toBe('saml-idps');
    expect(samlIdpsDescriptor.endpoint).toBe('/api/v1/idps');
    expect(samlIdpsDescriptor.filter.kind).toBe('none');
  });

  it('validates a row with a nested SAML trust issuer and reads it via the issuer column', () => {
    const row = {
      id: '0oaidpFAKE1',
      type: 'SAML2',
      name: 'Partner SAML',
      status: 'ACTIVE',
      protocol: {
        type: 'SAML2',
        credentials: {
          trust: {
            issuer: 'https://idp.example.com/saml',
            audience: 'https://okta.example.com',
            kid: 'kidFAKE1',
          },
        },
      },
    };

    const parsed = samlIdpsDescriptor.schema.parse(row);
    expect(parsed.id).toBe('0oaidpFAKE1');

    const issuerColumn = samlIdpsDescriptor.columnCatalog.find((c) => c.id === 'issuer');
    expect(issuerColumn).toBeDefined();
    expect(issuerColumn?.accessor(parsed)).toBe('https://idp.example.com/saml');
  });
});
