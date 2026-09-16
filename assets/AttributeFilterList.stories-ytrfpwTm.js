import{A as o}from"./AttributeFilterList-URvyoqeI.js";import{b as i}from"./memberAnalytics-BqndU7JT.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:n,fn:c,userEvent:l}=__STORYBOOK_MODULE_TEST__,d=Array.from({length:30},(s,e)=>({id:`00uFAKE${e+1}`,status:"ACTIVE",profile:{login:`member${e+1}@example.com`,email:`member${e+1}@example.com`,firstName:`First${e+1}`,lastName:`Last${e+1}`,department:["Engineering","Support","Finance"][e%3],title:e%2===0?"Manager":"Individual Contributor",costCenter:`CC-${100+e%9}`}})),p=i(d),y={title:"Members/AttributeFilterList",component:o,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'Inside the filter drawer an attribute is a route to a value, not a report: picking one opens `BreakdownDetailsModal` over that attribute’s distribution, and picking a value there filters the member list. Each row is the shared `ListRow as="button"` and carries an accessible name saying what activating it does.'}}},args:{attributes:p,filteredKeys:new Set,onSelect:c()}},t={play:async({args:s,canvas:e})=>{await l.click(e.getByRole("button",{name:"Department: choose a value to filter by"})),await n(s.onSelect).toHaveBeenCalledWith("department")}},a={args:{filteredKeys:new Set(["department"])}},r={args:{attributes:[]},play:async({canvas:s})=>{await n(s.getByText(/there is nothing to filter by/)).toBeVisible()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Department: choose a value to filter by'
    }));
    await expect(args.onSelect).toHaveBeenCalledWith('department');
  }
}`,...t.parameters?.docs?.source},description:{story:"Every discovered attribute, none of them filtering yet.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    filteredKeys: new Set(['department'])
  }
}`,...a.parameters?.docs?.source},description:{story:"An attribute currently filtering the list reads as selected.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    attributes: []
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText(/there is nothing to filter by/)).toBeVisible();
  }
}`,...r.parameters?.docs?.source},description:{story:"No browseable profile attribute at all — said in words, not left as an empty box.",...r.parameters?.docs?.description}}};const f=["Default","OneAttributeFiltering","NothingToFilterBy"];export{t as Default,r as NothingToFilterBy,a as OneAttributeFiltering,f as __namedExportsOrder,y as default};
