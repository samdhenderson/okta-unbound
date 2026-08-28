# ADR-0045: Capture thin, compose in React

- Status: Accepted
- Date: 2026-08-27
- Amends: [ADR-0043](./0043-the-demo-is-a-stage-the-script-is-the-director.md). The
  scene is still a stage and the script is still the director. What changes is where
  the director works: everything that is not the walk moves out of the browser and
  into a compositor, so ADR-0043's camera amendment is superseded rather than
  extended.
- Amends: [ADR-0044](./0044-a-reel-that-can-fail.md). Its principle survives intact
  and its detectors are rebuilt against a different manifest. Two of the four guards
  are deleted because the defects they watched for are no longer expressible.
- Relates to: [ADR-0016](./0016-in-tab-view-stack-navigation.md) (both rungs of a tab
  stay mounted, which is why a selector must judge whether a match is onstage),
  [ADR-0018](./0018-tabs-stay-mounted.md) (the mounted twin a walk can type into),
  [ADR-0027](./0027-motion-tokens-and-reduced-motion.md) (the duration tokens the capture retimes),
  [ADR-0012](./0012-no-test-tampering.md) (a detector that cannot fail is a weakened
  test by another name)

## Context

The reel worked. Developing it did not.

- **It was one indivisible take.** All five scenes were walked on a single page under
  a single `recordVideo` context, because there was no post-production step to
  concatenate with. A one-word caption change cost a 162 second shoot plus every
  guard.
- **The guards decoded video through Chrome.** `check:margin` measured 33.5s for
  roughly 650 `<video>` seeks.
- **The output was soft.** 162.6s of VP8 at 783 kbps, 25fps. The capture ran at
  `deviceScaleFactor: 2` and the encoder discarded the supersampling.
- **The token cost tracked the line count.** 8,671 lines of `.mjs` across twelve
  scripts, of which `scenes/showcase.mjs` alone was 2,991. Changing a caption meant
  navigating an imperative DOM builder rather than editing data.

The decisive observation is that **almost nothing the reel shows is something the
product does**. Chapter cards, captions, the margin, the camera, the cursor, the
grade, the rail zoom: all of it is motion graphics over product footage. Only the
walk needs a real browser.

Under the old design all of it lived _inside the page being filmed_, and every hard
problem in ADR-0043's third amendment was downstream of that: a `clip-path` camera
clipping fixed-position modals, camera drift racing Playwright's actionability check,
`useStaggerReveal` refusing to reveal under a push, `animation: stage-panel-in`
silently outranking the camera, three clocks reconciled by hand.

## Decision

**Split capture from composition.** Playwright records short clips of the real
product and writes a manifest beside each one. React composes the film.

```
capture (Playwright, thin)            compose (Remotion, React)
──────────────────────────────        ─────────────────────────────
viewport = the panel, 840x980   ──►   captures/<id>.mp4  ──►  OffthreadVideo
CDP screencast → ffmpeg CFR60         captures/<id>.json ──►  beats, figures,
                                                              pointer path, scrolls
                                                         ──►  reel.mp4 1920x1080 60fps
```

### 1. The capture viewport is the panel itself

840x980, `deviceScaleFactor: 1`, no transform. Three measurements forced this:

- **`deviceScaleFactor` does not reach the screencast.** At DSF 3,
  `Page.startScreencast` still returns 840x980; `maxWidth`/`maxHeight` are caps
  rather than targets. `Emulation.setPageScaleFactor` does not change it either. The
  supersampling the old system paid roughly 4x encoder load for never reached a file.
- **A bigger viewport with the app scaled into it works geometrically and breaks the
  product.** Verified end to end at 1680x1960 and 2520x2940 with both `transform:
scale()` and CSS `zoom`. In both, the docked action bar's `view-timeline` merge sits
  pinned at its end state, because view progress is measured against the viewport: the
  `Groups 9 / Apps / Profile 41` strip renders as a blank grey band while remaining
  perfectly present in the DOM. A clip like that plays fine and quietly omits a
  control.
- So **sharpness is bought elsewhere**: the composition holds the panel at roughly 1:1
  and takes its emphasis from vector overlays and diagrams drawn at full frame
  resolution. This is why the diagram layer exists at all, and it is a better answer
  than zooming soft video.

### 2. Recording is CDP screencast resampled onto a CFR grid

