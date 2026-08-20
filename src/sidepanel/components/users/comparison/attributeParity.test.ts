/*
 * The value-diff row model behind the comparison's Attributes dimension.
 *
 * Groups and apps ask "who holds this?"; attributes ask "do these two agree?".
 * These pin the five verdicts, the union of both inventories (an attribute only
 * the compared user carries is the whole point of the surface), the ordering that
 * floats actionable rows on their own, category resolution matching the Profile
 * pane, and the two ways a difference could be silently lost — `hidden` and
 * `showEmpty`.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect } from 'vitest';
import { attributeParityRows, type AttributeParityResult } from './attributeParity';
import { UNCATEGORIZED } from '../profileAttributeBlocks';
import type { OktaUser } from '../../../../shared/types';
import type { OktaUserProfileSchema } from '../../../../shared/schemas/okta';
import type { ProfileDisplayConfig } from '../../../../shared/storage/profileDisplayStore';

/** A fake user; `profile` overrides ride on top of the four required fields. */
const user = (id: string, profile: Record<string, unknown> = {}): OktaUser => ({
  id,
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Fake',
    lastName: 'User',
    ...profile,
  },
});

/** A schema whose base/custom blocks carry exactly the named attributes. */
const schemaOf = (
  base: Record<string, string> = {},
  custom: Record<string, string> = {},
): OktaUserProfileSchema =>
  ({
    definitions: {
      base: {
        properties: Object.fromEntries(
          Object.entries(base).map(([name, title]) => [name, { title, type: 'string' }]),
        ),
      },
      custom: {
        properties: Object.fromEntries(
          Object.entries(custom).map(([name, title]) => [name, { title, type: 'string' }]),
        ),
      },
    },
  }) as OktaUserProfileSchema;

/** A display config with everything off, so each test opts into one rule. */
const configOf = (overrides: Partial<ProfileDisplayConfig> = {}): ProfileDisplayConfig => ({
  layout: 'rows',
  showApiNames: false,
  showRuleChips: true,
  showEmpty: false,
  categories: [],
  assign: {},
  attrOrder: [],
  hidden: {},
  ...overrides,
});

/** The visible row for one Okta name, or `undefined`. */
const rowFor = (result: AttributeParityResult, name: string) =>
  result.rows.find((row) => row.name === name);

/** Visible row names, narrowed to the ones a test is actually about. */
const orderOf = (result: AttributeParityResult, names: string[]) =>
  result.rows.map((row) => row.name).filter((name) => names.includes(name));

const BASE = { department: 'Department', title: 'Title' };

describe('attributeParityRows — verdicts', () => {
  it('reports `same` when both users hold the same value', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Sales' }),
      schemaOf(BASE),
      configOf(),
    );

    expect(rowFor(result, 'department')?.verdict).toBe('same');
    expect(result.differenceCount).toBe(1); // the differing user ids, and nothing else
  });

  it('reports `differs` when both hold a value and the values disagree', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Engineering' }),
      schemaOf(BASE),
      configOf(),
    );

    const row = rowFor(result, 'department');
    expect(row?.verdict).toBe('differs');
    expect([row?.contextValue, row?.comparedValue]).toEqual(['Sales', 'Engineering']);
  });

  it('reports `onlyContext` when just the baseline user has a value', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002'),
      schemaOf(BASE),
      configOf(),
    );

    const row = rowFor(result, 'department');
    expect(row?.verdict).toBe('onlyContext');
    expect([row?.contextValue, row?.comparedValue]).toEqual(['Sales', '']);
  });

  it('reports `onlyCompared` when just the compared user has a value', () => {
    const result = attributeParityRows(
      user('00uFAKE0001'),
      user('00uFAKE0002', { department: 'Sales' }),
      schemaOf(BASE),
      configOf(),
    );

    const row = rowFor(result, 'department');
    expect(row?.verdict).toBe('onlyCompared');
    expect([row?.contextValue, row?.comparedValue]).toEqual(['', 'Sales']);
  });

  it('reports `bothEmpty`, and does not count it as a difference', () => {
    const result = attributeParityRows(
      user('00uFAKE0001'),
      user('00uFAKE0002'),
      schemaOf(BASE),
      configOf({ showEmpty: true }),
    );

    expect(rowFor(result, 'department')?.verdict).toBe('bothEmpty');
    expect(rowFor(result, 'title')?.verdict).toBe('bothEmpty');
    // Only the two user ids differ; neither empty attribute inflates the count.
    expect(result.differenceCount).toBe(1);
  });
});

