import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ContextBar from './ContextBar';

/**
 * Slim merged context header: a connection status wire, one identity row, and the
 * two chrome verbs (Refresh, Pin). Pinning freezes the panel on the current
 * entity; when the live tab moves while pinned, a hint offers to switch.
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
          "One line of chrome: a hue-coded connection *wire* along the panel's top edge, the live tab's entity name, and the two global context controls (Refresh, Pin). It sits outside the panel's scroller and is therefore always on screen, which is why it carries no wordmark, no id chip and no *Pinned* badge — see the module note for what each of those was cut for. The wire costs no layout height at rest and thickens into a labelled strip with a real Reconnect control when the connection is down. Notable states: resolving (`Loading`), a connection/context failure (`ErrorState`), pinned to the current entity (`Pinned`), and pinned-but-the-live-tab-moved (`PinnedLiveChanged`). Presentational — pin/refresh behaviour and the live-vs-pinned comparison are owned by the caller (App).\n\n" +
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
    handoff: {
      description:
        "The live Okta tab's entity, offered to be opened in the panel. Rendered into the identity region in place of the plain name.",
    },
    onAcceptHandoff: { description: 'Open the offered entity in the panel.' },
    onDismissHandoff: { description: 'Decline the offer, for that entity only.' },
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
 * entity identity while the bar reports connection health truthfully — a red
 * wire, `Not connected`, and the reload-tab affordance — instead of a permanent
 * green one.
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

/** Connection/context error: the wire thickens into its labelled strip. */
export const ErrorState: Story = {
  args: {
    entityName: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
    canPin: false,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The recovery control is a real, named, keyboard-reachable button — the
    // status light it replaces was `role="img"` with nothing to press, and the
    // separate Reconnect button it replaces displaced Refresh when it appeared.
    const reconnect = canvas.getByRole('button', { name: 'Reconnect' });
    reconnect.focus();
    await expect(reconnect).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onReconnect).toHaveBeenCalled();

    // Hue is not the only carrier (ADR-0061): the strip states it in words.
    await expect(canvas.getByText('Not connected to the Okta tab')).toBeInTheDocument();
  },
};

/**
 * Refresh and Pin are in the same pixel whether the connection is healthy or
 * down. Nothing about the failure state is allowed to move them: the recovery
 * control lives in the band *above* the row, and the identity region to their
 * left is what absorbs the change. A control that changes identity under the
 * reader's pointer at the moment something goes wrong is the failure this
 * composition exists to avoid.
 */
export const ControlsDoNotMoveOnFailure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both present and named identically in the healthy state rendered here;
    // `ErrorState` above renders the same two beside a Reconnect that has been
    // added in a different band rather than in their row. Position itself is not
    // assertable in this runner — see the story description.
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Pin/ })).toBeInTheDocument();
  },
};

/**
 * With no tab to reconnect to, the strip states the status and offers nothing —
 * an action known to be impossible is omitted, not shipped disabled (ADR-0039).
 */
export const ErrorWithNoTabToReconnect: Story = {
  args: {
    entityName: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
    canPin: false,
    onReconnect: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not connected to the Okta tab')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
  },
};

/**
 * The handoff offer: the live Okta tab is on something the panel can open.
 *
 * The identity region **morphs** into the offer rather than a banner appearing:
 * the region already names this entity, so the offer is that same name made
 * pressable. Refresh and Pin are `shrink-0` in a trailing group and do not move
 * — everything the offer adds is absorbed by the truncating `flex-1` region to
 * their left. This replaces the Users tab's detected-user banner, which asked
 * the same question for one kind and spent a whole row of the tab body doing it.
 */
export const HandoffGroup: Story = {
  args: {
    handoff: { kind: 'group', id: '00gFAKE0001', name: 'Payments Team' },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /Open Payments Team in Groups/ }));
    await expect(args.onAcceptHandoff).toHaveBeenCalled();

    // Refresh and Pin are still exactly the two controls they were.
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Pin/ })).toBeInTheDocument();
  },
};

/** The user case — the one the deleted `DetectedUserBanner` used to serve alone. */
export const HandoffUser: Story = {
  args: {
    pageType: 'user',
    handoff: { kind: 'user', id: '00uFAKE0001', name: 'user@example.com' },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn(),
  },
};

/** An app, proving the affordance is not user-only. */
export const HandoffApp: Story = {
  args: {
    pageType: 'app',
    handoff: { kind: 'app', id: '0oaFAKE0001', name: 'Salesforce' },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn(),
  },
};

/**
 * The offer's full life: it appears, declining hides it for **that entity**, and
 * pointing the live Okta tab at a different one brings it back.
 *
 * Both halves matter and neither is optional. An offer that stays dismissed
 * forever is a dead feature; one that returns for the same entity is a nag. The
 * dismissal record is one Okta id held in React state for the session — nothing
 * is written to `chrome.storage`, which is plaintext, and a durable log of which
 * people an admin looked at and declined has no business being there.
 */
export const HandoffDismissAndReturn: Story = {
  render: function HandoffLifecycle(args) {
    const [live, setLive] = useState({ id: '00gFAKE0001', name: 'Payments Team' });
    const [dismissedId, setDismissedId] = useState<string | null>(null);

    return (
      <div>
        <ContextBar
          {...args}
          entityName={live.name}
          handoff={live.id === dismissedId ? null : { kind: 'group', id: live.id, name: live.name }}
          onDismissHandoff={() => setDismissedId(live.id)}
        />
        {/* Stands in for the reader navigating the live Okta tab. */}
        <button
          type="button"
          onClick={() => setLive({ id: '00gFAKE0002', name: 'Finance Team' })}
          className="m-2 underline"
        >
          Move the live tab
        </button>
      </div>
    );
  },
  args: { onAcceptHandoff: fn(), onDismissHandoff: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('button', { name: /Open Payments Team in Groups/ }),
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss Payments Team' }));
    await expect(
      canvas.queryByRole('button', { name: /Open Payments Team in Groups/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Move the live tab' }));
    await expect(
      canvas.getByRole('button', { name: /Open Finance Team in Groups/ }),
    ).toBeInTheDocument();
  },
};

/**
 * Nothing to hand over: an admin console page carries no entity at all. The
 * region falls back to its plain readout rather than to a control that would
 * only refuse (ADR-0039). `PageType`'s `admin` and `unknown` have no
 * `EntityType`, which is the guard `useEntityHandoff` holds.
 */
export const HandoffAbsentOnAdminPage: Story = {
  args: {
    pageType: 'admin',
    entityName: undefined,
    canPin: false,
    handoff: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Okta Admin')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Open / })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Dismiss / })).not.toBeInTheDocument();
  },
};
