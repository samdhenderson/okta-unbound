import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import ComparisonAttributesTab from './ComparisonAttributesTab';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import type { AttributeEditCell } from '../../../hooks/useProfileEdit';
import type { ComparisonEditSide } from '../../../hooks/useComparisonProfileEdit';
import type { ProfileDisplayConfig } from '../../../../shared/storage/profileDisplayStore';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../../shared/storage/profileDisplayStore';

/** One attribute parity row, as `attributeParityRows` would emit it. */
const row = (
  name: string,
  label: string,
  contextValue: string,
  comparedValue: string,
  verdict: AttributeVerdict,
  over: Partial<AttributeParityRow> = {},
): AttributeParityRow => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  contextValue,
  comparedValue,
  verdict,
  categoryKey: 'organization',
  hiddenByConfig: false,
  ...over,
});

/**
 * All five verdicts, in the order the pure module emits them: the three
 * differences first, then the two agreements. Never re-sorted by the tab.
 */
const ROWS: AttributeParityRow[] = [
  row('department', 'Department', 'Engineering', 'Design', 'differs'),
  row('manager', 'Manager', 'dana@example.com', '', 'onlyContext'),
  row('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared'),
  row('userType', 'User type', 'Employee', 'Employee', 'same', { categoryKey: 'identity' }),
  row('nickName', 'Nickname', '', '', 'bothEmpty', { categoryKey: '' }),
];

/** An attribute the config hides — and one the two users actually differ on. */
const HIDDEN_ROWS: AttributeParityRow[] = [
  row('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
    hiddenByConfig: true,
  }),
];

/**
 * A configuration with a real category order and one category nothing is filed
 * under: `Contact & locale` must simply not appear rather than rendering as an
 * empty heading.
 */
const CONFIG: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
    { key: 'contact-locale', name: 'Contact & locale' },
  ],
  assign: {
    userType: 'identity',
    department: 'organization',
    manager: 'organization',
    costCenter: 'organization',
    employeeNumber: 'organization',
    nickName: '',
  },
  attrOrder: ['userType', 'department', 'manager', 'costCenter', 'employeeNumber', 'nickName'],
  hidden: { employeeNumber: true },
};

/** One attribute's editing cell, as `useProfileEdit` hands it over. */
const editCell = (name: string, over: Partial<AttributeEditCell> = {}): AttributeEditCell => ({
  name,
  editability: { editable: true, control: 'text', required: false },
  dirty: false,
  onChange: fn(),
  ...over,
});

/** A map of editable cells, keyed by attribute name exactly as the tab joins them. */
const editCells = (
  names: readonly string[],
  over: Record<string, Partial<AttributeEditCell>> = {},
): Record<string, AttributeEditCell> =>
  Object.fromEntries(names.map((name) => [name, editCell(name, over[name])]));

/** One column's editor, as `useComparisonProfileEdit` hands it over. */
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

/** Every attribute name the fixtures above use. */
const ALL_NAMES = ['department', 'manager', 'costCenter', 'userType', 'nickName', 'employeeNumber'];

/** The attribute diff: two values per row, an equality marker, and the config's grouping. */
const meta = {
  title: 'Users/Comparison/ComparisonAttributesTab',
  component: ComparisonAttributesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The comparison's fourth dimension: what is *different about these two people*, attribute by " +
          "attribute, in the admin's own categories and order.\n\n" +
          'Groups and apps answer "who has what access". Neither answers the question an admin actually arrives ' +
          'with when two people have different access — and the attributes are the evidence group rules read, so ' +
          'an attribute diff is very often the whole explanation.\n\n' +
          "The chrome is `ComparisonDiffTab`'s: filter pills, a search field, and one bordered container whose " +
          "rows are separated by `divide-y divide-neutral-100` (ADR-0029's second sanctioned separator pattern " +
          'for a dense, table-like surface — the rows are `<li>` and carry no card border, so this is **not** a ' +
          '`ListRow` surface).\n\n' +
          'What differs: the cells carry **values**, not checkmarks, and the rows group under category eyebrows ' +
          "in the config's order with Uncategorized last — the same grouping the Users tab's Profile pane uses.\n\n" +
          '**Hidden differences are disclosed, never dropped.** The display config can hide an attribute, and the ' +
          'one it hides may be the one explaining an access gap, so the count is stated above the list with a ' +
          'control that reveals those rows inline, marked as hidden.\n\n' +
          '**Either user is editable, per side.** Which of the two values is right is exactly what a value diff ' +
          'leaves the admin to decide, so the affordance works in both directions: one editor per column, each ' +
          'naming its user, with the per-attribute cells joined to a row by the bare attribute name.\n\n' +
          '**The counts and the markers do not follow the typing.** They describe what Okta holds; a dirty side ' +
          'is marked with an `Edited` badge instead. And a hidden row holding a draft stays listed even with the ' +
          'disclosure collapsed, so an edit can never be on screen nowhere and still in the patch.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    contextName: 'Ada Context',
    comparedName: 'Bo Compared',
    rows: ROWS,
    hiddenRows: HIDDEN_ROWS,
    hiddenDifferences: 1,
    config: CONFIG,
    ruleReads: { department: ['Engineering → VPN Access'] },
  },
  argTypes: {
    contextName: { description: 'Display name of the context user — the LEFT cell of every row.' },
    comparedName: {
      description: 'Display name of the compared user — the RIGHT cell of every row.',
    },
    rows: {
      description:
        'The config-visible rows from `attributeParityRows`, already ordered differences-first. Never re-sorted here.',
    },
    hiddenRows: {
      description: 'Rows the config hides, kept whole so this surface can reveal them on demand.',
    },
    hiddenDifferences: {
      description:
        'How many of `hiddenRows` actually differ — the number behind the disclosure line.',
    },
    config: {
      description:
        "The admin's reconciled display configuration: category list and order, `showApiNames`, `showRuleChips`.",
    },
    ruleReads: {
      description:
        'Attribute Okta name to the rules that read it and currently grant either user access, from `profileRuleReads`.',
    },
    contextEdit: {
      description: "The context user's editor. Absent leaves the left column read-only.",
    },
    comparedEdit: {
      description: "The compared user's editor. Same contract as `contextEdit`.",
    },
  },
} satisfies Meta<typeof ComparisonAttributesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default view: differences only, which is what an admin came for. The
 * `1 rule` chip beside `Department` is what makes the diff an access explanation
 * rather than trivia.
 */
