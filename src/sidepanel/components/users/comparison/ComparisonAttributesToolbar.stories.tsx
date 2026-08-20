import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import ComparisonAttributesToolbar from './ComparisonAttributesToolbar';
import type { ComparisonEditSide } from '../../../hooks/useComparisonProfileEdit';

/**
 * One column's editor, as `useComparisonProfileEdit` hands it over. The toolbar
 * is presentational, so a story states the state directly rather than standing
 * up two `useProfileEdit` instances behind it.
 */
const side = (
  key: 'context' | 'compared',
  userName: string,
  over: Partial<ComparisonEditSide> = {},
): ComparisonEditSide => ({
  key,
  userName,
  cells: {},
  isEditing: false,
  isSaving: false,
  hasChanges: false,
  hasInvalid: false,
  canEdit: true,
  begin: fn(),
  cancel: fn(),
  requestSave: fn(),
  ...over,
});

const CONTEXT = side('context', 'Ada Context');
const COMPARED = side('compared', 'Bo Compared');

/** The Attributes tab's controls: filter, search, disclosure and the two editors. */
const meta = {
  title: 'Users/Comparison/ComparisonAttributesToolbar',
  component: ComparisonAttributesToolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Everything above the comparison's attribute list: the three filter pills, the search field, the " +
          'hidden-differences disclosure, and — one per user — the Edit / Cancel / Save controls.\n\n' +
          '**Both edit affordances name their user.** The tab writes to a *profile*, and there are two profiles ' +
          'on screen, so an unqualified "Edit" would be a live write to whichever user the admin was not ' +
          'thinking about. `Edit` states the name visibly; `Cancel` and `Save` shorten it once the column is ' +
          'unambiguously in edit mode and keep the name in their **accessible** names, so the two columns never ' +
          'present two identically-named buttons to a screen reader. At 360px the two columns stack.\n\n' +
          '**A column with no host to publish a save shows nothing at all** rather than a disabled control: ' +
          '`canEdit` is false when the surface is hidden, when there is no user, or when nothing can lift the ' +
          'saved result — and a disabled button would invite a hunt for the condition that enables it.\n\n' +
          'The save outcome lands here only when there is no confirmation left to carry it: `danger` for a ' +
          'rejected write, `warning` for one whose result could not be confirmed.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  args: {
    filter: 'differences',
    onFilterChange: fn(),
    differenceCount: 3,
    sharedCount: 8,
    totalCount: 11,
    query: '',
    onQueryChange: fn(),
    hiddenDifferences: 1,
    revealHidden: false,
    onToggleHidden: fn(),
  },
  argTypes: {
    filter: { description: 'The active filter pill.' },
    onFilterChange: { description: 'Called with the pill the reader chose.' },
    differenceCount: { description: 'How many listed rows differ — the Differences pill count.' },
    sharedCount: { description: 'How many listed rows agree — the Shared pill count.' },
    totalCount: { description: 'How many rows are listed in total — the All pill count.' },
    query: { description: 'The current search term.' },
    onQueryChange: { description: 'Called with the new search term.' },
    hiddenDifferences: {
      description:
        'How many differing attributes the display config hides. `0` renders no disclosure line at all.',
    },
    revealHidden: { description: 'Whether the hidden rows are currently revealed.' },
    onToggleHidden: { description: 'Toggles the reveal.' },
    contextEdit: {
      description: "The left column's editor. Absent renders no editing controls for it.",
    },
    comparedEdit: {
      description: "The right column's editor. Absent renders no editing controls for it.",
    },
  },
} satisfies Meta<typeof ComparisonAttributesToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No editors passed at all — the toolbar every read-only host renders. */
export const Default: Story = {};

/**
 * Both columns editable and at rest. Each entry point names its user, because
 * "Edit" alone would not say whose profile is about to be written.
 */
export const BothEditable: Story = {
  args: { contextEdit: CONTEXT, comparedEdit: COMPARED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Edit Ada Context' })).toBeInTheDocument(),
    );
    expect(canvas.getByRole('button', { name: 'Edit Bo Compared' })).toBeInTheDocument();
  },
};

/**
 * The context column has no host that can publish a save, so it offers nothing —
 * not a disabled button. This is the state until a host passes
 * `onContextUserUpdated` into `useUserComparison`.
 */
export const ContextColumnReadOnly: Story = {
  args: { contextEdit: side('context', 'Ada Context', { canEdit: false }), comparedEdit: COMPARED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Edit Bo Compared' })).toBeInTheDocument(),
    );
    expect(canvas.queryByRole('button', { name: 'Edit Ada Context' })).not.toBeInTheDocument();
  },
};

/**
 * One column editing with a change drafted. Save is live; the accessible names
 * still say whose profile each control acts on.
 */
export const Editing: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', { isEditing: true, hasChanges: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = await canvas.findByRole('button', { name: 'Save changes to Bo Compared' });
    expect(save).toBeEnabled();
    await userEvent.click(save);
  },
};

/** Editing with nothing changed yet — Save has nothing to write, so it is disabled. */
export const EditingWithNoChanges: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', { isEditing: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = await canvas.findByRole('button', { name: 'Save changes to Bo Compared' });
    expect(save).toBeDisabled();
  },
};

/** A drafted value fails validation, so the write is blocked at the control. */
export const InvalidDraft: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      hasInvalid: true,
    }),
  },
};

/** The confirmed write is in flight: Save loads and Cancel locks. */
export const Saving: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      isSaving: true,
    }),
  },
};

/** Okta answered and rejected the write. The draft survives, so the column stays in edit mode. */
export const ErrorState: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      message: {
        type: 'danger',
        text: 'Okta rejected the update: department is not a valid value.',
      },
    }),
  },
};

/**
 * The write may have applied and may not have. `warning`, not `danger` — the two
 * are genuinely different findings, and collapsing them would report an
 * ambiguous write as a failed one.
 */
export const UnconfirmedOutcome: Story = {
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      message: {
        type: 'warning',
        text: 'This panel could not confirm whether the change to Bo Compared was saved. Reload the comparison to check before editing again.',
      },
    }),
  },
};

/** Nothing is hidden, so the disclosure line is absent entirely. */
export const NothingHidden: Story = {
  args: { hiddenDifferences: 0, contextEdit: CONTEXT, comparedEdit: COMPARED },
};

/** The hidden rows are revealed, so the control offers to put them back. */
export const HiddenRevealed: Story = {
  args: { revealHidden: true, hiddenDifferences: 2 },
};

/**
 * The compact side panel. Two named edit affordances do not fit on one 360px
 * line, so the columns stack rather than truncating a name — a control that
 * writes to a profile must never be ambiguous about whose.
 */
export const CompactPanel: Story = {
  args: {
    contextEdit: side('context', 'Ada Context', { isEditing: true, hasChanges: true }),
    comparedEdit: COMPARED,
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
