import{C as y}from"./CauseWorklist-BP5lMtA6.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./CauseWorklistRow-CE38mMU8.js";import"./ClauseGroupList-0V5tF3Gv.js";import"./groupContext-D0LcfWax.js";import"./ruleExpression-nPAdgj2W.js";import"./membershipAnalysis-CAnarCAG.js";const{expect:l,fn:h,userEvent:f,within:E}=__STORYBOOK_MODULE_TEST__,g=(u,n,m)=>({node:"leaf",expressionText:u,resolvedValue:n,status:"fail",reads:[{path:m,value:n}]}),p={groupId:"00gFAKE001",groupName:"Engineering — Platform",remedy:"blocked-by-attribute",ruleId:"0prFAKE001",ruleName:"Platform engineers",failingClauses:[g('user.department == "Platform"',"Support","user.department"),g('user.title != "Contractor"',"Contractor","user.title")]},A={groupId:"00gFAKE002",groupName:"VPN Access",remedy:"excluded-by-rule",ruleId:"0prFAKE002",ruleName:"All full-time staff get VPN",failingClauses:[]},w={groupId:"00gFAKE003",groupName:"Finance Approvers",remedy:"manual-add",failingClauses:[]},e={groupId:"00gFAKE004",groupName:"Regional Leads",remedy:"cannot-determine",undeterminedReason:"unevaluable-clause",ruleId:"0prFAKE004",ruleName:"Leads by region",failingClauses:[]},O={title:"Users/Comparison/CauseWorklist",component:y,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The comparison worklist: every group the compared user has and the context user lacks, grouped by **remedy** — the action that would close the gap.\n\n`cannot-determine` is a first-class group. It never folds into another remedy, is never hidden because it is short, and is rendered **neutral** — not `danger` (nothing resolved to false) and not `warning` (nothing is wrong; we simply could not tell). Its `undeterminedReason` becomes a sentence saying why.\n\nThree empty states are deliberately distinct: `causes` absent means *not computed*, `causes` empty means *computed and nothing found*, and a remedy group with no rows is simply not rendered."}}},args:{contextName:"Jane Doe",comparedName:"John Smith",causes:[p,A,w,e],onViewClauses:h()},argTypes:{causes:{description:'Access differences classified by remedy. Absent means "not computed" — rendered differently from an empty array.'},contextName:{description:"Display name for the context user (the one who lacks access)."},comparedName:{description:"Display name for the compared user (the one who has it)."},onViewClauses:{description:"Opens the full clause checklist for one cause. Omitted, rows offer no jump."}}},r={},o={args:{causes:[e,{...e,groupId:"00gFAKE005",groupName:"Contractors — EMEA"},{...e,groupId:"00gFAKE006",groupName:"Data Stewards",undeterminedReason:"needs-group-context"},{...e,groupId:"00gFAKE007",groupName:"Payroll Admins",undeterminedReason:"ambiguous-attribution"},{...e,groupId:"00gFAKE008",groupName:"Beta Testers",undeterminedReason:"no-rule-inventory"},{...e,groupId:"00gFAKE009",groupName:"On-call Rotation",undeterminedReason:"no-condition"}]}},a={args:{causes:[...Array.from({length:8},(u,n)=>({...p,groupId:`00gFAKEB${n}`,groupName:`Engineering — Squad ${n+1}`})),e]}},s={args:{causes:void 0}},t={args:{causes:[]}},i={args:{causes:[{...p,groupId:"00gFAKELONG",groupName:"Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete",ruleName:"All Workday-provisioned contractors in EMEA with a read-only entitlement on the identity platform"}]}},d={args:{onViewClauses:void 0}},c={args:{causes:[p]},play:async({canvasElement:u,args:n})=>{const m=E(u);await f.click(m.getByRole("button",{name:"Open clause checklist"})),await l(n.onViewClauses).toHaveBeenCalledWith(l.objectContaining({groupId:"00gFAKE001"}))}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"All four remedies present, each in its own group.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    causes: [undetermined, {
      ...undetermined,
      groupId: '00gFAKE005',
      groupName: 'Contractors — EMEA'
    }, {
      ...undetermined,
      groupId: '00gFAKE006',
      groupName: 'Data Stewards',
      undeterminedReason: 'needs-group-context'
    }, {
      ...undetermined,
      groupId: '00gFAKE007',
      groupName: 'Payroll Admins',
      undeterminedReason: 'ambiguous-attribution'
    }, {
      ...undetermined,
      groupId: '00gFAKE008',
      groupName: 'Beta Testers',
      undeterminedReason: 'no-rule-inventory'
    }, {
      ...undetermined,
      groupId: '00gFAKE009',
      groupName: 'On-call Rotation',
      undeterminedReason: 'no-condition'
    }]
  }
}`,...o.parameters?.docs?.source},description:{story:"Every difference was undeterminable — the neutral group stands alone.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    causes: [...Array.from({
      length: 8
    }, (_, i) => ({
      ...blocked,
      groupId: \`00gFAKEB\${i}\`,
      groupName: \`Engineering — Squad \${i + 1}\`
    })), undetermined]
  }
}`,...a.parameters?.docs?.source},description:{story:"One `cannot-determine` row keeps its own group beside a large `blocked-by-attribute`\none: never folded in, never dropped for being short.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    causes: undefined
  }
}`,...s.parameters?.docs?.source},description:{story:"`causes` absent: nothing has been computed, so nothing has been ruled out.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    causes: []
  }
}`,...t.parameters?.docs?.source},description:{story:"`causes` empty: computed, and there is nothing to explain.",...t.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    causes: [{
      ...blocked,
      groupId: '00gFAKELONG',
      groupName: 'Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete',
      ruleName: 'All Workday-provisioned contractors in EMEA with a read-only entitlement on the identity platform'
    }]
  }
}`,...i.parameters?.docs?.source},description:{story:"A pathologically long group name must wrap, never overflow the panel.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    onViewClauses: undefined
  }
}`,...d.parameters?.docs?.source},description:{story:"Without `onViewClauses` the rows still show their evidence, but offer no jump.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    causes: [blocked]
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open clause checklist'
    }));
    await expect(args.onViewClauses).toHaveBeenCalledWith(expect.objectContaining({
      groupId: '00gFAKE001'
    }));
  }
}`,...c.parameters?.docs?.source},description:{story:"The jump hands back the cause whose row it sits in, not merely the fact of a click.",...c.parameters?.docs?.description}}};const R=["AllRemedies","OnlyCannotDetermine","SingleCannotDetermineBesideLargeGroup","NotComputed","Empty","LongGroupName","WithoutClauseDeepLink","OpeningTheClauseChecklist"];export{r as AllRemedies,t as Empty,i as LongGroupName,s as NotComputed,o as OnlyCannotDetermine,c as OpeningTheClauseChecklist,a as SingleCannotDetermineBesideLargeGroup,d as WithoutClauseDeepLink,R as __namedExportsOrder,O as default};
