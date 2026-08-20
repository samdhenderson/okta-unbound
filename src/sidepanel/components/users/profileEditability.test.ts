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
import { attributeEditability, profileMastering } from './profileEditability';
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

    /*
     * RETARGETED (ADR-0022(3)): the contract — a `PROFILE_MASTER` block with
     * nothing checkable behind it locks — is unchanged and still asserted here.
     * What changed is the copy: the old version asserted `source: 'Profile
     * Master'`, which named the mastering *mode* as though it were a system an
     * admin could go and look at. With no `priority` list there is no source to
     * name, so the verdict now carries none.
     */
    it('locks a PROFILE_MASTER attribute with no priority list, naming no source', () => {
      const verdict = attributeEditability(
        attribute(
          'department',
          'Platform',
          property({ type: 'string', master: { type: 'PROFILE_MASTER' } }),
        ),
        user,
      );

      expect(verdict).toMatchObject({ editable: false, reason: 'externally-mastered' });
      expect(verdict.editable).toBe(false);
      if (!verdict.editable) {
        expect(verdict.source).toBeUndefined();
        expect(verdict.explanation).toContain('profile source outside Okta');
      }
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

  /*
   * The bug these pin: `master` on a schema property describes the ORG, and the
   * panel was reading it as though it described every user. An org with one HR
   * profile source had every mastered attribute locked on every user — including
   * the ones that source has never heard of, whose attributes Okta itself lets
   * you edit.
   *
   * Every case is a PAIR. A one-sided assertion passes for the wrong reason: a
   * gate that simply locked everything would satisfy half of them, and that is
   * precisely the regression being guarded against.
   */
  describe('a PROFILE_MASTER block is resolved per user, not per org', () => {
    const HR_APP = '0oaFAKEhr0000000000';
    const AD_APP = '0oaFAKEad0000000000';

    /** `department`, mastered by the HR app at the org level. */
    const mastered = () =>
      attribute(
        'department',
        'Platform',
        property({
          type: 'string',
          master: { type: 'PROFILE_MASTER', priority: [{ type: 'APP', value: HR_APP }] },
        }),
      );

    it('locks it for a user the mastering app is assigned to, and names the app', () => {
      const verdict = attributeEditability(
        mastered(),
        user,
        profileMastering([{ id: HR_APP, label: 'Workday' }], true),
      );

      expect(verdict).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
        source: 'Workday',
      });
      if (!verdict.editable) expect(verdict.explanation).toContain('Workday');
    });

    it('leaves it editable for a user assigned to none of the mastering apps', () => {
      const verdict = attributeEditability(
        mastered(),
        user,
        profileMastering([{ id: AD_APP, label: 'Active Directory' }], true),
      );

      expect(verdict).toMatchObject({ editable: true, control: 'text' });
    });

    it('leaves it editable for a user with no app assignments at all', () => {
      expect(attributeEditability(mastered(), user, profileMastering([], true))).toMatchObject({
        editable: true,
        control: 'text',
      });
    });

    it('locks it while the app list has not loaded — an absence cannot be proven yet', () => {
      expect(attributeEditability(mastered(), user, {})).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
      });
    });

    it('locks it when the app walk did not finish, even though the app is missing from it', () => {
      // The rows say the HR app is absent. The walk says it never got to the end.
      // Only the second of those is an answer.
      const partial = profileMastering([{ id: AD_APP, label: 'Active Directory' }], false);

      expect(attributeEditability(mastered(), user, partial)).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
      });
    });

    it('locks it when a priority entry names a source kind it cannot check a user against', () => {
      const agentMastered = attribute(
        'department',
        'Platform',
        property({
          type: 'string',
          master: {
            type: 'PROFILE_MASTER',
            priority: [
              { type: 'APP', value: HR_APP },
              { type: 'AGENT', value: 'agent-1' },
            ],
          },
        }),
      );

      // The user matches no APP entry, but the AGENT entry is unanswerable — so
      // the list as a whole is, and "no match" would be a confident wrong answer.
      expect(attributeEditability(agentMastered, user, profileMastering([], true))).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
      });
    });

    it('locks it when the priority list is not the shape this module knows', () => {
      const malformed = attribute(
        'department',
        'Platform',
        property({ type: 'string', master: { type: 'PROFILE_MASTER', priority: ['0oaFAKE'] } }),
      );

      expect(attributeEditability(malformed, user, profileMastering([], true))).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
      });
    });

    it('does not extend the per-user check to a mastering mode it does not know', () => {
      const overridden = attribute(
        'department',
        'Platform',
        property({
          type: 'string',
          master: { type: 'OVERRIDE', priority: [{ type: 'APP', value: HR_APP }] },
        }),
      );

      expect(attributeEditability(overridden, user, profileMastering([], true))).toMatchObject({
        editable: false,
        reason: 'externally-mastered',
      });
    });
  });
});

describe('profileMastering', () => {
  it('indexes a completed walk by app id', () => {
    const context = profileMastering([{ id: '0oaFAKE1', label: 'Workday' }], true);

    expect(context.assignedApps?.get('0oaFAKE1')).toBe('Workday');
  });

  it('reports nothing for an unfinished walk, so absence is never inferred from it', () => {
    expect(
      profileMastering([{ id: '0oaFAKE1', label: 'Workday' }], false).assignedApps,
    ).toBeUndefined();
  });

  it('reports nothing when no walk has returned', () => {
    expect(profileMastering(undefined, true).assignedApps).toBeUndefined();
  });

  it('distinguishes a completed empty walk from no walk at all', () => {
    expect(profileMastering([], true).assignedApps?.size).toBe(0);
  });
});
