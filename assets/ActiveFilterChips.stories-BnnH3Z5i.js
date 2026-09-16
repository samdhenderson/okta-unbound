import{j as m,r as y}from"./iframe-tAvKsVeF.js";import{A as p}from"./ActiveFilterChips-DX7-p1iN.js";import"./preload-helper-PPVm8Dsz.js";const{expect:o,fn:l,userEvent:c,within:f}=__STORYBOOK_MODULE_TEST__,u=[{dimension:"status",value:"ACTIVE",label:"Status: Active"},{dimension:"department",value:"Engineering",label:"Department: Engineering"}],T={title:"Members/ActiveFilterChips",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:`Removable chips summarizing the member explorer's active facet filters: one chip per filter with its own remove button, plus a "Clear all" action. Renders nothing when no filters are active.`}}},argTypes:{filters:{description:"Currently active facet filters."},onRemove:{description:"Remove a single filter."},onClearAll:{description:"Remove every active filter."}},args:{filters:u,onRemove:l(),onClearAll:l()}},t={},n={args:{filters:[u[0]]}},a={args:{filters:[{dimension:"status",value:"ACTIVE",label:"Status: Active"},{dimension:"department",value:"Engineering",label:"Department: Engineering"},{dimension:"title",value:"Developer",label:"Title: Developer"},{dimension:"city",value:"Austin",label:"City: Austin"},{dimension:"mfa",value:"enrolled",label:"MFA: Enrolled"}]}},r={args:{filters:[]}},E=()=>{const[s,e]=y.useState([{dimension:"status",value:"ACTIVE",label:"Status: Active"},{dimension:"department",value:"Engineering",label:"Department: Engineering"},{dimension:"city",value:"Austin",label:"City: Austin"}]);return m.jsx(p,{filters:s,onRemove:d=>e(v=>v.filter(g=>g!==d)),onClearAll:()=>e([])})},i={render:()=>m.jsx(E,{}),play:async({canvasElement:s})=>{const e=f(s);await c.click(e.getByRole("button",{name:"Remove Department: Engineering filter"})),await o(e.queryByText("Department: Engineering")).not.toBeInTheDocument(),await o(e.getByText("Status: Active")).toBeInTheDocument(),await c.click(e.getByRole("button",{name:"Clear all"})),await o(e.queryByText("Status: Active")).not.toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:'Two active filter chips with a "Clear all" action.',...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    filters: [sampleFilters[0]]
  }
}`,...n.parameters?.docs?.source},description:{story:"A single active filter.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    filters: [{
      dimension: 'status',
      value: 'ACTIVE',
      label: 'Status: Active'
    }, {
      dimension: 'department',
      value: 'Engineering',
      label: 'Department: Engineering'
    }, {
      dimension: 'title',
      value: 'Developer',
      label: 'Title: Developer'
    }, {
      dimension: 'city',
      value: 'Austin',
      label: 'City: Austin'
    }, {
      dimension: 'mfa',
      value: 'enrolled',
      label: 'MFA: Enrolled'
    }]
  }
}`,...a.parameters?.docs?.source},description:{story:"Many active filters wrapping across lines.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    filters: []
  }
}`,...r.parameters?.docs?.source},description:{story:"No active filters — the component renders nothing.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <RemovableChips />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Remove Department: Engineering filter'
    }));
    await expect(canvas.queryByText('Department: Engineering')).not.toBeInTheDocument();
    await expect(canvas.getByText('Status: Active')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear all'
    }));
    await expect(canvas.queryByText('Status: Active')).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:'Removing one chip leaves the rest; "Clear all" empties the row entirely.',...i.parameters?.docs?.description}}};const D=["Default","SingleFilter","ManyFilters","Empty","Removing"];export{t as Default,r as Empty,a as ManyFilters,i as Removing,n as SingleFilter,D as __namedExportsOrder,T as default};
