# Shooting script

The reel in one file: what the camera does, what the slide says, and what still
has to be re-shot. **This is the working document.** Edit it; I fold the copy
into `reel/src/script.ts` and the camera work into the walks under
`.storybook/scripts/capture/walks/`.

**Notation.**

- **Camera** - what the walk actually drives in the panel. This is footage: a
  change here means a re-shoot of that chapter.
- **Slide** - one headline, then points. A new headline clears the slide before
  it. Free to change, no re-shoot.
- `[28]` - a **figure read off the live panel** during the shoot. Not typed into
  the script; looked up at render, and a key that stops being read fails the
  render rather than printing a stale number.
- `REVISION` - the script has moved ahead of the footage here. Listed again at
  the bottom with what each one costs.
- **hold** - how long the frame is frozen while the slide lands, before the
  footage under it moves. Read, then watch. **tail** - the pause on the last
  frame of an act.
- **Set piece** - a synthetic composition, and a **peer act** rather than a mark
  with a long hold. It carries its own length and names the capture whose
  figures it dramatises but whose frames it plays none of. No footage under it:
  the panel is gone and a recreation of one of its own components is on the dark
  stage at 2x to 6x, drawn into the **whole frame** rather than the focus plot,
  because the two zone geometry only exists while the panel is on screen. Free
  to change, no re-shoot, but every figure in it has to be a figure the rig
  read, and a cue pointing at a figure its act does not play now throws rather
  than clamping to one end of the act.

**Two constraints.** No em dashes or en dashes on camera, and every claim has to
be something the panel actually showed on film.

Runtime as cut today: **~3:52** for the footage. The **~3:57** below was
estimated when a set piece was still going to be a mark with a long hold, buying
its seconds from footage already on screen. A piece is a peer act, so it adds
its whole length: 222, 240 and 270 frames, 12.2s between the three. The opening
adds the cold open's 5.5s and gives back a tenth on the title card, 414 frames
rather than 420. The real total is whatever the current clips make it, and it is
not written here because nothing has measured it.

---

## The synthetic layer

Between and around the footage the film stages faithful recreations of the
product's own components, so they can be enlarged, exploded and counted in ways
a screen recording cannot. Three rules keep it from undermining the footage.

1. **Every figure comes from the capture.** A composition with an unread figure
   fails to render rather than printing a number nobody measured.
2. **A synthetic object is never mistakable for a screenshot.** Isolated on the
   backdrop, 2x to 6x, no window chrome, no cursor, shadowed the way the flat
   product UI never is, usually partially exploded.
3. **The footage carries every claim of capability.** The synthetic layer
   dramatises what just happened or is about to. It never stands in for the
   doing.

**Rule 1 has been tested four times, by this document.** The design handoff
assumed 412 groups and the rig measured 37. B1's block put two fixture ids on
the plates and those ids appear in no capture and no fixture anywhere in this
repository. B2's block asked each row to name the rule carrying it, and only the
report's two pill counts were ever shot. B3's block asked for four group names,
and every figure that walk reads is a number. Four for four, each one written
here first and each one refused at build time by somebody who went looking for
the capture behind it. **Nothing in this file is a figure until a walk reads
it**, however plausible it looks written down, and a value that reads as
obviously right is the dangerous kind.

**Six verbs, and a seventh that is governed.** dock (arriving), lift
(emphasis), count (a captured figure landing), split (comparison), fan
(consequence), recede (leaving). If a beat cannot be said with one of the six it
belongs in the footage instead. The seventh is draw, a graphite hairline
extruding along its own path, and it only ever applies to something the product
has not made yet: a claim awaiting evidence, a state that does not exist, or the
world before the panel. Never to a rendering of real captured state. `convert`
is draw's own modifier, a hard edged wipe from graphite into ink, and it
replaces the handoff's crossfade solidify. Frame counts, easings and colours are
in the design handoff at `DesignDocs/REEL DESIGN AND REWORK/`.

### What the audit found

The handoff expected the cause card and the blast radius to be product debt.
Both already ship:

| Object                | Real component                                                                 |
| --------------------- | ------------------------------------------------------------------------------ |
| Finding row           | `home/OrgSnapshotCard` row: `StretchedButton` + `FigureNumber` + chevron-right |
| List row              | `shared/ListRow`                                                               |
| Rule card             | `components/RuleCard`                                                          |
| Comparison tallies    | `users/comparison/ComparisonTabBar` tab counts                                 |
| Worklist cause card   | `users/comparison/CauseWorklistRow` + `ClauseChecklist`                        |
| Blast radius preview  | `users/BlastRadiusReport` + its rule and group rows                            |
| Facet segments        | `members/AttributeFacet`                                                       |
| MFA coverage rows     | `members/memberAnalytics` rows, drawn by `BreakdownReport`                     |
| Jump bar + result row | `home/JumpBar` + `home/JumpResultRow`                                          |
| Tally, Ratio, Funnel  | film-native, no product counterpart                                            |

