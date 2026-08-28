/**
 * Compare — a deep chapter.
 *
 * Two engineers in the same department, and the set of things one has that the
 * other does not. The demo org derives both sides from its own rule predicates,
 * so the difference is a consequence of the org rather than a fixture: rule 3
 * excludes contractors, which is why `GitHub - Engineering` is hers alone.
 *
 * @module
 */
import {
  comparisonSearch,
  comparisonSection,
  comparisonTab,
  compareButton,
  personRow,
  readComparisonTallies,
  userSearch,
} from '../selectors.mjs';

/** The pinned pair, from `demo/users.ts`. Same department, different everything else. */
const LEFT = 'Amara Okonkwo';
const RIGHT = 'Tomas Lindqvist';

export async function walk({ page, drive, beat }) {
  await beat('subject', async () => {
    await drive.type(userSearch(page), LEFT);
    await drive.settle(1200);
    await drive.click(personRow(page, LEFT), { navigates: true });
    await drive.settle(1500);
  });

  await beat('compare', async () => {
    // `Compare` is disabled while the selected user's memberships load, and a
    // raw mouse click on a disabled control dispatches, does nothing, and looks
    // exactly like success. The verb refuses instead.
    await drive.click(compareButton(page));
    await drive.settle(1200);
    // The comparison's search mounts only after the phase transition, so this
    // is the first moment it can be typed into at all.
    await drive.type(comparisonSearch(page), RIGHT);
    await drive.settle(1200);
    await drive.click(personRow(page, RIGHT), { navigates: true });
    await drive.settle(1800);
  });

  await beat('tallies', async () => {
    // The three figures the composition's set-difference diagram is drawn from.
    // Read off the panel's own tab badges, so the diagram and the panel cannot
    // disagree without this throwing first.
    await drive.read('tallies', () => readComparisonTallies(page));
    await drive.settle(900);
  });

  await beat('memberships', async () => {
    await drive.scrollTo(comparisonSection(page, 'Group memberships'));
    await drive.settle(1100);
    // The Groups tab holds the difference itself rather than the summary.
    await drive.click(comparisonTab(page, 'Groups'));
    await drive.settle(1500);
  });

  await beat('worklist', async () => {
    // `What to fix` is the CauseWorklist: failing clauses grouped by remedy,
    // never by rule. It is the chapter's payoff — the difference is not just
    // reported, it is attributed to something an administrator can change.
    await drive.click(comparisonTab(page, 'Overview'));
    await drive.settle(1000);
    await drive.scrollTo(comparisonSection(page, 'What to fix'));
    await drive.settle(1600);
  });
}
