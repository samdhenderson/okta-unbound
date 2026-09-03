/**
 * Rules, act two - what a rule is holding up, and what each verb does to it.
 *
 * The chapter ADR-0043 pulled, back on its own terms. It was held out because
 * the product was narrating a claim that was not true: `ruleImpact` modelled
 * deactivation as retracting membership, and Okta does not work that way, so the
 * scene captioned an access loss over a modal that had counted something else
 * entirely (`D-052`). `D-052` fixed the model and the copy; ADR-0043's held-out
 * note said what the scene should argue when it returned, and this is that:
 * **both verbs, side by side, over one population.**
 *
 * ## The argument
 *
 * One number, two meanings:
 *
 * - **Deactivate.** Nobody moves. Every member held by this rule alone stays in
 *   the group, with no rule left to explain why they are there. Reversible.
 * - **Delete.** The only verb that can take them out, and `removeUsers` is the
 *   choice between removing them and keeping them as ordinary manual members.
 *   Neither branch can be undone.
 *
 * The panel states both itself - `RuleImpactModal`'s lead sentence differs per
 * mode - so the walk reads that sentence in each mode and refuses a take where
 * it does not say what the chapter says it says. That refusal is the whole
 * regression guard: film the fix and film the defect and the two look identical
 * at playback speed, which is exactly how `D-052` survived a cut.
 *
 * ## Why this rule
 *
 * `Engineering by department` is the subject because it is the one rule in the
 * demo org whose solely-held set is **not empty**. ADR-0043's original scene
 * previewed `Engineering -> GitHub`, whose target is an `APP_GROUP`; group rules
 * never attribute `APP_GROUP` membership, so `heldSolelyCount` there is
 * structurally 0 and the scene demonstrated nothing - which is why the defect
 * went unnoticed. `Engineering by department` targets `Engineering - All`, an
 * ordinary group no other active rule assigns into, so every member of it is
 * held by this rule alone. The walk asserts that rather than assuming it.
 *
 * ## Nothing is written
 *
 * The demo org is genuinely writable (ADR-0052), so the deactivate modal is
 * opened and **cancelled**. Confirming it would leave the rule INACTIVE for
 * whatever chapter films next, and the rules chapter's first act argues from
 * the count of inactive rules. `Preview impact` writes nothing by construction.
 *
 * @module
 */
import {
  deactivateRule,
  impactDismiss,
  impactLead,
  impactModal,
  loadRulesButton,
  moreActions,
  openRule,
  previewImpact,
  readImpactSummary,
  readImpactTarget,
} from '../selectors.mjs';

/** The one rule in the demo org with a non-empty solely-held set. */
const SUBJECT = 'Engineering by department';

/** The group it assigns into. An ordinary group, which is the point - see the header. */
const TARGET = 'Engineering - All';

/**
 * What each mode's lead sentence has to still say.
 *
 * Substrings, not the whole paragraph: the sentence names the rule inline and
 * carries an em dash, and ADR-0043 bans that glyph from the frame, so this is
 * asserted against and never printed. Each fragment is the specific promise the
 * chapter makes on that verb's behalf.
 */
const PROMISE = {
  preview: 'Only deleting the rule can remove them, and that choice is irreversible.',
  deactivate: 'Nobody is removed from a group',
};

/** Refuse a take where the panel stopped saying what the chapter attributes to it. */
async function assertLead(page, mode) {
  const said = await impactLead(page, mode).innerText();
  if (!said.includes(PROMISE[mode])) {
    throw new Error(
      `the ${mode} dialog no longer says "${PROMISE[mode]}" - it says "${said}". The chapter ` +
        'narrates the panel making this distinction, so a take without it would put D-052 back ' +
        'on camera.',
    );
  }
  return said;
}

