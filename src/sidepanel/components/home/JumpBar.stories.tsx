import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import JumpBar from './JumpBar';
import type { JumpResult, UseJumpResolverResult } from '../../hooks/useJumpResolver';

/**
 * A frozen resolver state. `JumpBar` is presentational — every rule about what
 * costs a request lives in `useJumpResolver` — so the stories dictate a state
 * rather than driving the real hook.
 */
const jumpState = (over: Partial<UseJumpResolverResult> = {}): UseJumpResolverResult => ({
  query: '',
  setQuery: fn(),
  mode: 'idle',
  results: [],
  error: null,
  isIdQuery: false,
  resolution: null,
  submit: fn(),
  clear: fn(),
  ...over,
});

const GROUP: JumpResult = { kind: 'group', id: '00gFAKE0000000000001', name: 'Engineering' };
const RULE: JumpResult = {
  kind: 'rule',
  id: '0prFAKE0000000000001',
  name: 'Eng — All ICs',
  secondary: 'Active',
};
const USER: JumpResult = {
  kind: 'user',
  id: '00uFAKE0000000000001',
  name: 'Ada Lovelace',
  secondary: 'ada@example.com',
};

const meta = {
  title: 'Home/JumpBar',
  component: JumpBar,
  parameters: {
    // heading-order disabled: the "nothing matched" `EmptyState` renders an `h3`
    // with no surrounding page heading, which axe reads as a skipped level.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The Home tab’s first region: one input that **resolves** an id or **searches** names and ' +
          'emails. The distinction is the whole point — an admin usually already has the id, and a name ' +
          'search cannot match one.\n\n' +
          '| Input | Before Enter | On Enter |\n' +
          '| --- | --- | --- |\n' +
          '| A well-formed id | nothing | one local lookup; a request only on a miss |\n' +
          '| 3+ characters of a name | one debounced search | re-runs it immediately |\n' +
          '| 0–2 characters | nothing | nothing |\n\n' +
          'The footnote reports what the resolution **actually cost**. Groups, rules and apps are ' +
          'already in the local org snapshot (ADR-0040), so those resolve at zero requests; users are ' +
          'deliberately not stored (ADR-0040 §5), so a user id always costs one. The design specified a ' +
          'fixed "1 request", which the snapshot makes untrue about half the time — a cost line that is ' +
          'sometimes wrong is worse than none.\n\n' +
          'Rows rise in via `.rise-in-stagger`, the app’s existing CSS-only stagger. No raw `ms` or ' +
          'inline `cubic-bezier()` reaches shipped code.',
      },
    },
  },
  argTypes: {
    jump: { description: 'Live resolver state from `useJumpResolver`.' },
    onSelect: { description: 'Open a result on its owning tab.' },
    canReach: { description: 'Whether a result’s kind has a destination in this build.' },
    autoFocus: { description: 'Focus on mount. The tab passes this only on first activation.' },
  },
  args: {
    onSelect: fn(),
    canReach: (_kind: JumpResult['kind']): boolean => true,
    oktaOrigin: 'https://example.okta.com',
    jump: jumpState(),
  },
} satisfies Meta<typeof JumpBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state. The helper line explains the two behaviours before either runs. */
export const Idle: Story = {};

/**
 * A well-formed id has been pasted. The helper line switches to name the action,
 * and — critically — **no request has been issued**. Nothing happens until Enter.
 */
export const IdTyped: Story = {
  args: { jump: jumpState({ query: '00gFAKE0000000000001', isIdQuery: true }) },
};

/** A name search in flight: the spinner shares the trailing slot with Clear. */
export const Searching: Story = {
  args: { jump: jumpState({ query: 'engineering', mode: 'searching' }) },
};

/**
 * The design's "Resolving" state: an id returned the entity and the rules
 * touching it, each row labelled with the tab it opens. Resolved from the local
 * snapshot, so the footnote says **no request**.
 */
export const ResolvedFromSnapshot: Story = {
  args: {
    jump: jumpState({
      query: '00gFAKE0000000000001',
      isIdQuery: true,
      mode: 'results',
      results: [GROUP, RULE],
      resolution: { cost: 0 },
    }),
  },
};

/** The same shape for a user id, which the snapshot cannot hold — one request. */
export const ResolvedFromOkta: Story = {
  args: {
    jump: jumpState({
      query: '00uFAKE0000000000001',
      isIdQuery: true,
      mode: 'results',
      results: [USER],
      resolution: { cost: 1 },
    }),
  },
};

/** Name-search results across kinds. No footnote: nothing was *resolved*. */
export const SearchResults: Story = {
  args: {
    jump: jumpState({ query: 'eng', mode: 'results', results: [GROUP, USER] }),
  },
};

/**
 * An app result in a build with no app navigation handler. The row keeps a real
 * route — "Open in Okta" — instead of rendering a control that refuses.
 */
export const UnreachableKind: Story = {
  args: {
    canReach: (kind: JumpResult['kind']): boolean => kind !== 'app',
    jump: jumpState({
      query: 'datadog',
      mode: 'results',
      results: [{ kind: 'app', id: '0oaFAKE0000000000001', name: 'Datadog' }],
    }),
  },
};

/** An id that resolved to nothing. The copy differs from the name-search miss. */
export const NoSuchId: Story = {
  args: {
    jump: jumpState({
      query: '00gFAKE0000000000009',
      isIdQuery: true,
      mode: 'results',
      resolution: { cost: 0 },
    }),
  },
};

/** A name that matched nothing. */
export const NoMatches: Story = {
  args: { jump: jumpState({ query: 'zzzz', mode: 'results' }) },
};

/**
 * Every search leg failed. An empty list would read as "nothing matched", which
 * is a different and wrong claim — so the bar says what actually happened.
 */
export const Failed: Story = {
  args: {
    jump: jumpState({
      query: 'eng',
      mode: 'error',
      error: 'Search failed. Check the connection to Okta and try again.',
    }),
  },
};
