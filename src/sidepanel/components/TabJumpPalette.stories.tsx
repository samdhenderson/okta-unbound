import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import TabJumpPalette from './TabJumpPalette';
import type { JumpResult } from '../hooks/useJumpResolver';

/** ⌘K jump-to palette for the panel's nine top-level sections. */
const meta = {
  title: 'Sidepanel/TabJumpPalette',
  component: TabJumpPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "⌘K jump-to palette for the side panel's nine top-level sections.\n\n" +
          'The primary nav is an icon rail, so inactive tabs are icon-only — compact, but it asks the user to aim at a small target. This palette is the keyboard route to the same destinations: it costs no horizontal space and no clicks. Filtering is a case-insensitive substring match on the section label; the section you are already on is marked `aria-current="page"` and labelled **Current**; choosing a result calls the same `onTabChange` the rail calls and then closes.\n\n' +
          '**Two halves, one list.** Sections filter synchronously on every keystroke; org entities — groups, apps, rules, policies, users — arrive from `useJumpResolver` on their own debounced schedule, handed in by the `CommandPalette` container. A section jump must not get slower because the org is also being searched, so only one of the two waits. Section headings are a render-time partition over **one** flat rows array, which is what keeps the roving-focus arithmetic (wrapping Up/Down, Enter takes the top row) working unchanged across the boundary; the headings are `role="presentation"` so they can never land in the roving order.\n\n' +
          '**Every entity prop is optional.** Omit them all — as the stories below that do not name them do — and this is exactly the sections-only palette it has always been. That is the property that keeps these stories free of API mocking.\n\n' +
          '**Keyboard model — roving focus, not a combobox.** The shared `Input` does not spread arbitrary props, and bending a shared primitive with `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant` for one consumer is the wrong trade. So: Down leaves the field for the first result, Up/Down move within the list (Up off the top returns to the field), Enter or Space activates, Escape closes. Exactly one row is in the tab order at a time.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs) — the ⌘K listener itself lives in `useCommandPalette`, called once by `App`, because every tab stays mounted (ADR-0018) and a `window` listener inside a tab would be registered once per tab.',
      },
    },
  },
  argTypes: {
    isOpen: {
      description:
        'When false the palette closes; the underlying `Modal` holds the panel for one exit animation, hidden from the accessible tree.',
    },
    onClose: {
      description:
        'Invoked on Escape, overlay click, the header close button, and after a result is chosen.',
    },
    activeTab: {
      description:
        'The section currently on screen — marked `aria-current="page"` and labelled "Current".',
    },
    onSelect: {
      description:
        'Called with the chosen section id. Must be the same handler the icon rail uses.',
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    activeTab: 'home',
    onSelect: fn(),
  },
} satisfies Meta<typeof TabJumpPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three kinds, so the section boundaries and their provenance marks are visible. */
const ENTITY_RESULTS: JumpResult[] = [
  { kind: 'group', id: '00gFAKE0000000000001', name: 'Engineering', secondary: 'All engineers' },
  { kind: 'app', id: '0oaFAKE0000000000001', name: 'Salesforce' },
  { kind: 'rule', id: '0prFAKE0000000000001', name: 'Feeds Engineering', secondary: 'Active' },
  { kind: 'user', id: '00uFAKE0000000000001', name: 'Ada Lovelace', secondary: 'ada@example.com' },
];

/** Freshly opened: the unfiltered list of every section in the rail. */
export const Default: Story = {};

/** Opened from a different section, so a different row carries the "Current" marker. */
export const ActiveSectionMarked: Story = {
  args: { activeTab: 'policies' },
};

/**
 * A query narrowing the list. "or" appears mid-label in every match — Exp**or**t,
 * Expl**or**er, Hist**or**y — which is the substring (not prefix) behaviour.
 */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', { name: 'Search sections' });
    await userEvent.type(field, 'or');

    /*
      The matches are named, not just counted. A bare count rots silently every
      time a section is added — which is exactly how this story broke: `history`
      landed as the ninth section, "or" started matching three labels, and a
      count told nobody *which* three.
    */
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('3 sections'));
    await expect(canvas.getByRole('button', { name: /Export/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Explorer/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /History/ })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Groups/ })).not.toBeInTheDocument();
  },
};

