import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import ProfileEditCell from './ProfileEditCell';
import type { AttributeDescriptor } from './profileAttributes';
import type { AttributeEditability } from './profileEditability';

/** A profile attribute descriptor, as `allProfileAttributes` would emit it. */
const attribute = (
  name: string,
  label: string,
  value: string,
  kind: AttributeDescriptor['kind'] = 'base',
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label,
  kind,
  value,
  raw: value,
  isEmpty: value === '',
});

/** An editable verdict from `attributeEditability`. */
const editable = (
  control: 'text' | 'number' | 'select' | 'checkbox',
  extras: { options?: { value: string; label: string }[]; required?: boolean } = {},
): AttributeEditability => ({
  editable: true,
  control,
  required: extras.required ?? false,
  ...(extras.options ? { options: extras.options } : {}),
});

/** A locked verdict from `attributeEditability`. */
const locked = (
  reason: Extract<AttributeEditability, { editable: false }>['reason'],
  explanation: string,
  source?: string,
): AttributeEditability => ({
  editable: false,
  reason,
  explanation,
  ...(source ? { source } : {}),
});

const department = attribute('department', 'Department', 'Platform Engineering');
const login = attribute('login', 'Username', 'ada.example@example.com');

/** A value long enough that any `truncate` in this cell would hide the point of it. */
const streetAddress = attribute(
  'streetAddress',
  'Street Address',
  '4400 Northwest Cornelius Pass Road, Building 12, Suite 1400, Hillsboro, Oregon 97124',
);

/**
 * One profile attribute's value cell, shared by the Profile pane and the Compare
 * view.
 */
const meta = {
  title: 'Users/ProfileEditCell',
  component: ProfileEditCell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One attribute’s **value cell**, in whichever of three states applies: read-only, an ' +
          'editable control, or locked with the reason said out loud.\n\n' +
          '`onChange` is the mode switch. Absent, the cell renders the saved value read-only — ' +
          'which is every attribute outside edit mode. Present, an editable attribute gets the ' +
          'control its schema type calls for (`Input`, `Select`, `Checkbox`, or `Input type="number"`), ' +
          'and a locked one gets its value dimmed behind a padlock plus a sentence saying who owns ' +
          'it. **A lock is visible and explained, never a silently disabled field.**\n\n' +
          'The cell renders the value only, never the label: its two surfaces disagree about what a ' +
          'label is, so the control takes its accessible name from the attribute’s label through ' +
          '`ariaLabel`. Values wrap rather than truncate — a long login and a street address are ' +
          'exactly what an admin opened the profile to read.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
      },
    },
  },
  // The surfaces put this cell inside a white card on the canvas; without one it
  // floats on the page background and its dimmed states read as broken.
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas p-4">
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    attribute: department,
    editability: editable('text'),
  },
  argTypes: {
    attribute: { description: 'The attribute whose value this cell renders.' },
    editability: {
      description: 'The verdict from `attributeEditability` — how to edit, or why not.',
    },
    draft: { description: 'The in-flight value; absent means this attribute is untouched.' },
    onChange: {
      description: 'Present only in edit mode. Absent renders the cell read-only.',
    },
    invalid: { description: 'Validation message for this attribute, from `validateDraft`.' },
    mono: { description: 'Render the value in a monospace font (ids and similar).' },
  },
} satisfies Meta<typeof ProfileEditCell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Outside edit mode: the saved value, no control, whatever the verdict says. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Platform Engineering')).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
};

/** The user has no value for this attribute. An em dash states the absence. */
export const Empty: Story = {
  args: { attribute: attribute('costCenter', 'Cost Center', '') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('No value')).toBeInTheDocument();
  },
};

/** Read-only, in monospace — how an identifier-shaped attribute renders. */
export const Mono: Story = {
  args: { attribute: attribute('employeeNumber', 'Employee Number', 'E-0000042'), mono: true },
};

/** Edit mode, free text. The field takes its accessible name from the attribute's label. */
export const Editing: Story = {
  args: { onChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Department' })).toHaveValue(
      'Platform Engineering',
    );
  },
};

/** A draft differing from the saved value — what the surface's Save button is armed by. */
export const Dirty: Story = {
  args: { onChange: fn(), draft: 'Security Engineering' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Department' })).toHaveValue(
      'Security Engineering',
    );
  },
};

/** A validation message, rendered through `Input`'s own error state rather than beside it. */
export const ErrorState: Story = {
  args: {
    attribute: attribute('seats', 'Seats', '5'),
    editability: editable('number'),
    onChange: fn(),
    draft: '12abc',
    invalid: 'Enter a number.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Enter a number.')).toBeInTheDocument();
  },
};

