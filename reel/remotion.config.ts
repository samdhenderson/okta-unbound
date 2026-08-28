/**
 * Remotion's build and render settings.
 *
 * The public dir is the shoot's output directory rather than a copy of it:
 * `npm run capture` writes `captures/`, and the composition reads exactly what
 * was written. Copying would introduce a third place a clip can be stale.
 */
import { Config } from '@remotion/cli/config';

Config.setPublicDir('../captures');
Config.setVideoImageFormat('jpeg');
// The captures are already H.264; re-encoding at CRF 18 keeps the composited
// overlays crisp without making the master enormous.
Config.setCrf(18);
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
