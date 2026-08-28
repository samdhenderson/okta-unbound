/**
 * @module reel/comp/Backdrop
 * @description The stage the panel sits on.
 *
 * Static by design. A moving backdrop behind a moving panel gives the eye two
 * things to track and the panel loses. The only gradient is a soft pool under
 * wherever the panel is, which exists to stop a white rectangle from floating
 * on flat black.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { STAGE } from '../theme';

export const Backdrop: React.FC<{ focusX: number }> = ({ focusX }) => (
  <AbsoluteFill style={{ background: STAGE.back }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at ${focusX}px 42%, ${STAGE.plate} 0%, ${STAGE.back} 62%)`,
      }}
    />
  </AbsoluteFill>
);
