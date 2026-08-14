import type { Meta, StoryObj } from '@storybook/react-vite';
import AppScopeIndicator from './AppScopeIndicator';

/** The per-row marker on an app diff row: how Okta reports the assignment, or why it cannot be reported. */
const meta = {
  title: 'Users/Comparison/AppScopeIndicator',
  component: AppScopeIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The per-row marker on an app diff row: how Okta reports the assignment, or why it cannot be reported.\n\n' +
          'Four states, in two visual registers. A **chip** is an answer Okta actually gave (`Direct`, `Via group`); ' +
          '**muted italic text** is a non-answer (`Source unknown`, `Source not compared`). Nothing is left to be ' +
          'inferred from the absence of a chip — the absence is itself spelled out.\n\n' +
          'The wording is deliberately non-exclusive. Okta returns a **single** scope per app-user and reports ' +
          '`USER` when a user is both directly assigned *and* in an assigned group, so `Direct` can only mean ' +
          '"there is a direct assignment" — never "direct only" or "not via a group". The hover description on ' +
          'each state carries that caveat in full.\n\n' +
          'Neither answer is styled as good or bad: both chips share one neutral recipe and differ only in their ' +
          'words, so the distinction is never carried by colour alone.',
      },
    },
  },
  args: { state: 'USER' },
  argTypes: {
    state: {
      description:
        "Which of the four things a row can say: a scope Okta reported (`USER`/`GROUP`), `unknown` when it reported none, or `notCompared` for a shared row backed by one user's data.",
    },
  },
} satisfies Meta<typeof AppScopeIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Okta reported a direct assignment — which does **not** rule out a group path as well. */
export const Direct: Story = { args: { state: 'USER' } };

/** Okta reported the assignment as coming from a group. Which group is not shown. */
export const ViaGroup: Story = { args: { state: 'GROUP' } };

/**
 * Okta reported no scope for this row (an unexpanded response, an older cached
 * result, or a malformed embed). Unknown is not "via group" and not "direct".
 */
export const Unknown: Story = { args: { state: 'unknown' } };

/**
 * The shared bucket: both users hold the app, but the buckets carry only the
 * compared user's scope, so no source can be stated for the row as a whole.
 */
export const NotCompared: Story = { args: { state: 'notCompared' } };

/** All four states together — the two chips read as answers, the two muted lines as non-answers. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <AppScopeIndicator state="USER" />
      <AppScopeIndicator state="GROUP" />
      <AppScopeIndicator state="unknown" />
      <AppScopeIndicator state="notCompared" />
    </div>
  ),
};
