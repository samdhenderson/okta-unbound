/**
 * The verbs a walk is written in.
 *
 * Seven of them, and that is the whole vocabulary. The old system had
 * twenty-nine exports because more than half of them drove a camera and a
 * caption margin that lived inside the page; those are the composition's job
 * now, and deleting them from the driver is most of why a walk is readable.
 *
 * ## One rule holds this file together
 *
 * **Every verb throws.** Not one of them returns a boolean the caller might
 * forget to check. This is the single most expensive lesson the old system
 * learned: raw `page.mouse` deliberately bypasses Playwright's actionability
 * check, so nothing but this file stands between a walk and a click into empty
 * backdrop — and five distinct failure modes used to be silent, three of them
 * returning `true`. A beat could narrate a click on a control that was
 * disabled, off camera, or under a tooltip, and the manifest recorded success
 * for all of it.
 *
 * `{ optional: true }` is the one escape hatch, for marks genuinely allowed not
 * to exist.
 *
 * ## The pointer is data, not pixels
 *
 * No cursor is drawn here. The driver records the path it commands — in
 * normalized panel coordinates, so it survives any render scale — and the
 * composition draws a crisp vector cursor from it at 60fps. That also means the
 * cursor can be retimed in post along with everything else, which a cursor
 * burned into the footage could not be.
 *
 * @module
 */
import { selectors } from 'playwright';
import { PANEL, RETIME } from './stage.mjs';
import { SCROLL_ROOT } from './selectors.mjs';

/** How long to wait for any element before giving up on that movement. */
export const FIND_TIMEOUT = 3000;

/** How long the app's scroller may take to settle after a rung change. */
export const NAV_SETTLE_MS = 700;

/**
 * How long the app may keep moving after we touch it, before that counts as a
 * settle defect.
 *
 * `--dur-tell` is the app's longest motion token (500ms, `tailwind.css`) and
 * the stage multiplies every token by `RETIME`, so a transition we commanded
 * genuinely takes `500 * RETIME` ms to finish. The first version of this
 * declared the driver's own 180ms internal settle instead and the guard duly
 * flagged every `CollapsibleSection` in the reel opening: 38 violations in one
 * chapter, all of them footage the walk had asked for.
 *
 * Widening it does not blind the guard. What is still caught is the thing worth
 * catching: a badge or a chip that lands *after* the app's own transitions are
 * over, and re-wraps the string beside it while the camera holds on a panel the
 * walk believed was settled.
 */
export const COMMANDED_MS = 500 * RETIME;

/**
 * How long the pointer takes to cross the panel, and the floor for a nudge.
 *
 * `RETIME` slows the app; it does nothing to the driver, and that asymmetry is
 * what made the first cut unwatchable. `page.mouse.move(x, y, { steps: 16 })`
 * dispatches its sixteen events as fast as the CDP round trip allows — around
 * 90ms for the full width of the panel — and the manifest faithfully recorded
 * that 90ms. The composition then played the beat at `retime` to restore
 * natural speed and the drawn cursor crossed 840px in 30ms. It did not read as
 * fast. It read as a cut, with the pointer already at its destination.
 *
 * So a move is now *paced*: interpolated over a real duration, retimed like
 * everything else, so the frames exist and the ledger's `ms` is the truth. It
 * scales with distance, because a 30px nudge between two chips taking as long
 * as a sweep across the panel is its own kind of wrong.
 */
export const TRAVEL_MS = 420 * RETIME;
/** The floor, for a move too short to deserve the full crossing. */
export const NUDGE_MS = 150 * RETIME;
/** The distance that counts as a full crossing: corner to corner of the panel. */
const PANEL_REACH = Math.hypot(PANEL.width, PANEL.height);

/**
 * How long the camera stays on a control after it has been pressed.
 *
 * Not a settle allowance — {@link COMMANDED_MS} already covers the app's own
 * transitions. This is editorial: the press, the thing it caused, and a beat of
 * stillness to notice both. Without it every click cut straight into the next
 * pointer move and the reel became a list of things that had already happened.
 */
export const NOTICE_MS = 420 * RETIME;

