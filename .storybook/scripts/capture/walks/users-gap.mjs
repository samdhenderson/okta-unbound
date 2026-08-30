/**
 * Users, act one - the gap.
 *
 * The situation: Priya Achterberg was created three days ago for onboarding.
 * She is on the Engineering team, her manager is on the Engineering team, and
 * she cannot get into anything the Engineering team can.
 *
 * The act does one thing: establish that the gap is real and countable, off the
 * panel's own badge, before anything explains it. It deliberately does not
 * diagnose - that is act two's whole job, and a chapter that answers in its
 * first act has no reason to have a second.
 *
 * The search is on camera and is not the subject. It is played fast and carries
 * no line: "type a few letters and the list narrows" is true of every admin
 * tool built in the last fifteen years, and a beat whose sentence would be true
 * of all of them is furniture.
 *
 * @module
 */
import { membershipRow, personRow, userDetailTab, userSearch } from '../selectors.mjs';

/** The new hire, from `demo/users.ts`. Her `department` is mis-typed; that is the fixture. */
const SUBJECT = 'Priya Achterberg';

/** The group she should be in and is not. Rule 2 keys on `department`. */
const MISSING = 'Engineering - All';

/** Read the Groups tab's own badge. The panel's count, never ours. */
async function readGroupCount(page) {
  const label = await userDetailTab(page, 'Groups').first().textContent();
  const count = Number(/(\d+)/.exec(label ?? '')?.[1]);
  if (!Number.isFinite(count)) {
    throw new Error(`the Groups tab read ${JSON.stringify(label)} - there is no count in it`);
  }
  return count;
}

export async function walk({ page, drive, beat }) {
  await beat('arrive', async () => {
    await drive.type(userSearch(page), SUBJECT);
    await drive.settle(900);
    await drive.click(personRow(page, SUBJECT), { navigates: true });
    await drive.settle(1600);
  });

  await beat('gap', async () => {
    const groups = await drive.read('groups', () => readGroupCount(page));

    // Wait for the list to have arrived before asserting anything is absent
    // from it. An empty pane and a pane missing one group render identically to
    // a query, and only one of them is the chapter's claim.
    await drive.waitFor(page.locator('[data-group-id]').first(), {
      why: 'her group list never rendered, so nothing can be said about what is not in it',
    });

    const present = await membershipRow(page, MISSING).count();
    if (present > 0) {
      throw new Error(
        `"${MISSING}" is already in her memberships - the chapter's premise is that it is ` +
          'missing, and the fixture no longer supports it',
      );
    }
    if (groups === 0) {
      throw new Error(
        'she is in no groups at all - the act argues about a specific absence and would be ' +
          'showing a blank account instead',
      );
    }

    // No scroll here, and its absence is the finding. The first take asked for
    // 320px and the driver refused: nothing moved, because her whole membership
    // list fits on screen. A list you can see all of is the shot.
    await drive.settle(1800);
  });
}
