import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import UserProfileAttributeList from './UserProfileAttributeList';
import type { AttributeDescriptor } from './profileAttributes';
import type { AttributeEditCell } from '../../hooks/useProfileEdit';

const attribute = (
  name: string,
  label: string,
  kind: AttributeDescriptor['kind'],
  value: string,
  mono = false,
): AttributeDescriptor => ({
  key: kind === 'system' ? name : `profile.${name}`,
  name,
  label,
  kind,
  value,
  raw: value,
  isEmpty: value === '',
  ...(mono ? { mono: true } : {}),
});

/** One category block's worth of attributes: system, base and custom, with an empty one. */
const attributes: AttributeDescriptor[] = [
  attribute('id', 'User ID', 'system', '00uFAKE00000000000001', true),
  attribute('login', 'Login', 'base', 'user@example.com'),
  attribute('firstName', 'First Name', 'base', 'Ada'),
  attribute('lastName', 'Last Name', 'base', 'Lovelace'),
  attribute('department', 'Department', 'base', 'Platform Engineering'),
  attribute('costCenter', 'Cost Center', 'base', ''),
  attribute('employeeType', 'Employee Type', 'custom', 'FULL_TIME'),
];

/**
 * The two attributes that broke the card this component replaces: a street
 * address and a long login, clipped by fixed-width tiles with no way to see the
 * rest. Both must wrap here, in every layout.
 */
const longValues: AttributeDescriptor[] = [
  attribute(
    'streetAddress',
    'Street Address',
    'base',
    'Flat 12, Whitfield House, 145 Great Portland Street, Fitzrovia, London, W1W 6QQ, United Kingdom',
  ),
  attribute('login', 'Login', 'base', 'ada.lovelace.platform.engineering.contractor@example.com'),
  attribute(
    'externalIdentifier',
    'External Identifier',
    'custom',
    'urn:example:hr:worker:0000000000000000000000000000000000000042',
    true,
  ),
];

/**
 * The cells `useProfileEdit` hands down in edit mode. `department` is a plain
 * text field, `employeeType` a schema `select`, `costCenter` carries a
 * validation message, and `id` is locked.
 *
 * A locked cell has **no `onChange`**, exactly as `useProfileEdit` builds it —
 * and `onChange` is `ProfileEditCell`'s mode switch, so a locked attribute
 * renders as its plain read-only value here rather than as the lock-plus-reason
 * state that cell can also draw. The distinction on screen is that its
 * neighbours have grown a control and it has not.
 *
 * `onChange` is a spy rather than real state: these stories are about which
 * state each `<dd>` swaps to, not about typing.
 */
const editCells: Readonly<Record<string, AttributeEditCell>> = {
  id: {
    name: 'id',
    editability: {
      editable: false,
      reason: 'system',
      explanation: 'This is a system field, not a profile attribute, so it cannot be edited here.',
    },
    dirty: false,
  },
  department: {
    name: 'department',
    editability: { editable: true, control: 'text', required: false },
    draft: 'Identity Platform',
    dirty: true,
    onChange: fn(),
  },
  employeeType: {
    name: 'employeeType',
    editability: {
      editable: true,
      control: 'select',
      required: false,
      options: [
        { value: 'FULL_TIME', label: 'Full time' },
        { value: 'CONTRACTOR', label: 'Contractor' },
      ],
    },
    dirty: false,
    onChange: fn(),
  },
  costCenter: {
    name: 'costCenter',
    editability: { editable: true, control: 'text', required: true },
    draft: '',
    dirty: true,
    invalid: 'Okta requires a value for this attribute.',
    onChange: fn(),
  },
};

/** Attribute name → the group rules that read it. */
const ruleReads: Record<string, string[]> = {
  department: ['Platform engineers'],
  employeeType: ['Full-time staff', 'Badge holders', 'Payroll sync'],
};

/** One category block of profile attributes, in the admin's chosen layout. */
const meta = {
  title: 'Users/UserProfileAttributeList',
  component: UserProfileAttributeList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The label/value half of `UserProfilePane`: one category block, in whichever of the three ' +
          'layouts the admin chose.\n\n' +
          '**No truncation, ever.** The card this replaces laid attributes out as fixed two-column ' +
          'tiles and clipped anything that did not fit — which meant a street address and a long ' +
          'login, the two attributes most likely to be *why* an admin opened the profile, were the ' +
          'two that could not be read. Every layout here wraps (`break-words` + `text-pretty`) and ' +
          'the value takes whatever height it needs. A future `truncate` here would be a regression, ' +
          'not a tidy-up.\n\n' +
          'The layout decision is one `Record<layout, string>` lookup rather than three branches: ' +
          '`rows` is a wide label column beside a value, `compact` narrows the column and the gap, ' +
          'and `grid` becomes `auto-fit` cards that hold two per line at the 360px floor and grow ' +
          'to three or four when the panel is docked wider.\n\n' +
          'Rendered as a `<dl>`, so each label is programmatically tied to its value rather than ' +
          'merely sitting to its left — which is what makes the pane readable in a screen ' +
          "reader's list-of-terms view. An empty attribute renders `—` with a `No value` tooltip " +
          'rather than a blank line.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
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
    layout: 'rows',
    showApiNames: false,
    showRuleChips: true,
    ruleReads,
  },
  argTypes: {
    attributes: {
      description: "One category block's attributes, already filtered and in display order.",
    },
    layout: {
      description: 'Which of the three presentations to render.',
      control: 'inline-radio',
      options: ['rows', 'compact', 'grid'],
    },
    showApiNames: {
      description: 'Show the Okta attribute name (`department`, in mono) instead of its label.',
    },
    showRuleChips: { description: 'Whether the "read by rules" chips render at all.' },
    ruleReads: {
      description:
        'Attribute name → the rules that read it. An attribute absent from the map gets no chip.',
    },
    cells: {
      description:
        'Attribute name → its edit cell while the surface is editing. Absent is the read-only path.',
    },
  },
} satisfies Meta<typeof UserProfileAttributeList>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// The three layouts
// ---------------------------------------------------------------------------

