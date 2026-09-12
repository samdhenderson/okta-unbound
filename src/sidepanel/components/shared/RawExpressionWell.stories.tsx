import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RawExpressionWell from './RawExpressionWell';
import { NavigationProvider } from '../../contexts/NavigationContext';

const names: Record<string, string> = { '00gFAKEWELL1': 'Engineering — Platform' };
const resolveGroupName = (groupId: string): string | undefined => names[groupId];

const meta = {
  title: 'Shared/RawExpressionWell',
  component: RawExpressionWell,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The raw-condition view `ClauseLedger` shows behind its "Raw expression" toggle: the tenant\'s own EL text in a recessed well, plus a footer stating the whole-expression resolved value.\n\n' +
          'The footer never rounds "cannot tell" to `false` — an `unevaluable` result states the reason sentence in place of a value.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={{ group: fn() }}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    expression: { description: "The rule's condition expression (untrusted Okta rule text)." },
    result: { description: 'The authoritative whole-expression verdict. Drives the footer.' },
    resolveGroupName: { description: 'Names group ids inside the expression.' },
  },
  args: {
    expression: 'isMemberOfAnyGroup("00gFAKEWELL1")',
    resolveGroupName,
  },
} satisfies Meta<typeof RawExpressionWell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A matching condition: the footer states `true`. */
export const Match: Story = { args: { result: { outcome: 'match' } } };

/** A condition that does not match: the footer states `false`. */
export const NoMatch: Story = {
  args: { expression: 'user.department == "Sales"', result: { outcome: 'no-match' } },
};

/** An unevaluable condition: the footer states the reason, never `false`. */
export const Unevaluable: Story = {
  args: {
    expression: 'user.department ==',
    result: { outcome: 'unevaluable', reasonCode: 'parse-error' },
  },
};
