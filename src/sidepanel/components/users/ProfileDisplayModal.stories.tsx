import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ProfileDisplayModal from './ProfileDisplayModal';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

const attribute = (
  name: string,
  kind: AttributeDescriptor['kind'],
  value: string,
  mono = false,
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label: name,
  kind,
  value,
  raw: value,
  isEmpty: value === '',
  ...(mono ? { mono: true } : {}),
});

/** A small but representative profile: system, base and custom, with an empty one. */
const attributes: AttributeDescriptor[] = [
  attribute('id', 'system', '00uFAKE0001', true),
  attribute('status', 'system', 'ACTIVE'),
  attribute('lastLogin', 'system', 'Mar 4, 2026'),
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

/** Open the Attributes tab, which is where the per-attribute controls live. */
const showAttributesTab = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('tab', { name: /Attributes/ }));
  await expect(canvas.getByRole('searchbox', { name: 'Find an attribute' })).toBeVisible();
};

/**
 * The "Configure profile display" dialog — where an admin defines their own
 * attribute categories and decides which attributes appear, in which category,
 * in what order.
 */
const meta = {
  title: 'Users/ProfileDisplayModal',
  component: ProfileDisplayModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Where an admin defines their own attribute categories and decides which attributes appear, in which category, in what order.\n\n' +
          'A **controlled** component: it never reads the store itself. It takes the reconciled `ProfileDisplayConfig` as a prop and emits every edit as a `Partial<ProfileDisplayConfig>` patch, which is what lets an edit apply live to the profile pane behind the dialog — there is no Save.\n\n' +
          'The **Categories** tab carries layout, the three display toggles (the empty-attribute toggle states how many of *this* profile’s attributes are empty on *this* user), and the category list itself: rename in place, reorder, delete. Deleting a category returns its attributes to Uncategorized rather than hiding them.\n\n' +
          'The **Attributes** tab lists every attribute on the profile — including the empty ones and the hidden ones. Unticking a row dims it in place instead of removing it, because a row that vanishes when you untick it is unfindable afterwards; the arrows reorder an attribute **within its category** and are disabled at that category’s ends.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    attributes,
    config,
    onChange: fn(),
    onReset: fn(),
    ruleReads,
  },
  argTypes: {
    isOpen: {
      description: 'Whether the dialog is open; the shared `Modal` renders nothing when false.',
    },
    onClose: { description: 'Called on Done, Escape, overlay click, or the header close button.' },
    attributes: {
      description: 'Every attribute on the profile, including the empty ones.',
    },
    config: { description: 'The reconciled configuration being edited.' },
    onChange: {
      description: 'Emits one `Partial<ProfileDisplayConfig>` patch per edit, applied live.',
    },
    onReset: { description: 'Discards the org’s configuration and returns to the defaults.' },
    ruleReads: {
      description:
        'Attribute name → the group rules that read it; drives the rule marks and filter.',
    },
  },
} satisfies Meta<typeof ProfileDisplayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on the Categories tab: layout, the display toggles, and the category list. */
export const Default: Story = {};

/**
 * The Attributes tab. `costCenter`, `managerId` and `badgeId` have no value on
 * this user and say so in italics rather than rendering a blank line;
 * `department` and `employeeType` carry the "read by rules" mark.
 */
export const AttributesTab: Story = {
  play: showAttributesTab,
};

/**
 * Two attributes have been unticked. Their rows stay in place, dimmed and
 * unticked — the count line is the honest summary ("2 hidden"), and the control
 * that brings them back never leaves the screen.
 */
export const HiddenAttributes: Story = {
  args: {
    config: { ...config, hidden: { costCenter: true, badgeId: true } },
  },
  play: showAttributesTab,
};

/**
 * An org that has filed its profile into many categories. The list grows
 * downwards inside the modal's own scroller; the per-row arrows are still
 * disabled at the ends.
 */
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
        { key: 'custom', name: 'Custom attributes' },
      ],
    },
  },
};

/**
 * Nothing has been filed yet: every attribute is Uncategorized, which is the
 * first-run state for an org whose admin has not opened this dialog before.
 */
export const Unconfigured: Story = {
  args: {
    config: { ...DEFAULT_PROFILE_DISPLAY_CONFIG, attrOrder: attributes.map((item) => item.name) },
  },
  play: showAttributesTab,
};

/**
 * The 360px floor. An attribute row carries a checkbox, a category `Select` and
 * two arrows, so this is the width where the row has to hold together — the api
 * name and the value preview truncate, the controls do not shrink.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  play: showAttributesTab,
};