Two things the audit killed, both because they claimed a component that does not
exist:

- **The gate** (cause card, option B) staged a rule card counting `Fills 94` down
  to `93` and opening a `1 member excluded by value` strip. Nothing in the
  product exposes a rule's fill count or its excluded set. Not shot; filed as
  debt below.
- **The row opens** (finding row, option B) rotated the finding row's chevron and
  grew a drawer of named groups, sold as the component's own behaviour
  magnified. That chevron points **right** because pressing the row navigates to
  a filtered tab. It has no drawer. Not shot.

### Product debt the film wants

- **`D-*` Rule fill count.** A rule card that says how many members its condition
  currently fills, and how many are held out. Source: the rule's condition
  evaluated against the target group's roster, which the panel already does for
  the clause checklist. The film would use it; it is not waiting on it.
- **Home finding disclosure.** A finding row that can name its own items in
  place, instead of only routing to a filtered tab. Related to the cut `report`
  beat. Not required by the current cut.

---

## Opening

No footage. A drawn cold open, then two cards over an empty backdrop. Both cards
are rebuilt from type into diagram. `REVISION 3`

### Cold open (5.5s) - "The console you work in today"

The film's opening shot, and it is not in the product at all. The Okta admin
console you work in today, sketched in graphite: window, app bar, the nav
written out by name, the overview and task cards. About 3.8s of drawing, then a
seam is drawn down the right edge of frame and converts from graphite into the
film's accent, then a short hold so the hard cut into the title card lands on a
still frame. This is the third of the three things `draw` is allowed to touch:
the world before the panel.

The handoff's `8K users / 24 groups / 189 SSO apps` is not used. It is not a
shape any real org has, 8,000 people sharing 24 groups, and it came from no
capture. The figures are counted out of the repository's own Northwind fixture
instead, so the cold open and the footage describe one company: **250 users, 37
groups, 12 apps**. They are labelled Apps rather than SSO apps, because several
of the twelve exist for group push and one is inactive. The 37 agrees
independently with the `groupsTotal` the rig measured for B3.

The handoff's literal "Okta service / Operational" card is gone. Okta is named
in copy and its brand is not reproduced, so the slot and its `Status` title
survive with two inert rules and no text. Recognisability is the argument here,
and it is also the liability.

### Title card (6.9s) - "The dock"

Copy unchanged.

> # Okta Unbound
>
> Group and user administration right inside your active session.
>
> No external servers. Your data never leaves the browser tab.

The film's geometry drawn as a diagram before it is used as a layout: a hairline
tab rectangle you are already inside, and a panel plane docked at the right edge
with a film-accent seam and abstract placeholder rows. The wordmark sets inside
the tab, the claim below it, the two privacy facts in hairline boxes.

**On exit only the tab outline recedes. The panel seam persists into chapter
one.** The title card does not end, it becomes the film's frame. The seam itself
is drawn by the film rather than by this card, so the card is composed knowing it
will be drawn over and nothing load-bearing sits in the rightmost pixels.

Built at 414 frames, not a padded 420. The handoff's visible pencil tip, a
graphite tick travelling along the wordmark's reveal edge, is **cut**: it is the
treatment's highest cheesiness risk, the moment the metaphor stops being a
texture and starts being a cartoon, and cutting it is what buys the last tenth
back. The handoff's camera settle, a continuous 1.016 to 1.0 zoom held across
the whole card, is **cut** too: on a flat backdrop with 1px hairlines it does
not read as a slow push, it reads as crawl, and nothing in the grammar
authorises a camera move. The panel converts out of graphite through the same
hard wipe the cold open's seam uses; the world stays a drawing.

### Premise (11.0s) - "Three plates, three exhibits"

Claims unchanged. Eleven seconds of type alone stalls, so each claim gets an
exhibit beside it on a raised plane, and all three hold together at the end -
that hold is what makes the total read as accumulation.

> ## Every Okta environment accumulates technical debt.
>
> - Stale mapping rules. Manual attribute typos.
> - Legacy organization structures still driving access.

