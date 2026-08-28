/**
 * Reporting — a deep chapter.
 *
 * The one operation in this app that is genuinely irreducible: MFA coverage is
 * a factors call per member, so it is the only place a progress bar is showing
 * work an administrator actually waits on. The chapter runs it for real, reads
 * the breakdown it produces, and then filters the roster down to exactly the
 * people the claim is about.
 *
 * That last step is the point. A coverage report that states a number and
 * cannot show you who it means is a slide; this one hands back the rows.
 *
 * @module
 */
import {
  compositionSection,
  compositionTab,
  groupRow,
  membershipCard,
  mfaScanButton,
  mfaScanningButton,
  noFactorsRow,
  readMfaBreakdown,
  readRosterCounts,
} from '../selectors.mjs';

const HERO = 'Engineering - All';

export async function walk({ page, drive, beat }) {
  await beat('open', async () => {
    await drive.scrollTo(groupRow(page, HERO));
    await drive.click(groupRow(page, HERO), { navigates: true });
    await drive.settle(1200);
    await drive.click(membershipCard(page), { navigates: true });
    await drive.settle(1400);
    await drive.read('rosterBefore', () => readRosterCounts(page));
  });

  await beat('arm', async () => {
    await drive.click(compositionSection(page));
    await drive.settle(1200);
    // `Attributes` is the tab that opens; `MFA factors` is the one worth a click.
    await drive.click(compositionTab(page, 'MFA factors'));
    await drive.settle(1100);
  });

  await beat('scan', async () => {
    await drive.scrollTo(mfaScanButton(page));
    await drive.click(mfaScanButton(page));
    // Both edges are statements the panel makes about itself, and neither is a
    // duration this walk could guess. Neither is the progress bar, which is
    // mounted at rest and says nothing about whether an operation is running.
    // The scan arms when the button says so, and it is over when the breakdown
    // it produces exists.
    await drive.waitFor(mfaScanningButton(page), { why: 'the MFA scan never started' });
    await drive.waitFor(noFactorsRow(page), {
      timeout: 30000,
      why: 'the MFA scan never finished',
    });
    await drive.settle(1400);
  });

  await beat('breakdown', async () => {
    await drive.read('coverage', () => readMfaBreakdown(page));
    await drive.settle(1600);
  });

  await beat('unenrolled', async () => {
    // Close the loop: the claim's own row is the filter that produces the people
    // it is about.
    await drive.click(noFactorsRow(page));
    await drive.settle(1500);
    await drive.read('rosterUnenrolled', () => readRosterCounts(page));
    await drive.scrollBy(420, 1600);
    await drive.settle(1200);
  });
}
