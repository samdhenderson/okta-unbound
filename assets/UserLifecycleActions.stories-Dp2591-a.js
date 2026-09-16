import{j as g}from"./iframe-tAvKsVeF.js";import{U as y}from"./UserLifecycleActions-CwM8dHaQ.js";import{m as w}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";const{expect:m,fn:u,userEvent:f,within:l}=__STORYBOOK_MODULE_TEST__,d=(e={})=>({...w[10],status:"ACTIVE",...e}),R={title:"Users/UserLifecycleActions",component:y,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`The Manage tier's body on the user-detail rung: the account-state verbs plus their confirmation modal, gated by user status. Reading order is deliberate — the non-destructive verbs first, a rule, then the destructive one alone with its consequence stated beside it.

Offers only the actions valid for the current status: Reset password + Suspend for ACTIVE, Unsuspend for SUSPENDED, Reset password alone for RECOVERY / LOCKED_OUT / PASSWORD_EXPIRED, and a notice for DEPROVISIONED. Presentational: the parent owns the pending-action state and the API call.`}}},decorators:[e=>g.jsx("div",{className:"rounded-b-md border border-neutral-200 bg-white px-4 py-3",children:g.jsx(e,{})})],args:{user:d(),isLifecycleLoading:!1,pendingLifecycleAction:null,onRequestAction:u(),onCancel:u(),onConfirm:u()},argTypes:{user:{description:"The selected user the actions apply to."},isLifecycleLoading:{description:"True while a confirmed action is in flight (disables the trigger buttons)."},pendingLifecycleAction:{description:"The action awaiting confirmation, or null. Drives the confirm modal."},onRequestAction:{description:"Arm the confirm modal for an action."},onCancel:{description:"Dismiss the confirm modal without running the action."},onConfirm:{description:"Run the armed action (the confirm button)."}}},s={play:async({args:e,canvasElement:p})=>{const h=l(p);await f.click(h.getByRole("button",{name:"Suspend user"})),await m(e.onRequestAction).toHaveBeenCalledWith("suspend"),await m(e.onConfirm).not.toHaveBeenCalled()}},t={args:{user:d({status:"SUSPENDED"})}},n={args:{user:d({status:"LOCKED_OUT"})}},r={args:{user:d({status:"DEPROVISIONED"})}},o={args:{isLifecycleLoading:!0}},a={args:{pendingLifecycleAction:"suspend"},play:async({args:e})=>{const p=l(await l(document.body).findByRole("dialog"));await f.click(p.getByRole("button",{name:"Suspend"})),await m(e.onConfirm).toHaveBeenCalledTimes(1)}},i={args:{pendingLifecycleAction:"resetPassword"}},c={parameters:{viewport:{value:"sidepanelCompact"}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The destructive verb arms a confirmation; it never writes on the first press.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Suspend user'
    }));
    await expect(args.onRequestAction).toHaveBeenCalledWith('suspend');
    await expect(args.onConfirm).not.toHaveBeenCalled();
  }
}`,...s.parameters?.docs?.source},description:{story:"ACTIVE user: Reset password above the rule, Suspend user below it.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    user: user({
      status: 'SUSPENDED'
    })
  }
}`,...t.parameters?.docs?.source},description:{story:"SUSPENDED user: the destructive row becomes the restorative one.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    user: user({
      status: 'LOCKED_OUT'
    })
  }
}`,...n.parameters?.docs?.source},description:{story:"LOCKED_OUT user: Reset password only — there is no destructive row to rule off.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    user: user({
      status: 'DEPROVISIONED'
    })
  }
}`,...r.parameters?.docs?.source},description:{story:"DEPROVISIONED user: no actions available, just the notice.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isLifecycleLoading: true
  }
}`,...o.parameters?.docs?.source},description:{story:"An action is in flight — the trigger buttons are disabled.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    pendingLifecycleAction: 'suspend'
  },
  play: async ({
    args
  }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', {
      name: 'Suspend'
    }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  }
}`,...a.parameters?.docs?.source},description:{story:"The suspend action is armed — the confirmation modal is open.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    pendingLifecycleAction: 'resetPassword'
  }
}`,...i.parameters?.docs?.source},description:{story:"The reset-password action is armed — the confirmation modal is open.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...c.parameters?.docs?.source},description:{story:"The 360px floor: the consequence text and its button must wrap, not squeeze.",...c.parameters?.docs?.description}}};const b=["Active","Suspended","LockedOut","Deprovisioned","Loading","ConfirmingSuspend","ConfirmingResetPassword","Narrow"];export{s as Active,i as ConfirmingResetPassword,a as ConfirmingSuspend,r as Deprovisioned,o as Loading,n as LockedOut,c as Narrow,t as Suspended,b as __namedExportsOrder,R as default};
