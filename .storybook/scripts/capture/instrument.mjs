/**
 * What the page records about itself while being filmed.
 *
 * Two questions, and only two, because the composition now answers everything
 * else. The old stage carried ~713 lines of instrumentation, most of it
 * sampling a camera that no longer exists inside the browser.
 *
 *   1. **Did the panel re-lay-out while we were filming it?** A count badge
 *      landing a network tick late, re-wrapping the string beside it, is a
 *      defect in the footage that no composite can fix and no viewer can
 *      unsee. This is the one signal that judges the *product* rather than the
 *      rig, and it is why `settle()` can be more than a sleep.
 *   2. **Was that motion asked for?** A scroll we commanded is footage; a
 *      scroll that happened on its own is a jump. Only the caller knows which,
 *      so the caller declares.
 *
 * @module
 */

/**
 * A shift smaller than this is not worth reporting, in panel CSS pixels.
 *
 * One pixel. Below that it is subpixel text rendering, which no viewer sees and
 * every font-metric change produces.
 */
export const SHIFT_EPS_PX = 1.0;

/**
 * How long after a declared move a shift is still attributed to it.
 *
 * A transition's final frame and the layout-shift entry describing it do not
 * arrive together, and the entry is delivered on a task after paint.
 */
export const MOTION_TAIL_MS = 120;

/**
 * The in-page recorder, as source, for `addInitScript`.
 *
 * It is a string rather than a function because a function serialized with
 * `toString()` closes over nothing — the old stage had to smuggle its own
 * constants into the page through CSS custom properties and read them back with
 * `getComputedStyle`. Building the source here lets the constants be
 * interpolated in the one place they are defined.
 *
 * @param {number} renderScale The stage's transform scale. See below.
 */
