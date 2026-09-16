import{O as m}from"./OperationRow-VYbtlK_2.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./PipelineMeter-BzIGys_V.js";const{expect:d,fn:g,userEvent:h,within:u}=__STORYBOOK_MODULE_TEST__,S={title:"Sidepanel/Activity/OperationRow",component:m,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"One operation and its declared request budget. The budget reads `spent / estimated` plainly — the total the scheduler currently holds, with no qualifier — and the meter beneath renders the same figures. The ✕ stops this operation alone; requests already dispatched are left to settle, because their budget is already spent."}}},argTypes:{operation:{description:"The plan as published by the scheduler."},onCancel:{description:"Stops this operation alone. Omit for a read-only ledger."}},args:{onCancel:g()}},x=176e10;function n(e,r,c=0){return{id:`${e}-leg`,bucket:e,method:"GET",estimated:r,spent:c,remaining:r===null?null:Math.max(0,r-c),approximate:!1}}function a(e){return{startedAt:x,legs:[n("/api/v1/users",50)],spent:0,estimated:50,remaining:50,approximate:!1,...e}}const t={args:{operation:a({id:"export",name:"Export all users",legs:[n("/api/v1/users",50,12)],spent:12,remaining:38})}},s={args:{operation:a({id:"export",name:"Export all users",legs:[n("/api/v1/users",8,3)],spent:3,estimated:8,remaining:5,approximate:!0})}},o={args:{operation:a({id:"scan",name:"Scan group MFA",legs:[n("/api/v1/groups",4,4),n("/api/v1/users",120,31)],spent:35,estimated:124,remaining:89})}},i={args:{operation:a({id:"rules",name:"Capture rule impact",legs:[n("/api/v1/groups",null,6)],spent:6,estimated:null,remaining:null,approximate:!0})}},p={args:{operation:a({id:"export",name:"Export all users",spent:12,remaining:38}),onCancel:void 0},play:async({canvasElement:e})=>{await d(u(e).queryByRole("button")).toBeNull()}},l={args:{operation:a({id:"export",name:"Export all users",legs:[n("/api/v1/users",50,12)],spent:12,remaining:38})},play:async({args:e,canvasElement:r})=>{const c=u(r);await h.click(c.getByRole("button",{name:"Stop Export all users"})),await d(e.onCancel).toHaveBeenCalledWith("export")}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'export',
      name: 'Export all users',
      legs: [leg('/api/v1/users', 50, 12)],
      spent: 12,
      remaining: 38
    })
  }
}`,...t.parameters?.docs?.source},description:{story:"A walk whose page count is known exactly, part-way through.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'export',
      name: 'Export all users',
      legs: [leg('/api/v1/users', 8, 3)],
      spent: 3,
      estimated: 8,
      remaining: 5,
      approximate: true
    })
  }
}`,...s.parameters?.docs?.source},description:{story:"The same walk before the first `Link` header: the floor renders as a plain number.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'scan',
      name: 'Scan group MFA',
      legs: [leg('/api/v1/groups', 4, 4), leg('/api/v1/users', 120, 31)],
      spent: 35,
      estimated: 124,
      remaining: 89
    })
  }
}`,...o.parameters?.docs?.source},description:{story:"Drawing on two buckets at once — which is why one is stalled and the other is not.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'rules',
      name: 'Capture rule impact',
      legs: [leg('/api/v1/groups', null, 6)],
      spent: 6,
      estimated: null,
      remaining: null,
      approximate: true
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"Nothing could be sized up front, so the row reports only what has been spent.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'export',
      name: 'Export all users',
      spent: 12,
      remaining: 38
    }),
    onCancel: undefined
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"Read-only: the ledger without a stop control.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    operation: plan({
      id: 'export',
      name: 'Export all users',
      legs: [leg('/api/v1/users', 50, 12)],
      spent: 12,
      remaining: 38
    })
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Stop Export all users'
    }));
    await expect(args.onCancel).toHaveBeenCalledWith('export');
  }
}`,...l.parameters?.docs?.source},description:{story:"The ✕ stops this operation alone, reporting its plan id.",...l.parameters?.docs?.description}}};const f=["ExactBudget","ApproximateBudget","MultipleBuckets","Unsized","NoCancelControl","Stopping"];export{s as ApproximateBudget,t as ExactBudget,o as MultipleBuckets,p as NoCancelControl,l as Stopping,i as Unsized,f as __namedExportsOrder,S as default};
