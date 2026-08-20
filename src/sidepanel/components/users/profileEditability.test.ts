/**
 * Unit tests for the profile-attribute editability gate.
 *
 * The module is pure, so every case is a direct call: a descriptor plus a user
 * in, a verdict out. What is pinned is the deny-by-default behaviour the write
 * path depends on — an unrecognized `mutability` locks rather than opens, an
 * externally-mastered attribute names its master, and `login` is decided by the
 * *account's* credential provider rather than by a per-attribute `master` block.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `user@example.com`) per CLAUDE.md.
 */
import { describe, it, expect } from 'vitest';
import { attributeEditability } from './profileEditability';
import { oktaUserSchemaPropertySchema } from '../../../shared/schemas/okta';
import type { OktaUserSchemaProperty } from '../../../shared/schemas/okta';
import type { AttributeDescriptor } from './profileAttributes';
import type { OktaUser } from '../../../shared/types';

/** Parse a raw schema property the same way the schema operation does. */
const property = (raw: unknown): OktaUserSchemaProperty => oktaUserSchemaPropertySchema.parse(raw);

/** A profile attribute descriptor, as `allProfileAttributes` would emit it. */
const attribute = (
  name: string,
  raw: unknown,
  schemaProperty?: OktaUserSchemaProperty,
  kind: AttributeDescriptor['kind'] = 'base',
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label: schemaProperty?.title ?? name,
  kind,
  value: raw === undefined || raw === null ? '' : String(raw),
  raw,
  isEmpty: raw === undefined || raw === null || raw === '',
  ...(schemaProperty ? { property: schemaProperty } : {}),
});

/** A user, optionally carrying a credential provider. */
const makeUser = (provider?: { type?: string; name?: string }): OktaUser =>
  ({
    id: '00uFAKE0001',
    status: 'ACTIVE',
    ...(provider ? { credentials: { provider } } : {}),
    profile: {
      login: 'user@example.com',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Example',
    },
  }) as OktaUser;

const user = makeUser();

