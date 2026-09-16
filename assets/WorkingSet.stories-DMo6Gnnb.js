import{W as y}from"./WorkingSet-DKwciz0i.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./WorkingSetRow-CLgaur2H.js";import"./dateFormat-tpkRVL7u.js";const{expect:t,fn:d,within:m}=__STORYBOOK_MODULE_TEST__,l=1440*60*1e3,g=[{kind:"group",id:"00gFAKE0000000000001",name:"Engineering",lastPane:"Members",lastSeenAt:Date.now()},{kind:"user",id:"00uFAKE0000000000001",name:"Ada Lovelace",lastPane:"Profile",lastSeenAt:Date.now()-2*l}],u=[{kind:"group",id:"00gFAKE0000000000002",name:"Contractors",lastSeenAt:Date.now()-l},{kind:"user",id:"00uFAKE0000000000002",name:"Grace Hopper",lastPane:"Groups",lastSeenAt:Date.now()-4*l}],f={title:"Home/WorkingSet",component:y,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`The Home tab's second region: what you pinned, and what you were just looking at.

An empty *Pinned* list still renders and says how to fill it — it is the only surface that teaches the pin affordance. *Recent* is absent until it has rows, because it needs no teaching.`}}},argTypes:{pinned:{description:"Entities the reader chose to keep."},recent:{description:"Entities recently opened, most recent first."},onOpen:{description:"Open one on its owning tab."},onUnpin:{description:"Release a pin."},onForget:{description:"Drop a recent."}},args:{pinned:g,recent:u,onOpen:d(),onUnpin:d(),onForget:d()}},a={},o={play:async({args:e,canvas:n,userEvent:p})=>{await p.click(n.getAllByRole("button",{name:"Open group"})[0]),await t(e.onOpen).toHaveBeenCalledWith(g[0]),await p.click(n.getByRole("button",{name:"Unpin Engineering"})),await t(e.onUnpin).toHaveBeenCalledWith(g[0])}},r={play:async({args:e,canvas:n,userEvent:p})=>{await p.click(n.getByRole("button",{name:"Forget Contractors"})),await t(e.onForget).toHaveBeenCalledWith(u[0])}},s={args:{pinned:[],recent:[]},play:async({canvasElement:e})=>{const n=m(e);await t(n.getByText(/Nothing pinned yet/)).toBeInTheDocument(),await t(n.queryByText("Recent")).not.toBeInTheDocument()}},i={args:{pinned:[]}},c={args:{recent:[]},play:async({canvasElement:e})=>{await t(m(e).queryByText("Recent")).not.toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Both lists populated.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    // Two groups are listed — the pinned one leads.
    await userEvent.click(canvas.getAllByRole('button', {
      name: 'Open group'
    })[0]);
    await expect(args.onOpen).toHaveBeenCalledWith(PINS[0]);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Unpin Engineering'
    }));
    await expect(args.onUnpin).toHaveBeenCalledWith(PINS[0]);
  }
}`,...o.parameters?.docs?.source},description:{story:"Opening a row reports the entry; releasing a pin reports it separately.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Forget Contractors'
    }));
    await expect(args.onForget).toHaveBeenCalledWith(RECENTS[0]);
  }
}`,...r.parameters?.docs?.source},description:{story:"A recent row is dropped through Forget, not Unpin — a different verb for a different list.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    pinned: [],
    recent: []
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Nothing pinned yet/)).toBeInTheDocument();
    await expect(canvas.queryByText('Recent')).not.toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"A cold panel: Pinned holds its space and teaches the affordance; Recent is absent entirely.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    pinned: []
  }
}`,...i.parameters?.docs?.source},description:{story:"Nothing pinned, but the reader has been browsing.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    recent: []
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByText('Recent')).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Pins with nothing recent — every recent aged out of the 14-day window.",...c.parameters?.docs?.description}}};const S=["Default","OpeningAndUnpinning","ForgettingARecent","ColdStart","RecentsOnly","PinsOnly"];export{s as ColdStart,a as Default,r as ForgettingARecent,o as OpeningAndUnpinning,c as PinsOnly,i as RecentsOnly,S as __namedExportsOrder,f as default};
