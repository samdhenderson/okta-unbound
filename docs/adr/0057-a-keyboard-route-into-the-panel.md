# ADR-0057: A keyboard route into the panel

- Status: Proposed
- Date: 2026-08-29
- Scoped by: `I-018`
- Relates to: [ADR-0028](./0028-icon-rail-navigation.md) (the rail the palette
  jumps between), the Home tab program (whose jump bar became the primary route)

> **Numbering note.** `I-018` reserved `0046` on 2026-08-28; the response-layer
> ADR took it days later. See `D-072`.

## Context

The ⌘K palette is unreachable in the situation it exists for.

`useCommandPalette` registers a plain `window` keydown
(`src/sidepanel/hooks/useCommandPalette.ts:52-61`) inside the side-panel
document. The chord therefore only lands once you have already clicked into the
panel. Pressed while focus is in the Okta page — which is where an admin
actually is when they want to jump — Chrome takes ⌘K for the omnibox and the
panel never sees it.

Home's jump bar softens this: it is a real autofocused input on a real tab, so
the _capability_ has a route. But the _shortcut_ is still a control that does
nothing from the place a person would use it, which is worse than not having one.

The only mechanism that can hear a chord outside the panel document is a
`manifest.json` `commands` entry. `manifest.json` has no `commands` key today.
That makes this a manifest change, and CLAUDE.md requires an ADR and Sam's
explicit review for one — correctly, because it is a new permission-shaped
surface, it can collide with a user's existing bindings, and Chrome budgets four
suggested shortcuts per extension, so spending one is a decision about which
single chord is worth it.

## Decision

### One command, and it is `_execute_action`

The extension declares exactly one command:

```json
"commands": {
  "_execute_action": {
    "suggested_key": { "default": "Ctrl+Shift+K", "mac": "Command+Shift+K" },
    "description": "Open Okta Unbound"
  }
}
```

`_execute_action` is Chrome's reserved name for "do what clicking the toolbar
icon does". Choosing it over a custom command is the whole decision, and it buys
three things:

1. **No new permission and no new message.** A custom command needs a
   `chrome.commands.onCommand` listener in the service worker, which then has to
   open the panel and tell it what to do — a new message action, with a new
   sender-validation obligation. `_execute_action` is handled by Chrome and adds
   no code path at all.
2. **It survives the panel being closed**, which is the case the item is about.
3. **It does one obvious thing**, so it does not need to explain itself.

**Chrome will not let an extension open a side panel from a keyboard shortcut
except through a user gesture it recognises**, and `_execute_action` is that
gesture. This is the constraint that makes the choice, not a preference.

### The chord is `⌘⇧K`, not `⌘K`

⌘K belongs to the omnibox and to roughly every editor and chat app a person has
open. An extension that takes it wins an argument the user did not ask to have.
⌘⇧K is unclaimed by Chrome itself, is one modifier from the chord the palette
already teaches inside the panel, and Chrome silently drops a `suggested_key`
that conflicts with a browser binding — so a greedier choice would not even fail
loudly.

**Suggested, never assumed.** `suggested_key` is a suggestion: Chrome ignores it
on conflict, and the user can rebind or clear it at `chrome://extensions/shortcuts`.
Nothing in the UI may state the chord as fact. Where the panel teaches the
shortcut it reads it back from `chrome.commands.getAll()` and renders what is
actually bound — or says it is unassigned, with a link to the shortcuts page.
A hint that lies about its own keystroke is worse than no hint.

### In-panel ⌘K is unchanged

The existing `window` listener stays exactly as it is. The two do not overlap:
`_execute_action` opens the panel from outside, in-panel ⌘K opens the palette
once you are in it. Nothing is rewired, and the item ships no change to
`useCommandPalette`.

### What happens when the panel is already open

`_execute_action` toggles per Chrome's own behaviour for the action, and this
ADR does not fight it. Opening the panel does not force the palette open, does
not change tabs, and does not steal focus from a field the admin is typing in.
The shortcut's promise is _the panel is now in front of you_ — arriving on a
surface other than the one you left would make it unpredictable, and the
palette's own chord is one keystroke away.

## Consequences

The shortcut becomes true from the Okta page, which is the only place it was
ever going to be used, at the cost of zero new code and zero new permissions —
`commands` is a manifest key, not a permission, and adds nothing to the
install-time prompt.

Three costs. The extension spends one of its four suggested-shortcut slots, and
this ADR asserts this is the one worth spending. The chord is `⌘⇧K` while the
in-panel palette is `⌘K`, which is a real inconsistency that has to be taught
rather than hidden. And any UI that displays the chord now depends on
`chrome.commands.getAll()`, an async read that can legitimately return nothing.

## Alternatives considered

**A custom command plus an `onCommand` listener.** More expressive — it could
open the panel _and_ focus the jump bar. It needs a service-worker listener, a
new message action into the panel, and its own sender validation, and Chrome's
user-gesture rules make reliably opening a side panel from a custom command the
awkward path rather than the supported one. Rejected for a mechanism that does
90% of the job with none of the surface.

**Take `⌘K` in the manifest.** The chord users already know. Chrome drops it on
conflict with the omnibox, silently, so the feature would appear to work for
whoever wrote it and be absent for everyone else.

**A content-script keydown listener on the Okta page.** Would hear the chord in
the page and could message the panel. It means listening to every keystroke on
an authenticated admin console — a keylogger-shaped capability for a navigation
convenience. Rejected on security grounds regardless of feasibility.

**Do nothing; the jump bar is enough.** Defensible, and it leaves a documented
shortcut that does nothing from where it is needed. The cheapest honest
alternative would be removing the ⌘K hint rather than leaving it misleading.
