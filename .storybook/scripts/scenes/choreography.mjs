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
 *
 * ## The margin never empties
 *
 * Every beat leaves the margin populated. `claim()` and `proof()` replace their
 * band in place and `evidence()` / `diffRow()` / `trace()` accrete, so there is
 * no state in which the left 45% of the frame is blank. The previous cut called
 * `clearCaption()` at the end of most beats and then kept filming; stills pulled
 * at t=33s and t=128s were empty from the rail to the panel.
 *
 * ## Chapters state, they do not ask
 *
 * Three of the five chapter titles used to be questions. A question hands the
 * viewer a job and defers the payoff. Each scene now asserts, the evidence band
 * produces the artifacts, and the proof line settles it — the *why* rides on the
 * evidence, which is where it belongs.
 *
 * ## No em dashes on camera
 *
 * Not in the margin, and not in the demo org either: the group names lost their
 * em dash separator for the same reason (`snapshot.ts`). Hyphens are fine.
 */
import {
  callout,
  centreInView,
  claim,
  clearBody,
  clearOverlays,
  diffBlock,
  diffRow,
  evidence,
  evidenceBlock,
  find,
  hold,
  moveAndClick,
  proof,
  rampScroll,
  strip,
  sweepPanelWidth,
  tally,
  trace,
  traceBlock,
  typeInto,
  visible,
} from './helpers.mjs';

const HERO_GROUP = 'Engineering - All';

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

/**
 * The `Preview Impact` button belonging to **one** rule.
 *
 * Every rule card renders its own, all nine are in the DOM at once, and all nine
 * report as visible — so neither `.first()` nor the `visible()` helper picks the
 * right one. `.first()` gives rule 1's, and once `scrollIntoViewIfNeeded` has
 * parked it under the `sticky top-0 z-40` nav the click lands on the nav
 * instead, while `moveAndClick` still reports success. The first cut did exactly
 * that and then captioned a number over a panel that had never changed.
 *
 * Rule ids are unique and on screen, so the nearest ancestor of a button that
 * mentions exactly one of them is that button's own card.
 */
async function previewImpactFor(page, ruleId) {
  const index = await page.evaluate((id) => {
    const buttons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent.trim() === 'Preview Impact',
    );
    return buttons.findIndex((button) => {
      let node = button.parentElement;
      while (node) {
        const ids = node.textContent.match(/0prFAKE\d+/g);
        if (ids && new Set(ids).size === 1) return ids[0] === id;
        node = node.parentElement;
      }
      return false;
    });
  }, ruleId);
  if (index < 0) return null;
  return page.getByRole('button', { name: /^Preview Impact$/ }).nth(index);
}

/** `Engineering → GitHub (excludes contractors)`, the rule this scene previews. */
const GITHUB_RULE_ID = '0prFAKE0003';

