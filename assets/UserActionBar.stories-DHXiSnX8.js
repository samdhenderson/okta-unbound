import{r as w,j as y}from"./iframe-tAvKsVeF.js";import{U as f}from"./UserActionBar-BXR4cHec.js";import{m as O}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";import"./UserLifecycleActions-CwM8dHaQ.js";import"./userDisplay-xpx41Abi.js";const{expect:m,fn:r,userEvent:g,within:b}=__STORYBOOK_MODULE_TEST__,h=(s={})=>({...O[10],status:"ACTIVE",...s}),D={title:"Users/UserActionBar",component:f,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Every verb whose object is the whole user, ranked rather than flattened. The row holds what you reach for while reading — *Add group* (the primary) and *Compare* — and the disclosure tier holds the account-state verbs, so suspending someone is one press further away than comparing them.\n\nThe disclosure belongs to the shared `ActionBar`: it renders **More**, owns the region and owns that region’s `aria-controls` target, which is why there is no disclosure button in this component’s source. Gating follows status — Suspend for `ACTIVE`, Unsuspend for `SUSPENDED`, and a notice instead of the band for `DEPROVISIONED`."}}},args:{user:h(),onCompare:r(),onAddToGroup:r(),isLoadingMemberships:!1,tierOpen:!1,onTierOpenChange:r(),isLifecycleLoading:!1,pendingLifecycleAction:null,onRequestLifecycleAction:r(),onCancelLifecycleAction:r(),onConfirmLifecycleAction:r(),sticky:!1},argTypes:{user:{description:"The user every verb in the strip acts on."},onCompare:{description:"Opens the comparison rung."},onAddToGroup:{description:"Opens the Add-to-Group modal."},isLoadingMemberships:{description:"True while memberships load — both row verbs need them, so both disable."},tierOpen:{description:"Whether the disclosure tier is showing. Owned by the tab, so a rung change collapses it."},onTierOpenChange:{description:"Called with the tier’s next open state when **More** is pressed."},isLifecycleLoading:{description:"True while a confirmed lifecycle action is in flight."},pendingLifecycleAction:{description:"The action awaiting confirmation, or `null`."},sticky:{description:"Pin the strip below the header. `false` in stories — nothing scrolls."}}},t={},n={args:{isLoadingMemberships:!0}},a={args:{tierOpen:!0}},o={args:{tierOpen:!0,user:h({status:"SUSPENDED"})}},i={args:{tierOpen:!0,user:h({status:"DEPROVISIONED"})}},c={args:{tierOpen:!0,isLifecycleLoading:!0}},p={args:{tierOpen:!0,pendingLifecycleAction:"suspend"}},d={render:s=>{const[l,e]=w.useState(!1);return y.jsx(f,{...s,tierOpen:l,onTierOpenChange:e})},play:async({canvasElement:s})=>{const l=b(s),e=l.getByRole("button",{name:"More"});await m(e).toHaveAttribute("aria-expanded","false"),await g.click(e),await m(e).toHaveAttribute("aria-expanded","true"),await m(l.getByRole("button",{name:/Suspend user/})).toBeVisible(),await g.click(e),await m(e).toHaveAttribute("aria-expanded","false")}},u={args:{tierOpen:!0},parameters:{viewport:{value:"sidepanelCompact"}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"The row only: the everyday verbs, with the tier closed behind **More**.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    isLoadingMemberships: true
  }
}`,...n.parameters?.docs?.source},description:{story:"Memberships are still loading, so Compare and Add group are both unavailable.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true
  }
}`,...a.parameters?.docs?.source},description:{story:"An ACTIVE user with the tier open: reset password above the rule, suspend below it.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    user: user({
      status: 'SUSPENDED'
    })
  }
}`,...o.parameters?.docs?.source},description:{story:"A SUSPENDED user: the destructive row becomes the restorative one.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    user: user({
      status: 'DEPROVISIONED'
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"A DEPROVISIONED user: the tier carries the notice rather than a row of disabled buttons.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    isLifecycleLoading: true
  }
}`,...c.parameters?.docs?.source},description:{story:"A lifecycle action is in flight — every verb in the tier is disabled.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    pendingLifecycleAction: 'suspend'
  }
}`,...p.parameters?.docs?.source},description:{story:"The suspend action is armed, so its confirmation modal is open.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [open, setOpen] = useState(false);
    return <UserActionBar {...args} tierOpen={open} onTierOpenChange={setOpen} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const manage = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(manage).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(manage);
    await expect(manage).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', {
      name: /Suspend user/
    })).toBeVisible();
    await userEvent.click(manage);
    await expect(manage).toHaveAttribute('aria-expanded', 'false');
  }
}`,...d.parameters?.docs?.source},description:{story:"More is a real disclosure: `aria-expanded` flips and the tier it reveals is reachable.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...u.parameters?.docs?.source},description:{story:`The 360px floor with the tier open — the width this strip's shape was designed
against, and the reason the label is *Add group* rather than "Add to Group". The
viewport preset resizes the explorer preview only; \`actionBarFit\`'s own tests are
what verify the arithmetic.`,...u.parameters?.docs?.description}}};const x=["Default","LoadingMemberships","TierOpenActive","TierOpenSuspended","TierOpenDeprovisioned","TierOpenLifecycleRunning","ConfirmingSuspend","MoreIsADisclosure","NarrowTierOpen"];export{p as ConfirmingSuspend,t as Default,n as LoadingMemberships,d as MoreIsADisclosure,u as NarrowTierOpen,a as TierOpenActive,i as TierOpenDeprovisioned,c as TierOpenLifecycleRunning,o as TierOpenSuspended,x as __namedExportsOrder,D as default};