describe('attributeParityRows — the union of both inventories', () => {
  it('keeps an attribute the compared user carries and the context user has never had', () => {
    const result = attributeParityRows(
      user('00uFAKE0001'),
      user('00uFAKE0002', { badgeId: 'FAKE-42' }),
      schemaOf(BASE),
      configOf(),
    );

    const row = rowFor(result, 'badgeId');
    expect(row).toBeDefined();
    expect(row?.verdict).toBe('onlyCompared');
    expect(row?.comparedValue).toBe('FAKE-42');
    expect(row?.kind).toBe('custom');
  });

  it('keeps an attribute only the context user carries', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { badgeId: 'FAKE-42' }),
      user('00uFAKE0002'),
      schemaOf(BASE),
      configOf(),
    );

    expect(rowFor(result, 'badgeId')?.verdict).toBe('onlyContext');
  });
});

describe('attributeParityRows — ordering', () => {
  const ordering = (config: ProfileDisplayConfig) =>
    attributeParityRows(
      user('00uFAKE0001', { alpha: 'a1', bravo: 'b1', charlie: 'c', zulu: 'z' }),
      user('00uFAKE0002', { alpha: 'a2', bravo: 'b2', charlie: 'c', zulu: 'z' }),
      schemaOf({}, { alpha: 'Alpha', bravo: 'Bravo', charlie: 'Charlie', zulu: 'Zulu' }),
      config,
    );

  it('floats the differences above the matching rows, whatever the configured order', () => {
    // The admin ordered the two matching attributes first; they still sink.
    const result = ordering(configOf({ attrOrder: ['charlie', 'zulu', 'alpha', 'bravo'] }));

    expect(orderOf(result, ['alpha', 'bravo', 'charlie', 'zulu'])).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'zulu',
    ]);
    expect(result.rows.slice(0, result.differenceCount).map((row) => row.verdict)).not.toContain(
      'same',
    );
  });

  it("follows the config's attrOrder within the differences", () => {
    const result = ordering(configOf({ attrOrder: ['bravo', 'alpha'] }));

    expect(orderOf(result, ['alpha', 'bravo'])).toEqual(['bravo', 'alpha']);
  });

  it('falls back to A–Z by label for attributes the config has not placed', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { zulu: 'z1', mike: 'm1', alpha: 'a1' }),
      user('00uFAKE0002', { zulu: 'z2', mike: 'm2', alpha: 'a2' }),
      schemaOf({}, { zulu: 'Zulu', mike: 'Mike', alpha: 'Alpha' }),
      configOf(),
    );

    expect(orderOf(result, ['alpha', 'mike', 'zulu'])).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('puts placed attributes ahead of unplaced ones in the same partition', () => {
    const result = ordering(configOf({ attrOrder: ['zulu'] }));

    expect(orderOf(result, ['charlie', 'zulu'])).toEqual(['zulu', 'charlie']);
  });
});

describe('attributeParityRows — categories match the Profile pane', () => {
  it('files an attribute under the category the config assigns it', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Engineering' }),
      schemaOf(BASE),
      configOf({
        categories: [{ key: 'organization', name: 'Organization' }],
        assign: { department: 'organization' },
      }),
    );

    expect(rowFor(result, 'department')?.categoryKey).toBe('organization');
  });

  it('falls to Uncategorized when the assigned category no longer exists', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Engineering' }),
      schemaOf(BASE),
      configOf({
        categories: [{ key: 'identity', name: 'Identity' }],
        assign: { department: 'deleted-category' },
      }),
    );

    expect(rowFor(result, 'department')?.categoryKey).toBe(UNCATEGORIZED);
  });

  it('falls to Uncategorized when the config has never placed the attribute', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Engineering' }),
      schemaOf(BASE),
      configOf({ categories: [{ key: 'organization', name: 'Organization' }] }),
    );

    expect(rowFor(result, 'department')?.categoryKey).toBe(UNCATEGORIZED);
  });
});

