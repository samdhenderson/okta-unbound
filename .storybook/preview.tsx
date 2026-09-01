import React from 'react';
import type { Preview, Decorator } from '@storybook/react-vite';

// Odyssey design tokens + fonts live in the @theme block of this stylesheet;
// importing it once makes every token-derived utility (bg-canvas, text-neutral-*,
// font-heading) resolve in stories.
import '../src/sidepanel/tailwind.css';

import { configure } from 'storybook/test';
import { installChromeFake } from './mocks/chrome';
import ErrorBoundary from '../src/sidepanel/components/ErrorBoundary';
import { ProgressProvider } from '../src/sidepanel/contexts/ProgressContext';
import { SchedulerProvider } from '../src/sidepanel/contexts/SchedulerContext';

// Install the benign chrome fake before any story (and thus any provider that
// polls chrome on mount) renders.
installChromeFake();

// `StableWidth` reserves a slot by rendering its widest state invisibly beside
// the live one (ADR-0044). The twin is `aria-hidden` and `invisible`, so a play
// function's text query must skip it the same way it already skips `<script>`
// and `<style>` — otherwise a reserved label matches twice. Mirrors
// `src/test/setup.ts`, which does the same for the jsdom suite.
configure({ defaultIgnore: 'script, style, [data-reserve-width], [data-reserve-width] *' });

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
        {/*
          The app sets `--font-primary` once per tab container, so every component
          inherits Inter in the real panel. Storybook has no tab container, so a
          story used to render in the browser default unless the component happened
          to force the font on itself — which two cards did and the rest did not.
          Setting it once here makes the explorer show what the panel shows, and
          removes any reason for a component to carry its own font declaration.
          `display: contents` keeps the wrapper out of layout; inherited properties
          still reach the children.
        */}
        <div style={{ fontFamily: 'var(--font-primary)', display: 'contents' }}>
          <Story />
        </div>
      </SchedulerProvider>
    </ProgressProvider>
  </ErrorBoundary>
);

/**
 * Global decorator that suppresses motion by default.
 *
 * Every story runs as a render test in headless Chromium, and the suite already
 * carries `retry: 2` for a Vite dep-optimizer race — in-flight animations would add
 * a second, timing-shaped flake source, and would make `npm run shoot` screenshots
 * non-deterministic. The `data-motion="off"` attribute is matched by the same
 * declaration block as `@media (prefers-reduced-motion: reduce)` in `tailwind.css`,
 * so this also exercises the reduced-motion code path on every CI run.
 *
 * A motion showcase story opts back in with `parameters: { motion: 'on' }`. Such a
 * story should have no `play` function.
 *
 * `display: contents` keeps the wrapper out of the layout entirely, so existing
 * story screenshots are unaffected.
 */
const withMotion: Decorator = (Story, context) => (
  <div
    data-motion={context.parameters.motion === 'on' ? 'on' : 'off'}
    style={{ display: 'contents' }}
  >
    <Story />
  </div>
);

const preview: Preview = {
  decorators: [withMotion, withProviders],
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
