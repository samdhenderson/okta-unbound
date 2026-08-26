/**
 * What each demo scene does on camera.
 *
 * One exported async function per story id, receiving the page and a
 * `beat(name, fn)` stamp. Beats are timestamped into `clips/manifest.json` so an
 * editor has trim points, and each is isolated: a missed mark costs that
 * movement, not the take.
 *
 * Selectors here are **probed, not guessed** — `node
 * .storybook/scripts/probe-scene.mjs <id> --click="…"` prints the real
 * interactive surface of a scene, which is how the member-row disclosure was
 * found to be `Show details for <name>` rather than the first `aria-expanded`
 * node on the page (that one is the Composition section, and aiming at it cost
 * the first cut thirty seconds of frozen video).
 */
import {
  clearCaption,
  find,
  hold,
  moveAndClick,
  rampScroll,
  say,
  sweepPanelWidth,
  typeInto,
  visible,
} from './helpers.mjs';

const HERO_GROUP = 'Engineering — All';

/**
 * The handle that actually opens a group row.
 *
 * Not the heading: each row lays a full-bleed `absolute inset-0` button over
 * itself (`aria-label="View group details"`), which intercepts every pointer
 * event aimed at the text underneath. Clicking the heading therefore does
 * nothing at all — which is what left the first cut sitting on the group list
 * through a beat named `open-group`. The button's `title` carries the group
 * name, so it is both the real target and a unique one.
 */
const openGroupRow = (page, name) =>
  page.locator(`[title="Open the detail view for ${name}"]`).first();

/** Scene 1 — browse the org, open a group, and ask why someone is in it. */
export async function groupDrilldown(page, beat) {
  await beat('open', async () => {
    await say(page, {
      kicker: 'Okta Unbound',
      headline: 'Your whole org,\nin the side panel.',
      sub: '34 groups, 250 people, and every rule that connects them — read from one cached snapshot.',
    });
    await hold(2600);
  });

  await beat('cascade', async () => {
    await clearCaption(page);
    await say(page, {
      kicker: 'Browse',
      headline: 'Every group,\nalready counted.',
      sub: 'Member counts, feeding rules and push mappings arrive together — no click-through required.',
    });
    // Rows are held by an IntersectionObserver until they cross the viewport,
    // then released on a stagger ladder. Travelling slowly is what turns that
    // into a cascade rather than a dump.
    await rampScroll(page, 760, 2600);
    await hold(700);
    await rampScroll(page, -760, 1500);
    await hold(600);
  });

  await beat('open-group', async () => {
    await clearCaption(page);
    await moveAndClick(page, openGroupRow(page, HERO_GROUP));
    await hold(1900);
    await say(page, {
      kicker: 'Drill in',
      headline: 'Engineering — All',
      sub: '94 members, and the panel already knows which rule put each of them here.',
    });
    await hold(2400);
  });

  await beat('members', async () => {
    await clearCaption(page);
    // The detail view opens on Overview. Member rows — and the disclosures this
    // scene exists to show — are on the Members tab, so the first cut spent its
    // last five seconds scrolling an Overview pane with nothing below the fold.
    await moveAndClick(page, page.getByRole('tab', { name: /^Members/ }).first());
    await hold(1600);
    await rampScroll(page, 320, 1500);
    await hold(600);
  });

  await beat('provenance', async () => {
    // Probed: member disclosures are labelled "Show details for <name>".
    const row = page.getByRole('button', { name: /^Show details for/ }).first();
    const ok = await moveAndClick(page, row);
    await hold(1600);
    if (ok) {
      await say(page, {
        kicker: 'Provenance',
        headline: 'Why is this person\nin this group?',
        sub: 'Direct assignment, or a rule — named, with the expression that matched it.',
      });
      await hold(3200);
      await clearCaption(page);
    }
  });
}