export const Default: Story = {};

/**
 * Every verdict at once — `differs`, `onlyContext`, `onlyCompared`, `same` and
 * `bothEmpty` — which is the only view where the two value cells, the `— not set`
 * non-answer and the marker column can be judged against each other.
 *
 * It also pins two grouping decisions: `Uncategorized` collects what the config
 * has not placed, and the configured-but-empty `Contact & locale` category is
 * dropped rather than rendered as an empty heading.
 */
export const AllVerdicts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^All/ }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
    expect(canvas.getByText('Uncategorized')).toBeInTheDocument();
    expect(canvas.queryByText('Contact & locale')).not.toBeInTheDocument();
  },
};

/**
 * The honesty requirement. An attribute the config hides, which the two users
 * actually differ on, is counted and disclosed rather than dropped — a compare
 * that silently omitted the one difference explaining an access gap would be
 * worse than no compare at all.
 */
export const HiddenDifferencesRevealed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText('Employee number')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  },
};

/** Nothing is hidden, so the disclosure line is absent entirely. */
export const NothingHidden: Story = {
  args: { hiddenRows: [], hiddenDifferences: 0 },
};

/** `showApiNames` renders the Okta name in mono instead of the human label. */
export const ApiNames: Story = {
  args: { config: { ...CONFIG, showApiNames: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('department')).toBeInTheDocument());
    expect(canvas.queryByText('Department')).not.toBeInTheDocument();
  },
};

/** `showRuleChips` off — the admin's configuration governs the chips too. */
export const RuleChipsOff: Story = {
  args: { config: { ...CONFIG, showRuleChips: false } },
};

/** Filtered to nothing — distinct from "there are no attributes to compare". */
export const FilteredToNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter attributes by name or value'), 'zzzz');
    await waitFor(() => expect(canvas.getByText('No attributes match')).toBeInTheDocument());
  },
};

/** No attributes at all — a different statement from "nothing matches the filter". */
export const Empty: Story = {
  args: { rows: [], hiddenRows: [], hiddenDifferences: 0 },
};

/**
 * The compact side panel: two value cells plus a marker at 360px is exactly where
 * this layout breaks. The values wrap rather than truncate — two values differing
 * only in their tails must not be able to render identically.
 */
export const CompactPanel: Story = {
  args: {
    rows: [
      row(
        'streetAddress',
        'Street address',
        '1 Example Street, Exampleton, EX1 2AB',
        '2 Example Street, Exampleton, EX1 2AC',
        'differs',
      ),
      ...ROWS,
    ],
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/**
 * The compared column is editing. Every listed row's right-hand cell becomes a
 * control; the left column, the marker column and all three counts are exactly
 * as they were.
 */
export const EditingComparedColumn: Story = {
  args: {
    contextEdit: side('context', 'Ada Context'),
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      cells: editCells(ALL_NAMES),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Department')).toHaveValue('Design'));
    expect(canvas.getByRole('button', { name: 'Differences 3' })).toBeInTheDocument();
  },
};

/**
 * A drafted change. The row says which side is holding it and the pill still
 * counts two differences — the arithmetic describes Okta, not the form.
 */
export const EditedDraft: Story = {
  args: {
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, {
        department: { draft: 'Engineering', dirty: true },
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Edited')).toBeInTheDocument());
    expect(canvas.getByRole('button', { name: 'Differences 3' })).toBeInTheDocument();
  },
};

/**
 * The honesty requirement, in the other direction: a config-hidden row that was
 * revealed, edited, and then had its disclosure collapsed again stays on screen.
 * Anything else would take the edit off screen without taking it out of the patch.
 */
export const DirtyHiddenRowStaysListed: Story = {
  args: {
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, {
        employeeNumber: { draft: 'E-0003', dirty: true },
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The disclosure is collapsed — it still offers to "Show" — and the row is
    // listed anyway, still marked as one the config hides.
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  },
};

/**
 * Editing at 360px: the controls stack under the pills and the search field, and
 * the value cells keep the same three-track grid the read-only rows use.
 */
export const EditingCompact: Story = {
  args: {
    contextEdit: side('context', 'Ada Context', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, { department: { draft: 'Design', dirty: true } }),
    }),
    comparedEdit: side('compared', 'Bo Compared'),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