describe('attributeEditability', () => {
  describe('the gates that lock', () => {
    it('locks a system attribute: it is not a profile attribute at all', () => {
      const verdict = attributeEditability(
        attribute('lastLogin', '2026-08-01T00:00:00.000Z', undefined, 'system'),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'system' });
    });

    it('locks an attribute the org schema never described', () => {
      const verdict = attributeEditability(attribute('legacyFlag', 'yes'), user);

      expect(verdict).toMatchObject({ editable: false, reason: 'not-in-schema' });
    });

    it('locks a READ_ONLY attribute', () => {
      const verdict = attributeEditability(
        attribute('created', 'x', property({ type: 'string', mutability: 'READ_ONLY' })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'read-only' });
    });

    it('locks a WRITE_ONLY attribute', () => {
      const verdict = attributeEditability(
        attribute('secret', '', property({ type: 'string', mutability: 'WRITE_ONLY' })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'write-only' });
    });

    it('locks a mutability it does not recognize rather than opening it', () => {
      const verdict = attributeEditability(
        attribute('futureField', 'x', property({ type: 'string', mutability: 'READ_WRITE_LATER' })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'read-only' });
    });

    it('locks a PROFILE_MASTER attribute and names the source', () => {
      const verdict = attributeEditability(
        attribute(
          'department',
          'Platform',
          property({ type: 'string', master: { type: 'PROFILE_MASTER' } }),
        ),
        user,
      );

      expect(verdict).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
        source: 'Profile Master',
      });
      expect(verdict.editable).toBe(false);
      if (!verdict.editable) expect(verdict.explanation).toContain('Profile Master');
    });

    it('treats a master type it does not recognize as external', () => {
      const verdict = attributeEditability(
        attribute('division', 'X', property({ type: 'string', master: { type: 'SOME_NEW_MODE' } })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'externally-mastered' });
    });

    it('leaves an OKTA-mastered attribute editable', () => {
      const verdict = attributeEditability(
        attribute('department', 'X', property({ type: 'string', master: { type: 'OKTA' } })),
        user,
      );

      expect(verdict).toMatchObject({ editable: true, control: 'text' });
    });

    it('locks an array attribute and names the type in the explanation', () => {
      const verdict = attributeEditability(
        attribute('aliases', ['a', 'b'], property({ type: 'array' })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'unsupported-type' });
      if (!verdict.editable)
        expect(verdict.explanation).toBe('This panel does not edit array attributes.');
    });

    it('locks an object attribute', () => {
      const verdict = attributeEditability(
        attribute('address', {}, property({ type: 'object' })),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'unsupported-type' });
    });

    it('locks an attribute whose schema states no type', () => {
      const verdict = attributeEditability(attribute('mystery', 'x', property({})), user);

      expect(verdict).toMatchObject({ editable: false, reason: 'unsupported-type' });
    });

    it('states every lock as a complete sentence', () => {
      const verdicts = [
        attributeEditability(attribute('id', '00uFAKE0001', undefined, 'system'), user),
        attributeEditability(attribute('unknown', 'x'), user),
        attributeEditability(
          attribute('created', 'x', property({ type: 'string', mutability: 'READ_ONLY' })),
          user,
        ),
        attributeEditability(attribute('aliases', [], property({ type: 'array' })), user),
      ];

      for (const verdict of verdicts) {
        expect(verdict.editable).toBe(false);
        if (!verdict.editable) expect(verdict.explanation).toMatch(/^[A-Z].*\.$/s);
      }
    });
  });

  describe('login is decided by the account credential provider', () => {
    const login = () => attribute('login', 'user@example.com', property({ type: 'string' }));

    it('EDITABLE when the provider is OKTA — there is deliberately no login deny-list', () => {
      const verdict = attributeEditability(login(), makeUser({ type: 'OKTA' }));

      expect(verdict).toMatchObject({ editable: true, control: 'text' });
    });

    it('locks login as account-mastered when the provider is ACTIVE_DIRECTORY', () => {
      const verdict = attributeEditability(login(), makeUser({ type: 'ACTIVE_DIRECTORY' }));

      expect(verdict).toMatchObject({
        editable: false,
        reason: 'account-mastered',
        source: 'Active Directory',
      });
    });

    it('locks login for any provider it does not recognize', () => {
      const verdict = attributeEditability(login(), makeUser({ type: 'SOME_FUTURE_IDP' }));

      expect(verdict).toMatchObject({ editable: false, reason: 'account-mastered' });
    });

    it('locks login when the user carries no credentials at all — absence is not confirmation', () => {
      const verdict = attributeEditability(login(), makeUser());

      expect(verdict).toMatchObject({ editable: false, reason: 'account-mastered' });
    });

    it('still applies the ordinary gates to an OKTA-provider login', () => {
      const verdict = attributeEditability(
        attribute(
          'login',
          'user@example.com',
          property({ type: 'string', mutability: 'READ_ONLY' }),
        ),
        makeUser({ type: 'OKTA' }),
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'read-only' });
    });

    it('does not apply the account gate to any other attribute', () => {
      const verdict = attributeEditability(
        attribute('email', 'user@example.com', property({ type: 'string' })),
        makeUser({ type: 'ACTIVE_DIRECTORY' }),
      );

      expect(verdict).toMatchObject({ editable: true, control: 'text' });
    });
  });

  describe('the control an editable attribute gets', () => {
    it('maps string to text', () => {
      expect(
        attributeEditability(attribute('title', 'Dev', property({ type: 'string' })), user),
      ).toMatchObject({
        editable: true,
        control: 'text',
      });
    });

    it('maps boolean to checkbox', () => {
      expect(
        attributeEditability(attribute('isContractor', true, property({ type: 'boolean' })), user),
      ).toMatchObject({ editable: true, control: 'checkbox' });
    });

    it('maps number and integer to a number field', () => {
      expect(
        attributeEditability(attribute('seats', 3, property({ type: 'number' })), user),
      ).toMatchObject({
        editable: true,
        control: 'number',
      });
      expect(
        attributeEditability(attribute('level', 3, property({ type: 'integer' })), user),
      ).toMatchObject({
        editable: true,
        control: 'number',
      });
    });

    it('maps a string enum to a select with the values projected', () => {
      const verdict = attributeEditability(
        attribute('region', 'EMEA', property({ type: 'string', enum: ['EMEA', 'AMER'] })),
        user,
      );

      expect(verdict).toMatchObject({
        editable: true,
        control: 'select',
        options: [
          { value: 'EMEA', label: 'EMEA' },
          { value: 'AMER', label: 'AMER' },
        ],
      });
    });

    it('prefers the oneOf titles for the option labels', () => {
      const verdict = attributeEditability(
        attribute(
          'region',
          'EMEA',
          property({
            type: 'string',
            enum: ['EMEA', 'AMER'],
            oneOf: [
              { const: 'EMEA', title: 'Europe, Middle East & Africa' },
              { const: 'AMER', title: 'Americas' },
            ],
          }),
        ),
        user,
      );

      expect(verdict).toMatchObject({
        editable: true,
        control: 'select',
        options: [
          { value: 'EMEA', label: 'Europe, Middle East & Africa' },
          { value: 'AMER', label: 'Americas' },
        ],
      });
    });

    it('falls back to the const when a oneOf entry carries no title', () => {
      const verdict = attributeEditability(
        attribute('region', 'EMEA', property({ type: 'string', oneOf: [{ const: 'EMEA' }] })),
        user,
      );

      expect(verdict).toMatchObject({ options: [{ value: 'EMEA', label: 'EMEA' }] });
    });

    it('falls back to free text when the enum entries are not all strings', () => {
      const verdict = attributeEditability(
        attribute('grade', 1, property({ type: 'string', enum: ['A', 2, null] })),
        user,
      );

      expect(verdict).toMatchObject({ editable: true, control: 'text' });
    });

    it('reports required from the schema', () => {
      expect(
        attributeEditability(
          attribute('email', 'a@example.com', property({ type: 'string', required: true })),
          user,
        ),
      ).toMatchObject({ editable: true, required: true });
      expect(
        attributeEditability(attribute('nickName', '', property({ type: 'string' })), user),
      ).toMatchObject({ editable: true, required: false });
    });
  });
});