/** Scene 2 — preview what deactivating a rule would cost. */
export async function ruleImpact(page, beat) {
  await beat('open', async () => {
    await say(page, {
      kicker: 'Group rules',
      headline: 'What breaks if\nI turn this off?',
      sub: 'The question every admin asks before touching a rule — and normally answers by guessing.',
    });
    await hold(2800);
  });

  await beat('load-rules', async () => {
    await clearCaption(page);
    // Probed: the Rules tab starts empty behind an explicit load.
    await moveAndClick(page, page.getByRole('button', { name: /^Load Rules$/ }).first());
    await hold(2200);
  });

  await beat('scan', async () => {
    await say(page, {
      kicker: '9 rules',
      headline: 'Written in real\nexpression language.',
      sub: 'Parsed, not evaluated — the panel reads the clauses and names the groups they feed.',
    });
    await rampScroll(page, 420, 1900);
    await hold(2200);
    await clearCaption(page);
  });

  await beat('expand-rule', async () => {
    const rule = page.getByRole('button', { name: /^Expand Engineering → GitHub/ }).first();
    await moveAndClick(page, rule);
    await hold(1800);
  });

  await beat('impact', async () => {
    // Exactly "Preview Impact". The first cut matched /impact|preview|deactivat/i,
    // which also matches the "Deactivate Rule" button sitting beside it — a
    // state-changing action, and the wrong thing to aim a camera at.
    const trigger = await find(page.getByRole('button', { name: /^Preview Impact$/ }).first(), 3000);
    if (trigger) {
      await moveAndClick(page, trigger);
      await hold(2600);
    }
    await say(page, {
      kicker: 'Impact preview',
      headline: '80 people would\nlose GitHub.',
      sub: 'Counted from the rule that actually places them — contractors excluded, exactly as the clause says.',
    });
    await hold(3400);
    await clearCaption(page);
  });
}

/** Scene 3 — a bulk change, with the ActivityBar tracking it. */
export async function bulkOperation(page, beat) {
  await beat('open', async () => {
    await say(page, {
      kicker: 'Bulk operations',
      headline: 'Change fifty\nmemberships at once.',
      sub: 'Rate-limited through the scheduler, cancellable at any point, and written to an audit trail.',
    });
    await hold(2800);
    await clearCaption(page);
  });

  await beat('search', async () => {
    const search = page.getByPlaceholder(/search/i).first();
    await typeInto(page, search, 'okonkwo');
    await hold(1800);
  });

  await beat('progress', async () => {
    await say(page, {
      kicker: 'In flight',
      headline: 'Live counts,\nnot a spinner.',
      sub: 'Completed, in-flight and failed — reported per item while the queue drains.',
    });
    // The bar's motion is real (transition-[width] at --dur-tell). Its counts are
    // driven from here, because bulk progress normally flows through the API
    // facade this story has mocked away. Stated plainly in ADR-0043.
    await page.evaluate(() =>
      window.__OKTA_DEMO__?.progress?.start('Bulk update', 'Updating memberships', 48),
    );
    for (let done = 0; done <= 48; done += 4) {
      await page.evaluate(
        (n) => window.__OKTA_DEMO__?.progress?.update(n, 48, `Updating memberships (${n}/48)`),
        done,
      );
      await hold(340);
    }
    await hold(900);
    await page.evaluate(() => window.__OKTA_DEMO__?.progress?.complete());
    await hold(1400);
    await clearCaption(page);
  });
}

/** Scene 4 — two people side by side across groups, apps and attributes. */
export async function userComparison(page, beat) {
  await beat('open', async () => {
    await say(page, {
      kicker: 'Compare',
      headline: '"Why can she get in\nand he can\'t?"',
      sub: 'Two people, side by side, across every group, app and profile attribute that differs.',
    });
    await hold(3000);
    await clearCaption(page);
  });

  await beat('find-user', async () => {
    await typeInto(page, visible(page.getByPlaceholder(/search/i)), 'amara okonkwo');
    await hold(1900);
    // Result rows are buttons whose accessible name begins with the person's
    // name. `getByText` matched a fragment and let the click fall through to the
    // row behind it, which is how the first cut ended up on the wrong person.
    await moveAndClick(page, visible(page.getByRole('button', { name: /^Amara Okonkwo/ })));
    await hold(2100);
  });

  await beat('compare', async () => {
    await moveAndClick(page, page.getByRole('button', { name: /^Compare$/ }).first());
    await hold(2000);
    await say(page, {
      kicker: 'Pick the second',
      headline: 'Someone who\nshould match.',
      sub: 'Same team, same department — and a different answer at the door.',
    });
    // Compare opens its own search phase with its own field. A `/search/i`
    // placeholder lookup matches the Users tab's search first — that rung stays
    // mounted behind this one (ADR-0016) — so the text went somewhere invisible
    // and the second person was never picked.
    await typeInto(page, visible(page.getByPlaceholder(/Search by email, name, or login/i)), 'tomas');
    await hold(2000);
    await clearCaption(page);
    await moveAndClick(page, visible(page.getByRole('button', { name: /^Tomas Lindqvist/ })));
    await hold(2600);
  });

  await beat('walk-tabs', async () => {
    // Scope to the comparison surface. The app's own top-level rail is also
    // `role="tab"` with Overview/Users/Groups/Apps, so an unscoped lookup clicks
    // the shell's Groups tab and navigates straight out of the comparison —
    // which is exactly what the first cut filmed.
    const surface = page.locator('[data-testid="user-comparison-view"]');
    if ((await surface.count()) === 0) return;

    const tabs = [
      { name: /^Groups/i, headline: 'Groups they\ndon\'t share.', kicker: 'Set diff' },
      { name: /^Apps/i, headline: 'And the access\nthat follows.', kicker: 'Consequence' },
      { name: /^Attributes/i, headline: 'The attribute that\nexplains both.', kicker: 'Root cause' },
    ];
    for (const tab of tabs) {
      const el = await find(surface.getByRole('tab', { name: tab.name }).first(), 2000);
      if (!el) continue;
      await moveAndClick(page, el);
      await hold(1000);
      await say(page, { kicker: tab.kicker, headline: tab.headline });
      await hold(2800);
      await clearCaption(page);
    }
  });
}

