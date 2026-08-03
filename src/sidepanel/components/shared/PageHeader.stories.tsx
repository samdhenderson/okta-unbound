import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Breadcrumbs from './Breadcrumbs';
import Button from './Button';
import PageHeader from './PageHeader';

/**
 * Top-of-view header bar with title, optional subtitle, status badge, leading back
 * affordance, breadcrumb trail, and trailing actions.
 */
const meta = {
  title: 'Shared/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Top-of-view header bar rendered at the top of a tab/view — title with optional subtitle, status badge, leading slot, breadcrumb trail, and trailing actions.\n\n' +
          'The optional badge uses PageHeader’s own local palette (`primary | success | warning | error | neutral`), which still keys on `error`; this is distinct from the canonical `StatusType` vocabulary (which uses `danger`, ADR-0002). Actions are right-aligned.\n\n' +
          'The leading-slot props (`onBack`, `leading`, `breadcrumbs`) are additive and optional — omitting them renders the original layout unchanged. They exist so a tab driven by `useViewStack` keeps **one** header mounted whose contents swap in place as views are pushed and popped, rather than each view rendering its own header.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    title: { description: 'Page/section heading.' },
    subtitle: { description: 'Optional secondary line under the title.' },
    actions: { description: 'Optional trailing action node(s), right-aligned (e.g. a `Button`).' },
    badge: {
      description: 'Optional coloured badge next to the title. Variant defaults to `neutral`.',
    },
    onBack: {
      description: 'When set, renders a leading chevron-left back button before the title.',
    },
    backLabel: {
      description: 'Accessible name / tooltip for the back button. Defaults to `Back`.',
    },
    leading: {
      description: 'Custom leading-slot node; takes precedence over the default back button.',
    },
    breadcrumbs: {
      description: 'Optional breadcrumb trail rendered above the title (e.g. a `Breadcrumbs`).',
    },
  },
  args: {
    title: 'Groups',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with title only. */
export const Default: Story = {};

/** Title with a subtitle. */
export const WithSubtitle: Story = {
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership',
  },
};

/** With a primary badge. */
export const WithBadgePrimary: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Beta', variant: 'primary' },
  },
};

/** With a success badge. */
export const WithBadgeSuccess: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Active', variant: 'success' },
  },
};

/** With a warning badge. */
export const WithBadgeWarning: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Caution', variant: 'warning' },
  },
};

/** With an error badge. */
export const WithBadgeError: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Error', variant: 'error' },
  },
};

/** With trailing action button. */
export const WithActions: Story = {
  args: {
    title: 'Groups',
    actions: <Button icon="plus">New Group</Button>,
  },
};

/** Full: title, subtitle, badge, and actions. */
export const Full: Story = {
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership',
    badge: { text: 'Beta', variant: 'primary' },
    actions: <Button icon="plus">Add Group</Button>,
  },
};

/** Drilled-in view: a back button appears in the leading slot. */
export const WithBackButton: Story = {
  args: {
    title: 'Engineering',
    subtitle: '184 members',
    onBack: fn(),
  },
};

/** Back button plus the breadcrumb trail from a view stack. */
export const WithBreadcrumbs: Story = {
  args: {
    title: 'Engineering',
    subtitle: '184 members',
    onBack: fn(),
    breadcrumbs: (
      <Breadcrumbs
        items={[
          { key: 'root', label: 'Groups', onSelect: fn() },
          { key: 'detail', label: 'Engineering' },
        ]}
      />
    ),
    actions: <Button icon="external-link">Open in Okta</Button>,
  },
};

/** A custom leading node replaces the default back button. */
export const WithCustomLeading: Story = {
  args: {
    title: 'Engineering',
    leading: (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-light text-sm font-semibold text-primary-text">
        EN
      </span>
    ),
  },
};
