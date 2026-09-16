import{C as n}from"./ComparisonHero-B2VUlJh6.js";import{m as i}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./userDisplay-xpx41Abi.js";const c=i[0],p=i[1],u={title:"Users/Comparison/ComparisonHero",component:n,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Compact header naming both users, with their overall Jaccard match as a tone-coded overlap bar.\n\nWhen the percentage covers less than everything, pass `scopeNote` so the label states what it covers rather than implying a whole-account figure."}}},args:{contextUser:c,comparedUser:p,contextName:"First1 Last1",comparedName:"First2 Last2",similarity:62,isLoading:!1},argTypes:{contextUser:{description:"The context user (left side)."},comparedUser:{description:"The compared user (right side)."},contextName:{description:"Display name for the context user."},comparedName:{description:"Display name for the compared user."},similarity:{description:"Overall similarity as a whole percent (0–100), shown as the label and the bar fill."},scopeNote:{description:'What the percentage covers, when that is less than everything — e.g. "groups only" while the app half could not be read. Appended to the `Match` label.'},isLoading:{description:"When true, renders placeholder glyphs instead of the match percentage."}}},e={},r={args:{similarity:92}},a={args:{similarity:8}},s={args:{similarity:25,scopeNote:"groups only"}},o={args:{isLoading:!0}},t={args:{contextName:"Alexandria Fitzgerald-Montgomery-Whitcombe",comparedName:"Bartholomew Christopherson-Van Der Berg"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Default hero with a mid-range match percentage.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    similarity: 92
  }
}`,...r.parameters?.docs?.source},description:{story:"High overlap (≥75%) renders the percentage and bar in success color.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    similarity: 8
  }
}`,...a.parameters?.docs?.source},description:{story:"Low overlap renders the percentage and bar in neutral color.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    similarity: 25,
    scopeNote: 'groups only'
  }
}`,...s.parameters?.docs?.source},description:{story:"A partial comparison: the app assignments could not be read, so the label says the figure covers groups only.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Loading state shows placeholder glyphs instead of the computed percentage.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    contextName: 'Alexandria Fitzgerald-Montgomery-Whitcombe',
    comparedName: 'Bartholomew Christopherson-Van Der Berg'
  }
}`,...t.parameters?.docs?.source},description:{story:"Long display names truncate within each side without breaking layout.",...t.parameters?.docs?.description}}};const y=["Default","HighMatch","LowMatch","ScopedToGroups","Loading","LongNames"];export{e as Default,r as HighMatch,o as Loading,t as LongNames,a as LowMatch,s as ScopedToGroups,y as __namedExportsOrder,u as default};
