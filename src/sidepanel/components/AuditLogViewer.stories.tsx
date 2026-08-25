import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import AuditLogViewer from './AuditLogViewer';
import type {
  CapturedAttribute,
  UndoAction,
  UndoActionMetadata,
  UndoHistory,
} from '../../shared/undoTypes';
import type { RequestLogEntry, RequestLogHistory } from '../../shared/requestLogTypes';

/** Five minutes ago, so every entry's relative time reads the same on every run. */
const recently = Date.now() - 5 * 60 * 1000;

const entry = (
  id: string,
  description: string,
  metadata: UndoActionMetadata,
  status: UndoAction['status'] = 'completed',
): UndoAction => ({ id, type: metadata.type, timestamp: recently, description, status, metadata });

const captured = (name: string, before: string, after: string): CapturedAttribute => ({
  name,
  label: name,
  beforeDisplay: before,
  beforeRaw: before,
  afterDisplay: after,
  restorable: true,
});

/** A profile write with both prior values captured: the one undoable shape. */
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

/** Already undone — it wears the mark and is never offered a second restore. */
const undoneEntry: UndoAction = {
  ...profileUpdate,
  id: 'action_undone',
  description: 'Updated city on Grace Hopper',
  status: 'undone',
  undoneByActionId: 'action_undo',
};

/** A write nobody could confirm. "Outcome unknown", and no undo path. */
const partialEntry: UndoAction = {
  ...profileUpdate,
  id: 'action_partial',
  description: 'Updated manager on Alan Turing',
  status: 'partial',
};

const groupRemoval = entry('action_removal', 'Removed Ada Lovelace from Engineering', {
  type: 'REMOVE_USER_FROM_GROUP',
  userId: '00uFAKE0000000000001',
  userEmail: 'user@example.com',
  userName: 'Ada Lovelace',
  groupId: '00gFAKE0000000000001',
  groupName: 'Engineering',
});

const bulkRemoval = entry('action_bulk', 'Removed 12 deprovisioned users from Contractors', {
  type: 'BULK_REMOVE_USERS_FROM_GROUP',
  users: Array.from({ length: 12 }, (_, index) => ({
    userId: `00uFAKEbulk${index}`,
    userEmail: `user${index}@example.com`,
    userName: `User ${index}`,
  })),
  groupId: '00gFAKE0000000000002',
  groupName: 'Contractors',
  operationType: 'deprovisioned',
});

const ruleChange = entry('action_rule', 'Deactivated rule "Engineering — US"', {
  type: 'DEACTIVATE_RULE',
  ruleId: '0prFAKE0000000000001',
  ruleName: 'Engineering — US',
});

/** Every shape at once: undoable, refused, unknown, and the non-profile types. */
const mixedHistory: UndoAction[] = [
  profileUpdate,
  undoneEntry,
  partialEntry,
  groupRemoval,
  bulkRemoval,
  ruleChange,
];

/**
 * Seeds `chrome.storage.local` with a given undo-action history and request
 * log before a story mounts, and restores the real getter on cleanup, so the
 * viewer's parallel `getUndoHistory()`/`getRequestLog()` reads (on mount)
 * resolve to the desired state without a service mock. Runs in `beforeEach`,
 * so the override is in place before the first render.
 */
const seedAll =
  (actions: UndoAction[], requestEntries: RequestLogEntry[] = []) =>
  async () => {
    const previous = chrome.storage.local.get;
    const undoHistory: UndoHistory = { actions, maxSize: 50 };
    const apiRequestLog: RequestLogHistory = { entries: requestEntries, maxSize: 50 };
    chrome.storage.local.get = ((keys: string[]) => {
      const result: Record<string, unknown> = {};
      if (keys.includes('undoHistory')) result.undoHistory = undoHistory;
      if (keys.includes('apiRequestLog')) result.apiRequestLog = apiRequestLog;
      return Promise.resolve(result);
    }) as typeof chrome.storage.local.get;
    return () => {
      chrome.storage.local.get = previous;
    };
  };

/** Seeds only the undo-action history, with an empty request log. */
const seedHistory = (actions: UndoAction[]) => seedAll(actions, []);

/** A request-log batch entry, for the Verbose-mode story. */
const requestBatch = (
  id: string,
  reason: string,
  requestCount: number,
  endpoint: string,
): RequestLogEntry => ({
  id,
  timestamp: recently,
  reason,
  requestCount,
  endpoints: [{ method: 'GET', endpoint }],
  endpointsTruncated: false,
  durationMs: 800,
  outcome: 'all',
});