/** Scene A — a group's membership, and the rule that accounts for all of it. */
export async function groupDrilldown(page, beat) {
  await beat('open', async () => {
    await claim(page, { label: 'Provenance', text: 'Nobody is in a group\nby accident.' });
    await evidenceBlock(page);
    await evidence(page, '34 groups');
    await hold(700);
    await evidence(page, '250 users');
    await hold(700);
    await evidence(page, '9 group rules');
    await hold(1400);
  });

  await beat('cascade', async () => {
    // Rows are held by an IntersectionObserver until they cross the viewport,
    // then released on a stagger ladder. Travelling slowly is what turns that
    // into a cascade rather than a dump. The margin dims for the length of the
    // ramp so the panel carries the beat, then comes back up.
    await strip(page, true);
    await rampScroll(page, 760, 2600);
    await hold(600);
    await strip(page, false);
    await hold(500);
  });

  await beat('open-group', async () => {
    await moveAndClick(page, openGroupRow(page, HERO_GROUP));
    await hold(1800);
    await evidence(page, '00gFAKE0002  Engineering - All');
    await hold(1400);
  });

  await beat('members', async () => {
    // The detail view opens on Overview. Member rows — and the disclosures this
    // scene exists to show — are on the Members tab, so the first cut spent its
    // last five seconds scrolling an Overview pane with nothing below the fold.
    await moveAndClick(page, page.getByRole('tab', { name: /^Members/ }).first());
    await hold(1500);
    await evidence(page, '94 members  ·  1 rule');
    await strip(page, true);
    await rampScroll(page, 320, 1400);
    await strip(page, false);
    await hold(700);
  });

  await beat('provenance', async () => {
    // Probed: member disclosures are labelled "Show details for <name>".
    const row = page.getByRole('button', { name: /^Show details for/ }).first();
    await moveAndClick(page, row);
    await hold(1500);
    await evidence(page, 'user.department == "Engineering"');
    await hold(1600);
    // Both lines are read off the panel's own Overview card, not asserted here.
    await proof(page, {
      text: '1 rule accounts for 100% of members.',
      note: 'No member was added by hand.',
    });
    await hold(3000);
  });
}

/**
 * Scene B — what deactivating a rule would cost, counted before you commit.
 *
 * The prologue is the void fix: the Rules tab opens on an explicit "No Rules
 * Loaded" empty state, and the first cut filmed it for the whole `load-rules`
 * beat. The chapter card is already covering the panel for its own hold, so the
 * load happens underneath it and never reaches camera.
 */
export async function ruleImpactPrologue(page) {
  // Probed: the Rules tab starts empty behind an explicit load.
  await moveAndClick(page, page.getByRole('button', { name: /^Load Rules$/ }).first());
}

export async function ruleImpact(page, beat) {
  await beat('open', async () => {
    await claim(page, { label: 'Rule impact', text: 'Turn it off\non paper first.' });
    await evidenceBlock(page);
    await evidence(page, '9 rules  ·  parsed, not evaluated');
    await hold(1800);
  });

  await beat('scan', async () => {
    await strip(page, true);
    await rampScroll(page, 420, 1800);
    await strip(page, false);
    await hold(900);
  });

  await beat('expand-rule', async () => {
    const rule = page.getByRole('button', { name: /^Expand Engineering → GitHub/ }).first();
    await moveAndClick(page, rule);
    await hold(1500);
    await evidence(page, 'user.department == "Engineering"');
    await hold(600);
    await evidence(page, '&& user.employeeType != "CONTRACTOR"');
    await hold(1600);
  });

  await beat('impact', async () => {
    // Exactly "Preview Impact", and exactly *this rule's*. See previewImpactFor.
    const trigger = await previewImpactFor(page, GITHUB_RULE_ID);
    if (trigger) {
      await centreInView(page, trigger);
      await moveAndClick(page, trigger);
      await hold(2600);
    }
    // The tally replaces the evidence block rather than stacking under it: the
    // expression has done its work and the number is the whole point now.
    //
    // These are the modal's own figures, read off it rather than invented here:
    // "Lose access 0", "Current members 80", target group "No change". The first
    // cut captioned "80 people would lose GitHub", which took the *membership*
    // count and reported it as a loss. The panel has never said that — and with
    // the click missing its button there was nothing on screen to contradict it.
    await clearBody(page);
    await tally(page, {
      from: 80,
      to: 0,
      delta: 'of 80 members',
      tone: 'affirm',
      label: 'Would lose access if this rule were deactivated',
    });
    await hold(2200);
    await proof(page, {
      text: 'Nobody would lose access.',
      note: 'All 80 are held by something other than this rule. Guessing would have said 80.',
    });
    await hold(3200);
  });
}

