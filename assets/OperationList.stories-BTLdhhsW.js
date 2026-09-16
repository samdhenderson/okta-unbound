import{O as v}from"./OperationList-CdprATOK.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./OperationRow-VYbtlK_2.js";import"./PipelineMeter-BzIGys_V.js";const{expect:n,fn:O,userEvent:x,within:d}=__STORYBOOK_MODULE_TEST__,B=176e10;function u(e,a,t=0){return{id:`${e}-leg`,bucket:e,method:"GET",estimated:a,spent:t,remaining:a===null?null:Math.max(0,a-t),approximate:!1}}function m(e){return{startedAt:B,legs:[u("/api/v1/users",50,12)],spent:12,estimated:50,remaining:38,approximate:!1,...e}}const g=m({id:"export",name:"Export all users"}),y=m({id:"scan",name:"Scan group MFA",legs:[u("/api/v1/groups",4,4),u("/api/v1/users",120,31)],spent:35,estimated:124,remaining:89}),h=m({id:"impact",name:"Capture rule impact",legs:[u("/api/v1/groups",null,6)],spent:6,estimated:null,remaining:null,approximate:!0}),w=m({id:"groups",name:"Load all groups"}),f=m({id:"apps",name:"Walk app assignments"}),A={title:"Sidepanel/Activity/OperationList",component:v,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Every operation that has declared a budget, oldest first, so concurrent work reads as several rows rather than one progress bar. Each row is an `OperationRow` with its own stop control.\n\nWith nothing declared the list renders nothing at all, keeping an idle bar slim; past `maxRows` the remainder is counted on one line rather than listed."}}},argTypes:{operations:{description:"Active plans as published by the scheduler, oldest first."},onCancelOperation:{description:"Stops one operation; omit for a read-only ledger."},maxRows:{description:"Cap on listed rows; beyond it the overflow is counted."}},args:{operations:[g,y],onCancelOperation:O()}},o={},r={args:{operations:[g]}},s={args:{operations:[]},play:async({canvasElement:e})=>{await n(d(e).queryByRole("button")).toBeNull()}},i={args:{operations:[g,y,h,w,f]},play:async({canvasElement:e})=>{const a=d(e);await n(a.getByText("+ 2 more operations")).toBeInTheDocument(),await n(a.queryByRole("button",{name:"Stop Walk app assignments"})).toBeNull()}},p={args:{operations:[g,y,h,w]},play:async({canvasElement:e})=>{await n(d(e).getByText("+ 1 more operation")).toBeInTheDocument()}},c={args:{onCancelOperation:void 0},play:async({canvasElement:e})=>{await n(d(e).queryByRole("button")).toBeNull()}},l={play:async({args:e,canvasElement:a})=>{const t=d(a);await x.click(t.getByRole("button",{name:"Stop Scan group MFA"})),await n(e.onCancelOperation).toHaveBeenCalledWith("scan"),await n(t.getByRole("button",{name:"Stop Export all users"})).toBeInTheDocument()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"Two concurrent operations, each with its own budget and buckets.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    operations: [exportUsers]
  }
}`,...r.parameters?.docs?.source},description:{story:"A single operation — the common case while one walk runs.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    operations: []
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  }
}`,...s.parameters?.docs?.source},description:{story:"Nothing declared: the ledger renders nothing rather than an empty panel.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    operations: [exportUsers, scanMfa, captureImpact, loadGroups, walkApps]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('+ 2 more operations')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Stop Walk app assignments'
    })).toBeNull();
  }
}`,...i.parameters?.docs?.source},description:{story:"Past the row cap, the remainder is counted on one line rather than listed.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    operations: [exportUsers, scanMfa, captureImpact, loadGroups]
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByText('+ 1 more operation')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Exactly one over the cap: the overflow line is singular.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    onCancelOperation: undefined
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  }
}`,...c.parameters?.docs?.source},description:{story:"A read-only ledger: no handler wired, so no row offers a stop control.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Stop Scan group MFA'
    }));
    await expect(args.onCancelOperation).toHaveBeenCalledWith('scan');
    await expect(canvas.getByRole('button', {
      name: 'Stop Export all users'
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Stopping one operation reports that plan alone, leaving its neighbour running.",...l.parameters?.docs?.description}}};const C=["Default","SingleOperation","Empty","OverflowCounted","OverflowOfOne","ReadOnly","StoppingOneOperation"];export{o as Default,s as Empty,i as OverflowCounted,p as OverflowOfOne,c as ReadOnly,r as SingleOperation,l as StoppingOneOperation,C as __namedExportsOrder,A as default};
