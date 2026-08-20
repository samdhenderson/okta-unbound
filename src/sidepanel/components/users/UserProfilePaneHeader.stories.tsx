import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import UserProfilePaneHeader, { type ProfileEditControls } from './UserProfilePaneHeader';

/** The edit cluster in its resting, nothing-typed-yet state. */
const controls: ProfileEditControls = {
  canEdit: true,
  isEditing: false,
  changeCount: 0,
  hasInvalid: false,
  onBeginEdit: fn(),
  onCancelEdit: fn(),
  onSave: fn(),
};

/** The Profile pane's header strip: what is shown, the display gear, and the edit verbs. */
const meta = {
  title: 'Users/UserProfilePaneHeader',
  component: UserProfilePaneHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Profile pane's top strip, extracted when the pane became editable — the pane was already " +
          'at the ~300-line ceiling and the strip had grown from "a summary line and a gear" into a mode ' +
          'switch with three states.\n\n' +
          'Two clusters sit side by side. The summary sentence and the gear are constant; the edit cluster ' +
          'beside them is **Edit**, or **Cancel + Save** with a dirty count, or nothing at all.\n\n' +
          '**The Edit button is absent, not disabled, when a profile has nothing editable.** A disabled ' +
          'Edit on a profile entirely mastered by Active Directory invites the reader to hunt for the ' +
          'reason it will not press — and the per-attribute lock reasons, which only appear in edit mode, ' +
          'would have nothing to explain.\n\n' +
          'Save refuses an edit with no changes and an edit with an invalid value, so the status line ' +
          'beside it always says why: how many attributes would be written, that there is nothing to ' +
          'write yet, or that a value needs fixing first. A disabled button that does not say why is a ' +
          'dead end.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    shown: { description: 'How many attributes the filter and configuration leave on screen.' },
    total: { description: 'How many distinct attributes the profile has in total.' },
    ruleReadCount: { description: 'How many of the shown attributes a granting rule reads.' },
    onConfigure: { description: 'Opens the "Configure attribute display" modal.' },
    edit: { description: 'The edit verbs; absent on a surface that does not offer editing.' },
  },
  args: {
    shown: 12,
    total: 21,
    ruleReadCount: 2,
    onConfigure: fn(),
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas p-4">
        {/* The rung wraps the panes in one white card; the strip itself is chromeless. */}
        <div className="rounded-md border border-neutral-200 bg-white">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof UserProfilePaneHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A surface that does not offer editing at all — the Compare view's read-only
 * columns, or the pane before the org's schema has arrived. Summary and gear only.
 */
export const ReadOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Configure attribute display' }),
    ).toBeInTheDocument();
  },
};

/**
 * Editing is offered, but this profile has nothing editable — every attribute is
 * read-only, externally mastered, or absent from the org's schema. The button is
 * gone rather than dead.
 */
export const NothingEditable: Story = {
  args: { edit: { ...controls, canEdit: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  },
};

/** At least one attribute can be edited, so the verb is offered beside the gear. */
export const Editable: Story = {
  args: { edit: controls },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeEnabled();
  },
};

/**
 * Edit mode, nothing typed. Save is disabled and the line beside it says so — the
 * state a bare disabled button would leave unexplained.
 */
export const EditingClean: Story = {
  args: { edit: { ...controls, isEditing: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(canvas.getByText('No changes yet')).toBeInTheDocument();
  },
};

/** Two attributes drafted: the count names what Save would write, and Save is live. */
export const EditingDirty: Story = {
  args: { edit: { ...controls, isEditing: true, changeCount: 2 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('2 changes')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};

/** One change, singular — the count never says "changes" for one. */
export const EditingOneChange: Story = {
  args: { edit: { ...controls, isEditing: true, changeCount: 1 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 change')).toBeInTheDocument();
  },
};

/**
 * A drafted value fails validation. Save refuses even though there are changes,
 * and the reason is stated ahead of the count rather than instead of the button.
 */
export const EditingInvalid: Story = {
  args: { edit: { ...controls, isEditing: true, changeCount: 2, hasInvalid: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(canvas.getByText('Fix the highlighted values')).toBeInTheDocument();
  },
};

/**
 * The 360px floor. The summary sentence and the three-control edit cluster do not
 * share a line there, so the cluster wraps onto its own row instead of either
 * being squeezed.
 */
export const Narrow: Story = {
  args: { edit: { ...controls, isEditing: true, changeCount: 2 } },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