describe('attributeParityRows — hidden rows are separated, never dropped', () => {
  const hiddenDepartment = (contextValue: string, comparedValue: string) =>
    attributeParityRows(
      user('00uFAKE0001', { department: contextValue }),
      user('00uFAKE0002', { department: comparedValue }),
      schemaOf(BASE),
      configOf({ hidden: { department: true } }),
    );

  it('moves a hidden attribute out of `rows` and flags it, rather than discarding it', () => {
    const result = hiddenDepartment('Sales', 'Engineering');

    expect(rowFor(result, 'department')).toBeUndefined();
    const hidden = result.hiddenRows.find((row) => row.name === 'department');
    expect(hidden?.hiddenByConfig).toBe(true);
    expect(hidden?.verdict).toBe('differs');
  });

  it('counts a hidden attribute that differs, so the UI can offer to reveal it', () => {
    const result = hiddenDepartment('Sales', 'Engineering');

    expect(result.hiddenDifferences).toBe(1);
    // The hidden difference is NOT also counted among the visible ones.
    expect(result.rows.some((row) => row.name === 'department')).toBe(false);
  });

  it('does not count a hidden attribute the two users agree on', () => {
    const result = hiddenDepartment('Sales', 'Sales');

    expect(result.hiddenRows.find((row) => row.name === 'department')?.verdict).toBe('same');
    expect(result.hiddenDifferences).toBe(0);
  });

  it('marks visible rows as not hidden', () => {
    const result = hiddenDepartment('Sales', 'Engineering');

    expect(result.rows.every((row) => row.hiddenByConfig === false)).toBe(true);
  });
});

describe('attributeParityRows — showEmpty never suppresses a difference', () => {
  it('keeps a one-sided value with showEmpty off — the trap this surface exists to avoid', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002'),
      schemaOf(BASE),
      configOf({ showEmpty: false }),
    );

    expect(rowFor(result, 'department')?.verdict).toBe('onlyContext');
    expect(result.differenceCount).toBe(2); // department + the differing user ids
  });

  it('keeps a one-sided value on the compared side too, with showEmpty off', () => {
    const result = attributeParityRows(
      user('00uFAKE0001'),
      user('00uFAKE0002', { department: 'Engineering' }),
      schemaOf(BASE),
      configOf({ showEmpty: false }),
    );

    expect(rowFor(result, 'department')?.verdict).toBe('onlyCompared');
  });

  it('governs only the rows neither user has a value for', () => {
    const args = [user('00uFAKE0001'), user('00uFAKE0002'), schemaOf(BASE)] as const;

    expect(
      rowFor(attributeParityRows(...args, configOf({ showEmpty: false })), 'title'),
    ).toBeUndefined();
    expect(
      rowFor(attributeParityRows(...args, configOf({ showEmpty: true })), 'title')?.verdict,
    ).toBe('bothEmpty');
  });
});

describe('attributeParityRows — security', () => {
  it('never emits a security-sensitive attribute, on either list', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { securityQuestion: 'fake-question', password: 'fake' }),
      user('00uFAKE0002', { securityQuestion: 'other-fake-question', recoveryAnswer: 'fake' }),
      schemaOf(BASE, { securityQuestion: 'Security Question' }),
      // Even a config that explicitly places and hides them cannot bring them back.
      configOf({
        categories: [{ key: 'identity', name: 'Identity' }],
        assign: { securityQuestion: 'identity' },
        attrOrder: ['securityQuestion', 'password'],
        hidden: { password: true },
        showEmpty: true,
      }),
    );

    const every = [...result.rows, ...result.hiddenRows];
    for (const banned of ['securityQuestion', 'password', 'recoveryAnswer']) {
      expect(every.some((row) => row.name === banned)).toBe(false);
    }
    expect(every.some((row) => row.contextValue.includes('fake-question'))).toBe(false);
  });
});

describe('attributeParityRows — degenerate inputs', () => {
  it('compares the base attributes with no schema and an empty config', () => {
    const result = attributeParityRows(
      user('00uFAKE0001', { department: 'Sales' }),
      user('00uFAKE0002', { department: 'Engineering' }),
      null,
      configOf(),
    );

    const row = rowFor(result, 'department');
    expect(row?.verdict).toBe('differs');
    expect(row?.label).toBe('Department'); // humanized, since there is no schema title
    expect(row?.categoryKey).toBe(UNCATEGORIZED);
    expect(result.hiddenRows).toEqual([]);
    expect(result.hiddenDifferences).toBe(0);
  });

  it('returns no differences for two users with identical profiles and ids', () => {
    const identical = () => user('00uFAKE0001', { department: 'Sales' });
    const result = attributeParityRows(identical(), identical(), null, configOf());

    expect(result.differenceCount).toBe(0);
    expect(result.rows.every((row) => row.verdict === 'same')).toBe(true);
  });
});
