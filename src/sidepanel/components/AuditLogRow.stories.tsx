import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import AuditLogRow from './AuditLogRow';
import type { CapturedAttribute, UndoAction, UndoActionMetadata } from '../../shared/undoTypes';
import type { UseUndoActionReturn } from '../hooks/useUndoAction';

/** Five minutes ago, so every row's relative time reads the same on every run. */
const recently = Date.now() - 5 * 60 * 1000;

const entry = (
  id: string,
  description: string,
  metadata: UndoActionMetadata,
  status: UndoAction['status'] = 'completed',
): UndoAction => ({
  id,
  type: metadata.type,
  timestamp: recently,
  description,
  status,
  metadata,
});

const captured = (name: string, before: string, after: string): CapturedAttribute => ({
  name,
  label: name,
  beforeDisplay: before,
  beforeRaw: before,
  afterDisplay: after,
  restorable: true,
});

/**
 * An attribute whose prior value the capture policy dropped rather than
 * truncated — `beforeDisplay` is **absent**, not empty.
 */
const omitted = (
  name: string,
  after: string,
  reason: CapturedAttribute['omitted'],
): CapturedAttribute => ({
  name,
  label: name,
  afterDisplay: after,
  restorable: false,
  omitted: reason,
});

/** A profile write with two fully captured attributes: the undoable case. */
const profileUpdate = entry('action_profile', 'Updated department, title on Ada Lovelace', {
  type: 'UPDATE_USER_PROFILE',
  userId: '00uFAKE0000000000001',
  userLogin: 'user@example.com',
  userName: 'Ada Lovelace',
  changes: [
    captured('department', 'Platform', 'Engineering'),
    captured('title', 'Intern', 'Engineer'),
  ],
});

/** Five attributes, two of which have no prior value to put back. */
const profileUpdateMixed = entry('action_mixed', 'Updated department and 4 more on Ada Lovelace', {
  type: 'UPDATE_USER_PROFILE',
  userId: '00uFAKE0000000000001',
  userLogin: 'user@example.com',
  userName: 'Ada Lovelace',
  changes: [
    captured('department', 'Platform', 'Engineering'),
    omitted('bio', 'A long biography that exceeded the capture cap', 'too-large'),
    captured('title', 'Intern', 'Engineer'),
    omitted('notes', 'Another long note', 'too-many'),
    captured('city', '', 'Berlin'),
  ],
});

/** A group removal: recorded in full, but with no undo path in this build. */
const groupRemoval = entry('action_removal', 'Removed Ada Lovelace from Engineering', {
  type: 'REMOVE_USER_FROM_GROUP',
  userId: '00uFAKE0000000000001',
  userEmail: 'user@example.com',
  userName: 'Ada Lovelace',
  groupId: '00gFAKE0000000000001',
  groupName: 'Engineering',
});

/** A consolidation — the type the old viewer's `switch` had no branch for at all. */
const consolidation = entry('action_consolidation', 'Consolidated 2 rules into Engineering — all', {
  type: 'CONSOLIDATE_RULE',
  createdRuleId: '0prFAKE0000000000009',
  createdRuleName: 'Engineering — all',
  createdGroupIds: ['00gFAKE0000000000001', '00gFAKE0000000000002'],
  retiredRules: [
    {
      id: '0prFAKE0000000000001',
      name: 'Engineers by department',
      expression: 'user.department=="Engineering"',
      groupIds: ['00gFAKE0000000000001'],
    },
    {
      id: '0prFAKE0000000000002',
      name: 'Engineers by title',
      expression: 'user.title=="Engineer"',
      groupIds: ['00gFAKE0000000000002'],
    },
  ],
});

/** Already undone: the entry carries the mark and offers no second Undo. */
const undone: UndoAction = {
  ...profileUpdate,
  id: 'action_undone',
  status: 'undone',
  undoneByActionId: 'action_undo',
};

/** The write whose outcome nobody could confirm. Never offered for undo. */
const partial: UndoAction = { ...profileUpdate, id: 'action_partial', status: 'partial' };

/**
 * The real eligibility rules, transcribed from `useUndoAction` so the stories
 * exercise the same branches the hook does without rendering the hook itself.
 */
