import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import UserProfilePane from './UserProfilePane';
import type { ProfileEditControls } from './UserProfilePaneHeader';
import type { AttributeDescriptor } from './profileAttributes';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeEditCell } from '../../hooks/useProfileEdit';

/** A profile attribute the user has a value for. */
const attr = (
  name: string,
  label: string,
  value: string,
  over: Partial<AttributeDescriptor> = {},
): AttributeDescriptor => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  value,
  raw: value,
  isEmpty: value === '',
  ...over,
});

/** A top-level (non-profile) field. */
const system = (
  name: string,
  label: string,
  value: string,
  over: Partial<AttributeDescriptor> = {},
): AttributeDescriptor => attr(name, label, value, { key: name, kind: 'system', ...over });

/**
 * A deliberately awkward profile: a long login and a long street address — the two
 * values the tile layout this pane replaces used to clip — plus two attributes the
 * org defines but this user has never filled in.
 */
const ATTRIBUTES: AttributeDescriptor[] = [
  system('id', 'User ID', '00uFAKE0001', { mono: true }),
  system('status', 'Status', 'ACTIVE'),
  system('created', 'Created', '12 Mar 2021'),
  system('lastLogin', 'Last Login', '4 Aug 2026'),
  attr('login', 'Login', 'samantha.henderson-oconnell@corporate.example.com'),
  attr('email', 'Email', 'user@example.com'),
  attr('firstName', 'First Name', 'Samantha'),
  attr('lastName', 'Last Name', 'Henderson-O’Connell'),
  attr('displayName', 'Display Name', ''),
  attr('secondEmail', 'Second Email', ''),
  attr('department', 'Department', 'Engineering'),
  attr('title', 'Title', 'Staff Platform Engineer'),
  attr('manager', 'Manager', 'manager@example.com'),
  attr('division', 'Division', 'Product Engineering'),
  attr(
    'streetAddress',
    'Street Address',
    '1200 Northwest Continental Boulevard, Building 4, Suite 1750',
  ),
  attr('city', 'City', 'Vancouver'),
  attr('state', 'State', 'Washington'),
  attr('zipCode', 'Zip Code', '98660'),
  attr('countryCode', 'Country Code', 'US'),
  attr('costCenter', 'Cost Center', 'CC-4471', { kind: 'custom' }),
  attr('employeeType', 'Employee Type', 'Full-time', { kind: 'custom' }),
];

/**
 * An admin's configuration: four categories, `state` hidden, and two custom
 * attributes left unfiled so the Uncategorized block has something in it.
 */
const CONFIG: ProfileDisplayConfig = {
  layout: 'rows',
  showApiNames: false,
  showRuleChips: true,
  showEmpty: false,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
    { key: 'account-state', name: 'Account state' },
    { key: 'contact-locale', name: 'Contact & locale' },
  ],
  assign: {
    id: 'identity',
    login: 'identity',
    email: 'identity',
    firstName: 'identity',
    lastName: 'identity',
    displayName: 'identity',
    department: 'organization',
    title: 'organization',
    manager: 'organization',
    division: 'organization',
    status: 'account-state',
    created: 'account-state',
    lastLogin: 'account-state',
    secondEmail: 'contact-locale',
    streetAddress: 'contact-locale',
    city: 'contact-locale',
    state: 'contact-locale',
    zipCode: 'contact-locale',
    countryCode: 'contact-locale',
    // costCenter and employeeType are deliberately unassigned.
  },
  attrOrder: [
    'id',
    'login',
    'email',
    'firstName',
    'lastName',
    'displayName',
    'department',
    'title',
    'manager',
    'division',
    'status',
    'created',
    'lastLogin',
    'secondEmail',
    'streetAddress',
    'city',
    'state',
    'zipCode',
    'countryCode',
    'costCenter',
    'employeeType',
  ],
  hidden: { state: true },
};

/**
 * The pane-level verbs, resting: editing is offered, nothing typed yet.
 *
 * The pane owns none of this. The draft, the diff and the write live in
 * `useProfileEdit`, and `Save` only *arms* the confirmation — the dialog belongs
 * to `UserDetailPanel`, so this component is renderable without one.
 */
const EDIT_CONTROLS: ProfileEditControls = {
  canEdit: true,
  isEditing: false,
  changeCount: 0,
  hasInvalid: false,
  onBeginEdit: fn(),
  onCancelEdit: fn(),
  onSave: fn(),
};

