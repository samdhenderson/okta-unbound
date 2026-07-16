import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/** A component that throws during render, used to trigger the boundary's fallback UI. */
const Thrower: React.FC = () => {
  throw new Error('Simulated render failure for Storybook');
};

/** Trivial child rendered when nothing throws, to show the boundary passing through content. */
const Healthy: React.FC = () => (
  <div style={{ padding: 24 }}>Everything is fine — this is the guarded subtree.</div>
);

/**
 * Top-level error boundary: passes children through normally, or shows a
 * recoverable fallback (with expandable stack details) when a descendant throws.
 */
const meta = {
  title: 'Sidepanel/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    children: <Healthy />,
  },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No error — children render normally. */
export const Default: Story = {};

/** A descendant throws during render, triggering the fallback UI with error details. */
export const CaughtError: Story = {
  args: {
    children: <Thrower />,
  },
};
