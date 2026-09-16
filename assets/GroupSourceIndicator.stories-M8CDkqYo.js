import{j as r}from"./iframe-tAvKsVeF.js";import{G as s}from"./GroupSourceIndicator-Dh0LXLeG.js";import"./preload-helper-PPVm8Dsz.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";const a=(t,b)=>({id:t,name:b,status:"ACTIVE",conditionExpression:'user.userType == "Contractor"',groupIds:["00gFAKEgroup0001"],userAttributes:["userType"]}),e=(t={})=>({group:{id:"00gFAKEgroup0001",type:"OKTA_GROUP",profile:{name:"VPN Access"}},membershipType:"RULE_BASED",rules:[a("0prFAKErule00001","Contractors → VPN Access")],attribution:"exact",...t}),N={title:"Users/Comparison/GroupSourceIndicator",component:s,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"The per-row detail on a group diff row: how the membership was granted, and how far that may be trusted. A chip is an answer the classifier proved (`Added by Rule: …`, `Added directly`, `Managed by app`); muted italic text is anything a reader must not act on as proven — a deduction, or a classification that never happened.\n\nIt never credits one rule when the attribution is `ambiguous` (the list is a candidate set), never collapses several attributed rules into one, and never renders an `UNKNOWN` or absent membership as a manual add."}}},args:{membership:e()},argTypes:{membership:{description:"The membership behind the row, carried whole on `DiffItem.membership`. Omitted (app rows, hand-built fixtures) renders nothing at all — never a manual add."}}},o={args:{membership:e()}},i={args:{membership:e({rules:[a("0prFAKErule00001","Contractors → VPN"),a("0prFAKErule00002","EMEA → VPN")]})}},n={args:{membership:e({attribution:"inferred"})}},m={args:{membership:e({attribution:"ambiguous",rules:[a("0prFAKErule00002","Legacy A"),a("0prFAKErule00003","Legacy B")]})}},p={args:{membership:e({membershipType:"DIRECT",rules:[]})}},c={args:{membership:e({membershipType:"UNKNOWN",rules:[],attribution:"ambiguous"})}},u={args:{membership:e({group:{id:"00gFAKEgroup0002",type:"APP_GROUP",profile:{name:"Salesforce Users"}},rules:[]})}},d={args:{membership:void 0}},l={render:t=>r.jsxs("div",{className:"flex w-64 min-w-0 items-center gap-2 border border-neutral-200 p-2",children:[r.jsx("span",{className:"truncate text-sm text-neutral-800",children:"VPN Access"}),r.jsx(s,{...t})]}),args:{membership:e({rules:[a("0prFAKErule00009","All EMEA contractors with a manager in Finance, excluding interns and seasonal staff, provisioned from Workday")]})}},h={render:()=>r.jsxs("div",{className:"flex flex-col items-start gap-2",children:[r.jsx(s,{membership:e()}),r.jsx(s,{membership:e({attribution:"inferred"})}),r.jsx(s,{membership:e({attribution:"ambiguous",rules:[a("0prFAKErule00002","Legacy A"),a("0prFAKErule00003","Legacy B")]})}),r.jsx(s,{membership:e({membershipType:"DIRECT",rules:[]})}),r.jsx(s,{membership:e({membershipType:"UNKNOWN",rules:[],attribution:"ambiguous"})}),r.jsx(s,{membership:void 0})]})};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership()
  }
}`,...o.parameters?.docs?.source},description:{story:"`exact` + one rule: proven, so the rule is named as the source and chipped.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      rules: [rule('0prFAKErule00001', 'Contractors → VPN'), rule('0prFAKErule00002', 'EMEA → VPN')]
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"`exact` + two rules: both really can grant the same membership, so both are named and counted.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      attribution: 'inferred'
    })
  }
}`,...n.parameters?.docs?.source},description:{story:"`inferred`: a rule condition could not be evaluated, so the row hedges and drops the chip.",...n.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      attribution: 'ambiguous',
      rules: [rule('0prFAKErule00002', 'Legacy A'), rule('0prFAKErule00003', 'Legacy B')]
    })
  }
}`,...m.parameters?.docs?.source},description:{story:"`ambiguous`: the rules are a *candidate set*. Every candidate is listed and the\ncount says they are unresolved, so no single rule reads as the answer.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      membershipType: 'DIRECT',
      rules: []
    })
  }
}`,...p.parameters?.docs?.source},description:{story:"`DIRECT`: no active rule explains the membership, so it was added by hand.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      membershipType: 'UNKNOWN',
      rules: [],
      attribution: 'ambiguous'
    })
  }
}`,...c.parameters?.docs?.source},description:{story:"`UNKNOWN`: the rules could not be loaded, so the membership was never\nclassified. Deliberately **not** shown as a direct add.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    membership: membership({
      group: {
        id: '00gFAKEgroup0002',
        type: 'APP_GROUP',
        profile: {
          name: 'Salesforce Users'
        }
      },
      rules: []
    })
  }
}`,...u.parameters?.docs?.source},description:{story:"An `APP_GROUP`: rule-managed by its mastering application, with no group rule to name.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    membership: undefined
  }
}`,...d.parameters?.docs?.source},description:{story:"No membership at all (an app row, or a fixture without one): nothing renders.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex w-64 min-w-0 items-center gap-2 border border-neutral-200 p-2">
      <span className="truncate text-sm text-neutral-800">VPN Access</span>
      <GroupSourceIndicator {...args} />
    </div>,
  args: {
    membership: membership({
      rules: [rule('0prFAKErule00009', 'All EMEA contractors with a manager in Finance, excluding interns and seasonal staff, provisioned from Workday')]
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"A hostile-length rule name truncates inside its chip instead of overflowing the row.",...l.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col items-start gap-2">
      <GroupSourceIndicator membership={membership()} />
      <GroupSourceIndicator membership={membership({
      attribution: 'inferred'
    })} />
      <GroupSourceIndicator membership={membership({
      attribution: 'ambiguous',
      rules: [rule('0prFAKErule00002', 'Legacy A'), rule('0prFAKErule00003', 'Legacy B')]
    })} />
      <GroupSourceIndicator membership={membership({
      membershipType: 'DIRECT',
      rules: []
    })} />
      <GroupSourceIndicator membership={membership({
      membershipType: 'UNKNOWN',
      rules: [],
      attribution: 'ambiguous'
    })} />
      <GroupSourceIndicator membership={undefined} />
    </div>
}`,...h.parameters?.docs?.source},description:{story:"Every state at once — the chips read as answers, the muted lines as non-answers.",...h.parameters?.docs?.description}}};const w=["ExactSingleRule","ExactMultipleRules","Inferred","AmbiguousCandidates","Direct","Unknown","AppManaged","NoMembership","LongRuleName","AllStates"];export{h as AllStates,m as AmbiguousCandidates,u as AppManaged,p as Direct,i as ExactMultipleRules,o as ExactSingleRule,n as Inferred,l as LongRuleName,d as NoMembership,c as Unknown,w as __namedExportsOrder,N as default};
