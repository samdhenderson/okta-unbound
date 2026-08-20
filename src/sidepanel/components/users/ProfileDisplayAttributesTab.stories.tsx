import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ProfileDisplayAttributesTab from './ProfileDisplayAttributesTab';
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

/** A small but representative profile: system, base and custom, with empty ones. */
const attributes: AttributeDescriptor[] = [
  attribute('id', 'system', '00uFAKE00000000000001'),
  attribute('status', 'system', 'ACTIVE'),
  attribute('lastLogin', 'system', 'Aug 17, 2026'),
  attribute('login', 'base', 'user@example.com'),
  attribute('email', 'base', 'user@example.com'),
  attribute('firstName', 'base', 'Ada'),
  attribute('lastName', 'base', 'Lovelace'),
  attribute('department', 'base', 'Platform Engineering'),
  attribute('costCenter', 'base', ''),
  attribute('managerId', 'base', ''),
  attribute('employeeType', 'custom', 'FULL_TIME'),
  attribute('badgeId', 'custom', ''),
];

/** An org whose schema has grown well past what fits in the tab's 300px scroller. */
const manyAttributes: AttributeDescriptor[] = [
  ...attributes,
  ...Array.from({ length: 24 }, (_, index) =>
    attribute(`customField${String(index + 1).padStart(2, '0')}`, 'custom', `value-${index + 1}`),
  ),
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
    lastLogin: 'account-state',
    login: 'identity',
    email: 'identity',
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

const ruleReads: Record<string, string[]> = {
  department: ['Platform engineers'],
  employeeType: ['Full-time staff', 'Badge holders'],
};

/** Every attribute on the profile, its visibility, its category and its position. */
const meta = {
  title: 'Users/ProfileDisplayAttributesTab',
  component: ProfileDisplayAttributesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Attributes half of `ProfileDisplayModal`: every attribute on the profile — including ' +
          'the empty ones and the hidden ones — with whether it shows, which category it sits in, ' +
          'and where within that category.\n\n' +
          '**The list is every attribute; filtering is a view over it, never a deletion from it.** ' +
          'The pills narrow by source (`Base`, `Custom`, `System`), by whether an attribute is still ' +
          'unfiled, and by whether a group rule reads it. Filtered down to nothing, the tab says so ' +
          'in a sentence rather than showing an empty box.\n\n' +
          '**Unticking a row dims it in place.** Removing the row of an attribute you just unticked ' +
          'is how an attribute becomes unfindable: the only control that could bring it back would ' +
          'have left the screen with it. The count line above is the honest summary.\n\n' +
          '**Order is one global array partitioned by category.** Moving an attribute "up" swaps it ' +
          'with the previous attribute *in its own category*, which may be several rows above it on ' +
          'screen — so the arrows are disabled at that category’s ends, not at the list’s ends.\n\n' +
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
    ruleReads,
  },
  argTypes: {
    attributes: { description: 'Every attribute on the profile, including the empty ones.' },
    config: { description: 'The configuration being edited.' },
    onChange: { description: 'Emits one patch per edit, applied live by the caller.' },
    ruleReads: {
      description: 'Attribute name → the group rules that read it. Absent means rules are unknown.',
    },
  },
} satisfies Meta<typeof ProfileDisplayAttributesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole list, unfiltered, with the search field and the six filter pills above it. */
export const Default: Story = {};

/** The pills, exercised: `Custom` narrows to the org-defined attributes only. */
export const FilteredToCustom: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Custom' }));

    await expect(canvas.getByText('employeeType')).toBeInTheDocument();
    await expect(canvas.queryByText('department')).toBeNull();
  },
};

/** `Read by rules` — the attributes a group rule actually consults to decide membership. */
export const FilteredToRuleReaders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Read by rules' }));

    await expect(canvas.getByText('department')).toBeInTheDocument();
    await expect(canvas.getByText('employeeType')).toBeInTheDocument();
    await expect(canvas.queryByText('firstName')).toBeNull();
  },
};

/** `Uncategorized` — what the admin has not filed yet, counted in the pill itself. */
export const FilteredToUncategorized: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Uncategorized 2' }));

    await expect(canvas.getByText('badgeId')).toBeInTheDocument();
    await expect(canvas.queryByText('login')).toBeNull();
  },
};

/**
 * Filtered to nothing. The tab states it in a sentence — an empty scroller would
 * read as "this profile has no attributes", which is a different and untrue fact.
 */
export const FilteredToNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Find an attribute' }),
      'no-such-attribute',
    );

    await expect(canvas.getByText('No attributes match this filter.')).toBeInTheDocument();
  },
};

/**
 * Two attributes unticked. Their rows stay exactly where they were, dimmed and
 * unticked, and the count line above says `2 hidden` — the control that brings
 * them back never leaves the screen.
 */
export const HiddenRowsStayInPlace: Story = {
  args: {
    config: { ...config, hidden: { costCenter: true, badgeId: true } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Still present, still in order, and the checkbox is the way back.
    await expect(canvas.getByRole('checkbox', { name: 'Show costCenter' })).not.toBeChecked();
    await expect(canvas.getByRole('checkbox', { name: 'Show login' })).toBeChecked();
    await expect(canvas.getByText('2 uncategorized · 2 hidden')).toBeInTheDocument();
  },
};

/**
 * An org with a large profile schema. The list grows inside the tab's own
 * scroller rather than pushing the search field and the pills off screen —
 * the filter has to stay reachable from the bottom of a long list.
 */
export const LongList: Story = {
  args: {
    attributes: manyAttributes,
    config: { ...config, attrOrder: manyAttributes.map((item) => item.name) },
  },
};

/** No rules payload, so no attribute carries a chip — absent is not "read by none". */
export const WithoutRuleReads: Story = {
  args: { ruleReads: undefined },
};

/**
 * The 360px floor. Each row carries a checkbox, an api name, a kind, a value
 * preview, a category `Select` and two arrows — the api name and the value are
 * what truncate; the controls do not shrink.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
