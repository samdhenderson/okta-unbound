import{j as g,Q as y}from"./iframe-tAvKsVeF.js";import{C as v}from"./CauseWorklistRow-CE38mMU8.js";import"./preload-helper-PPVm8Dsz.js";import"./ClauseGroupList-0V5tF3Gv.js";const{expect:w,fn:h,userEvent:C,within:A}=__STORYBOOK_MODULE_TEST__,a=(e,p,m=[])=>({node:"leaf",expressionText:e,resolvedValue:p,status:"fail",reads:m}),d={groupId:"00gFAKE001",groupName:"Engineering — Platform",remedy:"blocked-by-attribute",ruleId:"0prFAKE001",ruleName:"Platform engineers",failingClauses:[a('user.department == "Platform"',"Support",[{path:"user.department",value:"Support"}])]},F={title:"Users/Comparison/CauseWorklistRow",component:v,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"One group on the cause worklist: its name, the rule it hinges on, the failing-clause evidence, and the jump into the full clause checklist.\n\nA `cannot-determine` row renders its reason as a sentence in the neutral palette — never `danger`, never `warning` — and the clause preview is capped with the remainder counted. Group ids inside the clause text are named by `resolveGroupName`; an id it cannot name keeps its raw quoted form."}}},decorators:[e=>g.jsx(y,{handlers:{group:h()},children:g.jsx("ul",{className:"space-y-2 p-3",children:g.jsx(e,{})})})],args:{cause:d,onViewClauses:h()},argTypes:{cause:{description:"The classified difference. Its group and rule names are untrusted."},onViewClauses:{description:"Opens the full clause checklist for this cause. Omitted, the row offers no jump."},resolveGroupName:{description:"Names the group ids in the rule condition — in the prerequisite lists and inside the failing-clause text alike. Without it, ids stay raw."}}},r={},s={play:async({args:e,canvasElement:p})=>{const m=A(p);await C.click(m.getByRole("button",{name:"Open clause checklist"})),await w(e.onViewClauses).toHaveBeenCalled()}},n={args:{cause:{...d,failingClauses:[a('user.department == "Platform"',"Support"),a('user.title != "Contractor"',"Contractor"),a('user.costCenter == "R&D"',"G&A"),a("user.employeeNumber != null",null),a('user.locale == "en_US"',void 0)]}}},t={args:{cause:{groupId:"00gFAKE003",groupName:"Finance Approvers",remedy:"manual-add",failingClauses:[]}}},o={args:{cause:{groupId:"00gFAKE004",groupName:"Regional Leads",remedy:"cannot-determine",undeterminedReason:"unevaluable-clause",ruleId:"0prFAKE004",ruleName:"Leads by region",failingClauses:[]}}},i={args:{cause:{...d,groupName:"Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete",ruleName:"All Workday-provisioned contractors in EMEA with a read-only entitlement on the identity platform"}}},c={args:{onViewClauses:void 0}},f={...d,remedy:"needs-group-membership",failingClauses:[{node:"leaf",expressionText:'isMemberOfAnyGroup("00gFAKE010", "00gFAKE099")',resolvedValue:void 0,status:"fail",groupRequirement:"member",groupReferences:[{match:"id",value:"00gFAKE010",satisfied:!1},{match:"id",value:"00gFAKE099",satisfied:!1}],reads:[]}]},E=e=>e==="00gFAKE010"?"Platform Engineers":void 0,u={args:{cause:f,resolveGroupName:E}},l={args:{cause:f}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"A blocked row: the rule, the failing clause, and the value that drove it.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open clause checklist'
    }));
    await expect(args.onViewClauses).toHaveBeenCalled();
  }
}`,...s.parameters?.docs?.source},description:{story:"The jump into the clause checklist, exercised.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    cause: {
      ...blocked,
      failingClauses: [failing('user.department == "Platform"', 'Support'), failing('user.title != "Contractor"', 'Contractor'), failing('user.costCenter == "R&D"', 'G&A'), failing('user.employeeNumber != null', null), failing('user.locale == "en_US"', undefined)]
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"More failing clauses than the preview shows — the remainder is counted, not dropped.",...n.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    cause: {
      groupId: '00gFAKE003',
      groupName: 'Finance Approvers',
      remedy: 'manual-add',
      failingClauses: []
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"No rule accounts for the access — nothing to explain, just an action.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    cause: {
      groupId: '00gFAKE004',
      groupName: 'Regional Leads',
      remedy: 'cannot-determine',
      undeterminedReason: 'unevaluable-clause',
      ruleId: '0prFAKE004',
      ruleName: 'Leads by region',
      failingClauses: []
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"Neutral, with a sentence saying why — never a failure treatment.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    cause: {
      ...blocked,
      groupName: 'Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete',
      ruleName: 'All Workday-provisioned contractors in EMEA with a read-only entitlement on the identity platform'
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"A long group and rule name must wrap, never overflow the side panel.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    onViewClauses: undefined
  }
}`,...c.parameters?.docs?.source},description:{story:"Without a host that can navigate, the evidence stays but the jump goes.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    cause: byGroupMembership,
    resolveGroupName
  }
}`,...u.parameters?.docs?.source},description:{story:`With a resolver: the known id reads as its group inside the clause text, and
the unknown one keeps its raw quoted id — a name that is not loaded is never a
reason to show a half-labelled badge.`,...u.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    cause: byGroupMembership
  }
}`,...l.parameters?.docs?.source},description:{story:"The fallback, whole: no resolver at all, so the clause prints exactly as before.",...l.parameters?.docs?.description}}};const G=["BlockedByAttribute","ViewingClauses","ManyFailingClauses","ManualAdd","CannotDetermine","LongGroupName","WithoutClauseDeepLink","GroupIdsNamedInClauseText","GroupIdsUnresolved"];export{r as BlockedByAttribute,o as CannotDetermine,u as GroupIdsNamedInClauseText,l as GroupIdsUnresolved,i as LongGroupName,t as ManualAdd,n as ManyFailingClauses,s as ViewingClauses,c as WithoutClauseDeepLink,G as __namedExportsOrder,F as default};
