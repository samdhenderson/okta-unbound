/**
 * @module sidepanel/components/shared/CopyIconButton.test
 * @description Pins the accessible-name flip, which no story can cover: the
 * headless story runner has no writable clipboard, and `useCopyToClipboard`
 * deliberately swallows a blocked write and leaves `copied` false — so the
 * confirmation is unreachable there by design. Rendering and axe live in
 * `CopyIconButton.stories.tsx`; only the behaviour lives here (ADR-0023).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CopyIconButton from './CopyIconButton';

/**
 * Must run *after* `userEvent.setup()`, which installs its own clipboard stub —
 * and via `defineProperty`, since `navigator.clipboard` is a getter. Same shape
 * as `EntityLink.test.tsx`'s local helper.
 */
const stubClipboard = (writeText: ReturnType<typeof vi.fn>): ReturnType<typeof vi.fn> => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
};

describe('CopyIconButton', () => {
  it('flips its accessible name to a confirmation after a successful copy', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard(vi.fn().mockResolvedValue(undefined));

    render(<CopyIconButton value="00gFAKE1a2b3c4d5e6" label="Copy group id" />);

    await user.click(screen.getByRole('button', { name: 'Copy group id' }));

    expect(writeText).toHaveBeenCalledWith('00gFAKE1a2b3c4d5e6');
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('stays in its resting state when the clipboard write is refused', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard(vi.fn().mockRejectedValue(new Error('blocked')));

    render(<CopyIconButton value="00gFAKE1a2b3c4d5e6" label="Copy group id" />);

    await user.click(screen.getByRole('button', { name: 'Copy group id' }));

    expect(writeText).toHaveBeenCalledWith('00gFAKE1a2b3c4d5e6');
    // A refused write must never claim success — the control keeps its name.
    expect(screen.getByRole('button', { name: 'Copy group id' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });
});
