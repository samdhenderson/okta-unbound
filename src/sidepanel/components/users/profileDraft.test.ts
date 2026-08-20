/**
 * Unit tests for draft coercion, the dirty check, and client-side validation.
 *
 * The behaviours pinned here are the ones a regression would make invisible
 * rather than loud: a draft that equals the saved value must **not** arm Save
 * (typing a character and deleting it is not an edit), `5` and `'5'` must be the
 * same value, and only `login` may claim to change how someone signs in.
 *
 * Fixtures use only fake placeholders (`user@example.com`) per CLAUDE.md.
 */
import { describe, it, expect } from 'vitest';
import { coerceDraftValue, draftDiff, validateDraft } from './profileDraft';
import { oktaUserSchemaPropertySchema } from '../../../shared/schemas/okta';
import type { OktaUserSchemaProperty } from '../../../shared/schemas/okta';
import type { AttributeDescriptor } from './profileAttributes';
import type { AttributeEditability } from './profileEditability';

/** Parse a raw schema property the same way the schema operation does. */
const property = (raw: unknown): OktaUserSchemaProperty => oktaUserSchemaPropertySchema.parse(raw);

/** A profile attribute descriptor, as `allProfileAttributes` would emit it. */
const attribute = (
  name: string,
  raw: unknown,
  schemaProperty: OktaUserSchemaProperty,
  label = name,
): AttributeDescriptor => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  value: raw === undefined || raw === null ? '' : String(raw),
  raw,
  isEmpty: raw === undefined || raw === null || raw === '',
  property: schemaProperty,
});

const STRING = property({ type: 'string' });
const NUMBER = property({ type: 'number' });
const BOOLEAN = property({ type: 'boolean' });

/** An editable verdict, as `attributeEditability` would return it. */
const editable = (
  control: 'text' | 'number' | 'select' | 'checkbox',
  required = false,
): AttributeEditability => ({ editable: true, control, required });

describe('coerceDraftValue', () => {
  it('passes a text value through unchanged, including the empty string', () => {
    expect(coerceDraftValue('Platform', 'text')).toEqual({ ok: true, value: 'Platform' });
    expect(coerceDraftValue('', 'text')).toEqual({ ok: true, value: '' });
  });

  it('passes a select value through unchanged', () => {
    expect(coerceDraftValue('EMEA', 'select')).toEqual({ ok: true, value: 'EMEA' });
  });

  it('turns a numeric string into a number', () => {
    expect(coerceDraftValue('42', 'number')).toEqual({ ok: true, value: 42 });
    expect(coerceDraftValue('-3.5', 'number')).toEqual({ ok: true, value: -3.5 });
  });

  it('rejects text that is not a number', () => {
    expect(coerceDraftValue('12abc', 'number')).toMatchObject({ ok: false });
    expect(coerceDraftValue('abc', 'number')).toMatchObject({ ok: false });
    expect(coerceDraftValue('Infinity', 'number')).toMatchObject({ ok: false });
    expect(coerceDraftValue('0x10', 'number')).toMatchObject({ ok: false });
  });

  it('reads an emptied number field as clearing the attribute, not as zero', () => {
    expect(coerceDraftValue('', 'number')).toEqual({ ok: true, value: undefined });
    expect(coerceDraftValue('   ', 'number')).toEqual({ ok: true, value: undefined });
  });

  it('turns the checkbox strings into booleans', () => {
    expect(coerceDraftValue('true', 'checkbox')).toEqual({ ok: true, value: true });
    expect(coerceDraftValue('false', 'checkbox')).toEqual({ ok: true, value: false });
  });

  it('reads an empty checkbox value as clearing the attribute', () => {
    expect(coerceDraftValue('', 'checkbox')).toEqual({ ok: true, value: undefined });
  });

  it('rejects a checkbox value that is neither true nor false', () => {
    expect(coerceDraftValue('yes', 'checkbox')).toMatchObject({ ok: false });
  });
});

describe('draftDiff', () => {
  const attributes = [
    attribute('department', 'Platform', STRING, 'Department'),
    attribute('seats', 5, NUMBER, 'Seats'),
    attribute('isContractor', false, BOOLEAN, 'Is Contractor'),
    attribute('login', 'user@example.com', STRING, 'Username'),
  ];

  it('reports nothing when no attribute has a draft', () => {
    expect(draftDiff(attributes, {})).toEqual([]);
  });

  it('does not arm Save for a draft equal to the saved value', () => {
    expect(draftDiff(attributes, { department: 'Platform' })).toEqual([]);
  });

  it('compares through one stringifier, so 5 and "5" are the same value', () => {
    expect(draftDiff(attributes, { seats: '5' })).toEqual([]);
    expect(draftDiff(attributes, { isContractor: 'false' })).toEqual([]);
  });

  it('reports a genuine change with both displays and the coerced value', () => {
    expect(draftDiff(attributes, { seats: '7' })).toEqual([
      {
        name: 'seats',
        label: 'Seats',
        beforeDisplay: '5',
        afterDisplay: '7',
        afterRaw: 7,
        changesSignIn: false,
      },
    ]);
  });

  it('reports an attribute being cleared', () => {
    const changes = draftDiff(attributes, { seats: '' });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ afterDisplay: '', afterRaw: undefined });
  });

  it('still reports an uncoercible draft, carrying the raw text', () => {
    expect(draftDiff(attributes, { seats: '12abc' })).toEqual([
      {
        name: 'seats',
        label: 'Seats',
        beforeDisplay: '5',
        afterDisplay: '12abc',
        afterRaw: '12abc',
        changesSignIn: false,
      },
    ]);
  });

  it('flags changesSignIn for login and for nothing else', () => {
    const changes = draftDiff(attributes, {
      login: 'new.user@example.com',
      department: 'Security',
    });

    expect(changes.map((change) => [change.name, change.changesSignIn])).toEqual([
      ['department', false],
      ['login', true],
    ]);
  });

  it('follows the inventory order, not the draft key order', () => {
    const changes = draftDiff(attributes, { login: 'new.user@example.com', seats: '9' });

    expect(changes.map((change) => change.name)).toEqual(['seats', 'login']);
  });
});

describe('validateDraft', () => {
  const attributes = [
    attribute('email', 'user@example.com', STRING, 'Email'),
    attribute('seats', 5, NUMBER, 'Seats'),
    attribute('created', '2026-01-01', STRING, 'Created'),
  ];

  const verdicts = new Map<string, AttributeEditability>([
    ['email', editable('text', true)],
    ['seats', editable('number')],
    [
      'created',
      { editable: false, reason: 'read-only', explanation: 'Okta reports this as read-only.' },
    ],
  ]);

  it('is empty for a valid draft', () => {
    expect(validateDraft(attributes, verdicts, { email: 'new.user@example.com' })).toEqual({});
  });

  it('reports a required attribute left empty', () => {
    expect(validateDraft(attributes, verdicts, { email: '' })).toEqual({
      email: 'A value is required.',
    });
  });

  it('does not report an optional attribute left empty', () => {
    expect(validateDraft(attributes, verdicts, { seats: '' })).toEqual({});
  });

  it('reports non-numeric text typed into a number field', () => {
    expect(validateDraft(attributes, verdicts, { seats: '12abc' })).toEqual({
      seats: 'Enter a number.',
    });
  });

  it('ignores a draft for an attribute this panel has locked', () => {
    expect(validateDraft(attributes, verdicts, { created: '' })).toEqual({});
  });

  it('ignores an attribute with no verdict at all', () => {
    expect(validateDraft(attributes, new Map(), { email: '' })).toEqual({});
  });
});
