/**
 * Tests for GroupComparisonModal's CSV export.
 *
 * Pins the security-critical wiring: the export must route through
 * `csvUtils` so a group whose name is an end-user-controlled spreadsheet
 * formula (e.g. `=HYPERLINK(...)`) is neutralized rather than exported as a
 * live formula (CLAUDE.md: "Escape all export output").
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupComparisonModal from './GroupComparisonModal';
import * as csvUtils from '../../../shared/utils/csvUtils';
import type { GroupSummary, GroupComparisonResult, OktaUser } from '../../../shared/types';

function group(id: string, name: string, memberCount: number): GroupSummary {
  return { id, name, type: 'OKTA_GROUP', memberCount, hasRules: false, ruleCount: 0 };
}

const EVIL_NAME = '=HYPERLINK("http://evil","x")';

const selected = [group('g1', EVIL_NAME, 5), group('g2', 'Engineering', 3)];

const result: GroupComparisonResult = {
  groups: [
    { id: 'g1', name: EVIL_NAME, memberCount: 5 },
    { id: 'g2', name: 'Engineering', memberCount: 3 },
  ],
  intersection: ['u1'],
  uniqueMembers: { g1: ['u2'], g2: [] },
  totalUniqueUsers: 7,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GroupComparisonModal export', () => {
  it('neutralizes a formula-injection group name in the exported CSV', async () => {
    // Capture the CSV string handed to the download. `generateCSV` (which applies
    // the escaping) runs for real; only the download side effect is stubbed.
    let capturedCsv = '';
    vi.spyOn(csvUtils, 'downloadCSV').mockImplementation((content: string) => {
      capturedCsv = content;
    });

    const compareGroups = vi.fn().mockResolvedValue(result);
    const memberCache = new Map<string, OktaUser[]>();

    render(
      <GroupComparisonModal
        isOpen
        onClose={vi.fn()}
        groups={selected}
        compareGroups={compareGroups}
        memberCache={memberCache}
      />,
    );

    // Comparison runs on open; the Export button appears once results resolve.
    const exportButton = await screen.findByRole('button', { name: /Export Results/i });
    await userEvent.click(exportButton);

    expect(csvUtils.downloadCSV).toHaveBeenCalledTimes(1);
    // The raw formula must NOT appear at the start of a cell.
    expect(capturedCsv).not.toMatch(/(^|\n)=HYPERLINK/);
    // It must be neutralized with a leading apostrophe (then RFC-4180 quoted
    // because the name contains commas/quotes).
    expect(capturedCsv).toContain(`'=HYPERLINK`);
  });
});