export const instrumentInit = (renderScale) => `
(() => {
  if (window.__CAP__) return;

  /*
   * Layout-shift values arrive in VIEWPORT coordinates, and the stage puts a
   * static \`scale(${renderScale})\` on #storybook-root — so every shift inside the
   * panel is reported at ${renderScale}x its panel-local size. Dividing by the scale is
   * the whole normalisation.
   *
   * This used to be a live divisor that had to track a camera mid-push, which
   * was both fiddly and, it turned out, unnecessary: transform SCALE is
   * excluded from the Layout Instability API outright, so a zoom emits no
   * entries at all. Now that the camera lives in the composition, the divisor
   * is a constant and cannot be wrong.
   */
  const SCALE = ${renderScale};
  const EPS = ${SHIFT_EPS_PX};
  const TAIL = ${MOTION_TAIL_MS};

  const shifts = [];
  const motion = [];
  const scrolls = [];
  let lost = 0;
  let supported = false;

  const panel = () => document.getElementById('storybook-root');

  /*
   * Sample the app's own scroller.
   *
   * The Layout Instability API says nothing about this: a scroll is not a
   * layout shift, so a list that snaps to a different offset mid-shot emits no
   * entry at all and passes the settle check cleanly. It is still a defect in
   * the footage - the camera appears to jump - and the only way to see it is to
   * watch the offset. Sampled rather than hooked to \`scroll\` events because a
   * scroll that happens between two events is exactly the one worth catching.
   */
  const SCROLL_HZ = 30;
  let lastSample = 0;
  const sample = () => {
    const now = Date.now();
    if (now - lastSample >= 1000 / SCROLL_HZ) {
      lastSample = now;
      const el = document.querySelector('[data-testid="app-scroll-root"]');
      if (el) {
        const top = Math.round(el.scrollTop);
        const previous = scrolls.length ? scrolls[scrolls.length - 1] : null;
        // Only transitions are kept. A still page would otherwise write 30
        // identical rows a second into every manifest.
        if (!previous || previous.top !== top) scrolls.push({ at: now, top });
        if (scrolls.length > 2048) scrolls.shift();
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        /*
         * \`hadRecentInput\` is recorded and NEVER filtered on.
         *
         * Playwright dispatches mouse.down() through CDP as trusted input,
         * which opens a 500ms suppression window on layout-shift entries —
         * precisely when the app is settling after the click we just made. The
         * entries are still created and delivered with their value and sources;
         * only the CLS aggregator drops them. Filtering here would blind this
         * recorder exactly when it matters most.
         */
        const sources = entry.sources || [];
        const root = panel();
        // A shift with no node cannot be attributed to the panel, and one
        // outside the panel is Storybook's own chrome moving.
        const inside = sources.some((s) => s.node && root && root.contains(s.node));
        if (!inside) {
          if (sources.length === 0) lost += 1;
          continue;
        }
        // The largest single moved region is the honest magnitude; \`value\` is
        // a fraction-of-viewport score, which is not a distance.
        let px = 0;
        for (const s of sources) {
          const a = s.previousRect;
          const b = s.currentRect;
          if (!a || !b) continue;
          px = Math.max(px, Math.hypot(b.left - a.left, b.top - a.top) / SCALE);
        }
        if (px < EPS) continue;
        shifts.push({ at: Date.now(), px, hadRecentInput: Boolean(entry.hadRecentInput) });
        if (shifts.length > 512) shifts.shift();
      }
    });
    // \`buffered\` so shifts from before this ran are not lost.
    observer.observe({ type: 'layout-shift', buffered: true });
    supported = true;
  } catch {
    // The entry type is unavailable. \`supported: false\` is a different answer
    // from "no shifts", and the guard has to be able to say which it got.
    supported = false;
  }

  window.__CAP__ = {
    /** Open a window in which motion is expected. Wall-clock ms, like everything else. */
    declare(kind, ms) {
      const from = Date.now();
      motion.push({ kind: String(kind || 'move'), from, to: from + (Number(ms) || 0) + TAIL });
      if (motion.length > 512) motion.shift();
    },

    /**
     * Open a window that reaches backwards, for motion whose length was only
     * known once it finished.
     *
     * \`declare\` can only look forward, which is right for a click: the command
     * comes first. A wait is the other way round - the walk finds out how long
     * the panel took to answer only after it has answered - so the window has
     * to be opened over time that has already passed. Without this, waiting for
     * a rules list to arrive declared a window starting *after* the list had
     * already animated in, and the guard flagged the arrival it was asked for.
     */
    declareSince(ms, kind) {
      const to = Date.now() + TAIL;
      motion.push({ kind: String(kind || 'move'), from: to - (Number(ms) || 0) - TAIL, to });
      if (motion.length > 512) motion.shift();
    },

    /** Was anything commanded to move at \`t\`? */
    declared(t) {
      for (let i = motion.length - 1; i >= 0; i -= 1) {
        if (t - motion[i].from > 8000) return false;
        if (t >= motion[i].from && t <= motion[i].to) return true;
      }
      return false;
    },

    /**
     * Resolve once the panel has been still for \`quiet\` ms, or the budget runs out.
     *
     * Declared motion does not count against quiet — otherwise every beat after
     * a scroll would burn its whole budget waiting out footage we asked for.
     */
    async settled({ quiet = 220, budget = 1500 } = {}) {
      const begun = Date.now();
      /*
       * Finished first, still second. They are not the same fact.
       *
       * A CSS transition with a \`transition-delay\` leaves the page genuinely
       * motionless while it waits its turn, so a quiet gate reports quiet and
       * whatever comes next lands after the caller believed it was safe. The
       * rail's active tab does exactly this: the underline slides, and the
       * label unfurls behind a \`delay-(--dur-move)\`. Waiting longer does not
       * help, because the wait ends inside the gap rather than after it.
       *
       * Scoped to the document timeline. A scroll-driven \`.dock-band\` has a
       * \`finished\` that resolves only at 100% range progress, which is the hang
       * ADR-0045 refused Storybook's \`waitForAnimations\` over; filtering by
       * timeline keeps it out while still covering every ordinary transition.
       *
       * Bounded by the caller's budget, so this stays budgeted rather than
       * additive: a page with nothing running pays one microtask.
       */
      const root = panel();
      if (root) {
        const running = root
          .getAnimations({ subtree: true })
          .filter((a) => a.timeline === document.timeline);
        if (running.length) {
          await Promise.race([
            Promise.allSettled(running.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, Math.max(0, budget - (Date.now() - begun)))),
          ]);
        }
      }
      return new Promise((resolve) => {
        const started = begun;
        const tick = () => {
          const now = Date.now();
          const last = shifts.length ? shifts[shifts.length - 1] : null;
          const undeclared = last && !window.__CAP__.declared(last.at) ? last.at : 0;
          if (now - (undeclared || started) >= quiet) {
            return resolve({ quiet: true, waitedMs: now - started });
          }
          if (now - started >= budget) {
            return resolve({ quiet: false, waitedMs: now - started });
          }
          setTimeout(tick, 40);
        };
        tick();
      });
    },

    /** Everything recorded so far, plus the honesty fields. Not drained: the clip is short. */
    report() {
      return {
        supported,
        lost,
        shifts: shifts.slice(),
        motion: motion.slice(),
        scrolls: scrolls.slice(),
      };
    },

    /**
     * Force a layout shift, on purpose.
     *
     * The falsifiability control. A guard that cannot flag a shift it was told
     * is there is a guard whose verdicts mean nothing, and the only way to know
     * that is to plant one. Returns the magnitude it actually caused so the
     * fixture can assert against a real number rather than an intended one.
     */
    injectShift(px = 12) {
      const root = panel();
      const victim = root && root.querySelector('*');
      if (!victim) return 0;
      const before = victim.getBoundingClientRect().top;
      victim.style.marginTop = \`\${px}px\`;
      const after = victim.getBoundingClientRect().top;
      // Leave it in place: reverting immediately causes a second shift, and a
      // control that fires twice is indistinguishable from a real defect.
      return Math.abs(after - before) / SCALE;
    },
  };
})();
`;
