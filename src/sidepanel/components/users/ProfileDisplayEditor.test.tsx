import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileDisplayEditor from './ProfileDisplayEditor';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import { fixtureAttributes, fixtureConfig } from './profileDisplayStoryFixture';

/**
 * Behaviour tests for customize mode.
 *
 * The editor holds a **local draft** — that is the whole behaviour change from
 * the configuration modal it replaces, which wrote live. So every assertion here
 * is about what is on screen while editing, or about the one whole
 * `ProfileDisplayConfig` handed to `onCommit` when Done is pressed.
 *
 * The fixture (`profileDisplayStoryFixture`) is deliberately *interleaved* — the
 * two Identity attributes are separated in `attrOrder` by an uncategorized one —
 * so a reorder that swapped with the visual neighbour instead of the section
 * neighbour cannot pass.
 */

/** Render the editor and hand back the two spies. */
function renderEditor(props: Partial<React.ComponentProps<typeof ProfileDisplayEditor>> = {}) {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ProfileDisplayEditor
      attributes={fixtureAttributes}
      config={fixtureConfig}
      onCommit={onCommit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onCommit, onCancel };
}

/** The single config `onCommit` was called with. */
function committed(onCommit: ReturnType<typeof vi.fn>): ProfileDisplayConfig {
  expect(onCommit).toHaveBeenCalledTimes(1);
  return onCommit.mock.calls[0][0] as ProfileDisplayConfig;
}

describe('ProfileDisplayEditor', () => {
  it('keeps a hidden attribute’s row on screen and commits the whole hidden map', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Hide Last name' }));

    // The row a moment ago hidden is still here — an attribute you cannot find
    // is an attribute you cannot bring back — and its value is still legible.
    const toggle = screen.getByRole('button', { name: 'Show Last name' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Lovelace')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Whole map, not a one-key patch: the store merges a record patch by taking
    // every known attribute from the patch alone.
    expect(committed(onCommit).hidden).toEqual({
      login: false,
      lastName: true,
      firstName: false,
      department: false,
      id: false,
    });
  });

  it('narrows the rendered rows to the filter, disables the grips, and leaves the config whole', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderEditor({ filter: 'name' });

    expect(screen.getByRole('button', { name: 'Hide Last name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide Department' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide Okta ID' })).not.toBeInTheDocument();

    // A drop into a partly-rendered list would compute a position against rows
    // that are not all there, so reordering is off — and says so.
    expect(screen.getByRole('button', { name: 'Reorder Last name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reorder Identity' })).toBeDisabled();
    expect(screen.getByText('Clear the filter to reorder')).toBeInTheDocument();

    // Organization keeps its true "1 field" badge — that count is what the
    // delete consequence is measured in — so the section has to say where the
    // row went rather than sit empty under a badge that claims one.
    expect(screen.getByText('1 field, hidden by the filter')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Filtering is a view over the list, never a deletion from it.
    const config = committed(onCommit);
    expect(config.assign).toHaveProperty('department', 'organization');
    expect(config.attrOrder).toContain('id');
  });

  it('commits an inline section rename on Enter and reverts it on Escape', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Rename Identity' }));
    const field = screen.getByRole('textbox', { name: 'Rename Identity' });
    await user.clear(field);
    await user.type(field, 'People{Enter}');

    expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename People' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename People' }), ' of note{Escape}');

    expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'People of note' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));

    // The key is stable across a rename, so the section keeps its membership.
    expect(committed(onCommit).categories).toEqual([
      { key: 'identity', name: 'People' },
      { key: 'organization', name: 'Organization' },
    ]);
  });

  it('makes an added section immediately available as a drop target', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderEditor();

    await user.type(screen.getByRole('textbox', { name: 'New section name' }), 'Contact & locale');
    await user.click(screen.getByRole('button', { name: 'Add section' }));

    expect(screen.getByRole('region', { name: 'Contact & locale' })).toBeInTheDocument();

    // Okta ID sits in Uncategorized; one section back is the section just added.
    await user.click(screen.getByRole('button', { name: 'Reorder Okta ID' }));
    await user.keyboard('{ }{ArrowLeft}{Enter}');

    await user.click(screen.getByRole('button', { name: 'Done' }));

    const config = committed(onCommit);
    expect(config.categories).toContainEqual({ key: 'contact-locale', name: 'Contact & locale' });
    expect(config.assign.id).toBe('contact-locale');
  });

  it('moves an attribute across sections from the keyboard and announces where it landed', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderEditor();

    // First name is last in Identity, so one step down lands it in Organization.
    await user.click(screen.getByRole('button', { name: 'Reorder First name' }));
    await user.keyboard('{ }');
    expect(screen.getByRole('status')).toHaveTextContent('First name lifted.');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'First name moved to Organization, position 1.',
    );

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'First name moved to Uncategorized, position 3.',
    );

    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const config = committed(onCommit);
    expect(config.assign.firstName).toBe('');
    // `attrOrder` is repartitioned in section order, so the flat array and the
    // render cannot disagree: Identity, Organization, then Uncategorized.
    expect(config.attrOrder).toEqual(['login', 'department', 'lastName', 'id', 'firstName']);
  });

  it('discards the draft on Cancel', async () => {
    const user = userEvent.setup();
    const { onCommit, onCancel } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Hide Last name' }));
    await user.click(screen.getByRole('button', { name: 'Rename Identity' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename Identity' }), '!{Enter}');
    expect(screen.getByRole('region', { name: 'Identity!' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    // Nothing is written: the caller still holds the configuration it passed in.
    expect(onCommit).not.toHaveBeenCalled();
  });
});
