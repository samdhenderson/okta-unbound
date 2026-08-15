/**
 * Tests for PageHeader.
 *
 * Focus is the additive leading slot added for `useViewStack` sub-navigation
 * (`onBack` / `backLabel` / `leading` / `breadcrumbs`) — including the regression
 * guard that a header rendered without any of them is unchanged, since every
 * existing call site (App, GroupsTab, UsersTab, RulesTab, AppsTab,
 * AuthPoliciesTab, ExportTab) passes only title/subtitle/badge/actions.
 *
 * Plus the identity region: what crossfades (the region), what deliberately does not
 * (the `<h1>` and its badge), and the one-heading invariant that rules out holding an
 * outgoing headline on screen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Breadcrumbs from './Breadcrumbs';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Groups" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Groups' })).toBeInTheDocument();
  });

  it('renders subtitle, badge, and actions', () => {
    render(
      <PageHeader
        title="Groups"
        subtitle="Manage Okta group membership"
        badge={{ text: 'Beta', variant: 'primary' }}
        actions={<button type="button">New</button>}
      />,
    );

    expect(screen.getByText('Manage Okta group membership')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('renders no leading affordance when the new slots are omitted', () => {
    render(<PageHeader title="Groups" actions={<button type="button">New</button>} />);

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    // The only button is the caller's own action — no back button was injected.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a back button that calls onBack', async () => {
    const onBack = vi.fn();
    render(<PageHeader title="Engineering" onBack={onBack} />);

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses backLabel as the accessible name of the back button', () => {
    render(<PageHeader title="Engineering" onBack={vi.fn()} backLabel="Back to groups" />);

    expect(screen.getByRole('button', { name: 'Back to groups' })).toBeInTheDocument();
  });

  it('lets a custom leading node replace the default back button', () => {
    render(<PageHeader title="Engineering" onBack={vi.fn()} leading={<span>EN</span>} />);

    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('renders the identity region below the title', () => {
    render(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,284 members</span>} />,
    );

    expect(screen.getByText('1,284 members')).toBeInTheDocument();
  });

  it('holds the outgoing identity through the crossfade, then swaps it', async () => {
    const { rerender } = render(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,284 members</span>} />,
    );

    rerender(
      <PageHeader title="Support" identityKey="00gTWO" identity={<span>42 members</span>} />,
    );

    // The title is never deferred — it is the anchor the panel is read against.
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    // ...but the outgoing identity is still mounted, fading, one frame after the swap.
    expect(screen.getByText('1,284 members')).toBeInTheDocument();

    expect(await screen.findByText('42 members')).toBeInTheDocument();
    expect(screen.queryByText('1,284 members')).not.toBeInTheDocument();
  });

  it('swaps a same-entity refresh immediately, with no crossfade to wait on', () => {
    const { rerender } = render(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,283 members</span>} />,
    );

    // Same key: this is the member count arriving, not navigation to another group.
    rerender(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,284 members</span>} />,
    );

    expect(screen.getByText('1,284 members')).toBeInTheDocument();
    expect(screen.queryByText('1,283 members')).not.toBeInTheDocument();
  });

  it('keeps exactly one level-1 heading across an identity swap', async () => {
    const { rerender } = render(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,284 members</span>} />,
    );

    rerender(
      <PageHeader title="Support" identityKey="00gTWO" identity={<span>42 members</span>} />,
    );

    // Mid-transition: holding an outgoing headline as well would put two <h1>s in the
    // tree, which the GroupsTab/UsersTab navigation suites assert can never happen.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    await screen.findByText('42 members');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('closes the region when a rung has no identity', async () => {
    const { rerender } = render(
      <PageHeader title="Engineering" identityKey="00gONE" identity={<span>1,284 members</span>} />,
    );

    rerender(<PageHeader title="Groups" subtitle="Browse, search, and manage groups" />);

    await waitFor(() => {
      expect(screen.queryByText('1,284 members')).not.toBeInTheDocument();
    });
  });

  it('renders a breadcrumb trail above the title', () => {
    render(
      <PageHeader
        title="Engineering"
        onBack={vi.fn()}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { key: 'root', label: 'Groups', onSelect: vi.fn() },
              { key: 'detail', label: 'Engineering' },
            ]}
          />
        }
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Engineering' })).toBeInTheDocument();
  });
});