/** No section matches — the shared `EmptyState`, not a blank panel. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', { name: 'Search sections' });
    await userEvent.type(field, 'zzz');
    await canvas.findByText('No sections match');
  },
};

/**
 * Both halves at once: sections on top, then org results grouped by kind.
 *
 * Prop-fed, like every story here — the container owns the hooks, so nothing is
 * mocked to get this on screen.
 */
export const WithEntityResults: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: ENTITY_RESULTS,
    canReach: () => true,
    sectionMeta: {
      group: { fromSnapshot: false, complete: true },
      app: { fromSnapshot: true, complete: true },
      rule: { fromSnapshot: true, complete: true },
      user: { fromSnapshot: false, complete: true },
    },
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Named, not counted: a bare count rots the moment a section is added, which
    // is exactly how the `Filtered` story below broke once.
    await expect(canvas.getByRole('button', { name: /^Home/ })).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Engineering — open in Groups' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Salesforce — open in Apps' })).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Ada Lovelace — open in Users' }),
    ).toBeVisible();

    // The asymmetry is stated in the headings, not buried in a footnote: apps
    // and rules came from the local snapshot for free, users could not.
    await expect(canvas.getByText('from snapshot', { exact: false })).toBeVisible();
    await expect(canvas.getByText(/Users/).closest('li')).toHaveTextContent('live');
  },
};

/** Mid-search: the spinner is in the field and the previous rows are held. */
export const EntitySearching: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'searching',
    entityResults: ENTITY_RESULTS,
    canReach: () => true,
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Held across a refining search: emptying the list mid-word would replay the
    // entrance animation and read as the palette losing its place.
    await expect(
      canvas.getByRole('button', { name: 'Engineering — open in Groups' }),
    ).toBeVisible();
  },
};

/** The org search failed — a `danger` banner, not a list that reads as "nothing". */
export const EntityError: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'error',
    entityResults: [],
    entityError: 'Search failed. Check the connection to Okta and try again.',
    canReach: () => true,
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Search failed');
  },
};

/**
 * A snapshot walk that has not finished. The heading says so rather than letting
 * a partial collection pass for the whole org (ADR-0040 §7).
 */
export const PartialSnapshot: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: [ENTITY_RESULTS[1]],
    canReach: () => true,
    sectionMeta: { app: { fromSnapshot: true, complete: false } },
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/partial snapshot/)).toBeVisible();
  },
};

/** Below the character floor: the palette says what it is waiting for. */
export const BelowMinChars: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'idle',
    entityResults: [],
    canReach: () => true,
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', { name: 'Search sections' });
    await userEvent.type(field, 'en');

    // Sections still filter instantly at two characters — only the org search waits.
    await expect(canvas.getByRole('button', { name: /^Home/ })).toBeVisible();
    await expect(canvas.getByText('Type 3 characters to search the org.')).toBeVisible();
  },
};

/**
 * A kind this build cannot open renders a working Okta link rather than a
 * control that only refuses (ADR-0039).
 */
export const UnreachableKind: Story = {
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: ENTITY_RESULTS,
    canReach: () => false,
    oktaOrigin: 'https://example.okta.com',
    onEntitySelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('link', { name: /Okta/i }).length).toBeGreaterThan(0);
  },
};

/** Closed — the palette renders nothing at all. */
export const Closed: Story = {
  args: { isOpen: false },
};

/**
 * Motion enabled, so the overlay/panel entrance and the staggered `rise-in` of
 * the result rows run at their real durations. No `play` function — an
 * interaction assertion would race the animation.
 */
export const MotionShowcase: Story = {
  parameters: { motion: 'on' },
  globals: { viewport: { value: 'sidepanelDefault' } },
};
