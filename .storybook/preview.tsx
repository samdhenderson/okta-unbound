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
      // Enforced: a story with an axe violation fails the browser test suite
      // (promoted from the former report-only 'todo' after the a11y cleanup pass,
      // closing the ADR-0011 follow-up).
      test: 'error',
    },
    // Side-panel width presets. The extension lives in a Chrome side panel the
    // user drags freely; `useIsNarrow(640)` condenses the ActivityBar below 640px.
    // These let a reviewer preview the compact vs. full layouts in the explorer
    // (toolbar → Viewport). No default is set, so stories still fill the canvas.
    viewport: {
      options: {
        sidepanelCompact: {
          name: 'Side panel — compact (< 640)',
          styles: { width: '360px', height: '900px' },
          type: 'other',
        },
        sidepanelDefault: {
          name: 'Side panel — default',
          styles: { width: '480px', height: '900px' },
          type: 'other',
        },
        sidepanelWide: {
          name: 'Side panel — wide (≥ 640)',
          styles: { width: '720px', height: '900px' },
          type: 'other',
        },
      },
    },
    // The extension renders in a narrow side panel; default stories to fullscreen
    // (primitive stories override to 'centered').
    layout: 'fullscreen',
  },
};

export default preview;
