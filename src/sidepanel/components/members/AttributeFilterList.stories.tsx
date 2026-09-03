import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import AttributeFilterList from './AttributeFilterList';
import { discoverAttributeBreakdowns } from './memberAnalytics';
import type { OktaUser } from '../../../shared/types';

/** Thirty members over three departments, two titles and nine cost centres. */
const members: OktaUser[] = Array.from({ length: 30 }, (_, i) => ({
  id: `00uFAKE${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `member${i + 1}@example.com`,
    email: `member${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: ['Engineering', 'Support', 'Finance'][i % 3],
    title: i % 2 === 0 ? 'Manager' : 'Individual Contributor',
    costCenter: `CC-${100 + (i % 9)}`,
  },
}));

const attributes = discoverAttributeBreakdowns(members);

/** The profile attributes inside the member explorer's filter drawer. */
const meta = {
  title: 'Members/AttributeFilterList',
  component: AttributeFilterList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inside the filter drawer an attribute is a **route to a value**, not a report: ' +
          'picking one opens the shared `BreakdownDetailsModal` over that attribute’s full ' +
          'distribution, and picking a value there filters the member list.\n\n' +
          'That is why this is one row per attribute rather than the grid of spread-bar cards ' +
          '`CompositionReports` drew. The distribution is analysis and now lives on the ' +
          'Insights tab; what a filtering surface needs is the name, the distinct-value count ' +
          '(so a two-value attribute reads differently from a ninety-value one before it is ' +
          'opened), and whether it is currently filtering.\n\n' +
          'Each row is the shared `ListRow as="button"` and carries an accessible name saying ' +
          'what activating it does — a list of rows whose only visible text is a noun offers a ' +
          'screen-reader user no verb at all.',
      },
    },
  },
  args: {
    attributes,
    filteredKeys: new Set<string>(),
    onSelect: fn(),
  },
} satisfies Meta<typeof AttributeFilterList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every discovered attribute, none of them filtering yet. */
export const Default: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Department: choose a value to filter by' }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith('department');
  },
};

/**
 * An attribute that is currently filtering the list reads as selected, so the
 * chip on the control line above can be traced back to where it came from
 * without opening the reveal.
 */
export const OneAttributeFiltering: Story = {
  args: { filteredKeys: new Set(['department']) },
};

/**
 * A group whose members carry no browseable profile attribute at all. Said in
 * words rather than left as an empty box (`docs/ux-guidelines.md`).
 */
export const NothingToFilterBy: Story = {
  args: { attributes: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/there is nothing to filter by/)).toBeVisible();
  },
};
