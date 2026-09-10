import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ProfileDisplayOptions from './ProfileDisplayOptions';
import { fixtureAttributes, fixtureConfig } from './profileDisplayStoryFixture';

/**
 * The four display options at the top of the Profile pane's customize mode.
 */
const meta = {
  title: 'Users/ProfileDisplayOptions',
  component: ProfileDisplayOptions,
  tags: ['autodocs'],
  parameters: {
    // heading-order disabled: the options render as a page fragment out of their
    // heading context (no surrounding app shell), so axe flags the lone eyebrow.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'Layout and the three display marks, lifted from the configuration modal this feature replaces so nothing lost a home.\n\n' +
          'The "show attributes with no value" checkbox states the exact count it governs — "1 of 5 attributes are empty on this user." — because the option is otherwise a guess about a profile the admin cannot currently see. Every control is controlled by the caller\'s draft config; this component holds no state.',
      },
    },
  },
  argTypes: {
    attributes: { description: 'Every attribute on the profile — the source of the empty count.' },
    config: { description: 'The draft configuration being edited.' },
    onLayoutChange: { description: "Set the attribute list's layout." },
    onShowApiNamesChange: { description: 'Show the raw Okta key beside each label.' },
    onShowRuleChipsChange: { description: 'Mark each attribute a group rule reads.' },
    onShowEmptyChange: { description: 'Render attributes that are empty on this user.' },
  },
  args: {
    attributes: fixtureAttributes,
    config: fixtureConfig,
    onLayoutChange: fn(),
    onShowApiNamesChange: fn(),
    onShowRuleChipsChange: fn(),
    onShowEmptyChange: fn(),
  },
} satisfies Meta<typeof ProfileDisplayOptions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shipped defaults: rows layout, rule chips on, empty attributes shown. */
export const Default: Story = {};

/** Compact rows, with the Okta names revealed beside every label. */
export const CompactWithApiNames: Story = {
  args: { config: { ...fixtureConfig, layout: 'compact', showApiNames: true } },
};

/** A profile with nothing empty on it — the count says so rather than hiding. */
export const NothingEmpty: Story = {
  args: {
    attributes: fixtureAttributes.filter((attribute) => !attribute.isEmpty),
    config: { ...fixtureConfig, showEmpty: false },
  },
};
