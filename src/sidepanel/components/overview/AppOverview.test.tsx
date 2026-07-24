/**
 * @module sidepanel/components/overview/AppOverview.test
 * @description Tests the minimal detected-app Overview branch: its export
 * deep-links route to the correct app-scoped descriptors.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppOverview from './AppOverview';

describe('AppOverview', () => {
  it('deep-links each export to its app-scoped descriptor with the app as context', async () => {
    const onExport = vi.fn();
    render(<AppOverview appId="0oaABC" appName="Salesforce" onExport={onExport} />);

    expect(screen.getByText('Salesforce')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Export App Users' }));
    expect(onExport).toHaveBeenCalledWith('app-users', '0oaABC', 'Salesforce');

    await userEvent.click(screen.getByRole('button', { name: 'Export App Groups' }));
    expect(onExport).toHaveBeenCalledWith('app-groups', '0oaABC', 'Salesforce');
  });
});
