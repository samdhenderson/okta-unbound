/**
 * Rules — a tour chapter.
 *
 * Rules are the only tab that will not load itself. Nothing is fetched until
 * someone asks, which is the app's posture rather than an oversight, so the
 * chapter opens on the ask and the list arrives as a consequence.
 *
 * It ends on the one rule that is switched off, and on its expression. It stops
 * short of `Preview Impact` deliberately: that flow models deactivation as
 * retracting membership, which is not how Okta behaves, and a reel must not
 * narrate a bug as a feature (`D-045`).
 *
 * @module
 */
import { loadRulesButton, readRuleStats, ruleExpand, ruleFilter } from '../selectors.mjs';

/** The demo org's one INACTIVE rule, and the longest expression in it. */
const DORMANT = 'Interns → cohort group';

export async function walk({ page, drive, beat }) {
  await beat('load', async () => {
    await drive.click(loadRulesButton(page));
    // The stats grid counts up on arrival, so the figures are read after the
    // settle rather than the moment the cards mount — see `readRuleStats`.
    await drive.settle(2200);
    const stats = await drive.read('stats', () => readRuleStats(page));
    if (stats.Inactive < 1) {
      throw new Error('no inactive rule in the demo org — this chapter has no subject');
    }
  });

  await beat('active', async () => {
    // The narrowing is the argument: the difference between every rule and the
    // ones actually in force is exactly the rule nobody remembered to delete.
    await drive.click(ruleFilter(page, 'Active Only'));
    await drive.settle(1600);
    await drive.click(ruleFilter(page, 'All Rules'));
    await drive.settle(1200);
  });

  await beat('dormant', async () => {
    await drive.scrollTo(ruleExpand(page, DORMANT));
    await drive.click(ruleExpand(page, DORMANT));
    await drive.settle(1800);
  });
}
