/**
 * Users, act two - the cause.
 *
 * Priya against Amara Okonkwo, who does the same job on the same team. The
 * comparison reports the difference; the worklist attributes it.
 *
 * The distinction is the act. Reporting a difference is a diff, and every tool
 * has one. `CauseWorklist` groups the differences by **remedy** rather than by
 * rule, names the clause that actually failed, and prints the value that failed
 * it - so the answer on screen is not "she is missing four groups" but "one
 * profile attribute reads `Enginering`". Nothing in the reel showed that.
 *
 * @module
 */
import {
  causeWorklist,
  comparisonSearch,
  comparisonSection,
  comparisonTab,
  compareButton,
  personRow,
  readComparisonTallies,
  readWorklistCause,
  readWorklistGroupCount,
  userSearch,
  worklistRemedy,
} from '../selectors.mjs';

/** The user who lacks the access. The comparison is read from her side. */
const SUBJECT = 'Priya Achterberg';

/** Her opposite number: same department, same title, four years in. */
const PEER = 'Amara Okonkwo';

/** The remedy heading the whole act is about. `CauseWorklist`'s own words. */
const REMEDY = 'Fix a profile attribute';

export async function walk({ page, drive, beat }) {
  await beat('subject', async () => {
    await drive.type(userSearch(page), SUBJECT);
    await drive.settle(900);
    await drive.click(personRow(page, SUBJECT), { navigates: true });
    await drive.settle(1400);
  });

  await beat('against', async () => {
    // `Compare` is disabled while the selected user's memberships load, and a
    // raw mouse click on a disabled control dispatches, does nothing, and looks
    // exactly like success. The verb refuses instead.
    await drive.click(compareButton(page));
    await drive.settle(1100);
    // The comparison's search mounts only after the phase transition, so this
    // is the first moment it can be typed into at all.
    await drive.type(comparisonSearch(page), PEER);
    await drive.settle(1100);
    await drive.click(personRow(page, PEER), { navigates: true });
    await drive.settle(1700);
  });

  await beat('difference', async () => {
    const tallies = await drive.read('tallies', () => readComparisonTallies(page));
    // A comparison of two people who differ in nothing is not a scene. It is
    // also the shape a broken fixture takes: the memberships derive from rule
    // predicates, so a fixture change that accidentally fixed her department
    // would land here as three zeroes rather than as an error.
    if (!tallies || Object.values(tallies).every((n) => !n)) {
      throw new Error(
        `the comparison found no differences at all (${JSON.stringify(tallies)}) - the act ` +
          'argues about a gap and would be showing two identical people',
      );
    }
    await drive.settle(900);
  });

  await beat('cause', async () => {
    await drive.scrollTo(comparisonSection(page, 'What to fix'));
    await drive.settle(1100);
    await drive.waitFor(causeWorklist(page), { why: 'the worklist never rendered' });

    // The remedy group is the claim. Its absence means the panel explained the
    // difference some other way - a missing group assignment, an unevaluable
    // clause - and the chapter's sentence would be describing a row that is not
    // on screen.
    await drive.waitFor(worklistRemedy(page, REMEDY), {
      why: `the worklist did not group anything under "${REMEDY}"`,
    });

    const blocked = await drive.read('blockedGroups', () => readWorklistGroupCount(page, REMEDY));
    const { clause, resolved } = await drive.read('cause', () => readWorklistCause(page, REMEDY));

    // Both halves, or neither is evidence. The expression alone is a rule
    // anybody could have written down; it is the resolved value beside it that
    // makes the row a diagnosis of one person.
    if (!clause) {
      throw new Error(`"${REMEDY}" named no failing clause`);
    }
    if (!resolved) {
      throw new Error(
        `"${REMEDY}" printed the clause "${clause}" with no resolved value - the row states ` +
          'what was required without stating what was found, which is half the diagnosis',
      );
    }
    if (!blocked) {
      throw new Error(`"${REMEDY}" accounts for no groups`);
    }
    await drive.settle(1500);
  });
}
