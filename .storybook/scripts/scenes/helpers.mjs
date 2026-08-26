/**
 * Camera moves shared by the demo scenes.
 *
 * These exist because a Storybook `play` function can do none of them: it has no
 * wheel, no viewport, no visible cursor, and nowhere to put a caption.
 * Everything here runs from Playwright against the live page.
 *
 * Every locator helper takes a **short** timeout. The first cut of this script
 * used Playwright's 30s default, so a selector that never matched produced half
 * a minute of frozen video before the beat was recorded as failed. On a shoot, a
 * missed mark should cost a second, not a take.
 */

/**
 * Narrow a locator to the element that is actually on screen.
 *
 * Both rungs of a tab stay mounted (ADR-0016), so a placeholder or role lookup
 * routinely resolves to a hidden twin first. `.first()` then picks the invisible
 * one and every wait against it times out.
 */
export const visible = (locator) => locator.locator('visible=true').first();

/** The app's single scroller. Every sticky band and scroll timeline resolves against it. */
export const SCROLL_ROOT = '[data-testid="app-scroll-root"]';

/** How long to wait for any element before giving up on that movement. */
export const FIND_TIMEOUT = 3000;

/** Wait `ms`. Named for what it is on a shoot: a deliberate hold. */
export const hold = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve a locator, or return null quickly if it never appears.
 *
 * The null return is the point: a caller decides whether a missing element ends
 * the beat or is simply skipped, instead of Playwright deciding by timing out.
 */
export async function find(locator, timeout = FIND_TIMEOUT) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  } catch {
    return null;
  }
}

/**
 * Scroll the app root smoothly, one animation frame at a time.
 *
 * A single `scrollTo` jumps and `behavior: 'smooth'` gives no control over
 * duration. Filming `useStaggerReveal` needs rows to cross the viewport
 * gradually — they are released in DOM-order batches as an `IntersectionObserver`
 * sees them — and the `.dock-band` merge needs its `view-timeline` to advance
 * over many frames rather than snapping to 100%.
 */
export async function rampScroll(page, distance, duration = 1600) {
  await page.evaluate(
    ([selector, dist, ms]) =>
      new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (!el) return resolve();
        const from = el.scrollTop;
        const started = performance.now();
        // easeInOutCubic — the shape of the app's own --ease-standard, so a
        // filmed scroll feels like the product rather than like a robot.
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = (now) => {
          const t = Math.min(1, (now - started) / ms);
          el.scrollTop = from + dist * ease(t);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [SCROLL_ROOT, distance, duration],
  );
}

/**
 * Move the pointer to an element along a visible path, then click it.
 *
 * `locator.click()` teleports, which reads as a jump cut. Stepping the mouse
 * gives the viewer something to follow and lets hover states play on the way.
 *
 * @returns `true` when the element was found and clicked.
 */
export async function moveAndClick(page, locator, { click = true, steps = 22, settle = 260 } = {}) {
  const found = await find(locator);
  if (!found) return false;
  await found.scrollIntoViewIfNeeded({ timeout: FIND_TIMEOUT }).catch(() => {});
  const box = await found.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await hold(settle);
  if (click) {
    await page.mouse.down();
    await hold(80);
    await page.mouse.up();
  }
  return true;
}

/**
 * Type into a field at a human cadence, after moving to it.
 *
 * The cursor move is **best-effort**: an earlier version returned early when it
 * failed, so a field that appeared a beat later than expected — the comparison's
 * own search, which mounts after its phase transition — was never typed into at
 * all, and the scene filmed an empty box. Moving the pointer is presentation;
 * typing is the point, so only the latter can fail the movement.
 */
export async function typeInto(page, locator, text, { delay = 85, timeout = 6000 } = {}) {
  const found = await find(locator, timeout);
  // Throwing rather than returning false is deliberate. A silent `false` let the
  // comparison scene report a landed beat while filming an empty search box —
  // the worst kind of failure, because the manifest said everything was fine.
  if (!found) throw new Error(`typeInto: no visible field for ${locator}`);
  await moveAndClick(page, locator).catch(() => false);
  await locator.fill('').catch(() => {});
  await locator.pressSequentially(text, { delay });
  return true;
}

/**
 * Put a caption on the stage.
 *
 * Pass `anchor` (a selector) to align the caption with that element and draw a
 * connector plus a spotlight ring to it — the difference between a title card
 * and a caption that is actually about something.
 */
export async function say(page, spec) {
  await page.evaluate((s) => window.__DEMO_STAGE__?.caption(s), spec);
}

/** Ring an element the current caption is about. Returns false if it isn't on screen. */
export async function spotlight(page, selector) {
  return page.evaluate((sel) => window.__DEMO_STAGE__?.spotlight(sel) ?? false, selector);
}

/** Animate the current caption out. */
export async function clearCaption(page) {
  await page.evaluate(() => window.__DEMO_STAGE__?.clear());
  await hold(360);
}

/**
 * Step the panel's width through a ladder of values.
 *
 * The ActionBar's overflow beat. `actionBarFit` re-splits the row as the panel
 * tightens, and the ladder is deliberately non-monotonic — dropping an action
 * twice buys back enough room for the icons to return. Because the panel is a
 * framed element on a fixed 16:9 stage rather than the viewport itself, this
 * resizes the frame, not the window: the video size must not change mid-take.
 */
export async function sweepPanelWidth(page, widths, { hold: holdMs = 1000 } = {}) {
  for (const width of widths) {
    await page.evaluate((w) => {
      const root = document.getElementById('storybook-root');
      if (root) {
        root.style.transition = 'width 520ms cubic-bezier(0.22, 1.1, 0.36, 1)';
        root.style.width = `${w}px`;
      }
    }, width);
    await hold(holdMs);
  }
}
