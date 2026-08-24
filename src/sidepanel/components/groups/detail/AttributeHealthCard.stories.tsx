import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AttributeHealthCard from './AttributeHealthCard';
import type { AttributeSummary } from '../../overview/members/memberAnalytics';
import type { AttributeRuleRef } from '../../../../shared/rules/groupAttributeIndex';

const summary: AttributeSummary = {
  key: 'department',
  label: 'Department',
  distinct: 2,
  populated: 9,
  total: 12,
  fillRate: 75,
  rows: [
    { value: 'Engineering', label: 'Engineering', count: 5, pct: 41.7 },
    { value: 'Product', label: 'Product', count: 4, pct: 33.3 },
    { value: '', label: '(none)', count: 3, pct: 25 },
  ],
};

const rules: AttributeRuleRef[] = [{ ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' }];

const meta = {
  title: 'Groups/AttributeHealthCard',
  component: AttributeHealthCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    summary: { description: "The attribute's precomputed distribution." },
    rules: { description: 'The feeding rules that reference this attribute.' },
    onNavigateToRule: { description: 'Deep-links a dependent rule into the Rules tab.' },
  },
  args: { summary, rules, onNavigateToRule: fn() },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttributeHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One dependent rule, a mixed value spread. */
export const Default: Story = {};

/** Two rules depend on the same attribute. */
export const MultipleRules: Story = {
  args: {
    rules: [
      { ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' },
      { ruleId: '0prFAKE2', ruleName: 'Legacy import' },
    ],
  },
};

/** Fully populated — no blank segment. */
export const FullyPopulated: Story = {
  args: {
    summary: {
      ...summary,
      populated: 12,
      fillRate: 100,
      rows: [
        { value: 'Engineering', label: 'Engineering', count: 8, pct: 66.7 },
        { value: 'Product', label: 'Product', count: 4, pct: 33.3 },
      ],
    },
  },
};
