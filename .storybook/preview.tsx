import React from 'react';
import type { Preview, Decorator } from '@storybook/react-vite';

// Odyssey design tokens + fonts live in the @theme block of this stylesheet;
// importing it once makes every token-derived utility (bg-canvas, text-neutral-*,
// font-heading) resolve in stories.
import '../src/sidepanel/tailwind.css';

import { installChromeFake } from './mocks/chrome';
import ErrorBoundary from '../src/sidepanel/components/ErrorBoundary';
import { ProgressProvider } from '../src/sidepanel/contexts/ProgressContext';
import { SchedulerProvider } from '../src/sidepanel/contexts/SchedulerContext';

// Install the benign chrome fake before any story (and thus any provider that
// polls chrome on mount) renders.
installChromeFake();

/**
 * Global decorator mounting the app's provider stack
 * (ErrorBoundary → ProgressProvider → SchedulerProvider). Required by the
 * `useProgress`/`useScheduler` guards for hook-coupled containers; harmless for
 * pure primitives.
 */
const withProviders: Decorator = (Story) => (
  <ErrorBoundary>
    <ProgressProvider>
      <SchedulerProvider>
        <Story />
      </SchedulerProvider>
    </ProgressProvider>
  </ErrorBoundary>
);

const preview: Preview = {
  decorators: [withProviders],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' — surface violations in the a11y panel without failing;
      // promote to 'error' once stories are clean.
      test: 'todo',
    },
    // The extension renders in a narrow side panel; default stories to fullscreen
    // (primitive stories override to 'centered').
    layout: 'fullscreen',
  },
};

export default preview;