/**
 * Scene C — two people, and the attribute that explains the gap between them.
 *
 * Every diff row below is **derived, not written**. Amara is Engineering /
 * FULL_TIME / Seattle; Tomas is Engineering / CONTRACTOR / Berlin
 * (`demo/users.ts`). Applying the rule predicates in `demo/snapshot.ts` gives
 * exactly this set: rule 1 (`status == ACTIVE`) and rule 2 (`department ==
 * "Engineering"`) put both in VPN Users and Engineering - All; rule 3 excludes
 * contractors, so GitHub - Engineering is hers alone; rules 5 and 8 are his.
 * If the demo org's rules change, these rows change with them.
 */
export async function userComparison(page, beat) {
  await beat('open', async () => {
    await claim(page, { label: 'Compare', text: 'Same team.\nDifferent access.' });
    await evidenceBlock(page);
    await evidence(page, 'Amara Okonkwo    Engineering  ·  Seattle');
    await hold(900);
    await evidence(page, 'Tomas Lindqvist  Engineering  ·  Berlin');
    await hold(1600);
  });

  await beat('find-user', async () => {
    await typeInto(page, visible(page.getByPlaceholder(/search/i)), 'amara okonkwo');
    await hold(1500);
    // Result rows are buttons whose accessible name begins with the person's
    // name. `getByText` matched a fragment and let the click fall through to the
    // row behind it, which is how the first cut ended up on the wrong person.
    await moveAndClick(page, visible(page.getByRole('button', { name: /^Amara Okonkwo/ })));
    await hold(1800);
  });

  await beat('compare', async () => {
    await moveAndClick(page, page.getByRole('button', { name: /^Compare$/ }).first());
    await hold(1600);
    // Compare opens its own search phase with its own field. A `/search/i`
    // placeholder lookup matches the Users tab's search first — that rung stays
    // mounted behind this one (ADR-0016) — so the text went somewhere invisible
    // and the second person was never picked.
    await typeInto(
      page,
      visible(page.getByPlaceholder(/Search by email, name, or login/i)),
      'tomas',
    );
    await hold(1500);
    await moveAndClick(page, visible(page.getByRole('button', { name: /^Tomas Lindqvist/ })));
    await hold(2200);
  });

  await beat('walk-tabs', async () => {
    // Scope to the comparison surface. The app's own top-level rail is also
    // `role="tab"` with Overview/Users/Groups/Apps, so an unscoped lookup clicks
    // the shell's Groups tab and navigates straight out of the comparison —
    // which is exactly what the first cut filmed.
    const surface = page.locator('[data-testid="user-comparison-view"]');

    // The diff builds one argument across the tabs instead of flashing three
    // unrelated headlines at them. Shared rows strike through as they land: a
    // group both of them are in cannot be what separates them.
    await clearBody(page);
    await diffBlock(page, { a: 'Amara', b: 'Tomas' });

    const groupsTab = await find(surface.getByRole('tab', { name: /^Groups/i }).first(), 2000);
    if (groupsTab) await moveAndClick(page, groupsTab);
    await hold(900);
    await diffRow(page, { name: 'VPN Users', a: true, b: true, state: 'shared' });
    await hold(700);
    await diffRow(page, { name: 'Engineering - All', a: true, b: true, state: 'shared' });
    await hold(900);
    await diffRow(page, { name: 'Contractors - EMEA', a: false, b: true, state: 'only' });
    await hold(700);
    await diffRow(page, { name: 'Berlin Office', a: false, b: true, state: 'only' });
    await hold(700);
    await diffRow(page, { name: 'GitHub - Engineering', a: true, b: false, state: 'only' });
    await hold(1600);

    const appsTab = await find(surface.getByRole('tab', { name: /^Apps/i }).first(), 2000);
    if (appsTab) await moveAndClick(page, appsTab);
    await hold(900);
    await diffRow(page, { name: 'GitHub Enterprise', a: true, b: false, state: 'only' });
    await hold(1600);

    const attrsTab = await find(surface.getByRole('tab', { name: /^Attributes/i }).first(), 2000);
    if (attrsTab) await moveAndClick(page, attrsTab);
    await hold(900);
    await diffRow(page, {
      name: 'employeeType   FULL_TIME / CONTRACTOR',
      a: true,
      b: true,
      state: 'cause',
    });
    await hold(1400);
    await proof(page, {
      text: 'GitHub follows employeeType, not department.',
      note: 'Same team, same department, and one of them is a contractor.',
    });
    await hold(3000);
  });
}