/**
 * Per-keystroke cadence, before retiming.
 *
 * Typing is wall-clock, so this is multiplied by `RETIME` at the shoot for the
 * same reason a pointer move is: what the viewer sees is this number, after the
 * composition has played the beat back at `retime`.
 */
export const KEY_MS = 125;

/** Wait `ms`. Named for what it is on a shoot: a deliberate hold. */
export const hold = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ease-in-out quadratic — the curve the drawn cursor uses.
 *
 * Shared on purpose. The manifest records only a move's endpoints and its
 * duration, so the composition redraws the path with a curve of its own; if the
 * real pointer travelled on a different one, every hover state in the footage
 * would light up at a moment the drawn cursor was not yet over it. One curve,
 * two consumers, and `reel/src/comp/Cursor.tsx` names this file.
 */
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Register the `onstage=` selector engine. Call once per process.
 *
 * "Visible" as a non-zero box is the wrong test and it cost more takes than
 * anything else. Both rungs of a tab stay mounted (ADR-0016) and the rung
 * behind is not hidden, it is *scrolled away* — so its nodes report perfectly
 * real boxes at coordinates outside the panel. Accepting one produced landed
 * clicks that flew off camera and text typed into invisible twins.
 *
 * An element qualifies only if its **centre** lies inside the viewport, which
 * is what a viewer means by "on screen".
 *
 * The new capture geometry makes this simpler than it was: the panel is scaled
 * to fill the viewport exactly, so "inside the viewport" and "inside the panel"
 * are the same predicate, and it no longer has to find and measure a panel box
 * first.
 */
let registered = false;
export async function registerEngines() {
  if (registered) return;
  registered = true;
  await selectors
    .register('onstage', {
      content: `({
        /*
         * The engine judges the element it is HANDED, not that element's
         * descendants. When chained — \`getByRole('tab').locator('onstage=true')\`
         * — Playwright calls this once per parent match with \`root\` set to that
         * match, so asking \`root.querySelectorAll('*')\` searches inside the tab
         * and answers about its spans. That silently matched nothing for every
         * chained use, which reads exactly like "the element is off camera".
         */
        query(root) {
          return this._on(root) ? root : null;
        },
        queryAll(root) {
          return this._on(root) ? [root] : [];
        },
        _on(el) {
          if (!el || el.nodeType !== 1 || typeof el.getBoundingClientRect !== 'function') {
            return false;
          }
          const box = el.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) return false;
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          return cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight;
        },
      })`,
    })
    .catch((err) => {
      // Re-registration across a watch loop is not an error worth stopping for.
      if (!/already registered/i.test(String(err?.message))) throw err;
    });
}

/**
 * Narrow a locator to the one element that is actually on camera.
 *
 * The engine judges the element it is handed, so chaining is a drop-in swap:
 * `getByRole('tab').locator('onstage=true')` asks the question of each tab, not
 * of the spans inside one.
 */
export const onstage = (locator) => locator.locator('onstage=true').first();

/**
 * Build the verb set for one chapter.
 *
 * @param {import('playwright').Page} page
 * @param {object} ctx
 * @param {number} ctx.scale The stage's render scale, for normalizing coordinates.
 * @param {{width:number,height:number}} ctx.panel
 * @param {() => number} ctx.now Clip-local milliseconds. See `capture.mjs`.
 * @param {object} ctx.trace Where the pointer path and read-backs accumulate.
 */
