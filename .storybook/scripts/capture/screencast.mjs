/**
 * Record a page to a constant-rate 60fps clip, via CDP rather than Playwright.
 *
 * `recordVideo` was the old path and it has three faults this replaces. It is
 * VP8 at roughly 780 kbps with no encoder controls — measured on the last
 * master: 1920x1080 carrying 783 kbps, which is where the reel's softness came
 * from, and it threw away the supersampling `deviceScaleFactor` had just paid
 * for. It nominally runs at 25fps but commits frames when the compositor
 * commits them, so the rate is a wish. And it finalizes one file per `Page`,
 * which is what forced the whole reel to be one indivisible take.
 *
 * `Page.startScreencast` gives us the frames themselves, each carrying
 * `metadata.timestamp` — so this module knows exactly when every frame was on
 * screen and can resample onto an exact 60fps grid rather than hoping.
 *
 * ## The resampler, and why it is not a concat demuxer
 *
 * The obvious approach is to write every frame to disk and hand ffmpeg a concat
 * list with per-frame durations. At 2520x2940 a PNG is 3-8MB and a ten second
 * chapter is several hundred frames, so that is gigabytes of disk churn per
 * take for a file that ends up around 20MB.
 *
 * Instead this streams. Screencast frames arrive out of a real-time compositor,
 * so they are unevenly spaced; when frame N+1 arrives we know frame N was on
 * screen for exactly `t(N+1) - t(N)` seconds, and can emit it to ffmpeg's stdin
 * the right number of times for a 60fps grid. One frame of lag, no disk, and
 * the output is genuinely CFR — duplicated frames cost almost nothing in H.264
 * because a P-frame with no residual is a handful of bytes.
 *
 * The accumulator carries the rounding error forward (`emitted` is compared
 * against the total elapsed time, not against each gap independently). Rounding
 * each gap on its own drifts: sixty 16.7ms gaps each rounding up is a full
 * extra second per minute, and the beat timestamps in the manifest would then
 * point at the wrong frames — silently, and further out the longer the clip.
 *
 * @module
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';

/** The reel's frame rate. The composition is authored at this rate too. */
export const FPS = 60;

/**
 * Encoder settings for a capture master.
 *
 * This file is an intermediate, not a deliverable — Remotion reads it with
 * `<OffthreadVideo>`, which extracts exact frames through ffmpeg, and the final
 * reel is encoded once at the end. So it is tuned for fidelity and for seek
 * accuracy rather than for size:
 *
 * - **CRF 15** is visually lossless at this resolution. The old path's ~780kbps
 *   VP8 is roughly a twentieth of this bitrate.
 * - **`-g 30`** puts a keyframe every half second. `OffthreadVideo` seeks to
 *   arbitrary frames, and a sparse-keyframe file makes every seek decode a long
 *   run of P-frames.
 * - **`yuv420p`** because anything else fails to play in a depressing number of
 *   places, including some browsers.
 * - **`-preset veryfast`**, deliberately, not `slow`. At 2520x2940 and 60fps a
 *   slow preset cannot keep up with the compositor and the pipe applies
 *   backpressure, which shows up as held frames rather than as a slow encode.
 *   CRF governs quality; the preset governs how hard it works to hit that
 *   quality for a given bitrate, and bitrate is not scarce for an intermediate.
 */
const ENCODE = [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  '15',
  '-g',
  String(FPS / 2),
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
];

/**
 * Start recording `page` to `dest`.
 *
 * The returned handle's `stop()` resolves only once ffmpeg has exited, so the
 * file is complete and probeable the moment it returns — the old path's
 * `video.saveAs()` had the same contract and it is worth keeping.
 *
 * @param {import('playwright').Page} page
 * @param {string} dest Absolute path to the `.mp4` to write.
 * @param {object} [opts]
 * @param {number} [opts.width] Frame width to request, in device pixels.
 * @param {number} [opts.height] Frame height to request, in device pixels.
 * @returns {Promise<{ stop: () => Promise<CaptureReport>, startedAt: () => number|null }>}
 */
