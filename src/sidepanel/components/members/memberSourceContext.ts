/**
 * @module sidepanel/components/members/memberSourceContext
 * @description What the member explorer needs to show — and filter by — where each
 * member's membership came from.
 *
 * A module of its own rather than a type exported from `MemberExplorer`, because
 * both the explorer and the filter drawer it renders need the shape, and having
 * the drawer reach back into the explorer for it made the two files a cycle
 * (`knip:circular`). A type shared by a parent and its child belongs beside
 * them, not inside one of them.
 */
import type { MemberSourceIndex } from '../../../shared/membership/memberSourceIndex';
import type { MemberSourceBucket } from '../groups/memberSourceBuckets';

/**
 * Per-member membership source, plus the segments a meter should draw for it.
 *
 * One bundle rather than flat props because the feature is present or absent as
 * a whole: an index with no segments has nothing to draw, and segments with no
 * index would draw a meter whose pills could not resolve to anyone.
 */
export interface MemberSourceContext {
  /** Per-member source classification, from `buildMemberSourceIndex`. */
  index: MemberSourceIndex;
  /**
   * The exclusive display segments, in render order, from
   * `toMemberSourceSegments`. The caller owns this because how many rules earn a
   * named segment is a presentation decision the index deliberately does not
   * make.
   */
  segments: MemberSourceBucket[];
}