/** Scene 5 — the action strip: the dock merge, then the overflow ladder. */
export async function actionBarShowcase(page, beat) {
  await beat('open-group', async () => {
    await moveAndClick(page, openGroupRow(page, HERO_GROUP));
    await hold(2000);
    // Onto the Members rung before filming the dock. The Overview tab holds
    // three cards and no overflow, so there is nothing to scroll — the first cut
    // narrated "it docks as you scroll" over a strip that never moved, because
    // the ramp had no distance to travel. 94 members gives it a real scroller,
    // and a real header seam for the band to cover.
    await moveAndClick(page, page.getByRole('tab', { name: /^Members/ }).first());
    await hold(1800);
  });

  await beat('dock-merge', async () => {
    await say(page, {
      kicker: 'The action bar',
      headline: 'It docks as\nyou scroll.',
      sub: 'Over the last 16px of travel the strip loses its margins, radius and border, covers the header seam, and becomes one pinned surface.',
    });
    // The merge runs over the last --merge-range of the sentinel's travel, so it
    // wants a slow ramp: too fast and the whole transition lands in two frames.
    await rampScroll(page, 300, 2800);
    await hold(1500);
    await rampScroll(page, -300, 2000);
    await hold(1000);
    await rampScroll(page, 420, 2600);
    await hold(1800);
    await clearCaption(page);
  });

  await beat('overflow-ladder', async () => {
    await say(page, {
      kicker: 'Responsive by measurement',
      headline: 'It re-splits itself\nas you resize.',
      sub: 'Every action is measured, not guessed. Icons drop before anything moves behind More — and come back when dropping one buys the room.',
    });
    await hold(1600);
    await sweepPanelWidth(page, [1000, 860, 720, 600, 520, 440, 380], { hold: 1150 });
    await hold(800);
    await sweepPanelWidth(page, [640, 900], { hold: 1000 });
    await hold(900);
    await clearCaption(page);
  });
}

/** Story id → the movement that scene performs. */
export const SCENE_TITLES = {
  'demo-scenes--group-drilldown': {
    title: 'Where does\nmembership come from?',
    blurb: 'Browse the org, open a group, and see the rule that put each person in it.',
  },
  'demo-scenes--rule-impact': {
    title: 'What breaks\nif I turn this off?',
    blurb: 'Preview a group rule’s deactivation before you commit to it.',
  },
  'demo-scenes--bulk-operation': {
    title: 'Change a lot\nat once — safely.',
    blurb: 'Rate-limited, cancellable, and written to an audit trail you can undo from.',
  },
  'demo-scenes--user-comparison': {
    title: 'Why can she get in\nand he can’t?',
    blurb: 'Two people, compared across every group, app and attribute that differs.',
  },
  'demo-scenes--action-bar-showcase': {
    title: 'Built to be\nlived in.',
    blurb: 'A sticky action bar that docks as you scroll and re-splits itself as you resize.',
  },
};

/** The order the reel plays them in. */
export const REEL_ORDER = [
  'demo-scenes--group-drilldown',
  'demo-scenes--rule-impact',
  'demo-scenes--user-comparison',
  'demo-scenes--bulk-operation',
  'demo-scenes--action-bar-showcase',
];

/** Story id → the movement that scene performs. */
export const CHOREOGRAPHY = {
  'demo-scenes--group-drilldown': groupDrilldown,
  'demo-scenes--rule-impact': ruleImpact,
  'demo-scenes--bulk-operation': bulkOperation,
  'demo-scenes--user-comparison': userComparison,
  'demo-scenes--action-bar-showcase': actionBarShowcase,
};
