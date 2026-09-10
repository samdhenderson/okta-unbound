/**
 * @module sidepanel/components/users/ProfileDisplayDragGhost
 * @description The label that follows the pointer while an attribute or a
 * section is being dragged in customize mode.
 *
 * It follows the pointer exactly — 12px clear of the cursor, vertically centred
 * on it — via a `transform`, not `left`/`top`: a fixed box moved by its box
 * offsets cannot be transitioned cheaply, and the follow has to stay glued to the
 * cursor or it reads as a second, lagging object.
 *
 * It is deliberately translucent (68%): the drop indicator underneath it is the
 * control that actually answers "where will this land", and a solid ghost sitting
 * on top of that line hides the answer at the exact moment it matters.
 *
 * `aria-hidden`, because it is a picture of something the live region already
 * says in words — a screen reader reading a position twice is worse than not
 * reading it at all.
 *
 * **It portals to `document.body`.** `position: fixed` is resolved against the
 * nearest ancestor carrying a `transform`, `filter` or `contain` — and the pane
 * sits inside the shell's view stack, which transforms on every push and pop. Left
 * where it is declared, the ghost lands an arbitrary distance from the pointer it
 * is supposed to be following. It does *not* use the shell's modal layer: that
 * node is reserved for `Modal` overlays.
 *
 * Security: the label is a tenant-authored attribute or category name. Nothing
 * here logs it.
 */
import React from 'react';
import { createPortal } from 'react-dom';

/** Props for {@link ProfileDisplayDragGhost}. */
export interface ProfileDisplayDragGhostProps {
  /** What is being dragged — an attribute's label or a category's name. */
  label: string;
  /** Client X of the pointer. */
  x: number;
  /** Client Y of the pointer. */
  y: number;
  /** Drop the follow transition when the admin has asked for reduced motion. */
  reducedMotion?: boolean;
}

/**
 * A translucent follower carrying the dragged thing's name.
 *
 * @example
 * ```tsx
 * {editor.drag && editor.ghost && (
 *   <ProfileDisplayDragGhost label={editor.drag.label} {...editor.ghost} />
 * )}
 * ```
 */
const ProfileDisplayDragGhost: React.FC<ProfileDisplayDragGhostProps> = ({
  label,
  x,
  y,
  reducedMotion = false,
}) => {
  const ghost = (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed top-0 left-0 z-50 rounded-md border border-neutral-200 bg-white px-(--sp-row-x) py-1 text-xs font-medium text-neutral-900 opacity-[0.68] shadow-md ${
        reducedMotion ? '' : 'transition-transform duration-(--dur-press) ease-(--ease-press)'
      }`}
      // Positioned by `transform` rather than `left`/`top` so the follow is a
      // composited move the transition above can actually act on — and so the
      // ghost sits exactly where the pointer is, 12px clear of the cursor.
      style={{ transform: `translate3d(${x + 12}px, ${y}px, 0) translateY(-50%)` }}
    >
      {label}
    </div>
  );
  return createPortal(ghost, document.body);
};

export default ProfileDisplayDragGhost;
