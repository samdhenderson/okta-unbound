# Design brief: the visual language of the Okta Unbound reel

Paste this whole file into a fresh Claude conversation (Claude Design, or any
chat with artifacts on). It is self-contained.

---

## The film

A silent, unnarrated ~3:45 product film for **Okta Unbound**, a Chrome
side-panel extension for Okta group and user administration. Its argument: an
admin can diagnose and fix a real access problem without ever leaving the tab
they are already signed in to. Seven chapters, one per tab, plus a title card and
a premise card.

## The change you are being briefed on

Today the film is honest and flat. The product panel is real screen capture,
1:1, sitting on the left of a dark frame with a slide of copy to its right. It is
credible and it is boring: nothing is ever emphasised, enlarged, exploded or
celebrated, because everything on screen is either a recording or plain type.

**We want it to look like an Apple or Google product reveal.** Real footage where
the product is doing a real job, and heavily animated synthetic set pieces
between and around it, built from faithful recreations of the product's own
components so they can be enlarged, exploded, isolated, counted up and flown
around in a way a screen recording never can.

You are designing that synthetic layer, and the rules that keep it from
undermining the real one.

## The one rule that keeps this honest

The film's whole credibility rests on the real captures being real. So:

1. **Every number in a synthetic scene comes from the real capture.** The rig
   already reads figures off the live panel during the shoot (94 members, 8 of 9
   rules active, 16 with no second factor) and the composition fails to render
   rather than print a figure nobody read. Synthetic components are dressed with
   those same figures. They are stylised, never invented.
2. **A synthetic component must never be mistakable for a screenshot.** It should
   be obviously _staged_: isolated on the dark backdrop, at 2 to 6 times product
   scale, exploded or partially assembled, without window chrome, without a
   cursor, lit and shadowed in a way the flat product UI never is. The viewer
   should read it as "that component, held up to the light", not "a screen".
3. **The real footage carries every claim of capability.** If the film says the
   panel does something, the doing of it is on camera. The synthetic layer
   dramatises what just happened or what is about to; it never stands in for it.

Within those three, go as far as you like.

## What already exists (the seed)

There are already six vector components drawn at frame resolution and dressed
from captured figures. They are the primitive version of what you are being asked
to design properly:

- `Tally` - one figure, counted up, with a label.
- `Ratio` - a before/after pair (12 applications, 1 inactive).
- `Funnel` - a narrowing (94 members, 19 Staff Engineers, 17 of them Employees).
- `FacetBoard` - a grid of attribute cards, each with its values and counts.
- `FactorLadder` - ranked MFA coverage rows with one row highlighted.
- `RuleBoard` - 9 rules, 8 active, 1 dormant, 0 conflicts.

They are correct and inert. Assume they get replaced.

## The tokens, and why they matter here

The product's real design tokens are already mirrored into the film, so a
synthetic component can be **exactly** the product's colours rather than an
approximation:

```
PRODUCT (the panel's own light UI)
primary        #546be7      primary-light   #f2f3fd     primary-highlight #dbe0fa
danger         #e72500      danger-light    #fff0ee
success        #16884a      success-light   #defae7
warning        #a16c03      warning-light   #fdfad9
accent         #9333ea
canvas         #f4f4f4      neutral 100/200/300/400/600/700/900:
                            #ededed #e1e1e1 #cbcbcb #aeaeae #6e6e6e #4b4b4b #272727

FILM (the dark stage the panel sits on)
backdrop       #0d0f1a   FLAT. no gradients, they band in an 8-bit encode.
raised plane   #161a2b
hairline       #2a3050
ink            #e8eaf4      ink dim  #9aa1c4
film accent    #8f9ff2      alert    #ff7a5c

Type: Inter, weights 400/600/700, never italic.
Film type sizes (px at 1080p): chapter 92, claim 46, body 27, label 19,
unit 16, figure 108.

Product motion tokens: 80 / 140 / 220 / 320 / 500ms,
  standard cubic-bezier(.2,0,0,1), entrance (0,0,0,1), exit (.3,0,1,1),
  affirm (.2,1.3,.4,1)
```