/** A number attribute: the same field, typed, so a phone keypad and the spinners appear. */
export const NumberField: Story = {
  args: {
    attribute: attribute('seats', 'Seats', '5'),
    editability: editable('number'),
    onChange: fn(),
  },
};

/** An attribute the schema enumerates, with the `oneOf` titles as the option labels. */
export const SelectField: Story = {
  args: {
    attribute: attribute('region', 'Region', 'EMEA'),
    editability: editable('select', {
      options: [
        { value: 'EMEA', label: 'Europe, Middle East & Africa' },
        { value: 'AMER', label: 'Americas' },
      ],
    }),
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', { name: 'Region' })).toHaveValue('EMEA');
  },
};

/**
 * A saved value the schema no longer enumerates. The cell keeps it as an option
 * rather than letting the `<select>` silently display a different one.
 */
export const SelectWithRetiredValue: Story = {
  args: {
    attribute: attribute('region', 'Region', 'LATAM'),
    editability: editable('select', {
      options: [
        { value: 'EMEA', label: 'Europe, Middle East & Africa' },
        { value: 'AMER', label: 'Americas' },
      ],
    }),
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', { name: 'Region' })).toHaveValue('LATAM');
  },
};

/** A boolean attribute. The tickbox is bare — the surface already renders the label. */
export const CheckboxField: Story = {
  args: {
    attribute: attribute('isContractor', 'Is Contractor', 'true'),
    editability: editable('checkbox'),
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', { name: 'Is Contractor' })).toBeChecked();
  },
};

/** A top-level account field. Not a profile attribute at all, so there is nothing to edit. */
export const LockedSystem: Story = {
  args: {
    attribute: attribute('lastLogin', 'Last Login', 'Aug 17, 2026', 'system'),
    editability: locked(
      'system',
      'This is an account field rather than a profile attribute, so it is not edited here.',
    ),
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/not edited here/)).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
};

/** The org's schema never described it, so its type and mastering are both unknown. */
export const LockedNotInSchema: Story = {
  args: {
    attribute: attribute('legacyWorkerFlag', 'Legacy Worker Flag', 'Y', 'custom'),
    editability: locked(
      'not-in-schema',
      "The org's profile schema does not describe this attribute, so this panel will not write to it.",
    ),
    onChange: fn(),
  },
};

/** Okta reports the attribute as read-only. */
export const LockedReadOnly: Story = {
  args: {
    attribute: attribute('userType', 'User Type', 'EMPLOYEE'),
    editability: locked(
      'read-only',
      'Okta reports this attribute as read-only, so it is changed elsewhere.',
    ),
    onChange: fn(),
  },
};

/** Okta accepts a value but never returns one, so there is no before-value to edit against. */
export const LockedWriteOnly: Story = {
  args: {
    attribute: attribute('externalSecretRef', 'External Secret Ref', ''),
    editability: locked(
      'write-only',
      'Okta accepts a value for this attribute but never returns one, so there is nothing here to edit against.',
    ),
    onChange: fn(),
  },
};

/** A profile master owns the attribute; a write here would be overwritten at the next import. */
export const LockedExternallyMastered: Story = {
  args: {
    editability: locked(
      'externally-mastered',
      'An external system masters this attribute (Active Directory), so a change made here would be overwritten at the next import.',
      'Active Directory',
    ),
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Active Directory/)).toBeInTheDocument();
  },
};

/**
 * `login` is a credential, so the **account's** provider decides it. Mastered
 * outside Okta, the sign-in name is changed there rather than here.
 */
export const LockedAccountMastered: Story = {
  args: {
    attribute: login,
    editability: locked(
      'account-mastered',
      'This account is mastered by Active Directory, so the sign-in name is changed there rather than here.',
      'Active Directory',
    ),
    onChange: fn(),
  },
};

/** A multi-value attribute. Editing it needs a repeater this panel does not have. */
export const LockedUnsupportedType: Story = {
  args: {
    attribute: attribute('aliases', 'Aliases', 'ada,ada.example', 'custom'),
    editability: locked('unsupported-type', 'This panel does not edit array attributes.'),
    onChange: fn(),
  },
};

/** A long value wraps rather than truncating — the defect this cell's contract exists to prevent. */
export const LongValue: Story = {
  args: { attribute: streetAddress },
};

/**
 * The 360px floor, mid-edit. The field and the lock sentence both wrap into the
 * panel's narrowest width rather than clipping.
 */
export const Compact: Story = {
  args: {
    attribute: streetAddress,
    editability: locked(
      'externally-mastered',
      'An external system masters this attribute (Active Directory), so a change made here would be overwritten at the next import.',
      'Active Directory',
    ),
    onChange: fn(),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
