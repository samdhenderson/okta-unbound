/**
 * Rules — a tour chapter.
 *
 * Rules used to be the one tab that would not load itself, and this chapter
 * opened on the ask. ADR-0069 moved the fetch onto tab activation
 * (`useOwedLoad`, `src/sidepanel/components/RulesTab.tsx`), so the list is
 * already arriving by the time this walk gets a beat — the `load` beat is kept
 * (its name is filmed and played by `reel/src/script.ts`) but it now waits for
 * the list rather than asking for it. The empty state behind `Load Rules` only
 * renders if the auto-fetch itself failed, so there is nothing left to click.
 *
 * It ends on the one rule that is switched off, and on its expression. It stops
 * short of `Preview Impact` deliberately: that flow models deactivation as
 * retracting membership, which is not how Okta behaves, and a reel must not
 * narrate a bug as a feature (`D-052`).
 *
 * @module
 */
import {
  filtersSection,
  moreActions,
  openRule,
  readRuleStats,
  ruleFilter,
  statsPanel,
} from '../selectors.mjs';

/** The demo org's one INACTIVE rule, and the longest expression in it. */
const DORMANT = 'Interns → cohort group';

export async function walk({ page, drive, beat }) {
  await beat('load', async () => {
    // This beat used to press `Load Rules` and read the stats grid's own
    // `Inactive` count as proof the chapter had a subject. ADR-0069 moved the
    // fetch onto tab activation (`useOwedLoad`, `RulesTab.tsx`), so the list
    // has already started arriving by the time this beat gets the camera —
    // there is nothing left to click. `Load Rules` still exists, but only as
    // the list panel's own empty-state prompt for when the auto-fetch itself
    // failed, so a click on it here would land on nothing.
    //
    // The stats grid is no longer the free read it used to be: it sits behind
    // the strip's `Stats` toggle, itself behind `More` (`RulesListActionBar.tsx`
    // gives a closed panel `priority: 'tier'`). It is opened anyway, and the two
    // clicks are the chapter's subject rather than a detour: this act is called
    // "The inventory", and the grid is the inventory stated as four numbers.
    //
    // It is also not optional. `reel/src/script.ts` draws the `dormant` beat's
    // RuleBoard out of `figure(m, 'stats')`, and `PanelInk` reads the same key,
    // so a walk that skips this read does not merely film less: it fails the
    // render, at frame 3, with `no figure "stats" was read during capture`.
    // The panel is off frame by the time that board is drawn, which is exactly
    // why the number has to be taken here while it is still on camera (ADR-0045
    // section 5).
    //
    // Waiting on the chapter's own subject, the one inactive rule `dormant`
    // opens, proves the load finished and gives `dormant` a specific fault to
    // name if it did not.
    // `ruleExpand` used to point at this row - a button named `Expand <rule>`,
    // the way a Groups/Apps row works. Rule cards do not have that control any
    // more; the whole row is one `openRule` overlay named plainly "Open rule"
    // (`RuleCard.tsx`), disambiguated only by the row it lives in
    // (`ruleRow`, matched on the row's own heading). `ruleExpand` therefore
    // matched nothing at all, and a locator matching zero elements times out
    // on `waitFor(visible)` exactly the way a slow list would - the two
    // failures are indistinguishable from the outside, which is what made this
    // one look like a fold problem instead of a stale selector.
    await drive.waitFor(openRule(page, DORMANT), {
      why: 'the rules list never finished loading, or the demo org lost its one inactive rule',
    });
    await drive.settle(900);

    await drive.click(moreActions(page));
    await drive.settle(700);
    await drive.click(statsPanel(page), { navigates: true });
    await drive.settle(1200);

    const stats = await drive.read('stats', () => readRuleStats(page));
    // The board this feeds draws `active` and `dormant` as parts of a whole, so
    // a total that does not exceed its own inactive count would render a
    // segment wider than the bar it sits in. Refused here rather than debugged
    // later out of a diagram that looks merely ugly.
    const total = stats['Total Rules'] ?? 0;
    if (total === 0) {
      throw new Error('the stats grid reports no rules at all, so the inventory has no subject');
    }
    if ((stats.Inactive ?? 0) === 0) {
      throw new Error(
        'the stats grid reports no inactive rules, and `dormant` is about the one that is',
      );
    }
    await drive.settle(1000);
  });

  await beat('active', async () => {
    // The status chips used to sit permanently above the list. They now live
    // behind the strip's `Filters` disclosure (`RulesFilterPanel.tsx`) - with
    // it shut, `All Rules` / `Active Only` are in the DOM at a zero box, so
    // this beat has nothing to click until it opens the panel first.
    await drive.click(filtersSection(page));
    // The panel's own `animate-rise-in` plus the stagger-reveal list beneath
    // it are still moving past the first settle window on a cold run - the
    // check rig caught a few px of drift here at ~6.3s in. Longer settles,
    // not a workaround: the disclosure and the list beneath it are real
    // motion this beat should hold on rather than cut through.
    await drive.settle(1400);
    // The narrowing is the argument: the difference between every rule and the
    // ones actually in force is exactly the rule nobody remembered to delete.
    await drive.click(ruleFilter(page, 'Active Only'));
    await drive.settle(2000);
    await drive.click(ruleFilter(page, 'All Rules'));
    await drive.settle(1600);
  });

  await beat('dormant', async () => {
    await drive.scrollTo(openRule(page, DORMANT));
    await drive.click(openRule(page, DORMANT), { navigates: true });
    await drive.settle(1800);
  });
}
