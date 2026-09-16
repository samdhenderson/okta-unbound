import{M as p}from"./MemberSourceMeter-BZ5AAva_.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";const e=(c,u,l)=>({ruleId:c,ruleName:u,soleCount:l,oktaAttributedCount:l,clientAttributedCount:0}),t=c=>({total:0,direct:0,ruleBased:0,unattributed:0,byRule:[],multiRuleMembers:0,...c}),m=t({total:70,direct:1,ruleBased:69,byRuleMembers:[e("0prFAKE1","Eng — full-time",44),e("0prFAKE2","Eng — contract",24)],multiRuleMembers:1}),E={title:"Groups/MemberSourceMeter",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Stacked bar + legend answering \"where did this group's members come from?\", with one segment per attributing rule. Segments are mutually exclusive by construction: a member two rules both claim is counted once in `Matched by 2+ rules`, never in either rule.\n\nThe chart ramp's six stops cap the named rules — past that the tail aggregates into `Other rules` and prints how many it folded in. The bar is `aria-hidden`; every number it encodes is printed in the legend as text."}}},argTypes:{breakdown:{description:"The analyzed manual-vs-rule split for the group's members."},maxRules:{description:"How many rules get their own colour before the tail aggregates (default 6)."}},args:{breakdown:m}},a={},s={args:{breakdown:t({total:128,direct:0,ruleBased:128,byRuleMembers:[e("0prFAKE1","All employees",128)]})}},r={args:{breakdown:t({total:96,direct:6,ruleBased:90,byRuleMembers:[e("0prFAKE1","Engineering",30),e("0prFAKE2","Sales",20),e("0prFAKE3","Support",14),e("0prFAKE4","Finance",10),e("0prFAKE5","Legal",6),e("0prFAKE6","Marketing",5),e("0prFAKE7","Facilities",3),e("0prFAKE8","Interns",2)]})}},n={args:{...r.args,maxRules:3}},o={args:{breakdown:t({total:40,direct:8,ruleBased:32,unattributed:12,byRuleMembers:[e("0prFAKE1","Contractors",20)]})}},i={args:{breakdown:t({total:128,direct:32,ruleBased:96})}},d={args:{breakdown:t({})}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Two feeding rules, one shared member, one manual add.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: breakdown({
      total: 128,
      direct: 0,
      ruleBased: 128,
      byRuleMembers: [rule('0prFAKE1', 'All employees', 128)]
    })
  }
}`,...s.parameters?.docs?.source},description:{story:"Every member explained by a single rule — the cleanest possible answer.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: breakdown({
      total: 96,
      direct: 6,
      ruleBased: 90,
      byRuleMembers: [rule('0prFAKE1', 'Engineering', 30), rule('0prFAKE2', 'Sales', 20), rule('0prFAKE3', 'Support', 14), rule('0prFAKE4', 'Finance', 10), rule('0prFAKE5', 'Legal', 6), rule('0prFAKE6', 'Marketing', 5), rule('0prFAKE7', 'Facilities', 3), rule('0prFAKE8', 'Interns', 2)]
    })
  }
}`,...r.parameters?.docs?.source},description:{story:"More rules than the ramp has stops: the tail aggregates and says how many it hid.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    ...OverflowingRules.args,
    maxRules: 3
  }
}`,...n.parameters?.docs?.source},description:{story:"The compact budget the group-list row uses: three named rules, then the tail.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: breakdown({
      total: 40,
      direct: 8,
      ruleBased: 32,
      unattributed: 12,
      byRuleMembers: [rule('0prFAKE1', 'Contractors', 20)]
    })
  }
}`,...o.parameters?.docs?.source},description:{story:"Rules that could not be evaluated client-side: an honest indeterminate segment.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: breakdown({
      total: 128,
      direct: 32,
      ruleBased: 96
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"A breakdown computed before per-rule exclusivity existed: one aggregate segment.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: breakdown({})
  }
}`,...d.parameters?.docs?.source},description:{story:"Nothing analyzed: the meter says so instead of drawing an empty track.",...d.parameters?.docs?.description}}};const A=["Default","SingleRule","OverflowingRules","CompactBudget","WithIndeterminate","AggregateOnly","Empty"];export{i as AggregateOnly,n as CompactBudget,a as Default,d as Empty,r as OverflowingRules,s as SingleRule,o as WithIndeterminate,A as __namedExportsOrder,E as default};
