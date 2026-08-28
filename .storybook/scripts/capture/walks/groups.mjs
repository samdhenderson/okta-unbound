/**
 * Groups — the tour chapter.
 *
 * The list cascades, the hero group opens, the Members rung lands. One
 * interaction, and out.
 *
 * Compare this against what the old `groupDrilldown` had to be: 133 lines, of
 * which roughly half were camera moves and margin narration. Everything that
 * described or framed the action now lives in the composition, so what is left
 * is the action.
 *
 * @module
 */
import { groupRow, membershipCard, readRosterCounts } from '../selectors.mjs';

/** The demo org's hero group: large, rule-fed, and the same on every take. */
const HERO = 'Engineering - All';

/** @param {import('../capture.mjs').WalkContext} ctx */
export async function walk({ page, drive, beat }) {
  await beat('cascade', async () => {
    // `useStaggerReveal` releases rows in DOM-order batches as an
    // IntersectionObserver sees them, so travelling slowly is what turns a
    // scroll into a cascade rather than a dump.
    await drive.scrollBy(520, 1800);
    await drive.settle(600);
  });

  await beat('open-group', async () => {
    // `Engineering - All` is not near the top of a 33-group list, and this
    // chapter has no camera to look down at it — so it is scrolled into the
    // middle of the scroller first. `scrollTo` is the only sanctioned way; see
    // the note in `drive.mjs` about the sticky nav swallowing the click.
    await drive.scrollTo(groupRow(page, HERO));
    // `navigates` because changing rung resets the app's scroller to 0, and
    // that reset is commanded motion rather than a jump.
    await drive.click(groupRow(page, HERO), { navigates: true });
    await drive.settle(1200);
  });

  await beat('members', async () => {
    // The card, not a tab. See `membershipCard` — the tab strip this used to
    // click no longer renders, but its twin is still in the DOM and still
    // clickable, so the wrong selector fails by hitting something else rather
    // than by finding nothing.
    //
    // `navigates`: changing rung resets the app's scroller to 0, which is
    // commanded motion and has to be declared or it reads as a jump.
    await drive.click(membershipCard(page), { navigates: true });
    // A `demoDelay()` read lands mid-hold here: the count badge arrives and the
    // string beside it re-wraps. `settle` waits that out rather than guessing a
    // longer sleep.
    await drive.settle(1400);
    // The composition's caption for this beat is built from this figure, and
    // will fail to render without it — which is the point. No caption states a
    // number the panel does not display.
    await drive.read('roster', () => readRosterCounts(page));
  });
}