/** `rows` — a wide label column beside the value. The default, and the readable one. */
export const RowsLayout: Story = {
  args: { layout: 'rows' },
};

/** `compact` — the same shape with a narrower label column and a tighter gap. */
export const CompactLayout: Story = {
  args: { layout: 'compact' },
};

/** `grid` — `auto-fit` cards, label above value, two per line at the panel floor. */
export const GridLayout: Story = {
  args: { layout: 'grid' },
};

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * `costCenter` has no value on this user. It renders an em dash carrying a
 * `No value` tooltip — a stated absence, not a blank the reader has to interpret.
 */
export const EmptyValue: Story = {
  args: { attributes: [attributes[4], attributes[5]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('No value')).toBeInTheDocument();
  },
};

/**
 * The regression this component exists to prevent: long, unbroken values. In
 * `rows` they wrap over as many lines as they need — nothing here truncates.
 */
export const LongValues: Story = {
  args: { attributes: longValues, layout: 'rows' },
};

/** The same long values in `grid`, where the card grows rather than clipping. */
export const LongValuesInGrid: Story = {
  args: { attributes: longValues, layout: 'grid' },
};

// ---------------------------------------------------------------------------
// Marks and names
// ---------------------------------------------------------------------------

/** `showApiNames` off: the human label from the org's schema. */
export const HumanLabels: Story = {
  args: { showApiNames: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Department')).toBeInTheDocument();
  },
};

/** `showApiNames` on: the Okta name, in mono — what a rule expression references. */
export const ApiNames: Story = {
  args: { showApiNames: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('department')).toBeInTheDocument();
  },
};

/**
 * The rules chip. It never says "rules" for one — `department` is read by a
 * single rule and `employeeType` by three, and the tooltip names them.
 */
export const WithRuleChips: Story = {
  args: { showRuleChips: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 rule')).toBeInTheDocument();
    await expect(canvas.getByText('3 rules')).toBeInTheDocument();
  },
};

/** The same block with the chips turned off — the admin's own display toggle. */
export const WithoutRuleChips: Story = {
  args: { showRuleChips: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('1 rule')).toBeNull();
  },
};

/**
 * The 360px floor, in `rows`, with the values that used to be clipped. The label
 * column holds its width and the value wraps beside it; the `grid` layout is the
 * one that reflows to two cards per line here.
 */
export const Compact: Story = {
  args: {
    // `login` appears in both fixtures; the long one is the interesting one here.
    attributes: [...attributes.filter((item) => item.name !== 'login'), ...longValues],
    layout: 'rows',
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

/**
 * Edit mode. Only the attributes with a cell swap their `<dd>` for a control —
 * `login` and `firstName` have none here and render exactly as they do in read
 * mode, which is the property that keeps the no-truncation contract above a
 * fact about this file rather than about whichever branch ran.
 *
 * `costCenter` is required and empty, so it carries its validation message;
 * `employeeType` is a schema `select`; `id` is locked and therefore has no
 * control at all.
 */
export const Editing: Story = {
  args: { cells: editCells },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // An editable attribute becomes a control named for its label.
    await expect(canvas.getByRole('textbox', { name: 'Department' })).toHaveValue(
      'Identity Platform',
    );
    await expect(canvas.getByRole('combobox', { name: 'Employee Type' })).toBeInTheDocument();

    // A drafted value that fails validation says so beside its own control.
    await expect(canvas.getByText('Okta requires a value for this attribute.')).toBeInTheDocument();

    // A locked attribute grows no control — it stays the value it already was.
    await expect(canvas.queryByRole('textbox', { name: 'User ID' })).not.toBeInTheDocument();
    await expect(canvas.getByText('00uFAKE00000000000001')).toBeInTheDocument();

    // An attribute with no cell is untouched by edit mode.
    await expect(canvas.getByText('user@example.com')).toBeInTheDocument();
  },
};

/** The same cells in `grid`, where each control fills its card. */
export const EditingInGrid: Story = {
  args: { cells: editCells, layout: 'grid' },
};

/** Edit mode at the 360px floor: the controls take the full value column. */
export const EditingNarrow: Story = {
  args: { cells: editCells },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