const undoability: UseUndoActionReturn['undoability'] = (action) => {
  if (action.status === 'undone')
    return { undoable: false, reason: 'This action has already been undone.' };
  if (action.status === 'partial')
    return {
      undoable: false,
      reason:
        'This write was never confirmed, so we do not know which values it actually set — and therefore cannot know what to restore.',
    };
  if (action.status === 'failed')
    return { undoable: false, reason: 'This action failed, so there is nothing to put back.' };
  if (action.metadata.type !== 'UPDATE_USER_PROFILE')
    return {
      undoable: false,
      reason:
        'Only profile edits can be undone here. Every other action would need a new operation of its own rather than a restore.',
    };
  const total = action.metadata.changes.length;
  const restorable = action.metadata.changes.filter((change) => change.restorable).length;
  if (restorable === 0)
    return {
      undoable: false,
      reason: 'No previous values were captured for this edit, so there is nothing to restore.',
    };
  return { undoable: true, restorable, total };
};

/** One entry in the action history, with its disclosure and its way back. */
const meta = {
  title: 'Sidepanel/AuditLogRow',
  component: AuditLogRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One recorded action: what happened, its type, when — and, for a profile write whose prior values were captured, an **Undo** button.\n\n' +
          'This replaces a hand-rolled disclosure (a `cursor-pointer` `<div>` with no `role` and no `aria-expanded`, an inline `<svg>` chevron, and a `<span>` wearing badge classes). Adding a real Undo control to that shape would have nested one interactive element inside another, so the row is rebuilt on shared `ListRow` + `IconButton` + `Badge`.\n\n' +
          'Undo is **offered or absent**, never disabled: a disabled button with no explanation reads as a bug. The reason an entry cannot be undone is a quiet line inside the expanded body, where a sentence fits. An entry already undone wears `Undone`; one whose outcome was never confirmed wears `Outcome unknown` and is never offered a restore, because we cannot say what it set.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    action: profileUpdate,
    isExpanded: false,
    onToggle: fn(),
    onUndo: fn(),
    undoability,
  },
  argTypes: {
    action: { description: 'The history entry this row is about.' },
    isExpanded: {
      description:
        'Whether the disclosure is open. Owned by the list, so a refresh cannot close a row.',
    },
    onToggle: { description: "Toggles this row's disclosure, by action id." },
    onUndo: {
      description: 'Opens the undo confirmation. Omitted, no Undo button is rendered at all.',
    },
    undoability: {
      description:
        'The pure eligibility test from `useUndoAction` — the row asks rather than deciding.',
    },
  },
} satisfies Meta<typeof AuditLogRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A profile write, collapsed: description, type mark, relative time, and Undo. */
export const Default: Story = {};

/** Closed, which is how every row starts — a history of thirty open bodies is unscannable. */
export const Collapsed: Story = {
  args: { isExpanded: false },
};

/** Open: who was edited, and every attribute this write changed, `before → after`. */
export const Expanded: Story = {
  args: { isExpanded: true },
};

/** The undoable case. Every attribute here has a captured prior value. */
export const Undoable: Story = {
  args: { isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Undo' })).toBeVisible();
  },
};

/**
 * A group removal. No Undo button at all — and the reason is stated in the body
 * rather than hidden behind a disabled control.
 */
export const NotUndoable: Story = {
  args: { action: groupRemoval, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
    await expect(canvas.getByText(/Only profile edits can be undone/)).toBeVisible();
  },
};

/** Already undone: marked, and never offered a second restore. */
export const Undone: Story = {
  args: { action: undone, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Undone')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
  },
};

/**
 * `Outcome unknown` — the write's transport threw, so it may or may not have
 * applied. Undo is withheld because we do not know what it set.
 */
export const OutcomeUnknown: Story = {
  args: { action: partial, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Outcome unknown')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
  },
};

/**
 * Five attributes, two of whose prior values were never captured — those are
 * annotated in place rather than dropped, and the row is still undoable for the
 * other three.
 */
export const MixedRestorability: Story = {
  args: { action: profileUpdateMixed, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('(previous value not captured)')).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Undo' })).toBeVisible();
  },
};

/**
 * A rule consolidation. The `switch` this row's body was ported from had no
 * branch for this type, so it opened to nothing; the branch was added rather
 * than inherited.
 */
export const Consolidation: Story = {
  args: { action: consolidation, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('New rule:')).toBeVisible();
  },
};

/** The row on a surface that cannot undo anything: the button is absent, not disabled. */
export const WithoutUndoHandler: Story = {
  args: { onUndo: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
  },
};

/** The disclosure, driven from the chevron the way a reader opens it. */
export const OpeningTheDisclosure: Story = {
  args: { isExpanded: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show details for Updated department, title on Ada Lovelace',
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith('action_profile');
  },
};

/**
 * The 360px floor, where the description, two badges, the time, Undo and the
 * chevron all compete for one row. The badge cluster wraps; the description
 * truncates rather than pushing the controls off.
 */
export const Compact: Story = {
  args: { action: profileUpdateMixed },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