export function createDriver(page, { scale, panel, now, trace }) {
  const viewport = { width: panel.width * scale, height: panel.height * scale };
  /** Viewport CSS px -> fraction of the panel, so the composition is scale-agnostic. */
  const norm = (x, y) => ({ x: x / viewport.width, y: y / viewport.height });

  /** Where the pointer currently is, in viewport CSS px. */
  let at = { x: viewport.width * 0.5, y: viewport.height * 0.5 };

  const declare = (kind, ms) =>
    page.evaluate(([k, m]) => window.__CAP__?.declare(k, m), [kind, ms]).catch(() => {});

  /** As `declare`, but covering time that has already passed. See `declareSince`. */
  const declareSince = (kind, ms) =>
    page.evaluate(([k, m]) => window.__CAP__?.declareSince(m, k), [kind, ms]).catch(() => {});

  /** Resolve a locator, or return null quickly rather than timing out at Playwright's default. */
  const find = async (locator, timeout = FIND_TIMEOUT) => {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return locator;
    } catch {
      return null;
    }
  };

  const verbs = {
    /**
     * Hold, and do not return while the panel is still re-laying-out.
     *
     * The settle is **budgeted, not additive**: the gate is spent from inside
     * the hold the beat was already paying for, so a quiet page costs exactly
     * `ms` and only a page genuinely still moving borrows from the slack. A
     * fixed longer hold would make the reel longer and still be a guess.
     */
    async settle(ms, { quiet = 220, slack = 0.5 } = {}) {
      const started = Date.now();
      const lead = Math.max(0, ms - quiet);
      if (lead > 0) await hold(lead);
      const result = await page
        .evaluate((o) => window.__CAP__?.settled(o) ?? { quiet: true, waitedMs: 0 }, {
          quiet,
          budget: Math.max(0, Math.round(ms * (1 + slack)) - (Date.now() - started)),
        })
        .catch(() => ({ quiet: true, waitedMs: 0 }));
      const remaining = ms - (Date.now() - started);
      if (remaining > 0) await hold(remaining);
      return result;
    },

    hold,

    /**
     * Move the pointer along a visible path, then click.
     *
     * `locator.click()` teleports, which reads as a jump cut; stepping gives the
     * viewer something to follow and lets hover states play on the way.
     *
     * @throws when the element never appears, has a zero box, is disabled, is
     *   not onstage, or when the hit test at the click coordinate resolves to
     *   something that is neither the target nor a descendant of it. The
     *   message names what was hit instead.
     */
    async click(locator, { settle = 180, optional = false, navigates = false } = {}) {
      const label = String(locator);
      const refuse = (why) => {
        if (optional) return false;
        throw new Error(`click: ${why}`);
      };

      // Narrow to what is on camera BEFORE resolving, not after.
      //
      // This is structural, and it is the one place this driver deliberately
      // differs from the system it replaces. There, every call site had to
      // remember to wrap its locator in `visible(...)`, because ADR-0016 keeps
      // both rungs of a tab mounted and the rung behind is scrolled away rather
      // than hidden — so `getByRole('tab', { name: /^Members/ })` resolves to a
      // real element with a real box, several hundred pixels off camera. A call
      // site that forgot got a landed click on a twin nobody could see.
      //
      // Checking onstage *after* resolution, as an assertion, does not fix it:
      // the wrong element has already been chosen and the assertion just fails
      // confusingly. Narrowing first means the wrong element is never a
      // candidate, and "I forgot the wrapper" stops being expressible.
      //
      // `scrollTo` deliberately does NOT do this — see its own note. Scrolling
      // has to aim at where an element *is*; clicking has to aim at where the
      // camera can see. Collapsing the two makes an off-camera element
      // invisible to the very scroll that exists to fetch it.
      const found = await find(onstage(locator));
      if (!found) {
        const total = await locator.count().catch(() => 0);
        return refuse(
          total
            ? `${total} match(es) for ${label}, none of them onstage — ` +
                'the rung behind is mounted and scrolled away; scroll it into view first'
            : `no element for ${label}`,
        );
      }

      // Measured in the page, from the same getBoundingClientRect the onstage
      // predicate reads, so the coordinate aimed at and the coordinate judged
      // are one number rather than two measurements a round trip apart.
      const aim = await found.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return {
          x: b.left + b.width / 2,
          y: b.top + b.height / 2,
          w: b.width,
          h: b.height,
          // A control can be inert without being a disabled form element, and
          // can inherit the state from a wrapper it does not own.
          ariaDisabled: Boolean(el.closest('[aria-disabled="true"]')),
          onstage:
            b.width > 0 &&
            b.height > 0 &&
            b.left + b.width / 2 >= 0 &&
            b.left + b.width / 2 <= window.innerWidth &&
            b.top + b.height / 2 >= 0 &&
            b.top + b.height / 2 <= window.innerHeight,
        };
      });

      if (aim.w <= 0 || aim.h <= 0) return refuse(`zero box for ${label}`);
      // `isEnabled` is exactly what the raw mouse path skips: the native
      // disabled attribute and disabled-fieldset inheritance, which is how this
      // repo's shared Button expresses the state.
      if (!(await found.isEnabled()) || aim.ariaDisabled) return refuse(`disabled: ${label}`);
      if (!aim.onstage) {
        return refuse(`offstage at (${Math.round(aim.x)}, ${Math.round(aim.y)}): ${label}`);
      }

      const from = { ...at };
      const startedAt = now();
      // Paced rather than stepped. See TRAVEL_MS for what stepping produced.
      const reach = Math.hypot(aim.x - from.x, aim.y - from.y);
      const span = NUDGE_MS + (TRAVEL_MS - NUDGE_MS) * Math.min(1, reach / PANEL_REACH);
      const steps = Math.max(2, Math.round((span / 1000) * 40));
      for (let i = 1; i <= steps; i += 1) {
        const t = ease(i / steps);
        await page.mouse.move(from.x + (aim.x - from.x) * t, from.y + (aim.y - from.y) * t);
        await hold(span / steps);
      }
      at = { x: aim.x, y: aim.y };
      trace.pointer.push({
        kind: 'move',
        from: norm(from.x, from.y),
        to: norm(at.x, at.y),
        at: startedAt,
        ms: Math.max(1, now() - startedAt),
      });
      // Retimed like the move it follows: a pause before the press that shrank
      // to 60ms on playback was not a pause, it was a rendering hitch.
      await hold(settle * RETIME);

      // Hit test immediately before the press. This catches what no static
      // check could: the pointer path HOVERS every element it crosses, so a
      // tooltip or popover can have opened and be sitting under the click point
      // by the time the button goes down.
      const probe = await found.evaluate(
        (el, [x, y]) => {
          const under = document.elementFromPoint(x, y);
          const name = (n) => {
            if (!n) return 'nothing';
            const text = (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
            return `${String(n.tagName).toLowerCase()}${text ? ` "${text}"` : ''}`;
          };
          return {
            hit: under === el ? 'self' : el.contains(under) ? 'descendant' : 'miss',
            hitDesc: name(under),
          };
        },
        [aim.x, aim.y],
      );
      if (probe.hit === 'miss') {
        trace.pointer.push({
          kind: 'refused',
          at: now(),
          to: norm(at.x, at.y),
          why: probe.hitDesc,
        });
        return refuse(`hit ${probe.hitDesc} instead of ${label}`);
      }

      // The window opens BEFORE the press, not after it.
      //
      // React resets the scroll position on the render that mouseup schedules,
      // and that lands sooner than a round trip out to the page can declare it.
      // Measured on the old system: a window opening at 17.4s over a scroller
      // that had already snapped at 17.364s — reported twice, once as an
      // undeclared jump and once as an inert declaration.
      if (navigates) await declare('scroll', NAV_SETTLE_MS * RETIME);
      // A click is a command, and the app is entitled to move in response to it
      // for as long as its own retimed transitions take. Declared before the
      // press for the same reason the scroll window is: React schedules its
      // work on mouseup, sooner than a round trip out to the page can announce.
      await declare('move', COMMANDED_MS);

      await page.mouse.down();
      await hold(80);
      await page.mouse.up();
      trace.pointer.push({ kind: 'click', at: now(), to: norm(at.x, at.y), target: label });
      // Stay on it. See NOTICE_MS.
      await hold(NOTICE_MS);
      return true;
    },

    /**
     * Type at a human cadence, after moving to the field.
     *
     * The pointer move is **best-effort and the typing is not**: an earlier
     * version returned early when the move failed, so a field that mounted a
     * beat later than expected was never typed into and the scene filmed an
     * empty box while reporting success.
     */
    async type(locator, text, { delay = KEY_MS * RETIME } = {}) {
      // Same narrowing as `click`, and for a sharper reason: `fill()` on an
      // unnarrowed locator types into the offstage twin perfectly happily, and
      // the chapter films an empty search box while reporting success. That is
      // the exact failure the old comparison scene shipped.
      const field = onstage(locator);
      const found = await find(field, 6000);
      if (!found) throw new Error(`type: no onstage field for ${locator}`);
      // The pointer move is presentation and may fail; the typing is the point
      // and may not.
      await verbs.click(locator, { optional: true });
      await field.fill('').catch(() => {});
      // The whole type, plus one retimed transition for the list to re-render
      // after the last keystroke. A type-ahead narrowing its results *is* the
      // shot; flagging it would be flagging the point of the beat.
      await declare('move', text.length * delay + COMMANDED_MS);
      // The action timeout has to cover the whole word, not one keystroke.
      // Playwright's default is 4s, and at a retimed cadence a thirteen-letter
      // name takes longer than that: the shoot failed on exactly two chapters,
      // both of them the ones that type a full name.
      await field.pressSequentially(text, {
        delay,
        timeout: text.length * delay + 15_000,
      });
      // The last keystroke's result is the shot. Hold on it.
      await hold(NOTICE_MS);
      return true;
    },

    /**
     * Scroll the app's own scroller on an eased ramp.
     *
     * A single `scrollTo` jumps and `behavior: 'smooth'` gives no control over
     * duration. Filming `useStaggerReveal` needs rows to cross the viewport
     * gradually — they are released in DOM-order batches by an
     * `IntersectionObserver` — so travelling slowly is what turns a scroll into
     * a cascade rather than a dump.
     *
     * @throws when the scroller is not mounted, or when it does not move. Zero
     *   achieved travel means the ledger says the page moved while the page
     *   stood still, which is worse than an error: it is a declared window with
     *   nothing in it, and it hides a real jump.
     */
    async scrollBy(distance, ms = 1600) {
      const moved = await page.evaluate(
        ([selector, dist, duration]) =>
          new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (!el) return resolve(null);
            window.__CAP__?.declare('scroll', duration);
            const from = el.scrollTop;
            const started = performance.now();
            // easeInOutCubic — the shape of the app's own --ease-standard, so a
            // filmed scroll feels like the product rather than like a robot.
            const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
            const step = (nowMs) => {
              const t = Math.min(1, (nowMs - started) / duration);
              el.scrollTop = from + dist * ease(t);
              if (t < 1) requestAnimationFrame(step);
              else resolve(el.scrollTop - from);
            };
            requestAnimationFrame(step);
          }),
        [SCROLL_ROOT, distance, ms],
      );
      if (moved === null) {
        throw new Error(`scrollBy: nothing matched ${SCROLL_ROOT} — the rung has not rendered`);
      }
      if (distance !== 0 && moved === 0) {
        throw new Error(
          `scrollBy: asked for ${distance}px and nothing moved; ` +
            `${ms}ms of motion was declared over a still page`,
        );
      }
      return moved;
    },

    /**
     * Bring an element to the middle of its scroller, on an eased ramp.
     *
     * This is the **only** sanctioned way an off-screen mark comes into view.
     * `scrollIntoViewIfNeeded` is banned outright and deliberately has no silent
     * replacement: it is instant, unanimated, its failure is swallowed, and it
     * parks the element just inside the viewport edge — which in this app is
     * *under* a `sticky top-0 z-40` nav, so the click lands on the nav while the
     * beat reports success.
     */
    async scrollTo(locator, { settle: settleMs = 700, ms = 900 } = {}) {
      const found = await find(locator);
      if (!found) throw new Error(`scrollTo: no element for ${locator}`);
      await found.evaluate(
        (el, [selector, duration, tail]) =>
          new Promise((resolve) => {
            // The nearest scrollable ancestor, never anything above the panel.
            // Hardcoding the app's scroller is wrong on the comparison surface,
            // which scrolls inside its own container.
            const stop = document.getElementById('storybook-root');
            let root = null;
            for (let n = el.parentElement; n && n !== stop?.parentElement; n = n.parentElement) {
              const style = getComputedStyle(n);
              if (
                /auto|scroll|overlay/.test(style.overflowY) &&
                n.scrollHeight > n.clientHeight + 1
              ) {
                root = n;
                break;
              }
              if (n === stop) break;
            }
            if (!root) root = document.querySelector(selector);
            if (!root) return resolve();
            const rootBox = root.getBoundingClientRect();
            const elBox = el.getBoundingClientRect();
            const wanted =
              root.scrollTop + (elBox.top - rootBox.top) - (rootBox.height - elBox.height) / 2;
            const to = Math.max(0, Math.min(root.scrollHeight - root.clientHeight, wanted));
            const from = root.scrollTop;
            if (Math.abs(to - from) < 2) return resolve();
            // Declared here rather than at the top: a call that resolves without
            // moving anything must not open a window, or "declare everything"
            // stops meaning anything.
            //
            // The window covers the scroll **and the hold after it**, because a
            // scroll's consequences land after the scroll has stopped: sticky
            // bands re-pin, `useStaggerReveal` releases the rows that just
            // crossed the fold, and a header collapses. A ledger that closed at
            // the last scroll frame was measuring the cause and calling the
            // effect an undeclared jump - which is what it did to the Users
            // chapter's scroll back up to the pane header, 200ms of settling
            // reported as four violations.
            window.__CAP__?.declare('scroll', duration + tail);
            const started = performance.now();
            const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
            const step = (nowMs) => {
              const t = Math.min(1, (nowMs - started) / duration);
              root.scrollTop = from + (to - from) * ease(t);
              if (t < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          }),
        [SCROLL_ROOT, ms, settleMs],
      );
      await hold(settleMs);
      return true;
    },

    /**
     * Wait for the panel to say something, rather than for a clock to run out.
     *
     * The MFA scan is the case this exists for. It is one API call per member
     * and takes as long as it takes, so a `hold()` long enough to cover it is
     * either dead footage on a fast run or a cut mid-scan on a slow one. The
     * panel already states both edges — a `[role="progressbar"]` appears when
     * the scan starts, and a `No factors enrolled` row exists only once results
     * are in — so the walk waits on those instead of on arithmetic.
     *
     * `hidden` is a genuinely different question from `visible`, and both are
     * needed: a scan is over when the bar goes *away*.
     *
     * @param {import('playwright').Locator} locator
     * @param {{ state?: 'visible'|'hidden', timeout?: number, why?: string }} [options]
     * @throws when the statement never arrives. A scan that silently failed
     *   must end the chapter, not be filmed as a still page.
     */
    async waitFor(locator, { state = 'visible', timeout = 20000, why = '' } = {}) {
      // Waiting on a statement *is* a declaration that something is about to
      // change: the whole reason to wait is that the panel has not finished
      // yet. The window covers the wait itself plus one retimed transition for
      // whatever arrives to animate in - a rules list landing 700ms after the
      // click that asked for it is footage, not a settle defect.
      const started = Date.now();
      try {
        await locator.first().waitFor({ state, timeout });
        await declareSince('move', Date.now() - started);
        await declare('move', COMMANDED_MS);
      } catch {
        throw new Error(
          `waitFor(${state}) timed out after ${timeout}ms on ${String(locator)}` +
            (why ? ` — ${why}` : ''),
        );
      }
    },

    /**
     * Read a figure off the panel and record it for the composition.
     *
     * This is how the house rule is kept — no caption states a figure the panel
     * does not display — and it is stricter than the rule used to be. The old
     * read-back fell back to generic prose when its regex missed, so a caption
     * could quietly stop being evidence and nothing went red. Here the reader
     * throws, the chapter fails, and the composition never renders a claim with
     * nothing behind it.
     *
     * @param {string} name Key the composition will look this up by.
     * @param {() => Promise<any>} reader Usually one of `selectors.mjs`'s.
     */
    async read(name, reader) {
      const value = await reader();
      trace.figures[name] = { value, at: now() };
      return value;
    },
  };

  return verbs;
}
