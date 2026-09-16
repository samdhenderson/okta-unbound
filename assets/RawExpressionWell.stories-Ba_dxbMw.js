import{j as a,W as n,Q as i}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{fn:c}=__STORYBOOK_MODULE_TEST__,p={"00gFAKEWELL1":"Engineering — Platform"},u=t=>p[t],m={title:"Shared/RawExpressionWell",component:n,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'The raw-condition view `ClauseLedger` shows behind its "Raw expression" toggle: the tenant\'s own EL text in a recessed well, plus a footer stating the whole-expression resolved value. The footer never rounds "cannot tell" to `false` — an `unevaluable` result states the reason in place of a value.'}}},decorators:[t=>a.jsx(i,{handlers:{group:c()},children:a.jsx(t,{})})],argTypes:{expression:{description:"The rule's condition expression (untrusted Okta rule text)."},result:{description:"The authoritative whole-expression verdict. Drives the footer."},resolveGroupName:{description:"Names group ids inside the expression."}},args:{expression:'isMemberOfAnyGroup("00gFAKEWELL1")',resolveGroupName:u}},e={args:{result:{outcome:"match"}}},s={args:{expression:'user.department == "Sales"',result:{outcome:"no-match"}}},r={args:{expression:"user.department ==",result:{outcome:"unevaluable",reasonCode:"parse-error"}}},o={args:{result:void 0}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    result: {
      outcome: 'match'
    }
  }
}`,...e.parameters?.docs?.source},description:{story:"A matching condition: the footer states `true`.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department == "Sales"',
    result: {
      outcome: 'no-match'
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"A condition that does not match: the footer states `false`.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department ==',
    result: {
      outcome: 'unevaluable',
      reasonCode: 'parse-error'
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"An unevaluable condition: the footer states the reason, never `false`.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    result: undefined
  }
}`,...o.parameters?.docs?.source},description:{story:"No user in scope to evaluate against: the footer row is absent, never a dash.",...o.parameters?.docs?.description}}};const h=["Match","NoMatch","Unevaluable","NoEvaluation"];export{e as Match,o as NoEvaluation,s as NoMatch,r as Unevaluable,h as __namedExportsOrder,m as default};
