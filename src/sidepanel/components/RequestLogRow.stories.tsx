import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import RequestLogRow from './RequestLogRow';
import type { RequestLogEntry } from '../../shared/requestLogTypes';

/** Five minutes ago, so every row's relative time reads the same on every run. */
const recently = Date.now() - 5 * 60 * 1000;

const entry = (overrides: Partial<RequestLogEntry> = {}): RequestLogEntry => ({
  id: 'req_log_1',
  timestamp: recently,
  reason: 'Load group members',
  requestCount: 1,
  endpoints: [{ method: 'GET', endpoint: '/api/v1/groups/00gFAKE0000000000001/users' }],
  endpointsTruncated: false,
  durationMs: 120,
  outcome: 'all',
  ...overrides,
});

/** A single request — no disclosure, the endpoint shows inline as a badge. */
const single = entry();

/** A batch of many requests that all succeeded. */
const batch = entry({
  id: 'req_log_batch',
  reason: 'Populate Groups page',
  requestCount: 42,
  endpoints: [
    { method: 'GET', endpoint: '/api/v1/groups?limit=200' },
    { method: 'GET', endpoint: '/api/v1/groups?limit=200&after=00gFAKE0000000000042' },
    { method: 'GET', endpoint: '/api/v1/groups/00gFAKE0000000000001/stats' },
  ],
  endpointsTruncated: false,
  durationMs: 3_400,
});

/** A batch whose distinct-endpoint count exceeds what the log keeps a sample of. */
const truncatedBatch = entry({
  id: 'req_log_truncated',
  reason: 'Org inventory sync: Users',
  requestCount: 200,
  endpoints: Array.from({ length: 20 }, (_, i) => ({
    method: 'GET' as const,
    endpoint: `/api/v1/users?limit=200&after=00uFAKE${String(i).padStart(13, '0')}`,
  })),
  endpointsTruncated: true,
  durationMs: 45_000,
});

/** Every request in the batch failed. */
const failedBatch = entry({
  id: 'req_log_failed',
  reason: 'Load app assignments',
  requestCount: 3,
  endpoints: [{ method: 'GET', endpoint: '/api/v1/apps/0oaFAKE0000000000001/users' }],
  outcome: 'none',
});

/** Some requests in the batch failed, some succeeded. */
const partialBatch = entry({
  id: 'req_log_partial',
  reason: 'Bulk remove user from group',
  requestCount: 5,
  endpoints: [
    { method: 'DELETE', endpoint: '/api/v1/groups/00gFAKE0000000000001/users/<USER_ID>' },
  ],
  outcome: 'partial',
});

/** One entry in the History tab's verbose mode: a batch of requests sharing a reason. */
const meta = {
  title: 'Sidepanel/RequestLogRow',
  component: RequestLogRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "One batch of Okta API requests that shared a `reason` — the row the History tab's **Verbose** mode adds alongside the existing undo-action rows.\n\n" +
          'A batch of one request renders its endpoint inline, no disclosure needed. A larger batch collapses to `N requests — reason` with the same `ListRow` + `IconButton`/`aria-expanded` disclosure shape as `AuditLogRow`, so the two entry kinds read as one list.\n\n' +
          'Endpoints were already redacted (`shared/utils/redact`) before they reached storage; this row does not redact anything itself.',
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
    entry: single,
    isExpanded: false,
    onToggle: fn(),
  },
  argTypes: {
    entry: { description: 'The request-log entry this row is about.' },
    isExpanded: {
      description:
        'Whether the disclosure is open. Owned by the list, so a refresh cannot close a row.',
    },
    onToggle: { description: "Toggles this row's disclosure, by entry id." },
  },
} satisfies Meta<typeof RequestLogRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single request: reason, its one endpoint as a badge, and no chevron. */
export const SingleRequest: Story = {
  args: { entry: single },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Load group members')).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/** A collapsed batch — the count and reason on one line, closed by default. */
export const CollapsedBatch: Story = {
  args: { entry: batch, isExpanded: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('42 requests — Populate Groups page')).toBeVisible();
    await expect(canvas.getByRole('button', { expanded: false })).toBeVisible();
  },
};

/** An expanded batch: every distinct endpoint listed underneath. */
export const ExpandedBatch: Story = {
  args: { entry: batch, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /*
      Exact strings, not `/groups\?limit=200/`: the batch's second endpoint is the
      *next page* of the first (`…&after=…`), so a substring regex matches both
      spans and `getByText` throws on the ambiguity. Naming each one is also the
      better assertion — what an expanded batch owes the reader is its distinct
      endpoints, and a paginated pair is exactly the case where "distinct" earns
      its keep.
    */
    await expect(canvas.getByText('/api/v1/groups?limit=200')).toBeVisible();
    await expect(
      canvas.getByText('/api/v1/groups?limit=200&after=00gFAKE0000000000042'),
    ).toBeVisible();
    await expect(canvas.getByText('/api/v1/groups/00gFAKE0000000000001/stats')).toBeVisible();
  },
};

/** A batch bigger than the endpoint sample the log keeps — the truncation note shows. */
export const TruncatedEndpoints: Story = {
  args: { entry: truncatedBatch, isExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Showing 20 of 200 requests.')).toBeVisible();
  },
};

/** Every request in the batch failed — the `Failed` mark, not a silent success line. */
export const AllFailed: Story = {
  args: { entry: failedBatch, isExpanded: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Failed')).toBeVisible();
  },
};

/** A mixed outcome — some of the batch's requests failed, some succeeded. */
export const PartiallyFailed: Story = {
  args: { entry: partialBatch, isExpanded: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Some failed')).toBeVisible();
  },
};

/** The disclosure, driven from the chevron the way a reader opens it. */
export const OpeningTheDisclosure: Story = {
  args: { entry: batch, isExpanded: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show the 42 requests for Populate Groups page',
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith('req_log_batch');
  },
};

/**
 * The 360px floor, where the reason, badges, time and chevron all compete for
 * one row. The reason line truncates rather than pushing the chevron off.
 */
export const Compact: Story = {
  args: { entry: truncatedBatch },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