export async function walk({ page, drive, beat }) {
  await beat('load', async () => {
    // Rules fetches nothing until asked, so every take on this tab starts here.
    // The act does not play this beat - the chapter's first act already showed
    // the ask - but it has to be walked, because the list does not exist
    // otherwise. See the `rules` scene's plan in `reel/src/script.ts`.
    await drive.click(loadRulesButton(page));
    await drive.settle(2000);
  });

  await beat('open', async () => {
    await drive.scrollTo(openRule(page, SUBJECT));
    await drive.click(openRule(page, SUBJECT), { navigates: true });
    // The rung's verb strip is the second band of the sticky stack, so waiting
    // on it is waiting on the rung itself. It is absent, not disabled, when a
    // rule assigns to no group, so this names that fault rather than timing out
    // on a click into empty space.
    await drive.waitFor(previewImpact(page), {
      why: `the rule rung for "${SUBJECT}" never opened, or it offers no impact verb`,
    });
    await drive.settle(1400);
  });

  await beat('holds', async () => {
    await drive.click(previewImpact(page));
    await drive.waitFor(impactModal(page, 'preview'), {
      why: 'the impact preview never opened',
    });
    // The analysis is asynchronous and the dialog renders a spinner until it
    // lands. Waiting on the breakdown's own heading is waiting on the result;
    // a fixed hold here would read the stat cards mid-spinner and record two
    // zeroes as if they were an answer.
    await drive.waitFor(impactModal(page, 'preview').getByText('Target groups', { exact: true }), {
      why: 'the impact analysis never finished, so the figures below are a spinner',
    });
    await drive.settle(1200);

    await drive.read('promise', () => assertLead(page, 'preview'));

    const sole = await drive.read('sole', () => readImpactSummary(page, 'preview'));
    const target = await drive.read('target', () => readImpactTarget(page, 'preview', TARGET));

    // The risk ADR-0043 flagged and `I-029` restated: a solely-held set of zero
    // films perfectly and argues nothing. The whole chapter is the difference
    // between what the two verbs do to *these people*, so if there are none the
    // act has no subject and must not be shot.
    if (sole.heldSolely < 1) {
      throw new Error(
        `"${SUBJECT}" holds nobody on its own, so both verbs would do the same nothing and the ` +
          'act would demonstrate no contrast. Another active rule has started targeting ' +
          `"${TARGET}", or the group turned into an APP_GROUP.`,
      );
    }
    if (sole.heldSolely > sole.members) {
      throw new Error(
        `the dialog says ${sole.heldSolely} of ${sole.members} members are held by this rule ` +
          'alone, which is not a subset - the two figures came off different surfaces.',
      );
    }
    if (target.held !== sole.heldSolely) {
      throw new Error(
        `the summary says ${sole.heldSolely} held solely and the "${TARGET}" row says ` +
          `${target.held}. The rule has one target group, so the two are the same claim and ` +
          'the margin would be free to print whichever is wrong.',
      );
    }

    await drive.settle(1600);
    await drive.click(impactDismiss(page, 'preview'));
    await drive.settle(900);
  });

  await beat('deactivate', async () => {
    // The lifecycle verbs are behind the strip's More tier, which is `inert`
    // while closed - the role query returns nothing until it opens, so this
    // click is a precondition and not a flourish.
    await drive.click(moreActions(page));
    await drive.settle(800);
    await drive.click(deactivateRule(page));
    await drive.waitFor(impactModal(page, 'deactivate'), {
      why: 'the deactivate confirmation never opened',
    });
    await drive.waitFor(
      impactModal(page, 'deactivate').getByText('Target groups', { exact: true }),
      { why: 'the deactivate dialog never finished its own impact analysis' },
    );
    await drive.settle(1400);

    await drive.read('reassurance', () => assertLead(page, 'deactivate'));

    // Read again in this mode rather than reusing the preview's figures. The
    // two dialogs run the same analysis and must agree; if they ever disagree
    // the chapter is showing one population and captioning another.
    const same = await drive.read('soleOnDeactivate', () => readImpactSummary(page, 'deactivate'));
    await drive.settle(1800);

    // Cancel, never confirm. See the module header: the org is real enough to
    // stay deactivated, and the chapter's first act counts inactive rules.
    await drive.click(impactDismiss(page, 'deactivate'));
    await drive.settle(1200);

    if (same.heldSolely < 1) {
      throw new Error(
        'the deactivate dialog counted nobody where the preview counted somebody - the two ' +
          'modes of one modal disagree about the same rule.',
      );
    }
  });
}
