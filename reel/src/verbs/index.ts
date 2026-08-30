/**
 * @module reel/verbs
 * @description The six-verb animation grammar's barrel.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, "Section A - the animation
 * grammar": "Build these as six reusable Remotion primitives that take an
 * arbitrary child, then compose every set piece from them. That is what makes
 * the film read as designed rather than as a reel of effects." This barrel is
 * the front door to all six (`Dock`, `Lift`/`LiftPlate`, `Count`, `Split`,
 * `Fan`/`FanChild`, `Recede`), plus `useVerb`/`release` and everything
 * `ease.ts` exports, so a set piece never has to reach past `reel/verbs` for
 * a verb's timing, curve, or component.
 *
 * ## The seventh verb is not here, deliberately
 *
 * The grammar has seven verbs, not six. `draw` - a hairline extruding along
 * its own path - and its `convert` modifier live in `reel/pencil`, because
 * they exist only for the graphite treatment and are governed by a rule none
 * of the six carry: **`draw` only ever applies to something the product has
 * not made yet** - a claim awaiting evidence, a state that does not exist, or
 * the world before the panel. Never to a rendering of real captured state.
 * That rule is what keeps a treatment from becoming a tic, and it is easier to
 * enforce when the verb ships beside the treatment it serves rather than in
 * the general vocabulary. Import it from `reel/pencil`; it is not re-exported
 * here, so there is exactly one import path for it.
 */
export * from './ease';
export * from './useVerb';
export * from './Dock';
export * from './Lift';
export * from './Count';
export * from './Split';
export * from './Fan';
export * from './Recede';