- **01 Stale mapping rules.** The dormant rule card, gone gray at 62 percent.
  `[1]` of `[9]` rules is switched off. Chapter 5 stages this component in full.
- **02 Manual attribute typos.** The misspelled value, `[Enginering]` in danger
  on danger-light. Chapter 2 stages this in full.
- **03 Legacy organization structures still driving access.** `[28]` groups no
  rule fills, beside `[3]` with nobody in them: structures still granting
  access that no automation maintains. Chapter 1 reads both off the panel.

Exhibit 03 replaces the handoff's renamed-department plate, which had one
attribute carrying two live values at 71 and 23 members. No panel surface
exposes that split and the rig cannot read it, so shooting it would have meant
inventing org history. Cut.

---

## 1. Home (~24s)

Panel on stage right throughout.

**jump** - _hold 3.0s, tail 2.4s._ `REVISION 1`
**Camera:** types `priya.achterberg@example.com` into the jump bar, the search
answers, one result row arrives.

> ## Search your directory instantly.
>
> - Type an email, get the person.
> - `[1]` result, without leaving the tab. _(cued when the row arrives)_

**working-set** - _hold 3.2s._
**Camera:** scrolls to the Pinned section, reads both counts.

> ## Resume your workflow without searching.
>
> - `[2]` pinned, `[2]` recent.
> - Stored locally per org. Automatically expires.

**findings** - _hold 3.4s, tail 3.2s._
**Camera:** scrolls to the org findings card and reads three of them.

> ## Spot actionable items right away.
>
> - `[28]` groups with no rule filling them.
> - `[3]` empty groups with nobody in them.
> - `[1]` inactive rule left behind.

**SET PIECE B3 - "The unpacking"** (~4.5s, follows `findings`). **Built.**
`REVISION 4` `REVISION 6`
The panel leaves. Three registers at once: the figure `[28]` counting up at
108px, a `[37]`-cell grid where `[28]` cells flip to film accent and prove the
proportion, and a column docking in from the right carrying the arithmetic
behind both.

The third register was specified as four of the group names docking in with
`and 24 more` setting with no motion at all, so the frame would admit it is a
sample. **It was not built, and could not be.** `walks/home.mjs` reads nine
figures for this chapter and every one of them is a number: `reportNamed` is a
count of the rows the report drew, not what any of them said, and the beat that
would have produced names is filmed and not played. Typing four group names into
the composition is the exact fabrication this piece exists to argue against. The
column carries `[28]` groups no rule fills, `[9]` a rule maintains, `[37]` in
the org and 76 per cent of it maintained by hand, every one read or derived by
subtraction over two reads, then the closing line. The names are obtainable for
one extra read and no re-shoot; see `REVISION 6`.

The grid is countable rather than a texture, which was the whole design problem:
eight cells to a row split into blocks of four, filled row major so the lit
region is one shape and the remainder is one shape, and the ledger's swatches are
the grid's own cells at the same size rather than a described legend. The last
row is short and is deliberately not padded, because 37 is prime and a ragged
five is what a measured number looks like.

> ## Most of this org is maintained by hand.
>
> - `[28]` of `[37]` groups have no rule filling them.
> - Every one of them is somebody's memory of who belongs.

This is not the cut `report` beat coming back. The camera never presses the
finding here; the set piece dramatises the count the camera already read.

The only place in the film a captured denominator is drawn rather than written,
and it needs one new figure: the groups collection total. **It is 37, not the
412 the design handoff assumed** - that number was never measured. See revisions
for what the real proportion changes.

**report** - **filmed, not played.** The walk still presses the finding and still
refuses a capture where the count and the rows behind it disagree, so the fixture
assertion survives. Name the beat in `plan` and it comes back with its words.

---

## 2. Users (72s)

Three acts on one tab. The band names each act beside the chapter counter.

### Act 1 - "The gap" (~17s)

**arrive** - _hold 3.2s._
**Camera:** searches for Priya Achterberg, opens her user page.

> ## A new hire files an access ticket.
>
> - Onboarding finished, but her core access never arrived.

**gap** - _hold 2.6s, tail 3.2s._
**Camera:** reads her group count.

_(joins the slide above)_

> - `[4]` assigned groups, missing her core team access.
> - View the complete assignment list on one screen.

### Act 2 - "The cause" (~29s)

**subject** - _hold 3.0s._
**Camera:** opens Priya again.

> ## Benchmark against a working coworker.
>
> - Same title and team. Different application access.

**against** - _hold 1.2s, no slide._
**Camera:** presses Compare, searches for the peer, opens the comparison.

