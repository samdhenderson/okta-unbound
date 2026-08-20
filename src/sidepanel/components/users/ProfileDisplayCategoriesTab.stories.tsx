import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ProfileDisplayCategoriesTab from './ProfileDisplayCategoriesTab';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

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

/** A small but representative profile, with three attributes empty on this user. */
const attributes: AttributeDescriptor[] = [
  attribute('id', 'system', '00uFAKE00000000000001'),
  attribute('status', 'system', 'ACTIVE'),
  attribute('login', 'base', 'user@example.com'),
  attribute('firstName', 'base', 'Ada'),
  attribute('lastName', 'base', 'Lovelace'),
  attribute('department', 'base', 'Platform Engineering'),
  attribute('costCenter', 'base', ''),
  attribute('managerId', 'base', ''),
  attribute('employeeType', 'custom', 'FULL_TIME'),
  attribute('badgeId', 'custom', ''),
];

const config: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
    { key: 'account-state', name: 'Account state' },
  ],
  attrOrder: attributes.map((item) => item.name),
  assign: {
    id: 'identity',
    status: 'account-state',
    login: 'identity',
    firstName: 'identity',
    lastName: 'identity',
    department: 'organization',
    costCenter: 'organization',
    managerId: 'organization',
    employeeType: '',
    badgeId: '',
  },
  hidden: {},
};

/**
 * A locally-stateful host, so a story can demonstrate an edit landing.
 *
 * The tab is deliberately controlled — it never reads the store and emits a
 * `Partial<ProfileDisplayConfig>` per keystroke — which means a story driven by
 * static `args` cannot show a rename actually happening. The modal is what
 * normally applies the patch; this stands in for it and nothing more.
 */
const Controlled: React.FC<{
  attributes: AttributeDescriptor[];
  config: ProfileDisplayConfig;
  onChange: (patch: Partial<ProfileDisplayConfig>) => void;
}> = ({ attributes: items, config: initial, onChange }) => {
  const [current, setCurrent] = useState(initial);
  return (
    <ProfileDisplayCategoriesTab
      attributes={items}
      config={current}
      onChange={(patch) => {
        setCurrent((previous) => ({ ...previous, ...patch }));
        onChange(patch);
      }}
    />
  );
};

/** Layout, the three display toggles, and the admin's own category list. */
const meta = {
  title: 'Users/ProfileDisplayCategoriesTab',
  component: ProfileDisplayCategoriesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Categories half of `ProfileDisplayModal`: how the profile is laid out, what extra ' +
          'marks it carries, and the admin’s own list of categories.\n\n' +
          'Every control is driven by the caller’s config and emits a ' +
          '`Partial<ProfileDisplayConfig>` patch — the tab holds exactly one piece of local state, ' +
          'the half-typed name of a category that does not exist yet. There is no Save, because ' +
          'each patch applies live to the profile pane behind the dialog.\n\n' +
          'The empty-attribute toggle states how many of **this** profile’s attributes are empty on ' +
          '**this** user, rather than describing the feature in the abstract.\n\n' +
          'The reorder arrows are disabled at the list’s ends, and **deleting a category returns ' +
          'its attributes to Uncategorized** — the caption under the list says so, because a ' +
          'category that took its attributes off the profile with it would be a destructive action ' +
          'wearing an editing action’s clothes. The delete handler emits an `assign` patch ' +
          'alongside the shortened list to make that true.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
      },
    },
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-white p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    attributes,
    config,
    onChange: fn(),
  },
  argTypes: {
    attributes: {
      description: 'Every attribute on the profile — the source of the per-category counts.',
    },
    config: { description: 'The configuration being edited.' },
    onChange: { description: 'Emits one patch per edit, applied live by the caller.' },
  },
} satisfies Meta<typeof ProfileDisplayCategoriesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Three categories. The first row's **Move up** and the last row's **Move down**
 * are disabled — the ends of the list are not a place an arrow can go — and the
 * delete caption states what deleting actually does.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Move Identity up' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Move Identity down' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Move Account state down' })).toBeDisabled();

    await expect(canvas.getByRole('button', { name: 'Delete Account state' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Deleting a category returns its attributes to Uncategorized.'),
    ).toBeInTheDocument();
  },
};

/** One category, so both of its arrows are disabled: there is nowhere to move it. */
export const SingleCategory: Story = {
  args: {
    config: { ...config, categories: [{ key: 'identity', name: 'Identity' }] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Move Identity up' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Move Identity down' })).toBeDisabled();
  },
};

/**
 * Nothing filed yet — the first-run state for an org whose admin has not opened
 * this dialog. `Add category` stays disabled until the field has a name in it, so
 * the control never offers to create a nameless category.
 */
export const Empty: Story = {
  args: {
    config: { ...DEFAULT_PROFILE_DISPLAY_CONFIG, categories: [] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Add category' })).toBeDisabled();
  },
};

/**
 * A rename in progress. The name field is the category itself — there is no edit
 * mode and no confirm step, so each keystroke is a patch the pane behind the
 * dialog has already applied.
 */
export const RenameInProgress: Story = {
  render: (args) => (
    <Controlled attributes={args.attributes} config={args.config} onChange={args.onChange} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Category 2 name' });

    await userEvent.clear(field);
    await userEvent.type(field, 'Employment');

    await expect(field).toHaveValue('Employment');
    // The reorder and delete controls follow the new name, so a half-typed
    // rename never leaves an action labelled for a category that no longer exists.
    await expect(canvas.getByRole('button', { name: 'Delete Employment' })).toBeInTheDocument();
  },
};

/** An org that has filed its profile into many categories; the arrows still end at the ends. */
export const ManyCategories: Story = {
  args: {
    config: {
      ...config,
      categories: [
        { key: 'identity', name: 'Identity' },
        { key: 'organization', name: 'Organization' },
        { key: 'account-state', name: 'Account state' },
        { key: 'contact-locale', name: 'Contact & locale' },
        { key: 'employment', name: 'Employment' },
        { key: 'facilities', name: 'Facilities & badging' },
        { key: 'provisioning', name: 'Provisioning' },
      ],
    },
  },
};

/**
 * The 360px floor. Each category row carries a name field, a count, two arrows
 * and a delete — the field is the only thing that may shrink, so the controls
 * stay pressable at the panel's narrowest.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
