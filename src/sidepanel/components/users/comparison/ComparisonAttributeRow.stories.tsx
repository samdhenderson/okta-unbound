import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import ComparisonAttributeRow from './ComparisonAttributeRow';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import type { AttributeEditCell } from '../../../hooks/useProfileEdit';

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
 * One side's editing cell, as `useProfileEdit` hands it over. Editable text by
 * default; pass an `editability` to lock it or a `draft` to dirty it.
 */
const editCell = (name: string, over: Partial<AttributeEditCell> = {}): AttributeEditCell => ({
  name,
  editability: { editable: true, control: 'text', required: false },
  dirty: false,
  onChange: fn(),
  ...over,
});

/** A row is an `<li>`; every story supplies the list it belongs to. */
const inList = (Story: ComponentType) => (
  <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
    <Story />
  </ul>
);

/** One attribute, and how the two users' values for it compare. */
const meta = {
  title: 'Users/Comparison/ComparisonAttributeRow',
  component: ComparisonAttributeRow,
  tags: ['autodocs'],
  decorators: [inList],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "One row of the comparison's Attributes tab: the attribute's name and annotations, then the two " +
          "users' **values** with an equality marker between them.\n\n" +
          'The strip is a three-track grid (`minmax(0,1fr) 2rem minmax(0,1fr)`) with `min-h-9` cells rather than ' +
          '`flex-1` boxes — under flex a padded cell keeps its own chrome before the free space is split, which ' +
          'put the marker 9px off-centre and made the `=` column stagger down the list.\n\n' +
          'The marker is **not a control**: a `role="img"` span showing `=` or `≠`. Two different glyphs, so the ' +
          'state never depends on colour. Both sides are always named, and there is no arrow.\n\n' +
          '**Values wrap; they never truncate.** A truncated value is actively dangerous in a diff — two values ' +
          'differing only in their tails would render identically beside a `≠` nobody could explain. An unset ' +
          'value is stated as `— not set` in the muted italic non-answer register `AppScopeIndicator` and ' +
          '`GroupSourceIndicator` share.\n\n' +
          '**Either side is editable.** Given a cell for a side, that side delegates to `ProfileEditCell` — the ' +
          "same cell the Users tab's Profile pane renders, so an attribute locked in one surface is locked " +
          'identically in the other, with the same sentence saying why.\n\n' +
          '**The marker does not follow the typing.** `=` / `≠` is a statement about what Okta holds; flipping ' +
          'it on an unsaved keystroke would claim two users now agree while the directory still says they ' +
          'differ, and re-verdicting live would pull the row being typed in out from under the cursor (the ' +
          'list is ordered differences-first). A dirty side is marked with an `Edited` badge whose tooltip ' +
          'says what saving *would* make true.',
      },
    },
  },
  args: {
    row: row('department', 'Department', 'Engineering', 'Design', 'differs'),
    contextName: 'Ada Context',
    comparedName: 'Bo Compared',
    showApiNames: false,
  },
  argTypes: {
    row: {
      description: "The attribute and both users' values for it, from `attributeParityRows`.",
    },
    contextName: { description: 'Display name of the context user (baseline) — the LEFT cell.' },
    comparedName: { description: 'Display name of the compared user — the RIGHT cell.' },
    showApiNames: {
      description:
        'Render the Okta name in mono instead of the human label (`config.showApiNames`).',
    },
    readers: {
      description:
        'Names of the rules that read this attribute and currently grant either user access. Absent renders no chip.',
    },
    contextCell: {
      description:
        "The context user's editing cell, joined by `row.name`. Present only while that column is editing.",
    },
    comparedCell: {
      description: "The compared user's editing cell. Same contract as `contextCell`.",
    },
  },
} satisfies Meta<typeof ComparisonAttributeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `differs` — both users have a value and the values disagree. */
export const Differs: Story = {};

