/**
 * @module reel/comp/Backdrop
 * @description The stage the panel sits on.
 *
 * Static by design. A moving backdrop behind a moving panel gives the eye two
 * things to track and the panel loses.
 *
 * ## Flat, not graded
 *
 * There used to be a soft radial pool under the panel, to stop a white
 * rectangle floating on flat black. It banded. A 900px-wide ramp across four
 * or five levels of near-black is asking an 8-bit 4:2:0 encode for gradations
 * it cannot represent, so it quantised into visible rings - and the rings moved
 * with the panel, which made the one thing on screen that was supposed to sit
 * still the most conspicuously animated. Flat colour has no such failure mode.
 *
 * `focusX` is kept in the signature. Every caller passes it, it costs nothing,
 * and a future treatment that wants to know where the eye is (a vignette that
 * dithers, a lit edge) should not have to re-thread it through six components.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { STAGE } from '../theme';

export const Backdrop: React.FC<{ focusX?: number }> = () => (
  <AbsoluteFill style={{ background: STAGE.back }} />
);
