import{W as l}from"./WorkingSetRow-CLgaur2H.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./dateFormat-tpkRVL7u.js";const{expect:r,fn:c,userEvent:p,within:g}=__STORYBOOK_MODULE_TEST__,s=1440*60*1e3,w={title:"Home/WorkingSetRow",component:l,tags:["autodocs"],parameters:{docs:{description:{component:'One entity in the Home tab’s working set. The row opens the entity and carries its own drop control, so it uses the shared `StretchedButton` overlay rather than `ListRow as="button"` — nesting a button inside a button is an axe `nested-interactive` violation.\n\nThe secondary line names the pane you left off on only when the rung reported one; a rung with no pane shows its kind alone rather than an invented location. The age is omitted for anything seen today.'}}},argTypes:{entry:{description:"The remembered entity."},onOpen:{description:"Open it on its owning tab."},pinned:{description:"Whether this is a pin — changes the drop verb from Forget to Unpin."},onDrop:{description:"Release a pin, or forget a recent."}},args:{onOpen:c(),onDrop:c(),pinned:!0,entry:{kind:"group",id:"00gFAKE0000000000001",name:"Engineering",lastPane:"Members",lastSeenAt:Date.now()}}},e={play:async({args:o,canvasElement:d})=>{const i=g(d);await p.click(i.getByRole("button",{name:"Open group"})),await r(o.onOpen).toHaveBeenCalledTimes(1),await p.click(i.getByRole("button",{name:"Unpin Engineering"})),await r(o.onDrop).toHaveBeenCalledTimes(1),await r(o.onOpen).toHaveBeenCalledTimes(1)}},n={args:{pinned:!1,entry:{kind:"user",id:"00uFAKE0000000000001",name:"Ada Lovelace",lastPane:"Profile",lastSeenAt:Date.now()-3*s}}},t={args:{entry:{kind:"group",id:"00gFAKE0000000000002",name:"Contractors",lastSeenAt:Date.now()-8*s}}},a={args:{entry:{kind:"group",id:"00gFAKE0000000000003",name:"Engineering — Platform — Identity and Access Management — On-call rotation",lastPane:"Insights",lastSeenAt:Date.now()-s}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open group'
    }));
    await expect(args.onOpen).toHaveBeenCalledTimes(1);

    // The trailing control sits above the stretched overlay, so pressing it drops
    // the entry instead of opening it.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Unpin Engineering'
    }));
    await expect(args.onDrop).toHaveBeenCalledTimes(1);
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  }
}`,...e.parameters?.docs?.source},description:{story:"A pinned group, left on its Members pane earlier today.",...e.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    pinned: false,
    entry: {
      kind: 'user',
      id: '00uFAKE0000000000001',
      name: 'Ada Lovelace',
      lastPane: 'Profile',
      lastSeenAt: Date.now() - 3 * DAY
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"A recent user. The drop control says *Forget*, not *Unpin*.",...n.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    entry: {
      kind: 'group',
      id: '00gFAKE0000000000002',
      name: 'Contractors',
      lastSeenAt: Date.now() - 8 * DAY
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"A rung that reported no pane: the line says what it is, and stops.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    entry: {
      kind: 'group',
      id: '00gFAKE0000000000003',
      name: 'Engineering — Platform — Identity and Access Management — On-call rotation',
      lastPane: 'Insights',
      lastSeenAt: Date.now() - DAY
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"A long name truncates rather than pushing the drop control off the row.",...a.parameters?.docs?.description}}};const A=["PinnedGroup","RecentUser","NoPane","LongName"];export{a as LongName,t as NoPane,e as PinnedGroup,n as RecentUser,A as __namedExportsOrder,w as default};