/** `same` — both users hold the same value, so the marker is `=`. */
export const Same: Story = {
  args: { row: row('userType', 'User type', 'Employee', 'Employee', 'same') },
};

/** `onlyContext` — the compared user's cell states the non-answer rather than sitting empty. */
export const OnlyContext: Story = {
  args: { row: row('manager', 'Manager', 'dana@example.com', '', 'onlyContext') },
};

/** `onlyCompared` — the mirror image, on the other side. */
export const OnlyCompared: Story = {
  args: { row: row('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared') },
};

/**
 * `bothEmpty` — the org defines the attribute and neither user has a value. That
 * is an agreement, not a difference, so the marker is `=`.
 */
export const BothEmpty: Story = {
  args: { row: row('nickName', 'Nickname', '', '', 'bothEmpty') },
};

/** A currently-granting rule reads this attribute — the chip that makes the diff an explanation. */
export const WithRuleChip: Story = {
  args: { readers: ['Engineering → VPN Access', 'Contractors → VPN Access'] },
};

/** `showApiNames` swaps the human label for the Okta name, in mono. */
export const ApiName: Story = {
  args: { showApiNames: true },
};

/** A row the display config hides, revealed on demand and marked as such. */
export const HiddenByConfig: Story = {
  args: {
    row: row('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
      hiddenByConfig: true,
    }),
  },
};

/**
 * Long values at 360px — the case the no-truncation rule exists for. Both cells
 * wrap and stay the same height, and the marker stays on the centre line.
 */
export const LongValuesCompact: Story = {
  args: {
    row: row(
      'streetAddress',
      'Street address',
      '1 Example Street, Exampleton, EX1 2AB, Exampleshire',
      '1 Example Street, Exampleton, EX1 2AC, Exampleshire',
      'differs',
    ),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/**
 * The compared column is editing: its value cell becomes a control while the
 * context column stays as it was. The marker is untouched — it still describes
 * Okta.
 */
export const EditingOneSide: Story = {
  args: { comparedCell: editCell('department') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Department')).toHaveValue('Design'));
    expect(canvas.getByRole('img', { name: 'The two users have different values' })).toBeVisible();
  },
};

/**
 * A drafted value. The `Edited` badge names the side holding it and hedges what
 * saving would make true; the `≠` stays put, because Okta has not changed.
 */
export const EditedDraft: Story = {
  args: {
    comparedCell: editCell('department', { draft: 'Engineering', dirty: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByTitle(/Bo Compared has an unsaved change/)).toBeInTheDocument(),
    );
    expect(canvas.getByRole('img', { name: 'The two users have different values' })).toBeVisible();
  },
};

/** Both columns edited at once — each badge says whose change it is. */
export const BothSidesEdited: Story = {
  args: {
    contextCell: editCell('department', { draft: 'Design', dirty: true }),
    comparedCell: editCell('department', { draft: 'Design', dirty: true }),
  },
};

/**
 * An attribute an external system masters. In edit mode the lock is stated with
 * its reason rather than rendering a bare value the admin might think they can
 * change — the same treatment, and the same sentence, as the Profile pane.
 */
export const LockedWhileEditing: Story = {
  args: {
    comparedCell: editCell('department', {
      editability: {
        editable: false,
        reason: 'externally-mastered',
        explanation:
          'An external system masters this attribute (Active Directory), so a change made here would be overwritten at the next import.',
      },
      onChange: undefined,
    }),
  },
};

/** A drafted value that fails validation, stated on the control it belongs to. */
export const InvalidDraft: Story = {
  args: {
    comparedCell: editCell('department', {
      draft: '',
      dirty: true,
      invalid: 'Department is required.',
    }),
  },
};

/**
 * Editing at 360px: two controls plus the marker in the same three-track grid the
 * read-only row uses, so nothing shifts on entering edit mode.
 */
export const EditingCompact: Story = {
  args: {
    contextCell: editCell('department'),
    comparedCell: editCell('department', { draft: 'Engineering', dirty: true }),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
