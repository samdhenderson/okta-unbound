import{A as f}from"./AuditLogUndoModal-_WXLSvGO.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:w,userEvent:b,within:y}=__STORYBOOK_MODULE_TEST__,o=(t,e,n)=>({name:t,label:t,beforeDisplay:e,beforeRaw:e,afterDisplay:n,restorable:!0}),v=(t,e,n)=>({name:t,label:t,afterDisplay:e,restorable:!1,omitted:n}),g=t=>({id:"action_profile",type:"UPDATE_USER_PROFILE",timestamp:Date.now()-300*1e3,description:"Updated department, title on Ada Lovelace",status:"completed",metadata:{type:"UPDATE_USER_PROFILE",userId:"00uFAKE0000000000001",userLogin:"user@example.com",userName:"Ada Lovelace",changes:t}}),B=g([o("department","Platform","Engineering"),o("title","Intern","Engineer")]),h=g([o("department","Platform","Engineering"),v("bio","A long biography that exceeded the capture cap","too-large"),o("title","Intern","Engineer"),v("notes","Another long note","too-many"),o("city","","Berlin")]),C={title:"Sidepanel/AuditLogUndoModal",component:f,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The confirmation for undoing a recorded profile write, and the place a refusal is explained. Undo here is a forward write — Okta has no rollback, so restoring an attribute issues a new update that happens to set the old value, and the dialog says so.\n\nThe confirm body lists every attribute `after → before`, naming any whose prior value was never captured. The `drifted` body is a refusal with no confirm button, and shows attribute names only, never values."}}},args:{action:B,onClose:w(),onConfirm:w(),isUndoing:!1},argTypes:{action:{description:"The entry being undone. `null` closes the dialog."},onClose:{description:"Called on Cancel, Escape, overlay click, or the header close button."},onConfirm:{description:"Runs the restoring write. The dialog never calls Okta itself."},isUndoing:{description:"Whether the restoring write is in flight; drives the confirm spinner."},drifted:{description:"Attributes changed in Okta since the original write; present means refused."},error:{description:"Message from a restore that was attempted and did not succeed."}}},r={play:async({canvasElement:t,args:e})=>{const n=y(t.ownerDocument.body);await a(n.getByRole("dialog",{name:"Restore previous values"})).toBeVisible(),await b.click(n.getByRole("button",{name:"Restore"})),await a(e.onConfirm).toHaveBeenCalledTimes(1)}},s={play:async({canvasElement:t,args:e})=>{const n=y(t.ownerDocument.body);await b.click(n.getByRole("button",{name:"Cancel"})),await a(e.onClose).toHaveBeenCalledTimes(1),await a(e.onConfirm).not.toHaveBeenCalled()}},i={args:{action:h},play:async({canvasElement:t})=>{const e=y(t.ownerDocument.body);await a(e.getByText("3 of 5 attributes can be restored.")).toBeVisible(),await a(e.getByText("Previous value was not captured (too large)")).toBeVisible(),await a(e.getByText("Previous value was not captured (too many attributes changed at once)")).toBeVisible()}},c={args:{action:g([o("city","","Berlin")])}},l={args:{drifted:["department","title"]},play:async({canvasElement:t})=>{const e=y(t.ownerDocument.body);await a(e.getByRole("dialog",{name:"Undo refused"})).toBeVisible(),await a(e.queryByRole("button",{name:"Restore"})).toBeNull(),await a(e.getByRole("button",{name:"Close"})).toBeVisible(),await a(e.queryByText(/Platform/)).toBeNull(),await a(e.queryByText(/Engineering/)).toBeNull()}},d={args:{isUndoing:!0}},p={args:{error:"Okta rejected the profile update."},play:async({canvasElement:t})=>{const e=y(t.ownerDocument.body);await a(e.getByRole("alert")).toHaveTextContent("Okta rejected the profile update."),await a(e.getByRole("button",{name:"Restore"})).toBeVisible()}},u={args:{action:null}},m={args:{action:h},parameters:{viewport:{value:"sidepanelCompact"}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('dialog', {
      name: 'Restore previous values'
    })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Restore'
    }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  }
}`,...r.parameters?.docs?.source},description:{story:"Everything can be put back: two attributes, each `after → before`. Restore confirms.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  }
}`,...s.parameters?.docs?.source},description:{story:"Cancel leaves the write unmade: the dialog closes and nothing is confirmed.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    action: partiallyRestorable
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('3 of 5 attributes can be restored.')).toBeVisible();
    await expect(canvas.getByText('Previous value was not captured (too large)')).toBeVisible();
    await expect(canvas.getByText('Previous value was not captured (too many attributes changed at once)')).toBeVisible();
  }
}`,...i.parameters?.docs?.source},description:{story:"Three of five: the two the capture policy dropped are named, with why.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    action: entry([captured('city', '', 'Berlin')])
  }
}`,...c.parameters?.docs?.source},description:{story:"A genuinely empty prior value reads as empty, never as blank space.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    drifted: ['department', 'title']
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('dialog', {
      name: 'Undo refused'
    })).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Restore'
    })).toBeNull();
    await expect(canvas.getByRole('button', {
      name: 'Close'
    })).toBeVisible();
    // Names only: no captured or current value is rendered.
    await expect(canvas.queryByText(/Platform/)).toBeNull();
    await expect(canvas.queryByText(/Engineering/)).toBeNull();
  }
}`,...l.parameters?.docs?.source},description:{story:"The refusal: attributes changed in Okta since the write. No confirm button, no values.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    isUndoing: true
  }
}`,...d.parameters?.docs?.source},description:{story:"The restoring write is in flight; the confirm button carries its own spinner.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    error: 'Okta rejected the profile update.'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('alert')).toHaveTextContent('Okta rejected the profile update.');
    await expect(canvas.getByRole('button', {
      name: 'Restore'
    })).toBeVisible();
  }
}`,...p.parameters?.docs?.source},description:{story:"A restore that was attempted and rejected, retryable without reopening.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    action: null
  }
}`,...u.parameters?.docs?.source},description:{story:"`action: null` — the shared `Modal` renders nothing at all.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    action: partiallyRestorable
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...m.parameters?.docs?.source},description:{story:"The 360px floor, where an attribute's `after → before` pair has to wrap.",...m.parameters?.docs?.description}}};const T=["Default","CancelMakesNoWrite","PartialRestore","RestoringToEmpty","Drifted","Undoing","ErrorState","Closed","Compact"];export{s as CancelMakesNoWrite,u as Closed,m as Compact,r as Default,l as Drifted,p as ErrorState,i as PartialRestore,c as RestoringToEmpty,d as Undoing,T as __namedExportsOrder,C as default};
