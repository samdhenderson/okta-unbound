import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import Icon, { type IconType } from './Icon';

/**
 * Inline SVG icon registry — maps icon names to Tailwind-sized, currentColor-stroked SVGs.
 */
const meta = {
  title: 'Shared/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Inline SVG icon registry shared across the Overview tab components.\n\n' +
          'A single stateless component that maps an icon name to a Tailwind-sized, ' +
          '`currentColor`-stroked SVG, so stat cards, quick actions, and facets can ' +
          'reference glyphs by name without an external icon library. Size is one of ' +
          '`xs` (12px), `sm` (16px), `md` (20px), `lg` (24px), `xl` (32px); pass a color ' +
          'token through `className`. See `AllIcons` for the full catalog.\n\n' +
          '**Decorative by default.** Every glyph is `aria-hidden` unless `label` says it carries ' +
          'meaning of its own, because an icon beside the label it illustrates announces a ' +
          'duplicate of what the reader has already heard. None of the app’s ~214 call sites hid ' +
          'its icon before this default (`D-041`), and defaulting the other way is what makes the ' +
          'quiet case the cheap one: a call site has to *state* that its icon is the answer, ' +
          'rather than remember that it is not.\n\n' +
          '`label` is **not** how an icon-only control gets its name — that comes from the ' +
          'control (`IconButton`’s `label`, or an `aria-label`), because the button is the thing ' +
          'a reader activates.',
      },
    },
  },
  argTypes: {
    type: { description: 'Which glyph to render (see the `AllIcons` catalog).' },
    className: { description: 'Extra classes merged after the size class (e.g. a color token).' },
    size: {
      description: 'Preset square dimensions: xs=12px, sm=16px, md=20px, lg=24px, xl=32px.',
    },
    label: {
      description:
        'Accessible name, for the rare glyph that *is* the answer. Omit it and the icon leaves the accessibility tree.',
    },
  },
  args: {
    type: 'check',
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default icon (check, medium size) — decorative, and absent from the accessibility tree. */
export const Default: Story = {};

/**
 * The opt-out: a glyph standing alone as a status, with no text beside it to
 * duplicate. It takes `role="img"` and the name it is given.
 *
 * The check the pair is worth making: the labelled icon is reachable by role, and
 * the default one is not there at all.
 */
export const NamedWhenTheGlyphIsTheAnswer: Story = {
  args: { type: 'shield', label: 'MFA enrolled' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'MFA enrolled' })).toBeInTheDocument();
  },
};

/** Extra-small size. */
export const ExtraSmall: Story = {
  args: {
    size: 'xs',
  },
};

/** Small size. */
export const Small: Story = {
  args: {
    size: 'sm',
  },
};

/** Large size. */
export const Large: Story = {
  args: {
    size: 'lg',
  },
};

/** Extra-large size. */
export const ExtraLarge: Story = {
  args: {
    size: 'xl',
  },
};

/** Users icon. */
export const Users: Story = {
  args: {
    type: 'users',
  },
};

/** Alert icon. */
export const Alert: Story = {
  args: {
    type: 'alert',
  },
};

/** Settings icon. */
export const Settings: Story = {
  args: {
    type: 'settings',
  },
};

/** Upload icon. */
export const Upload: Story = {
  args: {
    type: 'upload',
  },
};

/** Pencil (edit/rename) icon. */
export const Pencil: Story = {
  args: {
    type: 'pencil',
  },
};

/** With custom color class. */
export const WithCustomColor: Story = {
  args: {
    type: 'bolt',
    className: 'text-primary',
  },
};

/** Icon grid showing all available types. */
export const AllIcons: Story = {
  render: () => {
    const iconTypes: IconType[] = [
      'users',
      'user',
      'check',
      'alert',
      'bolt',
      'chart',
      'app',
      'building',
      'home',
      'lock',
      'refresh',
      'download',
      'upload',
      'settings',
      'trash',
      'pencil',
      'plus',
      'minus',
      'search',
      'link',
      'list',
      'hand',
      'key',
      'sparkles',
      'pause',
      'shield',
      'clipboard',
      'clipboard-check',
      'chevron-left',
      'chevron-down',
      'chevron-right',
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {iconTypes.map((type) => (
          <div
            key={type}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <Icon type={type} size="lg" />
            <span style={{ fontSize: 12, textAlign: 'center' }}>{type}</span>
          </div>
        ))}
      </div>
    );
  },
};
