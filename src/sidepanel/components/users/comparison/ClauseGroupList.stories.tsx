import type { Meta, StoryObj } from '@storybook/react-vite';
import ClauseGroupList from './ClauseGroupList';
import Button from '../../shared/Button';
import type { ClauseGroupReference } from '../../../../shared/rules/explainExpression';

const ref = (over: Partial<ClauseGroupReference> = {}): ClauseGroupReference => ({
  match: 'id',
  value: '00gFAKEgroup00001',
  satisfied: false,
  ...over,
});

/** The groups a failing `isMemberOf*` clause names, rendered per polarity. */
const meta = {
  title: 'Users/Comparison/ClauseGroupList',
  component: ClauseGroupList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The groups behind a failing group-membership clause — and the two polarities are **not** mirror ' +
          'images of each other.\n\n' +
          'A **positive** clause (`isMemberOfAnyGroup(a, b, c)`) failed because *none* of its groups matched, ' +
          'so every candidate is listed: that is what makes "it wanted any one of these and you have none" ' +
          'legible. Satisfied entries are marked rather than hidden, so a partly-satisfied list cannot be ' +
          'misread as "all of these are missing".\n\n' +
          'A **negated** clause (`!isMemberOfAnyGroup(…)`) failed because one *did* match. A real rule may ' +
          'exclude twenty groups of which the user is in one, so only the memberships they actually hold are ' +
          'shown; the rest are counted, never listed.\n\n' +
          'Group ids are labelled through `resolveGroupName` with the id kept underneath as evidence — an id ' +
          'is unreadable but it is the thing you paste into Okta. An id with no known name appears once, as ' +
          'itself.\n\n' +
          'Every state is stated in words (`already in`, `blocking`); colour never carries a meaning alone.',
      },
    },
  },
  args: { contextName: 'Sam' },
} satisfies Meta<typeof ClauseGroupList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One prerequisite group, named and offered. */
export const OnePrerequisite: Story = {
  args: {
    requirement: 'member',
    references: [ref({ value: '00gFAKEunion00001' })],
    resolveGroupName: () => 'us.employees.union',
    renderGroupAction: () => (
      <Button size="sm" variant="primary" icon="plus">
        Add
      </Button>
    ),
  },
};

/** `isMemberOfAnyGroup` — any one of these qualifies, and none is held. */
export const AnyOfSeveral: Story = {
  args: {
    requirement: 'member',
    references: [
      ref({ value: '00gFAKEunion00001' }),
      ref({ value: '00gFAKEstaff00001' }),
      ref({ value: '00gFAKEfte0000001' }),
    ],
    resolveGroupName: (id: string) =>
      ({
        '00gFAKEunion00001': 'us.employees.union',
        '00gFAKEstaff00001': 'us.employees.staff',
      })[id],
    renderGroupAction: () => (
      <Button size="sm" variant="primary" icon="plus">
        Add
      </Button>
    ),
  },
};

/** Partly satisfied: the heading stops promising that joining one would qualify them. */
export const PartlySatisfied: Story = {
  args: {
    requirement: 'member',
    references: [
      ref({ value: '00gFAKEunion00001', satisfied: true, matchedGroupName: 'us.employees.union' }),
      ref({ value: '00gFAKEstaff00001' }),
    ],
  },
};

/** More candidates than the preview limit — the rest are one click away. */
export const CollapsedCandidates: Story = {
  args: {
    requirement: 'member',
    references: Array.from({ length: 9 }, (_, i) => ref({ value: `00gFAKEgroup0000${i}` })),
  },
};

/** The exclusion case: 20 groups excluded, 1 held — only the blocker is shown. */
export const BlockedByOneOfTwenty: Story = {
  args: {
    requirement: 'non-member',
    references: [
      ref({
        value: '00gFAKEcontract01',
        satisfied: true,
        matchedGroupName: 'emea.contractors',
      }),
      ...Array.from({ length: 19 }, (_, i) => ref({ value: `00gFAKEexcluded${i}` })),
    ],
    renderGroupAction: () => (
      <Button size="sm" variant="secondary" icon="external-link">
        Open group
      </Button>
    ),
  },
};

/** A pattern match names no single group, so no action is offered. */
export const PatternMatch: Story = {
  args: {
    requirement: 'member',
    references: [ref({ match: 'nameStartsWith', value: 'sso.' })],
  },
};
