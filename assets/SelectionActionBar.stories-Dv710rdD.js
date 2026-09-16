import{S as v}from"./SelectionActionBar-BsGBZJPM.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,fn:y,userEvent:n,within:o}=__STORYBOOK_MODULE_TEST__,B={title:"Selection/SelectionActionBar",component:v,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"`docs/action-bars.md`’s questions put the two whole-page verbs in different places. **`Save as collection`** is the strip’s one `primary`: its object is the whole basket, opening the modal counts as acting, and nothing is destroyed — a saved collection can simply be deleted again — so it stays in the row.\n\n**`Clear all`** fails the third question: nothing re-ticks the basket for you, so a second press cannot undo the first. It goes behind **More**, hand-drawn in the tier rather than declared as an `ActionDescriptor`, because the consequence sentence beside the button (`Empties every partition. There is no undo.`) is exactly what a descriptor cannot carry — the same reason `UserLifecycleActions` hand-draws Suspend.\n\nThe band outlives an empty basket. An org with saved collections has something to search and something to load even with nothing ticked, so the two verbs are omitted individually rather than taking the search field down with them. Only a page with neither a basket nor a collection renders nothing at all — a verb with no object is omitted, never disabled."}}},args:{total:12,hasCollections:!1,query:"",onQueryChange:y(),onSaveCollection:y(),onClearAll:y(),sticky:!1},argTypes:{total:{description:"How many entities are in the basket. `0` omits both verbs."},hasCollections:{description:"Whether the org has any saved collection. Keeps the band alive at `total: 0`."},query:{description:"Current search text. `’’` means no filter."},onQueryChange:{description:"Called as the reader types."},onSaveCollection:{description:"Opens the save-a-collection modal."},onClearAll:{description:"Empty the whole basket. Wired to `useSelection().clearAll`."},sticky:{description:"Pin the strip below the header. `false` in stories — nothing scrolls."}}},i={args:{total:0,hasCollections:!1},play:async({canvasElement:a})=>{const e=o(a);await t(e.queryByRole("button")).not.toBeInTheDocument(),await t(e.queryByRole("searchbox")).not.toBeInTheDocument()}},c={args:{total:0,hasCollections:!0},play:async({canvasElement:a})=>{const e=o(a);await t(e.getByRole("searchbox",{name:"Search the selection and saved collections"})).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Save as collection"})).not.toBeInTheDocument(),await t(e.queryByRole("button",{name:"More"})).not.toBeInTheDocument()}},l={args:{total:12}},d={args:{total:47}},h={play:async({args:a,canvasElement:e})=>{const r=o(e).getByRole("button",{name:"Save as collection"});await t(r).toBeInTheDocument(),await n.click(r),await t(a.onSaveCollection).toHaveBeenCalled(),await t(a.onClearAll).not.toHaveBeenCalled()}},p={play:async({args:a,canvasElement:e})=>{const s=o(e);await n.type(s.getByRole("searchbox",{name:"Search the selection and saved collections"}),"mark"),await t(a.onQueryChange).toHaveBeenCalled()}},m={args:{total:1834},play:async({canvasElement:a})=>{const e=o(a);await n.click(e.getByRole("button",{name:"More"})),await n.click(e.getByRole("button",{name:"Clear all"})),await t(e.getByText("Clear all 1,834 entities? This cannot be undone.")).toBeInTheDocument()}},u={play:async({canvasElement:a})=>{const e=o(a),s=e.getByRole("button",{name:"More"});await t(s).toHaveAttribute("aria-expanded","false"),await n.click(s),await t(s).toHaveAttribute("aria-expanded","true"),await n.click(e.getByRole("button",{name:"Clear all"}));const r=o(e.getByRole("dialog",{name:"Clear all selected entities?"}));await t(r.getByText("Clear all 12 entities? This cannot be undone.")).toBeInTheDocument(),await n.click(r.getByRole("button",{name:"Clear all"}))}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    total: 0,
    hasCollections: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Nothing ticked and nothing saved — no verbs, nothing to search, so no band.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    total: 0,
    hasCollections: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('searchbox', {
      name: 'Search the selection and saved collections'
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Save as collection'
    })).not.toBeInTheDocument();
    // No tier content either, so the strip does not render a More onto a dead region.
    await expect(canvas.queryByRole('button', {
      name: 'More'
    })).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:`Nothing ticked, but the org has saved collections. The band survives for the
search field; both verbs are absent because neither has an object — not
present-and-disabled.`,...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    total: 12
  }
}`,...l.parameters?.docs?.source},description:{story:"A single-kind basket — the strip is identical whatever the basket holds; only the count varies.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    total: 47
  }
}`,...d.parameters?.docs?.source},description:{story:"A basket spanning several kinds — `Clear all`'s object is the whole basket regardless.",...d.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', {
      name: 'Save as collection'
    });
    await expect(save).toBeInTheDocument();
    await userEvent.click(save);
    await expect(args.onSaveCollection).toHaveBeenCalled();
    // Saving is the page's primary and never hides behind the tier.
    await expect(args.onClearAll).not.toHaveBeenCalled();
  }
}`,...h.parameters?.docs?.source},description:{story:"`Save as collection` is in the row, and pressing it opens the modal rather than saving in place.",...h.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Search the selection and saved collections'
    }), 'mark');
    await expect(args.onQueryChange).toHaveBeenCalled();
  }
}`,...p.parameters?.docs?.source},description:{story:"Typing in the sub-row reports every keystroke to the page that owns the query.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    total: 1834
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'More'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear all'
    }));
    await expect(canvas.getByText('Clear all 1,834 entities? This cannot be undone.')).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"A large partition — the confirm modal's count is still stated in full, not rounded or hedged.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear all'
    }));
    const dialog = within(canvas.getByRole('dialog', {
      name: 'Clear all selected entities?'
    }));
    await expect(dialog.getByText('Clear all 12 entities? This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', {
      name: 'Clear all'
    }));
  }
}`,...u.parameters?.docs?.source},description:{story:"`More` is a real disclosure into the tier, and the tier's `Clear all` opens a\nconfirm modal stating the consequence in plain language before anything is\ncleared.",...u.parameters?.docs?.description}}};const C=["Empty","EmptyBasketWithCollections","OneKind","MixedKinds","SaveIsInTheRow","SearchReportsTyping","LargePartition","ConfirmClearAll"];export{u as ConfirmClearAll,i as Empty,c as EmptyBasketWithCollections,m as LargePartition,d as MixedKinds,l as OneKind,h as SaveIsInTheRow,p as SearchReportsTyping,C as __namedExportsOrder,B as default};
