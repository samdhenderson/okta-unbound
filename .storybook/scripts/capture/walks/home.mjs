/**
 * Home — the film's first chapter.
 *
 * The situation: you opened the panel because a ticket, a URL or a log line put
 * an id in your hand, and because you want to know what is wrong with this org
 * before somebody else asks you.
 *
 * Two halves, and they are deliberately different jobs. The jump bar is for "I
 * have an id and I want the record". The org card is for "I have no id and I
 * want the problems". The chapter shows both and never pretends they are the
 * same affordance.
 *
 * ## What this chapter does not do
 *
 * It does not press a finding. Pressing one leaves Home for another tab, which
 * would break the two things the restructure is built on: that a tab is visited
 * once, and that the rail only moves forward. The reports card is the payoff
 * instead, because it opens **in place** — the groups it names are the whole
 * answer and a tab switch to read them would be ceremony.
 *
 * The cross-tab half of "a number is a place" is paid off structurally rather
 * than in this chapter: Home names its findings, and Groups, Apps and Rules
 * each open on one of them.
 *
 * It also does not pin anything. `chrome.storage.onChanged` is a no-op in the
 * Storybook fake, so a second `useWorkingSet` instance never learns about a
 * write and a "pin here, watch it appear there" take would look perfect and
 * show nothing. The affordance is taught in the Groups chapter, where the
 * feedback is local and optimistic and therefore real.
 *
 * @module
 */
import {
  jumpBarInput,
  jumpResultRow,
  jumpResultRows,
  orgFinding,
  readOrgFinding,
  readOrgFindingTotal,
  readReportCount,
  readWorkingSetCount,
  reportDisclosure,
  reportRows,
  workingSetSection,
} from '../selectors.mjs';

/** The person the jump bar resolves by email — the film's hero, so Home hands off straight into the Users chapter. */
const JUMP_EMAIL = 'priya.achterberg@example.com';
const JUMP_NAME = 'Priya Achterberg';

/** The finding whose "of N groups" note the unpacking set piece draws its denominator from. */
const GROUPS_FINDING = 'Groups no rule fills';

/** The finding the reports card opens. */
const REPORT = 'App access no rule maintains';

export async function walk({ page, drive, beat }) {
  await beat('jump', async () => {
    // Typed rather than filled: the beat is showing a search landing, and that
    // is only legible if the viewer sees the email arrive keystroke by
    // keystroke before the panel answers.
    await drive.type(jumpBarInput(page), JUMP_EMAIL);
    await drive.settle(900);
    await page.keyboard.press('Enter');
    await drive.waitFor(jumpResultRow(page, JUMP_NAME), {
      why: 'the jump bar never resolved the email search',
    });

    // An email search never carries the id-resolution footnote — JumpBar only
    // renders it for `jump.resolution`, which an email/name search never sets
    // (see selectors.mjs). So the number this beat has to answer for is not
    // what the lookup cost, it's how many rows it found.
    const results = await drive.read('results', () => jumpResultRows(page).count());
    if (results === 0) {
      throw new Error(
        `the jump bar returned 0 results for "${JUMP_EMAIL}" — the beat claims a search ` +
          'that found the person and would be showing nobody',
      );
    }
    await drive.settle(800);
  });

  await beat('working-set', async () => {
    await drive.scrollTo(workingSetSection(page, 'Pinned'));
    const pinned = await drive.read('pinned', () => readWorkingSetCount(page, 'Pinned'));
    const recent = await drive.read('recent', () => readWorkingSetCount(page, 'Recent'));
    // Both sections have to be carrying rows, or the claim about what is kept
    // on disk is made over an empty box.
    if (pinned === 0 || recent === 0) {
      throw new Error(
        `the working set is holding ${pinned} pinned and ${recent} recent — the beat ` +
          'claims the panel remembers where you were and would be showing nothing',
      );
    }
    await drive.settle(1100);
  });

  await beat('findings', async () => {
    await drive.scrollTo(orgFinding(page, GROUPS_FINDING));
    await drive.settle(900);
    const unruled = await drive.read('unruled', () => readOrgFinding(page, GROUPS_FINDING));
    const empty = await drive.read('emptyGroups', () =>
      readOrgFinding(page, 'Groups with no members'),
    );
    const paused = await drive.read('pausedRules', () =>
      readOrgFinding(page, 'Paused group rules'),
    );

    // Every finding this chapter narrates has to be a finding. A card whose rows
    // read zero argues the opposite of what it is for, and three of these read
    // zero before the fixtures were changed for exactly this reason.
    for (const [label, value] of [
      [GROUPS_FINDING, unruled],
      ['Groups with no members', empty],
      ['Paused group rules', paused],
    ]) {
      if (value === null) {
        throw new Error(`"${label}" has no number yet — the card is still reading`);
      }
      if (value === 0) {
        throw new Error(`"${label}" reads 0 — the chapter would narrate a finding that is not one`);
      }
    }

    // The set piece B3 grid draws `unruled` out of `groupsTotal` cells, so the
    // denominator has to come off the same row while the camera is already
    // parked on it — see readOrgFindingTotal for why it is read from the
    // finding's own note rather than the card's totals paragraph.
    await drive.read('groupsTotal', () => readOrgFindingTotal(page, GROUPS_FINDING));
    await drive.settle(1000);
  });

  await beat('report', async () => {
    await drive.scrollTo(reportDisclosure(page, REPORT));
    const count = await drive.read('reportCount', () => readReportCount(page, REPORT));
    await drive.click(reportDisclosure(page, REPORT));

    // Waited on by row, not by count. A number changing is not an event
    // Playwright can wait for; a row arriving in the DOM is.
    await drive.waitFor(reportRows(page).first(), {
      why: 'the report opened but named no group',
    });
    const named = await drive.read('reportNamed', () => reportRows(page).count());

    // The count on the disclosure and the rows behind it are two different
    // readings of the same fact, and a report that reports six and opens onto
    // four is the failure worth refusing: it would put a number on camera that
    // the thing underneath it does not support.
    if (!count) throw new Error('the report has no count');
    if (named !== count) {
      throw new Error(
        `the report says ${count} and opened onto ${named} rows — the number and the ` +
          'evidence behind it disagree',
      );
    }
    await drive.settle(1400);
  });
}