Rendered at 2560x1440, 60fps, in a 1920x1080 design space scaled up at render.
The panel occupies x 76-796, y 196-1036. Everything to the right of x=880 is the
film's own space.

## The product components worth recreating

These are the real things the film shows. Each is a candidate to be rebuilt as a
synthetic, animatable object:

- **Jump bar + result row** - a search field that resolves an id or an email into
  one row, with a footnote saying whether it cost a network request.
- **Finding row** - a label, a count, a chevron. "Groups no rule fills: 28".
  Pressing one expands it into the named groups.
- **List row** - the universal container: leading mark, name, secondary line,
  trailing control. Every list in the product is made of these.
- **Comparison tallies** - "4 groups, 3 apps, 11 attributes apart".
- **Worklist cause card** - the payoff of the film: a rule's clause
  (`user.department == "Engineering"`) beside the user's actual value
  (`"Enginering"`).
- **Blast radius preview** - a draft edit, and the list of groups it would add.
- **Facet segments** - an attribute, its values, each with a member count,
  clickable to filter.
- **Rule card** - name, status, the expression it matches on.
- **MFA coverage rows** - a ranked breakdown with counts and percentages.

## What to design

**A. The animation language.** Before any individual set piece: what is the film's
grammar for a synthetic object arriving, being emphasised, being counted, being
compared, and leaving? A keynote has exactly one such vocabulary and repeats it;
that is what makes it read as designed rather than as a reel of effects. Show it
on two or three different objects so the repetition is visible.

**B. Two or three set pieces.** Pick from the component list above and stage
them. The strongest candidates, because they are the film's turning points:

- the **cause card**, where `"Engineering"` and `"Enginering"` are held up
  side by side and the single missing character is the whole story;
- the **blast radius**, where one attribute edit fans out into the rules that
  read it and the groups that follow;
- the **finding row**, where a count becomes the names behind it.

**C. The title card and the premise card.** These have no footage at all - they
are pure synthetic, and currently pure type:

- _Title (7.0s):_ "Okta Unbound" / "Group and user administration right inside
  your active session." / "No external servers. Your data never leaves the
  browser tab." The film's geometry is a panel docked at one edge and an argument
  beside it; the title card is the one place that could be introduced rather than
  assumed.
- _Premise (11.0s):_ "Every Okta environment accumulates technical debt." /
  "Stale mapping rules. Manual attribute typos." / "Legacy organization
  structures still driving access." Three claims about decay, currently three
  lines of text on black.

## Constraints

- **No gradients** on the dark stage. They banded badly in an 8-bit encode. Flat
  fills and hard edges; baked dither patterns are fine, CSS gradients are not.
  Inside a synthetic product surface (which is light) a gradient is harmless.
- **No em dashes or en dashes** on screen. They kern badly at this size.
- **No stock photography, no depictions of people, no third-party logos.** Okta
  is named in the copy but its brand is not used.
- **No real org data.** Every identifier is a fake fixture: `00gFAKE...`,
  `user@example.com`, `Northwind Trading Co.`
- Buildable in **Remotion**: React, inline SVG, CSS transforms, springs. No
  external asset pipeline, no 3D engine, no video-editor effects. If it cannot be
  drawn in code it cannot ship.
- It plays **silent**, and it is watched without narration. Anything that needs
  explaining does not work.

## What to hand back

1. Rendered stills as HTML artifacts at 1920x1080, dark background, real Inter,
   real colours, so each idea can be judged by looking at it.
2. For anything that moves: what animates, in what order, over how many frames at
   60fps.
3. Two or three genuinely different options per item, not variations of one. It
   is easier to choose against something.

Do not write Remotion code. Getting it into the film is handled separately - the
artifact is the specification.