export async function startScreencast(page, dest, { width, height } = {}) {
  const client = await page.context().newCDPSession(page);

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      // The input is a bare stream of PNGs with no container timing of its own.
      // We have already resampled onto the 60fps grid, so declaring the input
      // rate as 60 and copying it to the output is the whole timing model.
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-i',
      'pipe:0',
      '-r',
      String(FPS),
      ...ENCODE,
      dest,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );

  let stderr = '';
  ffmpeg.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  /** Guards against writing to a pipe ffmpeg has already closed. */
  let piping = true;
  ffmpeg.stdin.on('error', () => {
    piping = false;
  });

  /** Screencast timestamp of the first frame. The clip's time origin. */
  let originTs = null;
  /** Screencast timestamp of the frame currently being held. */
  let heldTs = null;
  /** The frame currently being held, not yet emitted. */
  let heldBuf = null;
  /** How many 60fps slots have been written. */
  let emitted = 0;
  /** Frames the compositor handed us. */
  let received = 0;
  /** Backpressure: set when ffmpeg's stdin buffer is full. */
  let draining = null;

  /**
   * Write `buf` `n` times, respecting ffmpeg's stdin backpressure.
   *
   * Without the drain await this floods the pipe on a fast machine and Node
   * buffers the whole clip in memory. With it, the screencast naturally paces
   * itself to what the encoder can absorb.
   */
  const write = async (buf, n) => {
    for (let i = 0; i < n; i += 1) {
      if (!piping) return;
      if (!ffmpeg.stdin.write(buf)) {
        draining = once(ffmpeg.stdin, 'drain');
        await draining;
        draining = null;
      }
    }
  };

  /** Serializes frame handling: CDP events do not await each other. */
  let chain = Promise.resolve();

  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    // Acknowledge immediately and unconditionally. Chrome stops sending frames
    // until the previous one is acked, so an ack that waits on the encoder
    // turns backpressure into a stalled capture rather than a paced one.
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    received += 1;
    const ts = metadata?.timestamp;
    const buf = Buffer.from(data, 'base64');

    chain = chain.then(async () => {
      if (originTs === null || typeof ts !== 'number') {
        // The first frame, or one the compositor handed us without a timestamp.
        // Hold it; it will be measured by whatever arrives next.
        if (originTs === null && typeof ts === 'number') originTs = ts;
        heldBuf = buf;
        heldTs = typeof ts === 'number' ? ts : heldTs;
        return;
      }
      // The held frame was on screen from `heldTs` until now. Emit it up to the
      // grid slot this frame starts at, comparing against elapsed time from the
      // origin so per-gap rounding error cannot accumulate.
      const wantTotal = Math.round((ts - originTs) * FPS);
      const n = Math.max(0, wantTotal - emitted);
      if (heldBuf && n > 0) {
        await write(heldBuf, n);
        emitted += n;
      }
      heldBuf = buf;
      heldTs = ts;
    });
  });

  await client.send('Page.startScreencast', {
    format: 'png',
    // Every frame. The default skips, and a skipped frame is a stutter the
    // resampler faithfully reproduces as a held duplicate.
    everyNthFrame: 1,
    ...(width ? { maxWidth: width } : {}),
    ...(height ? { maxHeight: height } : {}),
  });

  // Prime, and do not return until a frame has actually landed.
  //
  // The compositor produces a frame when something changes, so on a page that
  // is momentarily still — which is exactly the state a chapter starts in,
  // after the readiness gate and the font settle — the first frame arrives
  // whenever the first motion does. Measured: 650ms of a 4s take, with the
  // clip's time origin landing on the first scrolled pixel instead of on the
  // call to this function.
  //
  // That is not merely a trimming problem. Every beat is stamped against
  // `originTs`, so an origin that drifts to first-motion silently shifts the
  // whole manifest against the footage, and the caption for beat one lands
  // over the tail of the movement it was describing.
  //
  // So nudge a repaint until a frame comes back. The nudge is a compositor-only
  // property on the root: it changes no layout, so it cannot register as a
  // shift, and it is reverted before the caller films anything.
  const primeDeadline = Date.now() + 2000;
  while (originTs === null && Date.now() < primeDeadline) {
    await page
      .evaluate(() => {
        const el = document.documentElement;
        el.style.opacity = el.style.opacity === '0.999' ? '0.998' : '0.999';
      })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 16));
  }
  await page.evaluate(() => {
    document.documentElement.style.opacity = '';
  }).catch(() => {});

  return {
    /**
     * Unix epoch **milliseconds** of the clip's first frame, or null.
     *
     * This is the reel's entire timebase, and it replaces the three clocks the
     * old runner reconciled by hand. `metadata.timestamp` is epoch seconds, so
     * a Node-side event at `Date.now()` converts to clip-local ms by simple
     * subtraction — no `performance.now()`, no per-navigation sync, no
     * round-trip midpoint estimate, and nothing that resets on navigation.
     */
    startedAt: () => (originTs === null ? null : originTs * 1000),

    /**
     * Stop recording and finalize the file.
     *
     * @returns {Promise<CaptureReport>}
     */
    async stop() {
      const stoppedAt = Date.now();
      await client.send('Page.stopScreencast').catch(() => {});
      await chain;
      // Pad the tail out to wall clock, and this is not a rounding nicety.
      //
      // The compositor produces a frame when something CHANGES, so a still page
      // produces nothing at all. Mid-clip that is harmless — the next frame's
      // timestamp measures the whole gap, so a hold in the middle is preserved
      // exactly. At the tail there is no next frame, so every chapter that ends
      // the way chapters should end, on a held pose, silently lost that hold.
      //
      // Measured: a 4000ms take whose easing slowed to a crawl over its last
      // stretch came back 3400ms long. The footage was not dropped, it was
      // never requested — and nothing reported it, because a short clip and a
      // correct clip look identical in a manifest.
      if (heldBuf && originTs !== null) {
        const want = Math.round(((stoppedAt - originTs * 1000) / 1000) * FPS);
        const n = Math.max(1, want - emitted);
        await write(heldBuf, n);
        emitted += n;
      } else if (heldBuf) {
        await write(heldBuf, 1);
        emitted += 1;
      }
      ffmpeg.stdin.end();
      const [code] = await once(ffmpeg, 'close');
      await client.detach().catch(() => {});
      if (code !== 0) {
        throw new Error(`ffmpeg exited ${code}: ${stderr.trim() || 'no output'}`);
      }
      return {
        frames: emitted,
        received,
        durationMs: Math.round((emitted / FPS) * 1000),
        startedAtMs: originTs === null ? null : originTs * 1000,
        endedAtMs: heldTs === null ? null : heldTs * 1000,
      };
    },
  };
}

/**
 * @typedef {object} CaptureReport
 * @property {number} frames Frames written to the file. Divide by FPS for its duration.
 * @property {number} received Frames the compositor produced. Well below `frames`
 *   means the page was static and the resampler held; well above means the
 *   encoder could not keep up and the pipe applied backpressure.
 * @property {number} durationMs
 * @property {number|null} startedAtMs Epoch ms of the first frame. The clip's
 *   time origin: every beat in the manifest is stamped against this.
 * @property {number|null} endedAtMs
 */