`Page.startScreencast({ format: 'png' })`, with each frame's `metadata.timestamp`
(Unix epoch seconds) resampled onto a 60fps grid and piped to ffmpeg as
`image2pipe` → H.264 CRF 15, `yuv420p`.

Two edges needed explicit handling, both because **a screencast only emits frames
when something changes**:

- A still page emits nothing, so recording began up to 650ms after `start()`
  returned. The recorder now nudges `documentElement.style.opacity` until the first
  frame lands, and treats that frame's timestamp as the clip origin.
- A held pose at the end is discarded for the same reason. The recorder pads the tail
  to wall clock, verified at 4033ms of clip against 4164ms of wall time.

Because the origin is the first frame's own timestamp, **clip-local time is a
subtraction**. ADR-0043's `syncClock` / `toReelMs` / `restamp` apparatus and its forty
line essay about three clocks are deleted.

### 3. The app is filmed slow and played back fast

The stage multiplies the app's own `--dur-*` tokens by `RETIME` (**3**, raised from 2
after the first cut). This has to happen at capture time and no amount of post can
recover it: measured on a real product scroll, the compositor produced roughly 10
frames per second of genuine motion, so slowing that moment 4x in the composition
would play at 2.5fps and read as a stutter rather than as emphasis.

Filming at 3x slow means playing back at 3x restores natural speed and leaves 3x of
real slow-motion headroom with real frames behind it. `retime` is written into every
manifest, because the composition cannot infer it and a wrong guess mistimes the whole
chapter.

**`RETIME` is only half of the pacing story, and the smaller half.** It slows the
app's own transitions, because those are CSS. It does nothing to the driver, and the
first cut was unwatchable for exactly that reason: `page.mouse.move(x, y, { steps })`
dispatches its steps as fast as the CDP round trip allows, around 90ms across the
panel, and the manifest faithfully recorded 90ms. The composition then played the beat
back at `retime` and the drawn cursor crossed 840px in 30ms. It did not read as fast;
it read as a cut, with the pointer already at its destination. Typing had the same
shape: 85ms per keystroke became 42ms on playback.

So every wall-clock action the driver takes is retimed one by one, in `drive.mjs`:

|                      | Before                | Now                                               |
| -------------------- | --------------------- | ------------------------------------------------- |
| Pointer travel       | as fast as CDP allows | `TRAVEL_MS`, distance-scaled, paced in real steps |
| Pause before a press | 180ms                 | `180 * RETIME`                                    |
| After a press        | none                  | `NOTICE_MS` — the result, and a beat to see it    |
| Keystroke            | 85ms                  | `KEY_MS * RETIME`                                 |

The paced move uses the same ease-in-out curve the drawn cursor is redrawn with,
exported as `drive.ease` and named by `reel/src/comp/Cursor.tsx`. The manifest records
only a move's endpoints and duration, so if the real pointer travelled on a different
curve, every hover state in the footage would light at a moment the drawn cursor was
not yet over it.

#### What the headroom is actually for

The first watchable cut ran 1:07 and was still too fast to read: a chapter would
reach its finding and cut on the same frame. The instinct was to go back to the
shoot and slow the driver again. That was wrong, and the reason is worth writing
down, because it is the payoff for splitting capture from composition at all.

