import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ProfileDisplayEditor from './ProfileDisplayEditor';
import { fixtureAttributes, fixtureConfig } from './profileDisplayStoryFixture';

/** Customize mode's body and its footer bar. */
const meta = {
  title: 'Users/ProfileDisplayEditor',
  component: ProfileDisplayEditor,
  tags: ['autodocs'],
  parameters: {
    // heading-order disabled: the editor renders as a page fragment out of its
    // heading context (no surrounding app shell), so axe flags its section
    // eyebrows.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The Profile pane while an admin is arranging it: the display options, every section with every attribute under it, the add-section form, and Reset / Cancel / Done.\n\n' +
          "This replaces a two-tab configuration modal that wrote live and asked an admin to arrange a profile they could not see while arranging it. Here the rows being reordered **are** the profile's rows, and nothing is written until Done — `Reset to default` acts on the draft too, so it stays undoable by Cancel.\n\n" +
          'Reordering works with a pointer and with the keyboard from the same handles, and every move is announced in a polite live region. A non-empty `filter` keeps the list findable but turns the grips off, because a drop into a partly-rendered list would compute a position against rows that are not all there.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    attributes: { description: 'Every attribute on this profile, empty ones included.' },
    config: { description: 'The reconciled configuration the draft starts from.' },
    onCommit: { description: 'Done — receives the whole edited configuration.' },
    onCancel: { description: 'Cancel — the draft is discarded and nothing is written.' },
    ruleReads: { description: 'Attribute Okta name → the rules that read it.' },
    filter: { description: "The pane's live free-text filter; non-empty disables reordering." },
  },
  args: {
    attributes: fixtureAttributes,
    config: fixtureConfig,
    onCommit: fn(),
    onCancel: fn(),
    ruleReads: { department: ['Engineering auto-join'] },
  },
} satisfies Meta<typeof ProfileDisplayEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two admin sections plus Uncategorized, with the rule mark on `department`. */
export const Default: Story = {};

/** A hidden attribute keeps its row, struck through, so it can be restored where it lives. */
export const WithHiddenAttribute: Story = {
  args: { config: { ...fixtureConfig, hidden: { ...fixtureConfig.hidden, lastName: true } } },
};

/** A live filter: the list narrows to a find, and the grips state why they are off. */
export const Filtered: Story = { args: { filter: 'name' } };

/** An org with no sections yet — everything lands in Uncategorized. */
export const Empty: Story = {
  args: { config: { ...fixtureConfig, categories: [], assign: {}, attrOrder: [] } },
};
