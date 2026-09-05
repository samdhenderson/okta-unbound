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
 * Composition (the tab the MFA breakdown lives on) moved off Members onto its
 * own `Insights` tab, so the `arm` beat now switches there before opening
 * Composition and picking the MFA factors tab inside it.
 *
 * @module
 */
import {
  compositionSection,
  compositionTab,
  groupRow,
  insightsTab,
  membershipCard,
  mfaScanButton,
  mfaScanningButton,
  noFactorsRow,
  readMfaBreakdown,
  readRosterCounts,
  SCROLL_ROOT,
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
    // Composition lives on its own Insights tab now, not on Members. Folded
    // into `arm` rather than a new beat for the same reason `attributes.mjs`
    // folds it into `facets`: `reel/src/script.ts` already names `arm` in its
    // plan and mark, and the switch is a precondition for arming the scan, not
    // a beat of its own.
    await drive.click(insightsTab(page), { navigates: true });
    await drive.settle(1200);
    // The Insights tab stacks an MFA coverage summary above Composition, so the
    // section header lands well below the fold at capture geometry (see the
    // same note in `attributes.mjs`'s `facets` beat). `drive.click` refuses an
    // offstage element rather than landing on it, so this has to scroll first.
    await drive.scrollTo(compositionSection(page));
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
    // it is about. Like every value click in `CompositionReports.tsx`, this one
    // calls `jumpToMembers` and switches `activeTab` to Members, snapping the
    // scroller to the top of that pane — `navigates: true` declares the window
    // that jump needs so it does not read as the app drifting on its own.
    await drive.click(noFactorsRow(page), { navigates: true });
    await drive.settle(1500);
    await drive.read('rosterUnenrolled', () => readRosterCounts(page));
    // The unenrolled roster can be short enough to fit the panel outright —
    // this demo group's own MFA gap is a handful of rows, not a page of them —
    // and `scrollBy` throws on a nonzero ask that produces zero motion (see its
    // own doc: a declared window with nothing in it is worse than no scroll at
    // all). Measure the room actually available and ask for no more than that.
    const room = await page.evaluate(
      (selector) => {
        const el = document.querySelector(selector);
        // Remaining room from the CURRENT position, not the scroller's total
        // range — `open`'s own scroll and the click just above may already sit
        // partway down, and `scrollBy` is relative to wherever that left it.
        return el ? el.scrollHeight - el.clientHeight - el.scrollTop : 0;
      },
      SCROLL_ROOT,
    );
    if (room > 20) {
      await drive.scrollBy(Math.min(420, room), 1600);
      await drive.settle(1200);
    }
  });
}
