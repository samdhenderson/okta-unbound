/**
 * @module reel/comp/Panel
 * @description The captured side panel, retimed, framed and cropped.
 *
 * Every segment of the ramp becomes its own `<Sequence>` around one
 * `<OffthreadVideo>` with a `trimBefore` and a `playbackRate`. Remotion turns
 * that into an exact source frame, so an arbitrary speed curve costs nothing in
 * accuracy — which is the reason the ramp is expressed as constant-rate slices
 * rather than as a per-frame time function.
 *
 * `<OffthreadVideo>` rather than `<Video>` because it extracts frames with
 * ffmpeg instead of driving a `<video>` element, and a `<video>` element seeked
 * per frame is where a render picks up the wrong frame under load.
 */
import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence } from 'remotion';
import type { Ramp } from '../ramp';
import { PANEL, type Crop, type Rect } from '../layout';
import { STAGE } from '../theme';

interface PanelProps {
  src: string;
  ramp: Ramp;
  /** Where the panel lands in the frame. */
  pose: Rect;
  /** Which part of the capture fills that rectangle. */
  crop: Crop;
  /** 0 while the panel is arriving, for the chapter's own entrance. */
  reveal?: number;
}

/**
 * The device frame around the capture.
 *
 * A real border rather than a drop shadow alone: the panel is white and the
 * stage is near black, and a hard edge is what stops the two reading as one
 * surface when the video's own top row happens to be white.
 */
const FRAME_STYLE: React.CSSProperties = {
  borderRadius: 16,
  overflow: 'hidden',
  border: `1px solid ${STAGE.rule}`,
  boxShadow: '0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
  background: '#fff',
};

export const Panel: React.FC<PanelProps> = ({ src, ramp, pose, crop, reveal = 1 }) => {
  // The crop fills the pose, so the video is drawn at `pose.width / crop.width`
  // and offset so the crop's origin lands at the pose's origin.
  const zoom = pose.width / crop.width;

  return (
    <AbsoluteFill
      style={{
        left: pose.x,
        top: pose.y,
        width: pose.width,
        height: pose.height,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 28}px)`,
        ...FRAME_STYLE,
      }}
    >
      <AbsoluteFill
        style={{
          width: PANEL.width * zoom,
          height: PANEL.height * zoom,
          left: -crop.x * zoom,
          top: -crop.y * zoom,
        }}
      >
        {ramp.segments.map((segment, i) => {
          // A hold is a `playbackRate` of 0 in the ramp's vocabulary, which
          // Remotion rejects outright — and rightly, since a zero rate is a
          // division by zero in its source-frame arithmetic. `<Freeze>` is the
          // primitive for this: it pins the whole subtree at one frame, so the
          // held image is the *same* frame for the hold's duration rather than
          // a very slow crawl that shimmers.
          const video = (
            <OffthreadVideo
              src={src}
              trimBefore={segment.trimBefore}
              playbackRate={segment.playbackRate || 1}
              style={{ width: '100%', height: '100%', objectFit: 'fill' }}
              // The captures are silent. Saying so keeps Remotion from mixing
              // an empty audio track into every chapter.
              muted
            />
          );
          return (
            <Sequence
              // Segments are positional slices of one clip; there is no id to
              // key by and reordering them would change the film, not the list.
              key={`${segment.from}-${i}`}
              from={segment.from}
              durationInFrames={segment.durationInFrames}
              layout="none"
            >
              {segment.playbackRate === 0 ? <Freeze frame={0}>{video}</Freeze> : video}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
