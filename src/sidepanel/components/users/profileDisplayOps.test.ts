import { describe, it, expect } from 'vitest';
import {
  addCategory,
  completeHidden,
  deleteCategory,
  namesInSection,
  placeAttribute,
  renameCategory,
  stepAttribute,
  toggleHidden,
} from './profileDisplayOps';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/**
 * Unit tests for the profile-display transforms, retargeted from
 * `ProfileDisplayModal.test.tsx` when the modal was replaced by inline editing:
 * the placement, boundary, delete, rename, add and whole-map assertions all
 * describe these functions now, not a dialog.
 *
 * The fixture is deliberately *interleaved* — the two Identity attributes are
 * separated in `attrOrder` by an uncategorized one — so a move that stepped to
 * the flat-array neighbour instead of the section neighbour cannot pass.
 */
const attribute = (
  name: string,
  kind: AttributeDescriptor['kind'],
  value: string,
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label: name,
  kind,
  value,
  raw: value,
  isEmpty: value === '',
});

const attributes: AttributeDescriptor[] = [
  attribute('login', 'base', 'user@example.com'),
  attribute('lastName', 'base', 'Lovelace'),
  attribute('firstName', 'base', 'Ada'),
  attribute('department', 'custom', ''),
  attribute('id', 'system', '00uFAKE0001'),
];

const config: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
  ],
  // Identity holds login (first) and firstName (last), with an uncategorized
  // attribute sitting between them in the global order.
  attrOrder: ['login', 'lastName', 'firstName', 'department', 'id'],
  assign: {
    login: 'identity',
    lastName: '',
    firstName: 'identity',
    department: 'organization',
    id: '',
  },
  hidden: {},
};

describe('stepAttribute', () => {
  it('moves an attribute within its own section, stepping over attributes in other sections', () => {
    const next = stepAttribute(config, attributes, 'firstName', 'up');

    // firstName swaps with login (its section neighbour), not with lastName
    // (its list neighbour).
    expect(namesInSection(next, 'identity')).toEqual(['firstName', 'login']);
    // The sections it stepped over are untouched.
    expect(namesInSection(next, 'organization')).toEqual(['department']);
    expect(namesInSection(next, '')).toEqual(['lastName', 'id']);
  });

  it('returns the config unchanged at the first position of the first section', () => {
    expect(stepAttribute(config, attributes, 'login', 'up')).toBe(config);
  });

  it('returns the config unchanged at the last position of the last section', () => {
    // `id` is last in Uncategorized, which is always the final section.
    expect(stepAttribute(config, attributes, 'id', 'down')).toBe(config);
  });

  it('steps into the next section at a section boundary', () => {
    // firstName is last in Identity, so `down` lands it at the top of Organization.
    const next = stepAttribute(config, attributes, 'firstName', 'down');

    expect(namesInSection(next, 'organization')).toEqual(['firstName', 'department']);
    expect(namesInSection(next, 'identity')).toEqual(['login']);
  });
});

describe('placeAttribute', () => {
  it('emits a complete assign map and an attrOrder partitioned in section order', () => {
    const next = placeAttribute(config, attributes, 'lastName', 'organization', 0);

    // The whole known map goes out: a one-key patch would un-file everything else.
    expect(next.assign).toEqual({
      login: 'identity',
      lastName: 'organization',
      firstName: 'identity',
      department: 'organization',
      id: '',
    });
    // Identity, then Organization, then Uncategorized — no interleaving left.
    expect(next.attrOrder).toEqual(['login', 'firstName', 'lastName', 'department', 'id']);
  });
});

describe('deleteCategory', () => {
  it('returns the category’s attributes to Uncategorized without hiding them', () => {
    const withHidden: ProfileDisplayConfig = { ...config, hidden: { lastName: true } };

    const next = deleteCategory(withHidden, attributes, 'identity');

    expect(next.categories).toEqual([{ key: 'organization', name: 'Organization' }]);
    // The category's attributes are uncategorized …
    expect(next.assign).toEqual({
      login: '',
      lastName: '',
      firstName: '',
      department: 'organization',
      id: '',
    });
    expect(namesInSection(next, '')).toEqual(['login', 'lastName', 'firstName', 'id']);
    // … and nothing was hidden on the way out.
    expect(next.hidden).toEqual({ lastName: true });
  });
});

describe('renameCategory', () => {
  it('changes only the name, keeping the key and every assignment', () => {
    const next = renameCategory(config, 'identity', 'People');

    expect(next.categories).toEqual([
      { key: 'identity', name: 'People' },
      { key: 'organization', name: 'Organization' },
    ]);
    // The key is stable across a rename — assignments are not orphaned by it.
    expect(next.assign).toEqual(config.assign);
    expect(namesInSection(next, 'identity')).toEqual(['login', 'firstName']);
  });
});

describe('addCategory', () => {
  it('derives a unique kebab key, suffixing a second category of the same name', () => {
    const once = addCategory(config, 'Contact & locale');

    expect(once.categories).toEqual([
      { key: 'identity', name: 'Identity' },
      { key: 'organization', name: 'Organization' },
      { key: 'contact-locale', name: 'Contact & locale' },
    ]);

    const twice = addCategory(once, 'Contact & locale');

    expect(twice.categories[3]).toEqual({ key: 'contact-locale-2', name: 'Contact & locale' });
  });
});

describe('completeHidden', () => {
  it('covers every attribute, not just the one that was toggled', () => {
    const next = toggleHidden(config, attributes, 'lastName');

    expect(next.hidden).toEqual({
      login: false,
      lastName: true,
      firstName: false,
      department: false,
      id: false,
    });
    // Hiding does not move the attribute: it keeps its row in the editor.
    expect(namesInSection(next, '')).toEqual(['lastName', 'id']);
  });

  it('writes an explicit entry for an attribute no override mentions', () => {
    expect(completeHidden(attributes, { ...config, hidden: { id: true } })).toEqual({
      login: false,
      lastName: false,
      firstName: false,
      department: false,
      id: true,
    });
  });
});
