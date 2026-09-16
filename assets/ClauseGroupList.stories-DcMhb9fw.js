import{j as d,B as p}from"./iframe-tAvKsVeF.js";import{C as f}from"./ClauseGroupList-0V5tF3Gv.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,userEvent:h,within:y}=__STORYBOOK_MODULE_TEST__,e=(r={})=>({match:"id",value:"00gFAKEgroup00001",satisfied:!1,...r}),b={title:"Users/Comparison/ClauseGroupList",component:f,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The groups behind a failing group-membership clause. The two polarities are not mirror images: a positive clause failed because none of its groups matched, so every candidate is listed with satisfied entries marked rather than hidden; a negated clause failed because one did match, so only the memberships actually held are shown and the rest are counted.\n\nEach entry is the shared `GroupReferenceChip`, and every state is stated in words (`already in`, `blocking`) — colour never carries a meaning alone."}}},args:{contextName:"Sam"}},n={args:{requirement:"member",references:[e({value:"00gFAKEunion00001"})],resolveGroupName:()=>"us.employees.union",renderGroupAction:()=>d.jsx(p,{size:"sm",variant:"primary",icon:"plus",children:"Add"})}},a={args:{requirement:"member",references:[e({value:"00gFAKEunion00001"})],resolveGroupName:()=>"us.employees.union"}},o={args:{requirement:"member",references:[e({value:"00gFAKEunion00001"}),e({value:"00gFAKEstaff00001"}),e({value:"00gFAKEfte0000001"})],resolveGroupName:r=>({"00gFAKEunion00001":"us.employees.union","00gFAKEstaff00001":"us.employees.staff"})[r],renderGroupAction:()=>d.jsx(p,{size:"sm",variant:"primary",icon:"plus",children:"Add"})}},t={args:{requirement:"member",references:[e({value:"00gFAKEunion00001",satisfied:!0,matchedGroupName:"us.employees.union"}),e({value:"00gFAKEstaff00001"})]}},i={args:{requirement:"member",references:Array.from({length:9},(r,s)=>e({value:`00gFAKEgroup0000${s}`}))},play:async({canvasElement:r})=>{const s=y(r),g=s.getByRole("button",{name:/Show \d+ more groups?/});await h.click(g),await l(s.queryByRole("button",{name:/Show \d+ more groups?/})).toBeNull(),await l(s.getByText("00gFAKEgroup00008")).toBeInTheDocument()}},c={args:{requirement:"non-member",references:[e({value:"00gFAKEcontract01",satisfied:!0,matchedGroupName:"emea.contractors"}),...Array.from({length:19},(r,s)=>e({value:`00gFAKEexcluded${s}`}))],renderGroupAction:()=>d.jsx(p,{size:"sm",variant:"secondary",icon:"external-link",children:"Open group"})}},u={args:{requirement:"member",references:[e({match:"nameStartsWith",value:"sso."})]}},m={args:{requirement:"member",references:[e({value:"00gFAKEunknown0001"})]}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      value: '00gFAKEunion00001'
    })],
    resolveGroupName: () => 'us.employees.union',
    renderGroupAction: () => <Button size="sm" variant="primary" icon="plus">
        Add
      </Button>
  }
}`,...n.parameters?.docs?.source},description:{story:"One prerequisite group, named and offered.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      value: '00gFAKEunion00001'
    })],
    resolveGroupName: () => 'us.employees.union'
  }
}`,...a.parameters?.docs?.source},description:{story:"The resolved-name row: the raw id stays one click away on the chip's copy control.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      value: '00gFAKEunion00001'
    }), ref({
      value: '00gFAKEstaff00001'
    }), ref({
      value: '00gFAKEfte0000001'
    })],
    resolveGroupName: (id: string) => ({
      '00gFAKEunion00001': 'us.employees.union',
      '00gFAKEstaff00001': 'us.employees.staff'
    })[id],
    renderGroupAction: () => <Button size="sm" variant="primary" icon="plus">
        Add
      </Button>
  }
}`,...o.parameters?.docs?.source},description:{story:"`isMemberOfAnyGroup` — any one of these qualifies, and none is held.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      value: '00gFAKEunion00001',
      satisfied: true,
      matchedGroupName: 'us.employees.union'
    }), ref({
      value: '00gFAKEstaff00001'
    })]
  }
}`,...t.parameters?.docs?.source},description:{story:"Partly satisfied: the heading stops promising that joining one would qualify them.",...t.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: Array.from({
      length: 9
    }, (_, i) => ref({
      value: \`00gFAKEgroup0000\${i}\`
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const reveal = canvas.getByRole('button', {
      name: /Show \\d+ more groups?/
    });
    await userEvent.click(reveal);
    await expect(canvas.queryByRole('button', {
      name: /Show \\d+ more groups?/
    })).toBeNull();
    await expect(canvas.getByText('00gFAKEgroup00008')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"More candidates than the preview limit: pressing the reveal lists the rest in place.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'non-member',
    references: [ref({
      value: '00gFAKEcontract01',
      satisfied: true,
      matchedGroupName: 'emea.contractors'
    }), ...Array.from({
      length: 19
    }, (_, i) => ref({
      value: \`00gFAKEexcluded\${i}\`
    }))],
    renderGroupAction: () => <Button size="sm" variant="secondary" icon="external-link">
        Open group
      </Button>
  }
}`,...c.parameters?.docs?.source},description:{story:"The exclusion case: 20 groups excluded, 1 held — only the blocker is shown.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      match: 'nameStartsWith',
      value: 'sso.'
    })]
  }
}`,...u.parameters?.docs?.source},description:{story:"A pattern match names no single group, so no action is offered.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    requirement: 'member',
    references: [ref({
      value: '00gFAKEunknown0001'
    })]
  }
}`,...m.parameters?.docs?.source},description:{story:"Unresolvable: the raw id is the chip's own label, shown once.",...m.parameters?.docs?.description}}};const K=["OnePrerequisite","ResolvedWithCopyableId","AnyOfSeveral","PartlySatisfied","CollapsedCandidates","BlockedByOneOfTwenty","PatternMatch","UnresolvableId"];export{o as AnyOfSeveral,c as BlockedByOneOfTwenty,i as CollapsedCandidates,n as OnePrerequisite,t as PartlySatisfied,u as PatternMatch,a as ResolvedWithCopyableId,m as UnresolvableId,K as __namedExportsOrder,b as default};
