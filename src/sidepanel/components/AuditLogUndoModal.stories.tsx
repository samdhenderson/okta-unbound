import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import AuditLogUndoModal from './AuditLogUndoModal';
import type { CapturedAttribute, UndoAction } from '../../shared/undoTypes';

const captured = (name: string, before: string, after: string): CapturedAttribute => ({
  name,
  label: name,
  beforeDisplay: before,
  beforeRaw: before,
  afterDisplay: after,
  restorable: true,
});

/**
 * An attribute the capture policy dropped rather than truncated: restoring a
 * truncated value would silently corrupt it, so there is no prior value at all.
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

/** Build a profile-write entry around a set of captured changes. */
const entry = (changes: CapturedAttribute[]): UndoAction => ({
  id: 'action_profile',
  type: 'UPDATE_USER_PROFILE',
  timestamp: Date.now() - 5 * 60 * 1000,
  description: 'Updated department, title on Ada Lovelace',
  status: 'completed',
  metadata: {
    type: 'UPDATE_USER_PROFILE',
    userId: '00uFAKE0000000000001',
    userLogin: 'user@example.com',
    userName: 'Ada Lovelace',
    changes,
  },
});

/** Everything captured: a clean, whole restore. */
const fullyRestorable = entry([
  captured('department', 'Platform', 'Engineering'),
  captured('title', 'Intern', 'Engineer'),
]);

/** Three of five — the partial restore, announced rather than performed quietly. */
const partiallyRestorable = entry([
  captured('department', 'Platform', 'Engineering'),
  omitted('bio', 'A long biography that exceeded the capture cap', 'too-large'),
  captured('title', 'Intern', 'Engineer'),
  omitted('notes', 'Another long note', 'too-many'),
  captured('city', '', 'Berlin'),
]);

/** The dialog that confirms — or refuses — an undo of a recorded profile write. */
const meta = {
  title: 'Sidepanel/AuditLogUndoModal',
  component: AuditLogUndoModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The confirmation for undoing a recorded profile write — and the place a refusal is explained.\n\n' +
          'Undo here is a **forward write**: Okta has no rollback, so restoring an attribute means issuing a new update that happens to set the old value. The dialog says so, because the difference is visible — the restore can fail, and it appears in the history as its own entry rather than erasing the one it undoes.\n\n' +
          'The **confirm** body lists every attribute `after → before`. When some prior values were never captured it says "3 of 5 attributes can be restored" and names the ones it will leave alone, with the reason: a silent partial restore would be a lie, and refusing outright would strand the attributes that *can* be put back.\n\n' +
          'The **drifted** body is a refusal, not an error the admin caused. The executor re-read the user and found an attribute is no longer what the original write set, so someone else owns it now; only the attribute *names* are shown, never a value. There is no confirm button in that state — re-offering the action would invite pressing past a guard that just worked.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    action: fullyRestorable,
    onClose: fn(),
    onConfirm: fn(),
    isUndoing: false,
  },
  argTypes: {
    action: { description: 'The entry being undone. `null` closes the dialog.' },
    onClose: {
      description: 'Called on Cancel, Escape, overlay click, or the header close button.',
    },
    onConfirm: { description: 'Runs the restoring write. The dialog never calls Okta itself.' },
    isUndoing: {
      description: 'Whether the restoring write is in flight; drives the confirm spinner.',
    },
    drifted: {
      description:
        'Attributes found changed in Okta since the original write. Present means the undo was refused — names only, never values.',
    },
    error: { description: 'Message from a restore that was attempted and did not succeed.' },
  },
} satisfies Meta<typeof AuditLogUndoModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything can be put back: two attributes, each `after → before`. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('dialog', { name: 'Restore previous values' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Restore' })).toBeVisible();
  },
};

/**
 * Three of five. The two whose prior value the capture policy dropped are named,
 * with why — they are left exactly as they are.
 */
export const PartialRestore: Story = {
  args: { action: partiallyRestorable },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('3 of 5 attributes can be restored.')).toBeVisible();
    await expect(canvas.getByText('Previous value was not captured (too large)')).toBeVisible();
    await expect(
      canvas.getByText('Previous value was not captured (too many attributes changed at once)'),
    ).toBeVisible();
  },
};

/**
 * A genuinely empty prior value renders as *empty* rather than as blank space —
 * "was empty" and "not captured" are different facts and must not look alike.
 */
export const RestoringToEmpty: Story = {
  args: { action: entry([captured('city', '', 'Berlin')]) },
};

/**
 * The refusal. Named attributes changed in Okta after the original write, so
 * putting the old values back would overwrite whoever changed them. No confirm
 * button, and no value anywhere on screen.
 */
export const Drifted: Story = {
  args: { drifted: ['department', 'title'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('dialog', { name: 'Undo refused' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Restore' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeVisible();
    // Names only: no captured or current value is rendered.
    await expect(canvas.queryByText(/Platform/)).toBeNull();
    await expect(canvas.queryByText(/Engineering/)).toBeNull();
  },
};

/** The restoring write is in flight; the confirm button carries its own spinner. */
export const Undoing: Story = {
  args: { isUndoing: true },
};

/** A restore that was attempted and rejected, retryable without reopening. */
export const ErrorState: Story = {
  args: { error: 'Okta rejected the profile update.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('alert')).toHaveTextContent('Okta rejected the profile update.');
    await expect(canvas.getByRole('button', { name: 'Restore' })).toBeVisible();
  },
};

/** `action: null` — the shared `Modal` renders nothing at all. */
export const Closed: Story = {
  args: { action: null },
};

/** The 360px floor, where an attribute's `after → before` pair has to wrap. */
export const Compact: Story = {
  args: { action: partiallyRestorable },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
