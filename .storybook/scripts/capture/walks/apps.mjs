/**
 * Apps — a tour chapter.
 *
 * The application inventory, narrowed by status and then re-sorted. One
 * interaction each way, and both of them state their result: the toolbar prints
 * `Showing N of M`, so the narrowing is a figure rather than an impression.
 *
 * @module
 */
import { appSort, appStatusFilter, railTab, readAppCounts } from '../selectors.mjs';

export async function walk({ page, drive, beat }) {
  await beat('open', async () => {
    // This chapter shares the groups stage, so it starts on the Groups rung and
    // switches. The rail's tabs carry `role="tab"` — a `getByRole('button')`
    // lookup does not match them at all, which is a silent no-op rather than an
    // error, and films as a chapter that simply never left the previous tab.
    await drive.click(railTab(page, 'Apps'), { navigates: true });
    await drive.settle(1800);
    await drive.read('inventory', () => readAppCounts(page));
  });

  await beat('filter', async () => {
    await drive.click(appStatusFilter(page, 'Inactive'));
    await drive.settle(1500);
    const narrowed = await drive.read('inactive', () => readAppCounts(page));
    if (narrowed.shown === 0 || narrowed.shown === narrowed.total) {
      throw new Error(
        `the Inactive bucket holds ${narrowed.shown} of ${narrowed.total} apps — ` +
          'nothing is being narrowed, so this beat shows nothing',
      );
    }
  });

  await beat('sort', async () => {
    await drive.click(appStatusFilter(page, 'All'));
    await drive.settle(1200);
    await drive.click(appSort(page, 'Status'));
    await drive.settle(1600);
  });
}
