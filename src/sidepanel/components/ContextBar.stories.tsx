import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import ContextBar from './ContextBar';

/**
 * Slim merged context header (identity + connection + refresh + pin). Replaces the
 * old stacked ContextBanner and Overview PageHeader. Pinning freezes the panel on
 * the current entity; when the live tab moves while pinned, a hint offers to switch.
 */
const meta = {
  title: 'Sidepanel/ContextBar',
  component: ContextBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One line of top chrome: what the live Okta tab is on, plus Refresh and Pin.\n\n' +
          "One line of chrome: a hue-coded connection dot, the live tab's entity name, and the two global context controls. It sits outside the panel's scroller and is therefore always on screen, which is why it carries no wordmark, no id chip and no *Pinned* badge — see the module note for what each of those was cut for. Notable states: resolving (`Loading`), a connection/context failure with a reload-tab affordance (`ErrorState`), pinned to the current entity (`Pinned`), and pinned-but-the-live-tab-moved (`PinnedLiveChanged`). Presentational — pin/refresh behaviour and the live-vs-pinned comparison are owned by the caller (App).\n\n" +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  argTypes: {
    pageType: { description: 'Detected page type; drives the label fallback and dot colour.' },
    entityName: { description: 'Display name of the detected (or pinned) entity, if resolved.' },
    connectionStatus: { description: 'Connection state to the Okta tab.' },
    isLoading: { description: 'Whether page context is still resolving.' },
    error: { description: 'Connection/context error message, or `null` when healthy.' },
    isPinned: { description: 'Whether the panel is currently pinned to the entity.' },
    canPin: {
      description: 'Whether pinning is available right now (a group/user entity is present).',
    },
    liveContextChanged: {
      description: 'While pinned, `true` once the live Okta tab has navigated to another entity.',
    },
    liveEntityName: {
      description: 'Optional name of the live entity, shown in the switch hint when known.',
    },
    onTogglePin: { description: 'Toggle the pin on/off.' },
    onRefresh: {
      description:
        'Re-read whatever the panel is showing, and re-probe the live context. Never disabled while pinned.',
    },
    refreshSubjectName: {
      description:
        "What Refresh will act on, in the reader's words. Reaches the control's tooltip and accessible name only — never visible text in the band.",
    },
    onReconnect: {
      description:
        'Reload the Okta tab to re-establish the content script, then re-detect. Shown only on error.',
    },
  },
  args: {
    pageType: 'group',
    entityName: 'Engineering Team',
    connectionStatus: 'connected',
    isLoading: false,
    error: null,
    isPinned: false,
    canPin: true,
    onTogglePin: fn(),
    onRefresh: fn(),
    onReconnect: fn(),
  },
} satisfies Meta<typeof ContextBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A resolved group page, unpinned. */
export const Default: Story = {};

/**
 * The refresh control **names its subject** — the rung on screen supplies it
 * through `useRefreshSubject` — but only in the tooltip and the accessible name.
 *
 * The band's own readout describes the *live Okta tab*, which may be on a
 * different entity entirely; printing the browsed entity's name here as label
 * text, a badge or a count is the ADR-0032 §1 convergence. So the play function
 * asserts both halves: the control is reachable by that name, and the name
 * appears nowhere a reader can see it.
 */
export const RefreshNamesItsSubject: Story = {
  args: {
    entityName: 'Engineering Team',
    refreshSubjectName: 'Payments Team',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const refresh = canvas.getByRole('button', { name: 'Refresh Payments Team' });
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveAttribute('title', 'Refresh Payments Team');

    // The subject is not visible anywhere in the band — only the live tab's
    // entity is, and the two are deliberately different here.
    await expect(canvasElement).toHaveTextContent('Engineering Team');
    await expect(canvasElement).not.toHaveTextContent('Payments Team');
  },
};

/**
 * With no rung claiming the control (a section that has registered no subject),
 * the name degrades to a bare *Refresh* rather than to a deictic guess.
 */
export const RefreshUnclaimed: Story = {
  args: { refreshSubjectName: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  },
};

/**
 * Pinned, and Refresh is still live. The pin governs which entity the panel
 * follows; it says nothing about whether the data under it is current, so only
 * the context re-probe half of a press is skipped (ADR-0069 §2). It used to be
 * disabled here, which was right for a control that only re-probed context.
 */
export const PinnedRefreshStaysEnabled: Story = {
  args: { isPinned: true, refreshSubjectName: 'Payments Team' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Refresh Payments Team' })).toBeEnabled();
  },
};

/** A resolved user page (accent dot). */
export const UserPage: Story = {
  args: {
    pageType: 'user',
    entityName: 'Jordan Rivera',
  },
};

/** Pinned to the current group. */
export const Pinned: Story = {
  args: { isPinned: true },
};

/** Pinned, but the live tab has moved to another entity — switch hint shown. */
export const PinnedLiveChanged: Story = {
  args: { isPinned: true, liveContextChanged: true, liveEntityName: 'Finance Team' },
};

/**
 * Pinned, but the connection to the Okta tab is down. The pin keeps the frozen
 * entity identity while the bar reports connection health truthfully — a red dot,
 * `Not connected`, and the reload-tab affordance — instead of a permanent green dot.
 */
export const PinnedDisconnected: Story = {
  args: {
    isPinned: true,
    connectionStatus: 'error',
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
  },
};

/** Nothing pinnable yet (admin/unknown page) — pin disabled. */
export const NotPinnable: Story = {
  args: {
    pageType: 'admin',
    entityName: undefined,
    canPin: false,
  },
};

/** Context still resolving. */
export const Loading: Story = {
  args: {
    isLoading: true,
    connectionStatus: 'connecting',
    entityName: undefined,
    canPin: false,
  },
};

/** Connection/context error, with the reconnect (reload-tab) affordance. */
export const ErrorState: Story = {
  args: {
    entityName: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
    canPin: false,
  },
};
