import{s as a,G as p}from"./groupSourceSummary-srPaUr-6.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";const n={id:"00gFAKE000000000001",name:"Engineering",description:"All engineering staff.",type:"OKTA_GROUP",memberCount:70,hasRules:!0,ruleCount:2,usedInRuleCount:1},e=(m,i,u)=>({ruleId:m,ruleName:i,soleCount:u,oktaAttributedCount:u,clientAttributedCount:0}),c={direct:1,ruleBased:69,unattributed:0,byRuleMembers:[e("0prFAKE1","Eng — full-time",44),e("0prFAKE2","Eng — contract",24)],multiRuleMembers:1},l={direct:6,ruleBased:90,unattributed:0,byRuleMembers:[e("0prFAKE1","Engineering",30),e("0prFAKE2","Sales",25),e("0prFAKE3","Support",20),e("0prFAKE4","Finance",10),e("0prFAKE5","Legal",5)],multiRuleMembers:0},R={title:"Groups/GroupListItemSignal",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'The one-line signal region of a group row: the compact member-source bar, the member count, what the source split says, and the group\'s rule/push facts. The bar is `aria-hidden`, so nothing is available only as colour. A row never fetches — it draws a bar only from a breakdown already banked in the session cache, and otherwise says "Source not analyzed" rather than showing an empty meter.'}}},argTypes:{model:{description:"The derived row model from `groupSourceSummary.summarizeGroupRow`."}},args:{model:a(n,c)}},r={},o={args:{model:a(n,l)}},s={args:{model:a(n,null)}},t={args:{model:a({...n,memberCount:0},null)}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"Two feeding rules plus one member both rules claim.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    model: summarizeGroupRow(group, manyRules)
  }
}`,...o.parameters?.docs?.source},description:{story:"More rules than the compact bar names: the rest aggregate into the tail.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    model: summarizeGroupRow(group, null)
  }
}`,...s.parameters?.docs?.source},description:{story:"Nothing computed for this group yet — the row says so instead of guessing.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    model: summarizeGroupRow({
      ...group,
      memberCount: 0
    }, null)
  }
}`,...t.parameters?.docs?.source},description:{story:"An empty group: no meter, no claim about sources.",...t.parameters?.docs?.description}}};const w=["Default","ManyRules","NotAnalyzed","Empty"];export{r as Default,t as Empty,o as ManyRules,s as NotAnalyzed,w as __namedExportsOrder,R as default};
