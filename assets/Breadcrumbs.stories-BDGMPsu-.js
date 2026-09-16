import{a8 as m}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:c,fn:o,userEvent:d,within:u}=__STORYBOOK_MODULE_TEST__,b={title:"Shared/Breadcrumbs",component:m,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Ordered `nav > ol` trail for push/pop sub-navigation inside a tab, shaped to the `trail` `useViewStack` returns. Every crumb but the last is a button back up the trail; the last is the current view and renders as text carrying `aria-current="page"`. Labels truncate rather than wrap.'}}},argTypes:{items:{description:"The trail, root-first. The last item is treated as the current view."},size:{description:"Density preset — `sm` is the compact side-panel default."},ariaLabel:{description:"Accessible name for the `nav` landmark. Defaults to `Breadcrumb`."},className:{description:"Extra classes on the `nav` wrapper."}},args:{items:[{key:"root",label:"Groups",onSelect:o()},{key:"detail",label:"Engineering"}]}},e={},r={args:{items:[{key:"root",label:"Groups"}]}},t={args:{items:[{key:"root",label:"Groups",onSelect:o()},{key:"g1",label:"Engineering",onSelect:o()},{key:"g2",label:"Engineering — Platform",onSelect:o()},{key:"g3",label:"Members"}]},play:async({args:l,canvasElement:p})=>{const i=u(p);await c(i.getByText("Members")).toHaveAttribute("aria-current","page"),await c(i.queryByRole("button",{name:"Members"})).toBeNull(),await d.click(i.getByRole("button",{name:"Engineering"})),await c(l.items[1].onSelect).toHaveBeenCalledTimes(1)}},a={args:{items:[{key:"root",label:"Groups",onSelect:o()},{key:"detail",label:"Corp — Engineering — Platform — Identity Infrastructure — On Call"}]}},n={args:{size:"md"}},s={args:{items:[]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"A one-level drill-down: list → detail.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      key: 'root',
      label: 'Groups'
    }]
  }
}`,...r.parameters?.docs?.source},description:{story:"The root view, where the only crumb is the current one.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      key: 'root',
      label: 'Groups',
      onSelect: fn()
    }, {
      key: 'g1',
      label: 'Engineering',
      onSelect: fn()
    }, {
      key: 'g2',
      label: 'Engineering — Platform',
      onSelect: fn()
    }, {
      key: 'g3',
      label: 'Members'
    }]
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Members')).toHaveAttribute('aria-current', 'page');
    await expect(canvas.queryByRole('button', {
      name: 'Members'
    })).toBeNull();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Engineering'
    }));
    await expect(args.items[1].onSelect).toHaveBeenCalledTimes(1);
  }
}`,...t.parameters?.docs?.source},description:{story:"A deep stack — every ancestor is actionable, the current view is not.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      key: 'root',
      label: 'Groups',
      onSelect: fn()
    }, {
      key: 'detail',
      label: 'Corp — Engineering — Platform — Identity Infrastructure — On Call'
    }]
  }
}`,...a.parameters?.docs?.source},description:{story:"Long labels truncate instead of wrapping the header.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...n.parameters?.docs?.source},description:{story:"The `md` density, for use outside the compact side-panel header.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...s.parameters?.docs?.source},description:{story:"Nothing renders for an empty trail.",...s.parameters?.docs?.description}}};const h=["Default","RootOnly","DeepStack","LongLabels","SizeMedium","Empty"];export{t as DeepStack,e as Default,s as Empty,a as LongLabels,r as RootOnly,n as SizeMedium,h as __namedExportsOrder,b as default};