/**
 * What `useProfileEdit` hands down in edit mode: `department` drafted to a new
 * value, `title` untouched, and the `id` system field locked with its reason.
 * `onChange` is a spy — these stories are about which state each `<dd>` swaps
 * to, not about typing.
 */
const EDIT_CELLS: Readonly<Record<string, AttributeEditCell>> = {
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
  title: {
    name: 'title',
    editability: { editable: true, control: 'text', required: false },
    dirty: false,
    onChange: fn(),
  },
};

/** Two rules read `department`, one reads `title`, and nothing reads the rest. */
const RULE_READS: Record<string, string[]> = {
  department: ['Engineering → VPN Access', 'Engineering → Wiki'],
  title: ['Staff+ → On-call Rotation'],
};

/**
 * The user's attributes, in the admin's own categories and order, with the rules
 * that read them marked.
 */
const meta = {
  title: 'Users/UserProfilePane',
  component: UserProfilePane,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Replaces `UserProfileCard`, which was a data dump: two-column white-on-white tiles that **truncated** ' +
          'the addresses and logins an admin came to read, hid every empty attribute so "does this org even ' +
          'define X?" could not be answered, and hard-coded its own labels and section names.\n\n' +
          "This pane's argument is different. **Attributes are the evidence group rules read to grant access**, " +
          'so a `{n} rules` chip sits beside any value a currently *granting* rule consults — and the header ' +
          'counts those separately from the plain attribute total. A rule that reads `department` but grants ' +
          'this user nothing is deliberately not counted; see `profileRuleReads`.\n\n' +
          "Everything else is the admin's: the categories, their order, the attributes inside them, the layout, " +
          'and whether API names, rule chips and empty attributes show at all. Attributes filed under no ' +
          'category — or under one that was deleted — collect in a final **Uncategorized** block that can never ' +
          'silently vanish.\n\n' +
          '`attributes`, `config` and `ruleReads` are props, not hooks: the pane renders and never fetches, and ' +
          'it owns no dialog — the gear calls `onConfigure` and `Save` only *arms* the confirmation, both of ' +
          'which are mounted by `UserDetailPanel`.\n\n' +
          '**Editing** arrives the same way. `edit` carries the pane-level verbs and `cells` carries one entry ' +
          'per attribute that has a control; an attribute with no cell renders exactly as it does in read ' +
          'mode, which is what keeps the no-truncation contract a property of the file rather than of a ' +
          'branch. The Edit button is **absent** rather than disabled when nothing on the profile can be ' +
          'edited.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    attributes: { description: 'Every attribute of the profile, empty ones included.' },
    config: { description: "The admin's reconciled display configuration." },
    ruleReads: { description: 'Attribute name → the granting rules that read it.' },
    edit: { description: 'The pane-level edit verbs; absent means the pane is read-only.' },
    cells: { description: 'Attribute name → its edit cell. Empty outside edit mode.' },
  },
  args: {
    attributes: ATTRIBUTES,
    config: CONFIG,
    ruleReads: RULE_READS,
    onConfigure: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-canvas p-4">
        {/* The rung wraps the panes in one white card; the pane itself is chromeless. */}
        <div className="rounded-md border border-neutral-200 bg-white">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof UserProfilePane>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default `rows` layout: a label column, then a wrapping value. The long
 * street address and login wrap in full rather than being clipped, `Engineering`
 * carries its `2 rules` chip, `Cost Center` collects in Uncategorized, and the
 * hidden `state` attribute is simply not there.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The chip is the pane's whole argument, and it is plural here.
    await expect(canvas.getByText('2 rules')).toBeInTheDocument();
    await expect(canvas.getByText('1 rule')).toBeInTheDocument();
    // An attribute no granting rule reads carries no chip.
    await expect(canvas.getByText('Product Engineering')).toBeInTheDocument();

    // Uncategorized is populated and last, and it cannot vanish.
    await expect(canvas.getByRole('region', { name: 'Uncategorized' })).toBeInTheDocument();
    await expect(canvas.getByText('CC-4471')).toBeInTheDocument();

    // A hidden attribute renders nowhere.
    await expect(canvas.queryByText('Washington')).not.toBeInTheDocument();

    // …and an empty one is out too, because showEmpty is off.
    await expect(canvas.queryByText('Second Email')).not.toBeInTheDocument();
  },
};

/** `compact`: the same label-then-value structure at tighter gaps. */
export const CompactLayout: Story = {
  args: { config: { ...CONFIG, layout: 'compact' } },
};

/** `grid`: auto-fitting cards on the canvas, label above value. */
export const GridLayout: Story = {
  args: { config: { ...CONFIG, layout: 'grid' } },
};

