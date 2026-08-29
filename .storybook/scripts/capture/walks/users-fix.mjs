/**
 * Users, act three - the fix.
 *
 * The payoff, and the reason the demo org was made writable at all (ADR-0052).
 * One attribute is corrected, the panel predicts what that will move before it
 * writes, and then the rule applies and the group arrives.
 *
 * ## The prediction is the beat, not the save
 *
 * `ProfileSaveModal` does not merely confirm. It restates the diff both ways
 * round, says in plain words that this is a live write, and offers to work out
 * which group memberships the edit will move - by evaluating every rule that
 * reads the attribute, against the drafted profile, before anything is sent.
 * That is the thing no admin console does, and it is the sentence the chapter
 * is for.
 *
 * ## What this refuses
 *
 * Four read-backs and four refusals, because a write that silently did nothing
 * films exactly like a write that worked:
 *
 *  1. The field must actually read the typo before the edit. A fixture that
 *     drifted would otherwise film a correction of something already correct.
 *  2. The prediction must name the group by name. A count that moved is not the
 *     same statement as the right group arriving.
 *  3. The group must be absent before the save and present after it, waited on
 *     by row rather than by count - a number changing is not an event
 *     Playwright can wait for; a named row entering the DOM is.
 *  4. The count after must exceed the count before.
 *
 * @module
 */
import {
  analyzeBlastRadius,
  blastRadiusSection,
  confirmSave,
  membershipRow,
  personRow,
  profileEditButton,
  profileField,
  profileSaveButton,
  readBlastRadiusCount,
  saveConfirmation,
  saveModal,
  userDetailTab,
  userSearch,
} from '../selectors.mjs';

const SUBJECT = 'Priya Achterberg';

/** The schema's title for the attribute, which is its accessible name on the control. */
const FIELD = 'Department';

/** What is there, and what it should have been. */
const TYPO = 'Enginering';
const CORRECTION = 'Engineering';

/** The group the correction lets rule 2 fill. */
const GAINED = 'Engineering - All';

async function readGroupCount(page) {
  const label = await userDetailTab(page, 'Groups').first().textContent();
  const count = Number(/(\d+)/.exec(label ?? '')?.[1]);
  if (!Number.isFinite(count)) {
    throw new Error(`the Groups tab read ${JSON.stringify(label)} - there is no count in it`);
  }
  return count;
}

export async function walk({ page, drive, beat }) {
  /** Her group count before anything is typed. Compared against, at the end. */
  let groupsBefore = 0;

  await beat('open', async () => {
    await drive.type(userSearch(page), SUBJECT);
    await drive.settle(800);
    await drive.click(personRow(page, SUBJECT), { navigates: true });
    await drive.settle(1500);

    groupsBefore = await drive.read('groupsBefore', () => readGroupCount(page));
    const already = await membershipRow(page, GAINED).count();
    if (already > 0) {
      throw new Error(
        `"${GAINED}" is already in her memberships before the edit - the act would film a ` +
          'write landing something that was there all along',
      );
    }
  });

  await beat('edit', async () => {
    await drive.click(userDetailTab(page, 'Profile'), { navigates: true });
    await drive.settle(1300);

    // The gate is deny-by-default and the button is absent, not disabled, when
    // nothing is editable. Waiting on it names the real failure - an org whose
    // profile schema never arrived - rather than filming a pane with no verb.
    await drive.waitFor(profileEditButton(page), {
      why: 'no attribute is editable, so the profile schema did not reach the panel',
    });
    await drive.click(profileEditButton(page));
    await drive.settle(900);

    // Scrolled to before it is typed into. The Profile pane is a long list and
    // `Department` sits below the fold, so the first take found the field,
    // read it correctly, and then refused to type: the driver only commands
    // controls whose centre is in frame, on the grounds that a keystroke landing
    // somewhere the camera cannot see is not footage of anything.
    const field = profileField(page, FIELD);
    await drive.scrollTo(field);
    await drive.settle(700);

    const before = await drive.read('typo', () => field.inputValue());
    if (before !== TYPO) {
      throw new Error(
        `${FIELD} reads "${before}", not "${TYPO}" - the fixture the whole chapter is built ` +
          'on has moved, and the act would film a correction of something already correct',
      );
    }

    await drive.type(field, CORRECTION);
    await drive.settle(1000);
  });

  await beat('predict', async () => {
    // Back up to the header. `Save` lives in the pane's header strip, which the
    // scroll down to `Department` took off screen - the driver refuses a
    // control it cannot see, which is the same refusal that caught the typing.
    await drive.scrollTo(profileSaveButton(page));
    await drive.settle(600);
    await drive.click(profileSaveButton(page));
    await drive.waitFor(saveModal(page), { why: 'the save confirmation never opened' });
    await drive.settle(1200);

    await drive.click(analyzeBlastRadius(page));
    await drive.waitFor(blastRadiusSection(page, 'Likely added').first(), {
      why: 'the prediction named no group it would add her to',
    });
    await drive.settle(1100);

    const predicted = await drive.read('predicted', () => readBlastRadiusCount(page, 'Groups'));
    const added = await drive.read('added', () =>
      blastRadiusSection(page, 'Likely added')
        .allInnerTexts()
        .then((rows) => rows.map((row) => row.split('\n')[0].trim())),
    );

    // The prediction has to name the group, not merely count something. A
    // report that moves three unrelated groups is a different claim from the
    // one the chapter makes, and at playback speed the two look identical.
    if (!added.some((name) => name.includes(GAINED))) {
      throw new Error(
        `the prediction adds ${JSON.stringify(added)} - "${GAINED}" is not among them, so the ` +
          'act would narrate a rule applying that the panel did not predict',
      );
    }
    if (!predicted) {
      throw new Error('the report predicts no group effect at all');
    }
    await drive.settle(900);
  });

  await beat('land', async () => {
    await drive.click(confirmSave(page));

    // The panel's own confirmation, never a timer. A fixed hold here would pass
    // on a take where the write failed or came back `unknown`, which is the
    // exact outcome ADR-0035 put into the type system so a caller could not
    // round it away.
    await drive.waitFor(saveConfirmation(page), {
      why: 'the panel never confirmed the write, so nothing was demonstrated to have landed',
    });
    await drive.read('saved', () => saveConfirmation(page).first().innerText());
    await drive.settle(1200);

    // A profile write invalidates the user's memberships (`useProfileEdit`), so
    // opening Groups re-reads them. This is the product's own repaint path, not
    // a reload staged for the camera.
    await drive.click(userDetailTab(page, 'Groups'), { navigates: true });
    await drive.waitFor(membershipRow(page, GAINED).first(), {
      why: `the write landed but "${GAINED}" never appeared, so the rule did not apply`,
    });
    await drive.settle(1400);

    const after = await drive.read('groupsAfter', () => readGroupCount(page));
    if (after <= groupsBefore) {
      throw new Error(
        `she was in ${groupsBefore} groups and is in ${after} - the row for "${GAINED}" ` +
          'arrived but the badge did not move, so the two readings of the same fact disagree',
      );
    }
    await drive.settle(1600);
  });
}
