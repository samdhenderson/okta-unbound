import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupReferenceChip from './GroupReferenceChip';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { ClauseGroupReference } from '../../../shared/rules/explainExpression';

const names: Record<string, string> = { '00gFAKECHIP1': 'Engineering — Platform' };
const resolveGroupName = (groupId: string): string | undefined => names[groupId];

const meta = {
  title: 'Shared/GroupReferenceChip',
  component: GroupReferenceChip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One group an `isMemberOf*` clause named, as a small primary-tinted chip.\n\n' +
          'The satisfied/unsatisfied glyph is **complete-or-absent**: it renders only when `hasContext` says a `RuleGroupContext` was actually supplied. Without one, `reference.satisfied` would read as a definite answer about membership nobody checked, so the chip shows no glyph at all rather than guessing.\n\n' +
          'The three pattern kinds (`nameStartsWith`, `nameContains`, `nameRegex`) never name a single group, so their label stays a mono-quoted phrase naming the pattern — `startsWith "SecOps-"` — the same convention `ClauseGroupList` uses.',
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
    reference: { description: 'The group reference to render.' },
    hasContext: {
      description:
        'Whether a `RuleGroupContext` was supplied. Gates the satisfied/unsatisfied glyph.',
    },
    resolveGroupName: { description: "Names an `id`-match reference's raw id." },
  },
  args: { hasContext: true, resolveGroupName },
} satisfies Meta<typeof GroupReferenceChip>;

export default meta;
type Story = StoryObj<typeof meta>;

const idSatisfied: ClauseGroupReference = {
  match: 'id',
  value: '00gFAKECHIP1',
  satisfied: true,
  matchedGroupName: 'Engineering — Platform',
};

const idUnsatisfied: ClauseGroupReference = {
  match: 'id',
  value: '00gFAKECHIP9',
  satisfied: false,
};

const nameSatisfied: ClauseGroupReference = {
  match: 'name',
  value: 'Contractors — EMEA',
  satisfied: true,
  matchedGroupName: 'Contractors — EMEA',
};

const startsWithUnsatisfied: ClauseGroupReference = {
  match: 'nameStartsWith',
  value: 'SecOps-',
  satisfied: false,
};

const containsSatisfied: ClauseGroupReference = {
  match: 'nameContains',
  value: 'Platform',
  satisfied: true,
  matchedGroupName: 'Engineering — Platform',
};

const regexUnsatisfied: ClauseGroupReference = {
  match: 'nameRegex',
  value: '^Eng-.*',
  satisfied: false,
};

/** `match: 'id'`, resolved to a name, satisfied — the check glyph, and a copy-id control. */
export const IdSatisfied: Story = { args: { reference: idSatisfied } };

/** `match: 'id'`, no resolvable name, unsatisfied — the raw id in mono, and the minus glyph. */
export const IdUnsatisfied: Story = { args: { reference: idUnsatisfied } };

/** `match: 'name'`, satisfied. */
export const NameSatisfied: Story = { args: { reference: nameSatisfied } };

/** `match: 'nameStartsWith'`, unsatisfied — no single group to name, so the pattern itself is shown. */
export const StartsWithUnsatisfied: Story = { args: { reference: startsWithUnsatisfied } };

/** `match: 'nameContains'`, satisfied and resolved to the group it matched. */
export const ContainsSatisfied: Story = { args: { reference: containsSatisfied } };

/** `match: 'nameRegex'`, unsatisfied. */
export const RegexUnsatisfied: Story = { args: { reference: regexUnsatisfied } };

/**
 * No context at all: the same satisfied reference as {@link IdSatisfied}, but
 * with no glyph — the tick is never shown for a check that was not actually run.
 */
export const NoContext: Story = { args: { reference: idSatisfied, hasContext: false } };

/** A long resolved name at the panel's narrowest width — the chip wraps, the copy control stays. */
export const CompactPanel: Story = {
  args: {
    reference: {
      match: 'id',
      value: '00gFAKELONGID001122',
      satisfied: true,
      matchedGroupName: 'Engineering-Platform-Infrastructure-Observability',
    },
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
