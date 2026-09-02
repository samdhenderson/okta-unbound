/**
 * @module sidepanel/components/TabNavigation.test
 * @description Pins the rail's ⌘K affordance to the palette it claims to open.
 *
 * ADR-0063 left Explorer and History with no rail seat and the ⌘K chord as their
 * only route, and `useCommandPalette().open()` had no caller at all — so the two
 * sections were unreachable for anyone who did not already know the shortcut.
 * The contract this file holds is end-to-end rather than "the callback fired":
 * the harness wires `useCommandPalette` the way `App` does and renders the real
 * `TabJumpPalette`, so the assertion is that a click puts the palette dialog on
 * screen, listing the sections the rail has no glyph for.
 *
 * The strip's own rendering, overflow and roving-tabindex behaviour stay in
 * `TabNavigation.stories.tsx` (ADR-0023) — this file is here for the behaviour
 * a story cannot state.
 */
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabNavigation from './TabNavigation';
import TabJumpPalette from './TabJumpPalette';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { RAIL_TAB_DEFS, type TabType } from '../tabs';

/**
 * The shell, reduced to the two things this contract spans: the rail and the
 * palette, sharing one `useCommandPalette` exactly as `App` does.
 */
function Shell() {
  const palette = useCommandPalette();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  return (
    <>
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCommandPalette={palette.open}
        shortcutPlatform="other"
      />
      <TabJumpPalette
        isOpen={palette.isOpen}
        onClose={palette.close}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />
    </>
  );
}

/**
 * The affordance, matched on the name a screen reader actually announces: the
 * modifier is spelled out, and the `⌘`/`Ctrl K` glyph beside it is `aria-hidden`
 * so it is not read twice.
 */
const shortcutButton = () =>
  screen.getByRole('button', { name: 'Search and jump to a section, Ctrl K' });

describe('TabNavigation ⌘K affordance', () => {
  it('opens the palette when pressed', async () => {
    render(<Shell />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(shortcutButton());

    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Jump to section');
  });

  it('reaches a section the rail has no seat for', async () => {
    render(<Shell />);

    // The regression in full: Explorer has no tab, so before this control the
    // only route to it was a chord nothing on screen mentioned.
    expect(screen.queryByRole('tab', { name: 'Explorer' })).toBeNull();

    await userEvent.click(shortcutButton());
    await userEvent.click(await screen.findByRole('button', { name: /^Explorer/ }));

    // The palette closed onto Explorer, and the rail honestly shows no selection.
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('sits beside the tablist rather than inside it', () => {
    render(<Shell />);

    // It opens a dialog; announcing it as a tab would be a lie, and an extra
    // `role="tab"` child would break the strip's one-tab-stop contract besides.
    const rail = screen.getByRole('tablist', { name: 'Main sections' });
    expect(within(rail).queryByRole('button', { name: /Search and jump/ })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(RAIL_TAB_DEFS.length);
  });
});