**difference** - _hold 3.4s._
**Camera:** reads the three tallies.

_(joins the slide above)_

> - `[4]` groups, `[3]` apps, `[11]` attributes apart.
> - Every tool can tell you that much.

**cause** - _hold 3.2s, tail 3.6s. Cued the moment the row is legible._
**Camera:** scrolls to "What to fix", reads the blocked group count, then the
clause and the value beside it.

> ## Unbound reveals the root cause.
>
> - The mapping rule requires `[user.department == "Engineering"]`
> - The user profile says `["Enginering"]`
> - An attribute typo broke the automated provisioning.

**SET PIECE B1 - "Exploded plates"** (~3.7s, follows `cause`). **Built.** The
film's payoff. The panel leaves. The cause card the camera just read, at 5x,
docks in whole, lifts, then **splits** into two plates tilted -1.2 and +1.2
degrees, each labelled with the `cause` slide's own line: `The mapping rule
requires` above `The user profile says`. A danger wash sits behind the
misspelling only, static and present from the dock rather than drawn, because
`draw` is banned on a rendering of real captured state. An alert delta bar
bridges the gap under a `1 char` caption. Raised-plane bands slide out from
behind the plates carrying the sentence, and on the way out **the plates rejoin
before receding**, so the cut back to footage lands on the whole card.

The two fixture ids this block used to hang on the plates, `0prFAKE7d8e9f` above
`00uFAKE1a2b3c`, are **struck**. They appear in no capture and in no fixture
anywhere in this repository, so printing them would have broken the synthetic
layer's first rule inside the one piece whose entire argument is that what you
are reading was measured. Unlike B2's rule names and B3's group names there is no
revision that would fix this: there is no frame to go back and read them off.
The slide's own two lines label the plates instead, which is what the camera
showed anyway.

Both strings are read, and from the `cause` figure of the **`users-cause`**
capture rather than `users-fix`, whose `typo` is only the misspelled value with
no clause to compare it against: `[user.department == "Engineering"]` from the
clause, `["Enginering"]` from the resolved value beneath it. They are diffed at
render, so `1 char` is measured rather than written, and the two plates are laid
out so both literals occupy the same columns whatever the font resolves to. Where
the character is missing the value plate reserves exactly that character's width
and draws an empty dashed slot over it, with nothing printed into it, so what is
on screen is still character for character what the rig read. The real component
stacks the clause above the value; the split is the film saying what the stack
means.

### Act 3 - "The fix" (~26s)

**open** - _hold 2.6s._
**Camera:** opens Priya, reads her group count before anything changes.

> ## Remediate directly from the investigation screen.
>
> - Edit the attribute right inside the panel.

**edit** - _hold 1.6s, no slide._
**Camera:** Profile tab, Edit, scrolls to the department field, reads the typo,
types the correction.

**predict** - _hold 3.4s._
**Camera:** Save, then Analyze blast radius; reads the predicted count and the
group names it predicts.

> ## Preview the blast radius before saving.
>
> - Test the draft against all dependent rules.
> - Predicted: `[Engineering - All, GitHub - Engineering]` _(cued when the prediction lands)_

**SET PIECE B2 - "The ledger"** (~4.0s, follows `predict`). **Built.**
`REVISION 5` `REVISION 7`
The panel leaves. The prediction as a receipt rather than a fan: cause on the
left (the draft edit, and a `Reversible - yes, until Apply` panel), consequence
on the right (a `WOULD ADD` row per predicted group), then the totals, then the
caveat last and longest on screen. **The zero does not roll, it simply sets.**
Each row's frame is graphite extruded on by `draw`, which is that verb used
exactly as its rule allows - a membership that does not exist yet, awaiting the
Apply that would make it real - and the captured group name docks into the frame
in ink once it closes. Nothing else on the plate is drawn.

The block used to ask each row to **name the rule that carries it**. There is no
such figure. `REVISION 5` shot the report's two pill counts and the absence of
the removal section, and nothing else, so a rule name on a row would have been
typed rather than read. The rule count stands once in the totals instead. The
names are obtainable for one more read off a frame the camera is already parked
on; see `REVISION 7`.

> `[groups]` groups, `[rules]` rules, **0 removals**
>
> - No group loses a member. Additive only.
> - Group rules only. Pushed groups are not modelled.

The second line is the report's own standing footnote, and it is not optional:
the panel cannot see a rule's exclusion list, evaluates conditions with its own
implementation of Okta's expression language, and Okta applies rules
asynchronously. A ledger that omits it claims more certainty than the product
does.

`0 removals` is true - the report's "Likely removed" section renders empty - but
the product never prints that zero, it drops the section. So the zero is the
film's own reading of the frame, and it needs a rig read that asserts the
section is empty rather than a hardcoded `0`. `groups` and `rules` are the
report's two pill counts. All three are new figures. See revisions.

The reader that assembles the plate refuses a manifest whose `groups` pill
disagrees with the number of names in `added`. A receipt that counts one thing
and itemises another is worse than one that fails to print.

**Closed.** The `predict` beat names two groups and the `land` beat goes from 4
to 7. The second-order note was the hypothesis and it is **refuted**: no demo
rule expression contains an `isMemberOf` clause, so `secondOrderScan` returns
empty unconditionally for this org, and `secondOrderPossible` was `false` in the
shoot.

The third group is `Datadog - Engineering`, and it arrives by **app group push**
rather than by a rule. `analyzeBlastRadius` only ever inventories the org's group
rules, so a pushed group can never appear in any of its three buckets - not even
as `not-predicted`, which still requires being a rule target. This is not a
missed prediction inside the tool's scope. It is a category of membership the
tool does not claim to cover.

So the ledger's caveat is not the report's generic footnote but the specific
truth: **group rules only, pushed groups are not modelled.** That earns the
adjacency of two predicted and four-to-seven gained, which a viewer sees in the
same chapter and which the film would otherwise be papering over.

**land** - _hold 2.6s, tail 4.0s. Cued on the new count._
**Camera:** confirms the save, reads the confirmation, returns to the Groups tab,
reads the new count.

> ## The automation triggers immediately.
>
> - `[Saved 1 attribute on Priya Achterberg.]`
> - `[4]` groups before, `[7]` after.
> - Resolved without a single page reload.

---

## 3. Groups (16s)

**cascade** - _no slide, silent travel._
**Camera:** the group list.

**open-group** - _hold 0.8s, no slide._
**Camera:** scrolls to `Engineering - All` and opens it.

**members** - _hold 3.2s, tail 3.4s._
**Camera:** opens the membership card, reads the roster counts.

> ## Audit membership provenance instantly.
>
> - Grouped by assignment source instead of alphabetical order.

_Diagram: **94 members**._

---

## 4. Apps (14s)

**open** - _no slide._
**Camera:** Apps tab, reads the inventory counts.

**filter** - _hold 3.0s._
**Camera:** filters to Inactive, reads the narrowed counts.

> ## Identify the applications nobody switched back on.

_Diagram: **12 applications → 1 inactive**._

**sort** - _hold 0.8s, tail 3.0s, no slide._
**Camera:** back to All, sorts by Status.

---

## 5. Rules (23s)

**load** - _hold 2.8s._
**Camera:** presses Load rules, reads the stats.

> ## Audit your automation logic directly.
>
> - Rules are fetched when you ask, and not before.

**active** - _hold 0.9s, no slide._
**Camera:** Active Only, then All Rules.

**dormant** - _hold 3.4s, tail 3.4s. Panel leaves the frame._
**Camera:** scrolls to the dormant rule and expands it.

> ## Locate inactive logic cluttering the environment.
>
> - `[8]` of `[9]` rules are in force.

_Diagram: 9 rules, 8 active, 1 dormant, 0 conflicts._

---

## 6. Attributes (31s)

Kept as analysis, given a job: the facets are what a rule matches on, which is
the same predicate that broke two chapters earlier.

**open** - _hold 3.0s._
**Camera:** opens `Engineering - All`, then its membership card.

> ## Before you write a rule, see what you are matching on.

**facets** - _hold 3.6s. Panel leaves the frame._
**Camera:** opens the composition section, reads every facet and the roster
count.

> ## Every attribute this group actually varies along.
>
> - Values, counts, and which ones a rule can filter on.

_Diagram: the facet board - Department, Title, Organization, User type, Employee
type, City, State / Region, Country._

**filter** - _hold 1.4s, no slide. Panel returns._
**Camera:** clicks the first facet value, reads the narrowed roster.

**compose** - _hold 3.2s._
**Camera:** clicks a second facet value on a different attribute, reads the
composed roster.

> ## Stack two filters and you have the population a rule would match.
>
> - Counted locally, without reloading the page.

_Diagram: 94 members → Staff Engineer 19 → and Employee 17._

**roster** - _hold 1.2s, tail 3.2s, no slide._

`REVISION 2` - which two facet values get clicked is chosen by the walk at run
time (first match on `/title|role|job/i`, then on `/type|location|city|team/i`).
It landed on Staff Engineer then Employee, which is a large, unremarkable slice.
Worth revisiting if the analysis should end somewhere more pointed.

---

## 7. Reporting (32s)

**open** - _hold 3.0s._
**Camera:** opens `Engineering - All`, its membership card, reads the roster.

> ## Deprecating SMS authentication. Who is exposed?

**arm** - _hold 3.2s._
**Camera:** opens the composition section, switches to the MFA factors tab.

_(joins the slide above)_

> - Calculates the exact cost before running the scan.
> - One API call per member. It never runs on its own.

**scan** - _hold 0.6s, played fast, no slide._
**Camera:** presses Scan and waits it out.

**breakdown** - _hold 3.6s. Panel leaves the frame._
**Camera:** reads the whole factor breakdown.

> ## Map the exact authentication posture.

_Diagram: the factor ladder, "No factors enrolled" highlighted - 16 (17%),
Multiple factors 27, Has SMS 29, Okta Verify Push 29, TOTP 23, Fastpass 16,
Security Key 5, Google Authenticator 2, Email 1._

**unenrolled** - _hold 3.0s, tail 4.0s. Panel returns._
**Camera:** clicks the "No factors enrolled" row, reads the resulting roster.

> ## Turn reports into actionable target lists.
>
> - `[16]` of `[94]` have no secure second factor.
> - Click the finding to reveal the vulnerable accounts.

---

## End card

> # Okta Unbound
>
> Fetches data only on demand, to respect your API limits.
>
> No servers. Nothing left the tab.

---

## Revisions needed

**REVISION 1 - Home, `jump`. Shot.**
Today the beat pastes `00gFAKE0000000000002`, a **group** id resolving to
`Engineering - All`. It becomes an email search for
`priya.achterberg@example.com`, which also hands Home straight into the Users
chapter instead of introducing a group nobody follows up on.

What changes: `walks/home.mjs` types the email instead of the id and waits for
the result row; a `results` figure replaces `jumpCost`; a `jumpResultRows`
selector is added. One chapter re-shot, about four seconds shorter.

What it costs: `JumpBar` renders `Exact id match · no request` **only** for an id
resolution. That footnote was the film's one piece of evidence that the panel
answers from its own snapshot without calling Okta, and it leaves the reel with
this change. Accepted.

**REVISION 2 - Attributes, `filter` and `compose`. Open, not blocking.**
See the note in chapter 6. No decision needed to ship the current cut.

**REVISION 3 - Opening. Built, no re-shoot.** Both cards go from type to
diagram. Pure synthetic, so nothing is filmed, but the premise card now needs
figures it never needed as type: `pausedRules`, `stats`, `typo`, `unruled` and
`emptyGroups` all already read, and all now render-blocking for the opening
rather than only for their own chapters. A rig that stops reading `unruled`
currently fails chapter 1; after this it fails the film's second card.

**Built, and it took a third manifest.** Each premise plate docks in as a
graphite outline, a claim awaiting evidence, and solidifies into ink through
`convert` at the moment its exhibit lands. That is the film's thesis as a
mechanic rather than as an assertion in copy. The card is one SVG, because
`convert` clips with an SVG clipPath and the HTML verbs cannot live inside that;
their timing and curves still drive it, so a plate arrives on entrance over 22f
and leaves on exit over 19f like every other object in the film. `count` is
deliberately not used, because a figure that rolls in after a wipe has already
revealed it is the same object arriving twice. The card reads home, rules and
users-fix directly rather than through an act, which is new and worth stating:
**a stale rules capture now fails at frame 0 of the film rather than at 2:40.**
That is better, and it will surprise someone.

**Still to do:** the cold open, the title card and the premise card are built and
each is registered as its own composition (`cold-open`, `card-title`,
`card-premise`, alongside `piece-unpacking`, `piece-ledger` and `seam`), so each
can be scrubbed on its own rather than found inside four minutes of film. The
film's `Opening` still plays the old type cards. Cutting the three in is the
remaining step, and it is wiring, not design.

**REVISION 4 - Home, set piece B3. Shot.**
The cell grid needs `groupsTotal`, the groups collection total. It is on the
Home snapshot card already, as the caption under the findings, so this is a
selector and a `drive.read` in `walks/home.mjs`, not a new camera move. No
re-shoot of the beat itself; the walk gains a read while it is already parked on
the card.

Until it lands, B3 cannot render - which is the point of the rule. Do not
hardcode a denominator.

**Shot, and it changed the set piece.** `groupsTotal` reads **37**. The demo org
has exactly 37 groups (`grep -c '^  group(' src/sidepanel/demo/snapshot.ts`), so
the figure is right and the handoff's 412 was invented, the same way the renamed
department was. 28 of 37 is not 28 of 412: the design's stated rationale was that
the grid "makes 28 feel small and specific instead of alarming", and at 76 per
cent it does the opposite. **Decided: the set piece argues the new thing.** A
grid that is three quarters lit says most of this org's groups are maintained by
hand, which is a sharper claim than "28 groups need attention" and closer to what
the film is actually about. The composition is unchanged; its job is not.

**REVISION 5 - Users act 3, set piece B2. Shot.**
The ledger needs the blast-radius report's two pill counts (`Groups N`,
`Rules N`) and an assertion that the "Likely removed" section is absent, which is
what licenses printing `0 removals`. All three come off the frame the `predict`
beat is already stopped on, so `walks/users-fix.mjs` gains reads rather than
moves.

**Measured:** `groups` 2, `rules` 2, `removed` 0, against `groupsBefore` 4 and
`groupsAfter` 7. So the ledger prints two predicted beside a four-to-seven jump,
and the "group rules only" caveat is doing real work rather than hedging. The
open question behind that gap is closed in the set piece's own section.

**REVISION 6 - Home, B3's group names. Open, one read, not blocking.**
The unpacking's third register was written as four group names docking in with
`and 24 more`. No group name is in any capture: `walks/home.mjs` reads nine
figures for this chapter and every one is a number, and `reportNamed` is a row
count rather than the rows' text. What it would take is a read, not a move. The
walk is already parked on the org findings card, and the `report` beat that
presses a finding and draws the named rows is filmed and not played, so the
names are on frames the rig has already driven to. A selector and a `drive.read`
returning the rows' text is the whole change; the beat itself does not move.

Until it lands the register carries the arithmetic, which is not a placeholder:
count, complement, total and proportion are a complete argument on their own.
Names would add the thing the arithmetic cannot, which is the frame admitting
out loud that it is showing a sample.

**REVISION 7 - Users act 3, B2's rule names. Open, one read, not blocking.**
The ledger's `WOULD ADD` rows were written to name the rule that carries each
predicted group. `REVISION 5` shot the report's `Groups N` and `Rules N` pills
and an assertion that the removal section is absent, and no rule name. What it
would take is another read in `walks/users-fix.mjs`, off the blast radius report
frame the `predict` beat is already stopped on, pulling each predicted row's rule
beside the group name it already yields. Reads rather than moves, exactly as
`REVISION 5` was.

Worth doing, because two rows naming two rules is the difference between a count
and a receipt. Until then the rule count stands once in the totals and no row
prints a name, which is the rule working rather than a gap.

**Parked - Apps.** The sharper line is about live assignments sitting on a dead
app; whether the app detail even shows an assignment count is unverified.
Revisit when the Apps tab gets more to say.

---

## Decisions log

- **Home's `report` beat is cut.** Pressing a finding and getting names back is a
  good moment, and Reporting ends on the same move against a scan nobody could
  run by hand. Filmed and not played rather than deleted.
- **Home's `jump` is an email search.** Breadth over the no-request proof.
- **Attributes stays analysis.** Reworded so the analysis has a job, rather than
  recast as outlier-hunting.
- **Apps keeps the modest line.** Parked until the tab is more useful.
- **The synthetic layer is built from six verbs, plus `draw` for the pencil.** A
  beat that needs an eighth belongs in the footage. `draw` is governed: it only
  ever applies to something the product has not made yet - a claim awaiting
  evidence, a state that does not exist, or the world before the panel. Never to
  a rendering of real captured state.
- **`convert` replaces the handoff's solidify.** The handoff ran an ink fade up
  against a pencil fade down for 19 frames, with two renderings of the same
  object visible for most of them. That is a crossfade between synthetic
  objects, the one transition this film never uses. `convert` clips both sides
  by complementary rects of a single bbox, so no pixel ever shows both. It draws
  its bbox wider than the object, because a bbox drawn tight shears off the
  graphite's own overshoot the moment the wipe mounts.
- **The wobble is geometry, not a filter.** The handoff's `feTurbulence` plus
  `feDisplacementMap` ran full frame for 12.3 seconds, which Chrome cannot cache
  and which is the usual reason a Remotion render looks hung. A stroke's own
  amplitude does the same job at no per-frame cost, and being static per frame
  nothing crawls between them.
- **A set piece is a peer act, not a mark with a hold.** It carries its own
  length and names the capture whose figures it uses. Hanging it off a mark
  would have welded editorial time to footage time, so every later cue shifted
  when a piece was retimed, and it would have composited a frozen video frame
  under a full-frame opaque plate for four seconds. The consequence worth
  knowing: a beat cued to a figure its act does not play used to clamp silently
  to one end of the clip, and now throws, naming the figure, its read time, the
  act and the act's window.
- **A set piece is drawn into the whole frame, not the focus plot.** The film's
  two zone geometry exists because the panel is on screen; for a piece it has
  left, and an object still pinned to the right of a column that is not there
  reads as a slide with a panel missing rather than as a thing held up to the
  light.
- **The cold open counts the Northwind fixture, not the handoff.** `8K users /
24 groups / 189 SSO apps` is not a shape any org has and no capture read it.
  250 users, 37 groups and 12 apps are counted out of the fixture the rest of
  the film is shot against, and the 37 agrees independently with what the rig
  measured for the unpacking.
- **The title card loses the pencil tip and the camera settle.** The tip is
  where the metaphor stops being a texture and becomes a cartoon, and cutting it
  is what lands the card at 6.9s. The settle, a continuous 1.016 to 1.0 zoom,
  reads as crawl on a flat backdrop of 1px hairlines, and nothing in the grammar
  authorises a camera move.
- **The unpacking's denominator is 37, and the set piece argues it.** The
  handoff's 412 was invented. 28 of 37 says most of this org's groups are
  maintained by hand, which is the better claim anyway.
- **The ledger says "group rules only".** The third group the fix gains arrives
  by app group push, which the blast-radius engine does not model. The specific
  caveat is honest where the report's generic one would have been evasive.
- **Cause card: exploded plates.** The real component stacks the clause above the
  resolved value; the film splits that stack and rejoins it before the cut back,
  so the footage and the set piece end on the same object.
- **Cause card: the fixture ids are struck.** `0prFAKE7d8e9f` and
  `00uFAKE1a2b3c` were in this document and are in no capture and no fixture in
  the repository. There is no frame to go back and read them off, so unlike the
  ledger's rule names and the unpacking's group names this one is not a revision,
  it is a deletion. The plates carry the cause slide's own two lines.
- **Cause card: "the gate" is not shot.** It needed a rule fill count and an
  excluded-member strip that the product does not have. Filed as debt rather
  than faked.
- **Blast radius: the ledger, carrying the product's own caveat.** The prediction
  is likely, not certain, and the film says so. The zero sets rather than rolls.
- **Finding row: the unpacking.** The proportion is drawn, once, in the one place
  the film has a captured denominator.
- **Finding row: "the row opens" is not shot.** It claimed a disclosure the
  component does not have; that chevron navigates.
- **Premise plate 03 is re-based onto unfilled and empty groups.** The renamed
  department with two live values at 71 and 23 was invented. Nothing reads it.
- **The title card's panel seam persists into chapter one, and the film draws
  it, not the card.** The card does not end, it becomes the frame the footage
  docks into. The seam is hoisted above the chapter series, because nothing
  rendered inside the series can slide from one chapter into the next and the
  seam has to cross the opening, where there is no panel to take its opacity
  from. It sits 4px wide at the frame's right edge, and the two more obvious
  positions both fail against the real layout: **x=1360** is inside the
  chapters' copy column and would strike through every slide, and **x=880**
  looks like the panel's docked edge and is not - the panel is at x=76, and x=880
  is the margin's own left edge, where the margin already draws a 2px rule, so an
  accent seam there would double an existing line on every home stage frame. It
  arrives by extending from its centre rather than fading up. The cold open draws
  its own seam onto the same pixels, so the handover at that cut has nothing to
  match.
- **The ledger's rule names and the unpacking's group names are filed, not
  dropped.** Neither was shot; both are one extra read off a frame the camera is
  already parked on. `REVISION 7` and `REVISION 6`.
- **Nothing in this document is a figure until a walk reads it.** The handoff's
  412 groups, B1's two fixture ids, B2's per-row rule names and B3's four group
  names were all written here first and all four were refused at build time.
  This document is where the fabrication starts, so it is where the habit has to
  be kept.
- **Cut for asserting rather than showing:** "Predictable and transparent
  execution", "Zero friction", "Review all mappings without clicking through
  menus", "Spot the missing manual assignments immediately".
