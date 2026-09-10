import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ProfileDisplaySectionEditor from './ProfileDisplaySectionEditor';
import ProfileDisplayAttributeEditRow from './ProfileDisplayAttributeEditRow';
import { fixtureAttribute } from './profileDisplayStoryFixture';

const rowHandlers = {
  isHidden: false,
  isLifted: false,
  ruleNames: [] as string[],
  onToggleHidden: fn(),
  onGripPointerDown: fn(),
  onLift: fn(),
  onStep: fn(),
  onDrop: fn(),
  onCancelLift: fn(),
};

const rows = [
  <ProfileDisplayAttributeEditRow
    key="firstName"
    attribute={fixtureAttribute('firstName', 'base', 'Ada', 'First name')}
    {...rowHandlers}
  />,
  <ProfileDisplayAttributeEditRow
    key="lastName"
    attribute={fixtureAttribute('lastName', 'base', 'Lovelace', 'Last name')}
    {...rowHandlers}
  />,
];

/** One section of the profile while it is being customized. */
const meta = {
  title: 'Users/ProfileDisplaySectionEditor',
  component: ProfileDisplaySectionEditor,
  tags: ['autodocs'],
  parameters: {
    // heading-order disabled: a lone section renders out of its heading context
    // (no surrounding app shell), so axe flags the Uncategorized eyebrow.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'A section grip, its name, its field count, its delete control, and the rows filed under it.\n\n' +
          '**The name is a button until it is clicked.** A column of text fields reads as a form to be filled in; a name that becomes a field only when you aim at it reads as a label you can correct. Enter and blur commit, Escape reverts.\n\n' +
          '**Deleting confirms inline and states the consequence** — "Its 2 attributes return to Uncategorized" — because an admin should not have to guess whether a delete takes attributes off the profile with it. It does not. Uncategorized itself renders fixed: no grip, no delete, and the editor pins it last.',
      },
    },
  },
  argTypes: {
    sectionKey: { description: "The section's stable key; `''` is Uncategorized." },
    name: { description: "The section's current name in the draft." },
    fieldCount: { description: "How many of the profile's attributes are filed under it." },
    isFixed: { description: 'True for Uncategorized: no grip, no delete.' },
    isLifted: { description: 'True while this section is the one lifted.' },
    isReorderDisabled: { description: 'Turns the grip off while a filter narrows the list.' },
    onRename: { description: 'Commit a new name for this section.' },
    onDelete: { description: 'Delete it, returning its attributes to Uncategorized.' },
    children: { description: 'The section rows, and any drop indicator between them.' },
  },
  args: {
    sectionKey: 'identity',
    name: 'Identity',
    fieldCount: 2,
    onRename: fn(),
    onDelete: fn(),
    onGripPointerDown: fn(),
    onLift: fn(),
    onStep: fn(),
    onDrop: fn(),
    onCancelLift: fn(),
    children: rows,
  },
} satisfies Meta<typeof ProfileDisplaySectionEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An admin-defined section with two attributes under it. */
export const Default: Story = {};

/** Uncategorized: no grip, no delete, pinned last by the editor. */
export const Uncategorized: Story = {
  args: { sectionKey: '', name: 'Uncategorized', isFixed: true },
};

/** A section holding nothing — a valid landing place, not an error. */
export const Empty: Story = { args: { name: 'Contact & locale', fieldCount: 0, children: [] } };

/** Lifted, mid-reorder. */
export const Lifted: Story = { args: { isLifted: true } };

/** Reordering off while the pane's filter is narrowing the list. */
export const Disabled: Story = { args: { isReorderDisabled: true } };