/** Scene D — a bulk change, rate limited, and the record it leaves behind. */
export async function bulkOperation(page, beat) {
  await beat('open', async () => {
    await claim(page, {
      label: 'Bulk operations',
      text: 'Fifty changes.\nEvery one on the record.',
    });
    await evidenceBlock(page);
    await evidence(page, '48 memberships queued');
    await hold(700);
    await evidence(page, 'rate limited through the scheduler');
    await hold(1200);
    // Populate the rung before anything is claimed about it. Without this the
    // scene runs its whole argument over the Users tab's "User Membership
    // Tracing" empty state — the panel showing nothing while the margin talks
    // about 48 changes, which is the same void the rule-impact scene used to
    // film.
    await typeInto(page, visible(page.getByPlaceholder(/search/i)), 'example.com');
    await hold(1800);
  });

  await beat('progress', async () => {
    await clearBody(page);
    await tally(page, {
      from: 0,
      to: 48,
      label: 'Memberships updated',
      delta: 'of 48',
      tone: 'signal',
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
      await hold(300);
    }
    await page.evaluate(() => window.__OKTA_DEMO__?.progress?.complete());
    await hold(1200);
  });

  await beat('record', async () => {
    // Every line here is either a shape the scheduler really produces or a count
    // taken from the same 48 the bar just drained. Ids are the repo's fake
    // placeholders; nothing is read from a real org.
    await clearBody(page);
    await traceBlock(page);
    await trace(page, 'POST /api/v1/groups/00gFAKE0002/users/00uFAKE0007   204');
    await hold(420);
    await trace(page, 'POST /api/v1/groups/00gFAKE0002/users/00uFAKE0011   204');
    await hold(420);
    await trace(page, 'POST /api/v1/groups/00gFAKE0002/users/00uFAKE0023   204');
    await hold(600);
    await trace(page, '48 requests  ·  0 failed', 'affirm');
    await hold(600);
    await trace(page, 'audit  48 rows written', 'signal');
    await hold(1200);
    await proof(page, {
      text: '48 changes. 48 audit rows.',
      note: 'Rate limited through the scheduler, and cancellable at any point.',
    });
    await hold(2800);
  });
}

/**
 * The action strip: the dock merge, then the overflow ladder.
 *
 * Kept as a standalone clip and deliberately **not** in `REEL_ORDER`. It is a
 * chrome detail, and the reel's last position is its strongest one — spending it
 * on a layout behaviour rather than on the audit trail was the weakest thing
 * about the first cut.
 */
export async function actionBarShowcase(page, beat) {
  await beat('open-group', async () => {
    await claim(page, { label: 'The action bar', text: 'It docks as\nyou scroll.' });
    await moveAndClick(page, openGroupRow(page, HERO_GROUP));
    await hold(1800);
    // Onto the Members rung before filming the dock. The Overview tab holds
    // three cards and no overflow, so there is nothing to scroll — the first cut
    // narrated "it docks as you scroll" over a strip that never moved, because
    // the ramp had no distance to travel. 94 members gives it a real scroller,
    // and a real header seam for the band to cover.
    await moveAndClick(page, page.getByRole('tab', { name: /^Members/ }).first());
    await hold(1600);
  });

  await beat('dock-merge', async () => {
    await evidenceBlock(page);
    await evidence(page, 'margins, radius and border, over 16px of travel');
    // The merge runs over the last --merge-range of the sentinel's travel, so it
    // wants a slow ramp: too fast and the whole transition lands in two frames.
    await strip(page, true);
    await rampScroll(page, 300, 2800);
    await hold(1200);
    await rampScroll(page, -300, 2000);
    await hold(800);
    await rampScroll(page, 420, 2600);
    await strip(page, false);
    await hold(1400);
  });

  await beat('overflow-ladder', async () => {
    await claim(page, {
      label: 'Responsive by measurement',
      text: 'It re-splits itself\nas you resize.',
    });
    await clearBody(page);
    await evidenceBlock(page);
    await evidence(page, 'every action measured, never guessed');
    await hold(1400);
    await strip(page, true);
    await sweepPanelWidth(page, [1000, 860, 720, 600, 520, 440, 380], { hold: 1100 });
    await hold(700);
    await sweepPanelWidth(page, [640, 900], { hold: 1000 });
    await strip(page, false);
    await proof(page, {
      text: 'Icons drop before anything hides behind More.',
      note: 'And they come back when dropping one buys the room.',
    });
    await hold(2600);
  });
}

/**
 * Story id → its chapter and its declared beats.
 *
 * The `beats` list is a contract, not documentation: the runner walks it to fill
 * the rail as the scene advances, and warns when a choreography function calls a
 * beat the list does not name. A renamed beat should surface, not silently stop
 * the rail halfway.
 *
 * `prologue` runs while the chapter is still covering the panel, for anything
 * that has to happen before the panel is fit to film.
 */
export const SCENES = {
  'demo-scenes--group-drilldown': {
    label: 'Provenance',
    title: 'Nobody is in a group\nby accident.',
    blurb: 'Open a group and the panel already knows which rule put each person in it.',
    beats: ['open', 'cascade', 'open-group', 'members', 'provenance'],
  },
  'demo-scenes--rule-impact': {
    label: 'Rule impact',
    title: 'Turn it off\non paper first.',
    blurb: 'Preview what deactivating a group rule would cost, before you commit to it.',
    beats: ['open', 'scan', 'expand-rule', 'impact'],
    prologue: ruleImpactPrologue,
  },
  'demo-scenes--user-comparison': {
    label: 'Compare',
    title: 'Same team.\nDifferent access.',
    blurb: 'Two people side by side, across every group, app and attribute that differs.',
    beats: ['open', 'find-user', 'compare', 'walk-tabs'],
  },
  'demo-scenes--bulk-operation': {
    label: 'Bulk operations',
    title: 'Fifty changes.\nEvery one on the record.',
    blurb:
      'Rate limited through the scheduler, cancellable at any point, and written to an audit trail.',
    beats: ['open', 'progress', 'record'],
  },
  'demo-scenes--action-bar-showcase': {
    label: 'The action bar',
    title: 'Built to be\nlived in.',
    blurb: 'A sticky action bar that docks as you scroll and re-splits itself as you resize.',
    beats: ['open-group', 'dock-merge', 'overflow-ladder'],
  },
};

/** The card the reel closes on. */
export const END_CARD = {
  title: 'Okta Unbound',
  blurb: 'A Chrome side panel for Okta group and user administration.',
};

/**
 * The order the reel plays them in.
 *
 * Four scenes, closing on the audit trail. The action bar showcase is filmed by
 * `npm run film` as its own clip but is not part of the reel.
 */
export const REEL_ORDER = [
  'demo-scenes--group-drilldown',
  'demo-scenes--rule-impact',
  'demo-scenes--user-comparison',
  'demo-scenes--bulk-operation',
];

/** Story id → the movement that scene performs. */
export const CHOREOGRAPHY = {
  'demo-scenes--group-drilldown': groupDrilldown,
  'demo-scenes--rule-impact': ruleImpact,
  'demo-scenes--bulk-operation': bulkOperation,
  'demo-scenes--user-comparison': userComparison,
  'demo-scenes--action-bar-showcase': actionBarShowcase,
};
