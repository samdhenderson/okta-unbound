import{j as e}from"./iframe-tAvKsVeF.js";import{A as n}from"./AppScopeIndicator-DosuQ_3O.js";import"./preload-helper-PPVm8Dsz.js";const d={title:"Users/Comparison/AppScopeIndicator",component:n,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'The per-row marker on an app diff row: how Okta reports the assignment, or why it cannot be reported. A chip is an answer Okta gave (`Direct`, `Via group`); muted italic text is a non-answer (`Source unknown`, `Source not compared`).\n\nOkta returns a single scope per app-user and reports `USER` when a user is both directly assigned and in an assigned group, so `Direct` means "there is a direct assignment", never "direct only".'}}},args:{state:"USER"},argTypes:{state:{description:"Which of the four things a row can say: a scope Okta reported (`USER`/`GROUP`), `unknown` when it reported none, or `notCompared` for a shared row backed by one user's data."}}},r={args:{state:"USER"}},s={args:{state:"GROUP"}},t={args:{state:"unknown"}},o={args:{state:"notCompared"}},a={render:()=>e.jsxs("div",{className:"flex flex-col items-start gap-2",children:[e.jsx(n,{state:"USER"}),e.jsx(n,{state:"GROUP"}),e.jsx(n,{state:"unknown"}),e.jsx(n,{state:"notCompared"})]})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    state: 'USER'
  }
}`,...r.parameters?.docs?.source},description:{story:"Okta reported a direct assignment — which does **not** rule out a group path as well.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    state: 'GROUP'
  }
}`,...s.parameters?.docs?.source},description:{story:"Okta reported the assignment as coming from a group. Which group is not shown.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    state: 'unknown'
  }
}`,...t.parameters?.docs?.source},description:{story:`Okta reported no scope for this row (an unexpanded response, an older cached
result, or a malformed embed). Unknown is not "via group" and not "direct".`,...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    state: 'notCompared'
  }
}`,...o.parameters?.docs?.source},description:{story:`The shared bucket: both users hold the app, but the buckets carry only the
compared user's scope, so no source can be stated for the row as a whole.`,...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col items-start gap-2">
      <AppScopeIndicator state="USER" />
      <AppScopeIndicator state="GROUP" />
      <AppScopeIndicator state="unknown" />
      <AppScopeIndicator state="notCompared" />
    </div>
}`,...a.parameters?.docs?.source},description:{story:"All four states together — the two chips read as answers, the two muted lines as non-answers.",...a.parameters?.docs?.description}}};const m=["Direct","ViaGroup","Unknown","NotCompared","AllStates"];export{a as AllStates,r as Direct,o as NotCompared,t as Unknown,s as ViaGroup,m as __namedExportsOrder,d as default};
