/**
 * Remotion's build and render settings.
 *
 * The public dir is the shoot's output directory rather than a copy of it:
 * `npm run capture` writes `captures/`, and the composition reads exactly what
 * was written. Copying would introduce a third place a clip can be stale.
 */
import { Config } from '@remotion/cli/config';

Config.setPublicDir('../captures');
// PNG, not JPEG. Remotion rasterizes every composited frame to this format
// before it reaches the encoder, and the default is JPEG at quality 80 - a
// lossy step applied to vector type and flat fields *before* any of the video
// encoding, which is where the softness around the slide copy and the banding
// across the backdrop were actually coming from. The captures underneath are
// already H.264 and cannot be improved here; everything drawn on top can.
Config.setVideoImageFormat('png');
// CRF and pixel format are deliberately *not* set here, and this is the reason.
// `Config.set*` is global: it applies to every render script and to `still`
// alike. CRF 16 and yuv420p describe the H.264 delivery file specifically,
// which is large flat near-black with fine type over it and has to play
// everywhere a link gets pasted. `npm run draft` deliberately wants CRF 28, and
// any future codec may reject these outright: a global CRF is what made an
// earlier ProRes master fail with "The prores codec does not support the --crf
// option" rather than merely encode badly.
//
// So they live on the `render` script in package.json, where they apply to the
// one codec they describe and are visible at the call site somebody debugging
// will actually look at. Same reasoning as `--timeout` below.
Config.setConcurrency(4);
// Remotion aborts a render whose first component render takes over 30s, which
// is a sensible guard against a stuck `delayRender`. Inter is fetched from
// Google's CDN at module scope, and on a slow link that fetch legitimately
// exceeds it - measured: the same composition rendered fine twice and then
// failed with `Timeout (30000ms) exceeded rendering the component initially`.
// The render scripts pass `--timeout=120000` rather than setting it here, so
// the number is visible at the call site where somebody debugging will look.
// The captures are silent. This stops Remotion *requiring* an audio track; it
// does not stop ffmpeg writing one, so the `render` script also passes
// `--muted`. Measured: with this alone the master still carried an empty AAC
// stream, which some players surface as a muted-audio control on a film that
// has no audio at all.
Config.setEnforceAudioTrack(false);
