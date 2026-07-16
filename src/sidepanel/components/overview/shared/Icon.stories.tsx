import type { Meta, StoryObj } from '@storybook/react-vite';
import Icon, { type IconType } from './Icon';

/**
 * Inline SVG icon registry — maps icon names to Tailwind-sized, currentColor-stroked SVGs.
 */
const meta = {
  title: 'Overview/Shared/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    type: 'check',
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default icon (check, medium size). */
export const Default: Story = {};

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
      'lock',
      'refresh',
      'download',
      'settings',
      'trash',
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