/** The History tab: what the extension has done, and the way back where there is one. */
const meta = {
  title: 'Sidepanel/AuditLogViewer',
  component: AuditLogViewer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The recorded action history, read from `chrome.storage` and live-refreshed while the tab is active.\n\n' +
          'Each entry is an `AuditLogRow` — a real disclosure with `aria-expanded`, not the `cursor-pointer` `<div>` this viewer used to render — and a profile write whose prior values were captured also carries an **Undo**, confirmed through `AuditLogUndoModal`. Undo is a forward write, so it can be refused on drift or fail outright; both keep the dialog open and explain themselves there. A resolved outcome (restored, already undone, not undoable) is reported in an inline alert above the list.\n\n' +
          'Clear History goes through the shared `Modal` rather than a native `confirm()`, which is what gives it a focus trap, focus restore and Escape. The `chrome.storage` listener is gated on `isActive`: a hidden tab registers no shared listener and re-reads when it comes back (ADR-0018).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Storage & cache](?path=/docs/internals-storage-cache--docs)',
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
  argTypes: {
    targetTabId: {
      description: "Tab hosting the live Okta session an undo's restoring write is scoped to.",
    },
    isActive: {
      description:
        'Whether the History tab is visible. Gates the `chrome.storage` listener (ADR-0018).',
    },
  },
} satisfies Meta<typeof AuditLogViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A history spanning every recorded shape. Only the completed profile write
 * offers an Undo; the undone and unconfirmed entries wear their outcome instead.
 */
export const Populated: Story = {
  beforeEach: seedHistory(mixedHistory),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('6 actions logged')).toBeVisible();
    await expect(canvas.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
    await expect(canvas.getByText('Undone')).toBeVisible();
    await expect(canvas.getByText('Outcome unknown')).toBeVisible();
  },
};

/**
 * Verbose mode off by default: a request log is recorded, but stays hidden
 * until the admin opts in — the count strip and list show only actions.
 */
export const VerboseModeOff: Story = {
  beforeEach: seedAll(
    [profileUpdate],
    [requestBatch('req_log_1', 'Populate Groups page', 42, '/api/v1/groups?limit=200')],
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('1 action logged')).toBeVisible();
    await expect(canvas.queryByText(/Populate Groups page/)).toBeNull();
  },
};

/**
 * Toggling Verbose merges the request log into the same chronological list —
 * a large batch collapses to one row rather than one per request.
 */
export const VerboseModeOn: Story = {
  beforeEach: seedAll(
    [profileUpdate],
    [requestBatch('req_log_1', 'Populate Groups page', 42, '/api/v1/groups?limit=200')],
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Verbose/ }));
    await expect(await canvas.findByText('1 action, 1 request batch logged')).toBeVisible();
    await expect(canvas.getByText('42 requests — Populate Groups page')).toBeVisible();
  },
};

/** Nothing recorded yet — the empty state, with no Clear History to offer. */
export const Empty: Story = {
  beforeEach: seedHistory([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No audit history')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Clear History' })).toBeNull();
  },
};

/**
 * A profile write, opened. The disclosure is a real button, so this is the
 * keyboard path as well as the pointer one.
 */
export const ProfileUpdate: Story = {
  beforeEach: seedHistory([profileUpdate]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', {
      name: 'Show details for Updated department, title on Ada Lovelace',
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(
      canvas.getByRole('button', {
        name: 'Hide details for Updated department, title on Ada Lovelace',
      }),
    ).toHaveAttribute('aria-expanded', 'true');
  },
};

/**
 * An entry that has already been undone. The reason it offers no second restore
 * is a sentence in the body, not a disabled button.
 */
export const Undone: Story = {
  beforeEach: seedHistory([undoneEntry]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Undone')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
  },
};

/**
 * A write whose outcome Okta never confirmed. It is never offered a restore:
 * we cannot know which values it actually set, so we cannot know what to put
 * back.
 */
export const OutcomeUnknown: Story = {
  beforeEach: seedHistory([partialEntry]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Outcome unknown')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
  },
};

/**
 * Undo opens a confirmation rather than writing: the restore is a new write to
 * Okta, and the dialog is where that is said.
 */
export const UndoConfirmation: Story = {
  beforeEach: seedHistory([profileUpdate]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Undo' }));
    const dialog = await within(document.body).findByRole('dialog');
    await expect(within(dialog).getByText('Restore previous values')).toBeVisible();
  },
};

/**
 * Clear History is destructive and irreversible, so it is confirmed in the
 * shared `Modal` — which is what brings the focus trap and Escape the native
 * `confirm()` it replaced could not offer.
 */
export const ClearHistoryConfirm: Story = {
  beforeEach: seedHistory(mixedHistory),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Clear History' }));
    const dialog = await within(document.body).findByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(within(dialog).getByRole('button', { name: 'Clear history' })).toBeVisible();
  },
};

/**
 * The 360px floor, where the count strip, the badges and the row controls all
 * compete for one width.
 */
export const Compact: Story = {
  beforeEach: seedHistory(mixedHistory),
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
