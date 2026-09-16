import{a2 as m}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const p={"00gFAKECHIP1":"Engineering — Platform"},f=d=>p[d],v={title:"Shared/GroupReferenceChip",component:m,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'One group an `isMemberOf*` clause named, as a small primary-tinted chip. The satisfied/unsatisfied glyph renders only when `hasContext` says a `RuleGroupContext` was supplied — without one, `reference.satisfied` would read as a verdict on membership nobody checked.\n\nThe three pattern kinds never name a single group, so their label stays a mono-quoted phrase naming the pattern — `startsWith "SecOps-"`.'}}},argTypes:{reference:{description:"The group reference to render."},hasContext:{description:"Whether a `RuleGroupContext` was supplied. Gates the satisfied/unsatisfied glyph."},resolveGroupName:{description:"Names an `id`-match reference's raw id."}},args:{hasContext:!0,resolveGroupName:f}},c={match:"id",value:"00gFAKECHIP1",satisfied:!0,matchedGroupName:"Engineering — Platform"},u={match:"id",value:"00gFAKECHIP9",satisfied:!1},h={match:"name",value:"Contractors — EMEA",satisfied:!0,matchedGroupName:"Contractors — EMEA"},l={match:"nameStartsWith",value:"SecOps-",satisfied:!1},g={match:"nameContains",value:"Platform",satisfied:!0,matchedGroupName:"Engineering — Platform"},S={match:"nameRegex",value:"^Eng-.*",satisfied:!1},e={args:{reference:c}},s={args:{reference:u}},a={args:{reference:h}},r={args:{reference:l}},t={args:{reference:g}},n={args:{reference:S}},i={args:{reference:c,hasContext:!1}},o={args:{reference:{match:"id",value:"00gFAKELONGID001122",satisfied:!0,matchedGroupName:"Engineering-Platform-Infrastructure-Observability"}},parameters:{viewport:{value:"sidepanelCompact"}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    reference: idSatisfied
  }
}`,...e.parameters?.docs?.source},description:{story:"`match: 'id'`, resolved to a name, satisfied — the check glyph, and a copy-id control.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    reference: idUnsatisfied
  }
}`,...s.parameters?.docs?.source},description:{story:"`match: 'id'`, no resolvable name, unsatisfied — the raw id in mono, and the minus glyph.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    reference: nameSatisfied
  }
}`,...a.parameters?.docs?.source},description:{story:"`match: 'name'`, satisfied.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    reference: startsWithUnsatisfied
  }
}`,...r.parameters?.docs?.source},description:{story:"`match: 'nameStartsWith'`, unsatisfied — no single group to name, so the pattern itself is shown.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    reference: containsSatisfied
  }
}`,...t.parameters?.docs?.source},description:{story:"`match: 'nameContains'`, satisfied and resolved to the group it matched.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    reference: regexUnsatisfied
  }
}`,...n.parameters?.docs?.source},description:{story:"`match: 'nameRegex'`, unsatisfied.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    reference: idSatisfied,
    hasContext: false
  }
}`,...i.parameters?.docs?.source},description:{story:"The same satisfied reference with no context: no glyph, because no check was run.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    reference: {
      match: 'id',
      value: '00gFAKELONGID001122',
      satisfied: true,
      matchedGroupName: 'Engineering-Platform-Infrastructure-Observability'
    }
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"A long resolved name at the narrowest panel width; the copy control stays.",...o.parameters?.docs?.description}}};const x=["IdSatisfied","IdUnsatisfied","NameSatisfied","StartsWithUnsatisfied","ContainsSatisfied","RegexUnsatisfied","NoContext","CompactPanel"];export{o as CompactPanel,t as ContainsSatisfied,e as IdSatisfied,s as IdUnsatisfied,a as NameSatisfied,i as NoContext,n as RegexUnsatisfied,r as StartsWithUnsatisfied,x as __namedExportsOrder,v as default};
