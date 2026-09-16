import{B as p}from"./BreakdownDetailsModal-BoybENQd.js";import{N as u,O as m}from"./memberAnalytics-BqndU7JT.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./BreakdownReport-RtX7G5yn.js";const{expect:i,fn:r,userEvent:l,within:s}=__STORYBOOK_MODULE_TEST__,c=[{value:"Engineering",label:"Engineering",count:420,pct:42},{value:"Sales",label:"Sales",count:210,pct:21},{value:"Marketing",label:"Marketing",count:150,pct:15},{value:"Support",label:"Support",count:90,pct:9},{value:u,label:"(none)",count:60,pct:6},{value:m,label:"Other (3 values)",count:60,pct:6}],b={title:"Members/BreakdownDetailsModal",component:p,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Every value for one composition dimension — including those the summary folded into "Other" — as a scrollable `BreakdownReport`, with a "Copy all" of the real value labels. Each row toggles a member-list filter, and the modal renders nothing while closed.'}}},argTypes:{isOpen:{description:"Whether the modal is open."},onClose:{description:"Close the modal."},title:{description:"Modal heading (usually the dimension's display title)."},rows:{description:"The complete (un-aggregated) value distribution for the dimension."},activeValues:{description:"Canonical values currently active as filters, for row highlighting."},onRowClick:{description:"Toggle a value as a member-list filter."}},args:{isOpen:!0,onClose:r(),title:"Department",rows:c,activeValues:new Set,onRowClick:r()}},e={play:async({args:n})=>{const d=s(await s(document.body).findByRole("dialog"));await l.click(d.getByRole("button",{name:/Sales/})),await i(n.onRowClick).toHaveBeenCalledWith(c[1]),await l.keyboard("{Escape}"),await i(n.onClose).toHaveBeenCalled()}},a={args:{activeValues:new Set(["Sales"])},play:async()=>{const n=s(await s(document.body).findByRole("dialog"));await i(n.getByRole("button",{name:/Sales/})).toHaveAttribute("aria-pressed","true")}},t={args:{rows:[],title:"Cost center"}},o={args:{isOpen:!1},play:async()=>{await i(s(document.body).queryByRole("dialog")).toBeNull()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    args
  }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', {
      name: /Sales/
    }));
    await expect(args.onRowClick).toHaveBeenCalledWith(sampleRows[1]);
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalled();
  }
}`,...e.parameters?.docs?.source},description:{story:'Full value distribution for a dimension, with a "Copy all" affordance.',...e.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    activeValues: new Set(['Sales'])
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByRole('button', {
      name: /Sales/
    })).toHaveAttribute('aria-pressed', 'true');
  }
}`,...a.parameters?.docs?.source},description:{story:"One value is currently active as a member-list filter.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [],
    title: 'Cost center'
  }
}`,...t.parameters?.docs?.source},description:{story:"No values at all — the copy button disables itself.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  },
  play: async () => {
    await expect(within(document.body).queryByRole('dialog')).toBeNull();
  }
}`,...o.parameters?.docs?.source},description:{story:"Closed state renders nothing.",...o.parameters?.docs?.description}}};const f=["Default","WithActiveFilter","Empty","Closed"];export{o as Closed,e as Default,t as Empty,a as WithActiveFilter,f as __namedExportsOrder,b as default};
