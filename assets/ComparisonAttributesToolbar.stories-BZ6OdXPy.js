import{C as x}from"./ComparisonAttributesToolbar-dc3pEzSe.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:s,fn:r,userEvent:B,waitFor:w,within:f}=__STORYBOOK_MODULE_TEST__,e=(t,n,o={})=>({key:t,userName:n,cells:{},isEditing:!1,isSaving:!1,hasChanges:!1,hasInvalid:!1,canEdit:!0,begin:r(),cancel:r(),requestSave:r(),...o}),a=e("context","Ada Context"),y=e("compared","Bo Compared"),D={title:"Users/Comparison/ComparisonAttributesToolbar",component:x,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`Everything above the comparison's attribute list: the three filter pills, the search field, the hidden-differences disclosure, and — one per user — the Edit / Cancel / Save controls.

Both edit affordances name their user, because two profiles are on screen and an unqualified "Edit" would write to whichever one the admin was not thinking about. A column whose host cannot publish a save (\`canEdit: false\`) shows nothing at all rather than a disabled control.`}}},args:{filter:"differences",onFilterChange:r(),differenceCount:3,sharedCount:8,totalCount:11,query:"",onQueryChange:r(),hiddenDifferences:1,revealHidden:!1,onToggleHidden:r()},argTypes:{filter:{description:"The active filter pill."},onFilterChange:{description:"Called with the pill the reader chose."},differenceCount:{description:"How many listed rows differ — the Differences pill count."},sharedCount:{description:"How many listed rows agree — the Shared pill count."},totalCount:{description:"How many rows are listed in total — the All pill count."},query:{description:"The current search term."},onQueryChange:{description:"Called with the new search term."},hiddenDifferences:{description:"How many differing attributes the display config hides. `0` renders no disclosure line at all."},revealHidden:{description:"Whether the hidden rows are currently revealed."},onToggleHidden:{description:"Toggles the reveal."},contextEdit:{description:"The left column's editor. Absent renders no editing controls for it."},comparedEdit:{description:"The right column's editor. Absent renders no editing controls for it."}}},i={},d={args:{contextEdit:a,comparedEdit:y},play:async({canvasElement:t})=>{const n=f(t);await w(()=>s(n.getByRole("button",{name:"Edit Ada Context"})).toBeInTheDocument()),s(n.getByRole("button",{name:"Edit Bo Compared"})).toBeInTheDocument()}},c={args:{contextEdit:e("context","Ada Context",{canEdit:!1}),comparedEdit:y},play:async({canvasElement:t})=>{const n=f(t);await w(()=>s(n.getByRole("button",{name:"Edit Bo Compared"})).toBeInTheDocument()),s(n.queryByRole("button",{name:"Edit Ada Context"})).not.toBeInTheDocument()}},p={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{isEditing:!0,hasChanges:!0})},play:async({canvasElement:t})=>{const o=await f(t).findByRole("button",{name:"Save changes to Bo Compared"});s(o).toBeEnabled(),await B.click(o)}},m={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{isEditing:!0})},play:async({canvasElement:t})=>{const o=await f(t).findByRole("button",{name:"Save changes to Bo Compared"});s(o).toBeDisabled()}},l={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{isEditing:!0,hasChanges:!0,hasInvalid:!0})}},h={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{isEditing:!0,hasChanges:!0,isSaving:!0})}},u={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{isEditing:!0,hasChanges:!0,message:{type:"danger",text:"Okta rejected the update: department is not a valid value."}})}},g={args:{contextEdit:a,comparedEdit:e("compared","Bo Compared",{message:{type:"warning",text:"This panel could not confirm whether the change to Bo Compared was saved. Reload the comparison to check before editing again."}})}},E={args:{hiddenDifferences:0,contextEdit:a,comparedEdit:y}},v={args:{revealHidden:!0,hiddenDifferences:2}},C={args:{contextEdit:e("context","Ada Context",{isEditing:!0,hasChanges:!0}),comparedEdit:y},parameters:{viewport:{value:"sidepanelCompact"}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source},description:{story:"No editors passed at all — the toolbar every read-only host renders.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: COMPARED
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('button', {
      name: 'Edit Ada Context'
    })).toBeInTheDocument());
    expect(canvas.getByRole('button', {
      name: 'Edit Bo Compared'
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`Both columns editable and at rest. Each entry point names its user, because
"Edit" alone would not say whose profile is about to be written.`,...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: side('context', 'Ada Context', {
      canEdit: false
    }),
    comparedEdit: COMPARED
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('button', {
      name: 'Edit Bo Compared'
    })).toBeInTheDocument());
    expect(canvas.queryByRole('button', {
      name: 'Edit Ada Context'
    })).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"The context column has no host that can publish a save, so it offers nothing at all.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const save = await canvas.findByRole('button', {
      name: 'Save changes to Bo Compared'
    });
    expect(save).toBeEnabled();
    await userEvent.click(save);
  }
}`,...p.parameters?.docs?.source},description:{story:`One column editing with a change drafted. Save is live; the accessible names
still say whose profile each control acts on.`,...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const save = await canvas.findByRole('button', {
      name: 'Save changes to Bo Compared'
    });
    expect(save).toBeDisabled();
  }
}`,...m.parameters?.docs?.source},description:{story:"Editing with nothing changed yet — Save has nothing to write, so it is disabled.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      hasInvalid: true
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"A drafted value fails validation, so the write is blocked at the control.",...l.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      isSaving: true
    })
  }
}`,...h.parameters?.docs?.source},description:{story:"The confirmed write is in flight: Save loads and Cancel locks.",...h.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      message: {
        type: 'danger',
        text: 'Okta rejected the update: department is not a valid value.'
      }
    })
  }
}`,...u.parameters?.docs?.source},description:{story:"Okta answered and rejected the write. The draft survives, so the column stays in edit mode.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: CONTEXT,
    comparedEdit: side('compared', 'Bo Compared', {
      message: {
        type: 'warning',
        text: 'This panel could not confirm whether the change to Bo Compared was saved. Reload the comparison to check before editing again.'
      }
    })
  }
}`,...g.parameters?.docs?.source},description:{story:"The write may have applied and may not have — `warning`, not `danger`, since\ncollapsing the two would report an unconfirmed write as a failed one.",...g.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    hiddenDifferences: 0,
    contextEdit: CONTEXT,
    comparedEdit: COMPARED
  }
}`,...E.parameters?.docs?.source},description:{story:"Nothing is hidden, so the disclosure line is absent entirely.",...E.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    revealHidden: true,
    hiddenDifferences: 2
  }
}`,...v.parameters?.docs?.source},description:{story:"The hidden rows are revealed, so the control offers to put them back.",...v.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: side('context', 'Ada Context', {
      isEditing: true,
      hasChanges: true
    }),
    comparedEdit: COMPARED
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...C.parameters?.docs?.source},description:{story:`The compact side panel: two named edit affordances do not fit on one 360px line, so
the columns stack rather than truncating a name.`,...C.parameters?.docs?.description}}};const O=["Default","BothEditable","ContextColumnReadOnly","Editing","EditingWithNoChanges","InvalidDraft","Saving","ErrorState","UnconfirmedOutcome","NothingHidden","HiddenRevealed","CompactPanel"];export{d as BothEditable,C as CompactPanel,c as ContextColumnReadOnly,i as Default,p as Editing,m as EditingWithNoChanges,u as ErrorState,v as HiddenRevealed,l as InvalidDraft,E as NothingHidden,h as Saving,g as UnconfirmedOutcome,O as __namedExportsOrder,D as default};