/**
 * `showApiNames` on: the label column becomes the raw Okta key in mono, which is
 * the vocabulary a rule condition actually uses.
 */
export const ApiNames: Story = {
  args: { config: { ...CONFIG, showApiNames: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('streetAddress')).toBeInTheDocument();
    await expect(canvas.queryByText('Street Address')).not.toBeInTheDocument();
  },
};

/**
 * `showEmpty` on: `Display Name` and `Second Email` appear with an em dash. This is
 * the state that answers "does this org define the attribute at all?", which the
 * card this replaced could not.
 */
export const ShowingEmptyAttributes: Story = {
  args: { config: { ...CONFIG, showEmpty: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Second Email')).toBeInTheDocument();
    await expect(canvas.getAllByTitle('No value').length).toBeGreaterThan(0);
  },
};

/** `showRuleChips` off: the values stay, the explanation goes. */
export const WithoutRuleChips: Story = {
  args: { config: { ...CONFIG, showRuleChips: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.queryByText('2 rules')).not.toBeInTheDocument();
  },
};

/** The `Used by rules` pill: only the attributes a granting rule actually reads. */
export const UsedByRulesOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Used by rules' }));

    await waitFor(() => expect(canvas.queryByText('CC-4471')).not.toBeInTheDocument());
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.getByText('Staff Platform Engineer')).toBeInTheDocument();
  },
};

/**
 * Filtered to nothing: an empty state that names the cause and offers the way out,
 * rather than a blank pane.
 */
export const FilteredToNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Filter attributes' }), 'zzzzz');

    const clear = await canvas.findByRole('button', { name: 'Clear filter' });
    await expect(canvas.getByText('No attributes match')).toBeInTheDocument();

    await userEvent.click(clear);
    await waitFor(() => expect(canvas.getByText('Engineering')).toBeInTheDocument());
  },
};

/** Nothing to render and no filter to blame — the pane points at the gear instead. */
export const NothingConfiguredToShow: Story = {
  args: {
    config: { ...CONFIG, hidden: Object.fromEntries(ATTRIBUTES.map((a) => [a.name, true])) },
  },
};

/** Placeholders while the profile and the org schema load. */
export const Loading: Story = {
  args: { isLoading: true },
};

/**
 * The 360px floor, which is where the defect this pane fixes was worst: the long
 * login and the 58-character street address wrap in full instead of being cut off
 * with no way to see the rest.
 */
export const Narrow: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('samantha.henderson-oconnell@corporate.example.com'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('1200 Northwest Continental Boulevard, Building 4, Suite 1750'),
    ).toBeInTheDocument();
  },
};

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Editing is offered but not under way: one **Edit** button beside the gear, and
 * every value still read-only. This is the pane an admin lands on.
 */
export const Editable: Story = {
  args: { edit: EDIT_CONTROLS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeEnabled();
    // Nothing has become a control yet.
    await expect(canvas.queryByRole('textbox', { name: 'Department' })).not.toBeInTheDocument();
  },
};

/**
 * A profile with nothing editable — every attribute read-only, externally
 * mastered, or absent from the org's schema. The button is **gone**, not
 * disabled: there would be no controls behind it and no lock reasons to explain.
 */
export const NothingEditable: Story = {
  args: { edit: { ...EDIT_CONTROLS, canEdit: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Configure attribute display' }),
    ).toBeInTheDocument();
  },
};

/**
 * Edit mode with one attribute drafted. `department` is a text field holding the
 * new value, `id` says why it is locked, and every attribute without a cell —
 * the whole Contact & locale block — renders exactly as it does in read mode.
 */
export const Editing: Story = {
  args: {
    edit: { ...EDIT_CONTROLS, isEditing: true, changeCount: 1 },
    cells: EDIT_CELLS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('textbox', { name: 'Department' })).toHaveValue(
      'Identity Platform',
    );
    await expect(canvas.getByText('1 change')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();

    // An attribute with no cell is untouched by edit mode — including the long
    // street address this pane exists to stop clipping.
    await expect(
      canvas.getByText('1200 Northwest Continental Boulevard, Building 4, Suite 1750'),
    ).toBeInTheDocument();
  },
};

/**
 * Edit mode at the 360px floor. The header's three-control cluster wraps onto its
 * own row rather than squeezing the summary sentence, and each control fills the
 * value column beside its label.
 */
export const EditingNarrow: Story = {
  args: {
    edit: { ...EDIT_CONTROLS, isEditing: true, changeCount: 1 },
    cells: EDIT_CELLS,
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
