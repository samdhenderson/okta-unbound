import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import ProfileDisplayAttributeRow from './ProfileDisplayAttributeRow';
import type { AttributeCategoryOption } from './ProfileDisplayAttributeRow';
import type { AttributeDescriptor } from './profileAttributes';

const attribute = (
  name: string,
  kind: AttributeDescriptor['kind'],
  value: string,
  label = name,
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label,
  kind,
  value,
  raw: value,
  isEmpty: value === '',
});

/** Uncategorized plus the admin's own categories, in display order. */
const categoryOptions: AttributeCategoryOption[] = [
  { value: '', label: 'Uncategorized' },
  { value: 'identity', label: 'Identity' },
  { value: 'organization', label: 'Organization' },
  { value: 'account-state', label: 'Account state' },
];

const department = attribute('department', 'base', 'Platform Engineering', 'Department');
const emptyOnThisUser = attribute('costCenter', 'base', '', 'Cost Center');
const systemAttribute = attribute('lastLogin', 'system', 'Aug 17, 2026', 'Last Login');
const customAttribute = attribute('employeeType', 'custom', 'FULL_TIME', 'Employee Type');

/** An org-defined attribute with a name long enough to need the row's truncation. */
const longApiName = attribute(
  'workdayIntegrationExternalWorkerIdentifier',
  'custom',
  'urn:example:hr:worker:0000000000000000000000000000000000000042',
  'Workday Integration External Worker Identifier',
);

/** One attribute's row inside the Attributes tab of the profile-display dialog. */
const meta = {
  title: 'Users/ProfileDisplayAttributeRow',
  component: ProfileDisplayAttributeRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One configurable attribute: show/hide, its Okta api name, where it came from, whether a ' +
          'group rule reads it, a value preview, its category, and its position within that ' +
          'category.\n\n' +
          'Purely presentational — every control is driven by props and every edit leaves through a ' +
          'callback keyed by the attribute’s **Okta name**, so the parent can emit one whole-record ' +
          'patch rather than the row learning what a `ProfileDisplayConfig` is.\n\n' +
          '**A hidden row stays in the list, dimmed.** Removing the row of an attribute you just ' +
          'unticked is how an attribute becomes unfindable: the only control that could bring it ' +
          'back would have left the screen with it.\n\n' +
          'The api name is rendered in mono, because it is the string a **rule expression** ' +
          'references — the human label rides on its `title`. An attribute with no value on this ' +
          'user says `empty on this user` in italic rather than leaving the line blank.\n\n' +
          'The row carries no border of its own: the separators belong to the parent list ' +
          '(`divide-y`), which is ADR-0029’s second sanctioned pattern for a dense list inside one ' +
          'bordered container.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
      },
    },
  },
  // The parent supplies the bordered container and the row separators; without it
  // the row floats on the page background and reads as a different component.
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas p-4">
        <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    attribute: department,
    categoryKey: 'organization',
    categoryOptions,
    isHidden: false,
    canMoveUp: true,
    canMoveDown: true,
    ruleNames: [],
    onToggleVisible: fn(),
    onAssign: fn(),
    onMove: fn(),
  },
  argTypes: {
    attribute: { description: 'The attribute this row describes.' },
    categoryKey: { description: "The category it is filed under; `''` is Uncategorized." },
    categoryOptions: {
      description: 'Uncategorized plus the admin’s categories, in display order.',
    },
    isHidden: { description: 'Whether the attribute is hidden from the profile pane.' },
    canMoveUp: { description: '`false` when it is already first **within its category**.' },
    canMoveDown: { description: '`false` when it is already last **within its category**.' },
    ruleNames: { description: 'Rules that read this attribute; empty means no mark.' },
    onToggleVisible: { description: 'Called with the attribute name and whether it should show.' },
    onAssign: { description: 'Called with the attribute name and its new category key.' },
    onMove: {
      description: 'Called with the attribute name and `-1`/`1` — within its category only.',
    },
  },
} satisfies Meta<typeof ProfileDisplayAttributeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ticked, filed, and free to move in either direction within its category. */
export const Default: Story = {};

/** Ticked: the attribute shows on the profile pane. */
export const Checked: Story = {
  args: { isHidden: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', { name: 'Show department' })).toBeChecked();
  },
};

/**
 * Unticked. The row is dimmed **in place** rather than removed, so the tickbox
 * that brings it back is still where the reader left it.
 */
export const Hidden: Story = {
  args: { isHidden: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', { name: 'Show department' })).not.toBeChecked();
    // Dimmed, not gone: every control is still reachable.
    await expect(canvas.getByRole('combobox', { name: 'Category for department' })).toBeEnabled();
  },
};

/**
 * The user has no value for this attribute. The row still renders and says so in
 * italic — a stated absence, distinct from an attribute that does not exist.
 */
export const EmptyOnThisUser: Story = {
  args: { attribute: emptyOnThisUser, categoryKey: 'organization' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('empty on this user')).toBeInTheDocument();
  },
};

/** A group rule reads this attribute, so it carries the `rules` chip and names them on hover. */
export const WithRulesChip: Story = {
  args: { ruleNames: ['Platform engineers', 'Badge holders'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('rules')).toBeInTheDocument();
    await expect(
      canvas.getByTitle('Read by Platform engineers, Badge holders'),
    ).toBeInTheDocument();
  },
};

/** A `system` attribute: a top-level user field, not part of the profile object at all. */
export const SystemAttribute: Story = {
  args: { attribute: systemAttribute, categoryKey: 'account-state' },
};

/** A `custom` attribute the admin has not filed yet — `Uncategorized` is a real choice, not a gap. */
export const Uncategorized: Story = {
  args: { attribute: customAttribute, categoryKey: '' },
};

/**
 * First and last within its own category, so both arrows are disabled. That is
 * the category's ends, not the list's — the attribute above it on screen may
 * belong to a different category entirely.
 */
export const AtCategoryEnds: Story = {
  args: { canMoveUp: false, canMoveDown: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Move department up' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Move department down' })).toBeDisabled();
  },
};

/**
 * A long api name in mono. It truncates into the fixed-width category control
 * rather than pushing the arrows off the row; the human label rides on `title`.
 */
export const LongApiName: Story = {
  args: { attribute: longApiName, categoryKey: '', ruleNames: ['Contractor offboarding'] },
};

/**
 * The 360px floor. The category `Select` steps down a size here, which is what
 * leaves the api name something to truncate into instead of nothing.
 */
export const Compact: Story = {
  args: { attribute: longApiName, categoryKey: '', ruleNames: ['Contractor offboarding'] },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
