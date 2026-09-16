import{j as m}from"./iframe-tAvKsVeF.js";import{M as p}from"./MfaCoverageLauncher-OS434kER.js";import"./preload-helper-PPVm8Dsz.js";import"./EntityChooser-DY08NxvZ.js";import"./ReportRow-DXUM0Iey.js";import"./homeReports-5OcK7tHC.js";import"./orgFigures-Cf-XQIgx.js";const{expect:n,fn:u,userEvent:d,within:i}=__STORYBOOK_MODULE_TEST__,h=[{id:"00gFAKE01",name:"AWS Sandbox 2019",detail:"0 members"},{id:"00gFAKE11",name:"Salesforce Users",detail:"412 members"},{id:"00gFAKE21",name:"Engineering – All",detail:"1,204 members"}],E={title:"Home/MfaCoverageLauncher",component:p,tags:["autodocs"],parameters:{docs:{description:{component:`Home's third report row, and the only one that is not free: MFA coverage is a factor read per member, so this row asks for scope first. Pick a group from the snapshot and land on its Insights pane with the scan armed and deliberately not started.

The read state of the group collection decides whether a chooser is offered at all.`}}},args:{choices:h,status:"ok",onScan:u()},decorators:[a=>m.jsx("ul",{className:"divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white",children:m.jsx(a,{})})]},t={play:async({canvasElement:a})=>{const e=i(a);await n(e.getByRole("button",{expanded:!1,name:/MFA coverage/})).toBeInTheDocument(),await n(e.queryByRole("searchbox")).not.toBeInTheDocument()}},o={play:async({canvasElement:a,args:e})=>{const l=i(a);await d.click(l.getByRole("button",{name:/MFA coverage/})),await n(l.getByText(/not free/)).toBeInTheDocument(),await d.click(l.getByRole("button",{description:"Engineering – All"})),await n(e.onScan).toHaveBeenCalledWith("00gFAKE21")}},s={args:{status:"partial"},play:async({canvasElement:a})=>{const e=i(a);await d.click(e.getByRole("button",{name:/MFA coverage/})),await n(e.getByText(/may simply be unread/)).toBeInTheDocument(),await n(e.getByRole("searchbox",{name:"Filter groups"})).toBeInTheDocument()}},r={args:{choices:[],status:"unavailable"},play:async({canvasElement:a})=>{const e=i(a);await n(e.queryByRole("button")).not.toBeInTheDocument(),await n(e.getByText(/Groups have not been read yet/)).toBeInTheDocument()}},c={args:{choices:[],status:"reading"},play:async({canvasElement:a})=>{const e=i(a);await n(e.queryByRole("button")).not.toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      expanded: false,
      name: /MFA coverage/
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source},description:{story:"Closed. A question, not an answer — and nothing has been read to show it.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /MFA coverage/
    }));
    await expect(canvas.getByText(/not free/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      description: 'Engineering – All'
    }));
    await expect(args.onScan).toHaveBeenCalledWith('00gFAKE21');
  }
}`,...o.parameters?.docs?.source},description:{story:"Opened: the cost first, then the chooser. Picking one hands the id back.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'partial'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /MFA coverage/
    }));
    await expect(canvas.getByText(/may simply be unread/)).toBeInTheDocument();
    await expect(canvas.getByRole('searchbox', {
      name: 'Filter groups'
    })).toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:`The group walk did not finish. Every group the list names is real, so the chooser opens
and says what it cannot promise rather than refusing.`,...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    choices: [],
    status: 'unavailable'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText(/Groups have not been read yet/)).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:`Groups were never read. Inert and recessed, because a filter field over zero rows would
read as "this org has no groups".`,...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    choices: [],
    status: 'reading'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"The first read is still in flight: a skeleton, never an empty chooser.",...c.parameters?.docs?.description}}};const T=["Closed","Opened","Partial","Unavailable","Reading"];export{t as Closed,o as Opened,s as Partial,c as Reading,r as Unavailable,T as __namedExportsOrder,E as default};