**The pitch of the cut is an editorial decision, and editorial decisions are made
in post.** `Speed` in `reel/src/ramp.ts` is a multiplier on `retime`, so `dwell`
plays the product back at a third of life and `natural` at life. Because the
cursor is _redrawn_ from the ledger through `ramp.clipMsAt`, slowing a beat slows
its pointer and its typing along with the app — there is no separate lever to
find, and no way for the drawn cursor to disagree with the footage under it. Both
complaints about the 1:07 cut ("the mouse moves too fast", "the text boxes fill
too fast") were answered by re-pitching the plans and re-rendering: 1:07 to 2:11,
no re-shoot, minutes rather than an hour.

The shoot only has to be slow **enough**. Past that, going slower at capture buys
nothing post could not do and costs a re-shoot every time the cut is re-judged.

`tailMs` was the one thing the plan could not say. `holdMs` freezes a beat's first
frame, which holds the _previous_ beat's last state — enough everywhere except a
chapter's end, where there is no successor and the cut landed the instant the last
transition finished. It is per-beat and not automatic: how long a chapter rests on
its conclusion is editorial, and a chapter ending on a move wants no rest at all.

### 4. Remotion composes, and the app is never mounted inside it

Remotion's own documentation warns that animations not driven by `useCurrentFrame()` —
specifically CSS transitions — flicker during render. This app is built on CSS
transitions and the `--dur-*` / `--ease-*` tokens of ADR-0027. Playwright stays the
camera crew. This is settled, not open.

The ramp is expressed as constant-rate slices, each rendered as a `<Sequence>` around
one `<OffthreadVideo trimBefore playbackRate>`, which Remotion resolves to an exact
source frame. A rate _change_ is subdivided into seven short slices so speed arrives
rather than switches. A hold is `<Freeze>`, not a rate of zero, which Remotion rejects
outright.

**What "never mounted inside it" does and does not forbid.** It forbids mounting the
_extension's own React_, whose motion is CSS transitions on `--dur-*` tokens that a
frame-indexed renderer does not advance. It does not forbid writing React that draws
product surfaces, which `reel/src/showcase/` now does: hand-written components, driven
by `useCurrentFrame`, revealed with staggers and icon-first entrances that the
extension would never ship and should not. The cost is honest — a second
implementation of surfaces that can drift from the real ones — and two things keep the
drift from mattering. Every _number_ still comes from the capture's `figures`, so the
data cannot drift even if the styling does; and a showcase is always cut against
footage of the real component in the same chapter, so the film never asserts a
component exists without also showing it.

**Licence position, recorded because it is not OSI:** Remotion is free for individuals
and for organisations of three people or fewer, and $25 per seat above that. This
repository is MIT. The dependency lives in `reel/`, which is a standalone npm project
with its own lockfile and `node_modules` — not a workspace — so the extension's
`build`, `lint`, `type-check` and `knip` graphs never see it.

### 5. Every figure on screen is read off the panel

A walk calls `drive.read('rosterFiltered', () => readRosterCounts(page))`, which
throws if the panel does not say it. The composition fetches it with `figure()`, which
throws if the capture did not record it. Under the old system a caption fell back to
generic prose when its read-back regex missed, so a claim could quietly stop being
evidence and nothing went red.

Walks assert their own arguments too. The attribute chapter refuses to ship a take
where the second filter did not narrow the roster, because two filters that compose to
the same number is not an argument and is invisible at playback speed.

### 6. Two voices, one origin

`note` for tour chapters is one line. `register` for deep chapters is claim, then
evidence, then proof, opening downward from the same left rule and the same baseline.
They are deliberately not two designs: moving between them reads as the argument
opening out rather than as a different film.

### 7. The guards shrink to the one question a composite cannot answer

| Guard          | Disposition                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-settle` | **Kept**, simplified. Nothing zooms during capture, so the scale divisor is a constant rather than a camera-tracking one. This is the only guard that judges the _product_.       |
| `check-still`  | **Shrunk to its scroller channel.** The camera channels ceased to exist. A scroll is not a layout shift and emits no entry, so the instrument now samples `scrollTop` at 30Hz.    |
| `check-open`   | **Retargeted** to "the first frames are not uniform", measured with ffmpeg `signalstats`. Catches a white overlay and a black frame with one measurement.                         |
| `check-margin` | **Deleted.** The margin is React props, so a missing claim is a type error and a missing figure throws at render.                                                                 |
| `probe-shift`  | **Deleted.** It measured the scale normalisation of shift magnitudes under a live camera push. There is no live camera and the divisor is a constant, so it measures nothing now. |

The three survivors are one file, `capture/check.mjs`, and they keep ADR-0044's
central distinction: exit 1 is a bad take, exit 2 is **a detector that could not
look**, and the two are never conflated. `capture/check.fixture.mjs` plants one real
defect per control and asserts the guard names it — including a genuinely flat clip
generated by ffmpeg for the `open` control — with the magnitudes imported from
`thresholds.mjs` so raising a threshold cannot silently neuter its own control.

### 8. Two rails, on purpose: one is the product, one is the presentation

Chapters used to open with a 78-frame zoom into a vertical column of glyphs. It looked
like the storyboard and behaved badly: the column was centred on the _target_ glyph, so
it stood somewhere different in every chapter and the icons appeared to jump about
between them. A band held across the whole film replaced it, so a chapter change _is_
the highlight moving. That much was right and stayed. Getting the band's **content**
right took two wrong cuts, in opposite directions.

**Cut one: the band impersonated the app.** It was the product's own navigation,
rebuilt — `TAB_DEFS`, the product's `Icon` components, the arrangement `Tabs`' `rail`
variant draws — standing in the panel's own column at the panel's own scale. Every
capture had its `ContextBar` and rail cropped off the top so the reconstruction could
take their place, and the crop height had to be measured per chapter because
`ContextBar` is three lines for a group or a user and two for the admin fallback (122px
six times, 96px once). It looked right and it was a lie of a specific kind: **the film
was rendering a piece of the product**, so a viewer had no way to tell which of the
things moving on screen the extension draws and which the edit invented. For a reel
whose premise is "film the real product" (ADR-0043), the one piece of chrome that must
not be a reconstruction is the navigation — it is what a viewer uses to decide whether
the rest is real.

**Cut two: the band deleted its glyphs**, on the theory that once the app's rail was
uncropped and on camera, a second row of the same seven icons could only be
duplication. That is the wrong conclusion from the right observation. It cost the band
the one thing that made it a table of _contents_ rather than a caption: you could no
longer see at a glance which part of the product a chapter was about.

**Both rails are on screen, and they are not the same object.** The mistake in both
cuts was treating "the app has a rail" and "the film has a rail" as competing for one
slot:

- **The app's rail is evidence.** Inside the panel, at the panel's scale, filmed rather
  than drawn, behaving the way the extension behaves — the active tab's label unfurls
  inline.
- **The film's band is narration.** Full-bleed across the top of the frame, on the dark
  backdrop, at roughly twice the size, saying things the product never says: which
  chapter this is, how many there are, and whether it is a tour stop or an argument.

What keeps them from reading as one duplicated thing is that they never agree about
scale, register or content. A viewer resolves that in the first second, the same way
they resolve a subtitle not being part of the scene.

Three elements, none of which can carry another's fact:

- **The glyph row** says which section of the product this chapter is about. `TAB_DEFS`
  is imported, not transcribed, so a renamed or reordered tab cannot silently desync
  the film's contents from the product's navigation. The import is safe in both
  directions: `tabs.ts` pulls only a `type` from the icon registry, so no extension
  runtime comes with it. There is no rule across the band under it — the app's
  `border-b` separates its rail from panel content directly beneath, and here there is
  backdrop instead, so a hairline would be drawing a box with nothing in it. The active
  tab's indicator is the only line.
- **The chapter title** says what is being argued, at 52px. It is _not_ the tab's
  label: seven chapters sit on four tabs and three of them share Groups, so the glyph
  row alone would report the same position three times.
- **The counter and the progress rule** say how far into the film we are, which neither
  of the others can, for that same reason. They sit at the far end of the band from the
  glyphs, because they are the two things the product's own rail could never say.

It lives in `Reel` rather than in `Chapter`, because the indicator and the rule have to
slide _between_ chapters and only something that outlives both can draw that. `Chapter`
takes `rail` and draws a static band when rendered standalone.

**That placement cost a whole cut to a serif.** The composition's `fontFamily` was set
on `Chapter`'s root, and the band is mounted outside it, so it inherited nothing and
rendered in the browser's default serif for an entire pass before anyone looked at a
still closely enough. Anything drawn at the film level names its own face.

Dropping the `chrome` measurement did **not** bump `SCHEMA`. The field went away because
the composition stopped cropping, not because any footage went stale, and a manifest
carrying one key nobody reads is not a reason to re-shoot seven chapters. `SCHEMA` guards
against an old clip playing under new captions; that is not what this was.

### 9. The panel has one home, and either occupies it or is absent

Two versions of this were wrong before the third was right, and the sequence is the
argument.

**It shrank.** The first cut made room for a diagram by scaling the panel to 430x502
and tucking it into a corner. It made room and cost the point: at that size the product
is a thumbnail, and a chapter arguing about what the panel _shows_ was showing
something illegible while it argued. There was never anything to gain either way — the
capture is 840 real pixels wide and no more, so scaling up buys blur and scaling down
buys nothing.

**Then it moved.** Four stages, the panel swapping sides whenever the argument wanted
the other half. Every frame was defensible and the sequence was not: watched end to
end it never let the eye settle, because the largest object on screen was travelling
950px every few seconds and the viewer spent each move re-finding the thing they were
reading. **Legibility of a sequence is a different problem from legibility of a frame,
and mobility loses it.**

So there are two stages and the panel is at the same coordinates in both. `home` has
it; `focus` does not, and a showcase has the frame instead. The only thing that ever
changes is whether it is there, which is a boolean on the stage rather than a position.

**And it is drawn at 656 wide, which is the same decision as 765 tall.** The panel is
6:7 and the frame is 16:9, so "narrower" and "shorter" are one number, and the two
cannot both be maximised. "The full height of the app" means every row the app drew is
on screen — not that the panel reaches the top and bottom of the frame, which for this
aspect it can only do by cropping. Width is what gives, and 732 from 840 captured keeps
the footage downsampled rather than magnified.

**And it fades rather than travelling out.** Sliding it off the near edge crossed the
very column the argument was arriving in, and produced a frame of nothing but a white
sliver at the screen edge — which looks like a dropped frame, not a transition. A fade
has no path, so nothing can be in its way.

Two rules survive from the moving version, because the margin still changes columns:

- **The margin clears and re-sets; it does not travel.** Interpolating its box is the
  obvious repair and the wrong one: `focus` puts the copy in the panel's own column, so
  a margin sliding there arrives on top of a panel still fading out of it.
- **The gap covers the whole change, not its middle.** A first attempt dipped the
  opacity on a curve keyed to the change's progress, which put the copy back at a fifth
  of its strength while the panel was still four fifths present. A diagram cued _by_ a
  stage change waits the same way — though not for all of it, because the frames where
  nothing at all is on screen are the ones that read as a fault.

## Consequences

**The dev loop is the point.** A caption, a speed, a diagram or a layout change is a
Remotion hot reload with no re-shoot at all. A chapter that genuinely changed re-films
in 10 to 28 seconds; the whole reel is 122s from cold, against 162s of continuous
shooting plus 33.5s of margin checking for a single caption edit before.

**The output is better.** 1920x1080 H.264 at 60fps, against 162.6s of VP8 at 783 kbps
and 25fps. Chapters are independent, so per-chapter clips for docs are free, and a
poster frame and a WebVTT track are derivable from the same manifests.

**Filming slower costs shoot time and nothing else.** At `RETIME` 3 with paced pointer
moves and a hold after every press, the seven chapters take 2:48 from cold against
2:02 at `RETIME` 2. The composition is unchanged by it: the same plans, more frames
behind them. The reel itself lands at 67s.

**Roughly 4,400 lines are gone** and what replaced them is a fifth of the size. What
survived is the expensive half: the selectors, the waits, the mounting traps and the
measured coordinates, every one of which cost a bad take to learn. Those comments were
ported with the code, because they are the record of what already went wrong.

**Three traps are recorded here because they cost the most and are invisible when
they bite:**

- **`addInitScript` runs before `document.documentElement` exists.** Observing it
  directly threw `TypeError: parameter 1 is not of type 'Node'` and took the entire
  stage stylesheet down with it. Nothing reported it: the shoot ran, the clip was
  written, and the panel was unstyled for the whole take. Observe `document`.
- **Remotion serializes `<Composition>` defaultProps to JSON, dropping every
  function.** Passing a chapter's script through props delivered a chapter with its
  captions intact and every diagram and computed proof line silently missing. Chapters
  are addressed by id and resolve their own script.
- **A selector that "does not work" may be reporting on the rig.** The Group Detail
  tab strip was written up as deleted from the app. It was not; it was blanked by the
  scaled viewport in §1. Probe under the real capture geometry before concluding
  anything about the app.
- **Playwright's action timeout is per _action_, not per keystroke.**
  `pressSequentially` inherits the context's 4s default, and at a retimed cadence a
  thirteen-letter name takes longer than that. Two chapters failed on exactly the two
  beats that type a full name, and nowhere else.

**`overview` is deliberately not filmed.** It is being renamed Home and repurposed,
so a chapter shot against it today films a tab that is about to stop existing in that
form. `policies`, `export`, `explorer` and `history` are blocked on demo fixtures
rather than on design. `capture/chapters.mjs` carries that list as a `DEFERRED`
export, so the gap is a statement rather than an oversight.

**Deterministic capture via `Emulation.setVirtualTimePolicy` is out of scope.**
`HeadlessExperimental.beginFrame` is gone with old headless, and the remaining route
is slower than real time. It is unnecessary here: the composite is deterministic by
construction and each capture is now seconds rather than one continuous 162 second
take. Revisit only if the settle guard starts flapping.
