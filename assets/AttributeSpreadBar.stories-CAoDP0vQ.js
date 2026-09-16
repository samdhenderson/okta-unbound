import{j as c}from"./iframe-tAvKsVeF.js";import{A as u}from"./AttributeSpreadBar-BFtTzm-q.js";import{N as i,O as l}from"./memberAnalytics-BqndU7JT.js";import"./preload-helper-PPVm8Dsz.js";import"./chartPalette-Byit8206.js";const p=[{value:"Engineering",label:"Engineering",count:402,pct:31},{value:"Sales",label:"Sales",count:288,pct:22},{value:"Support",label:"Support",count:190,pct:15},{value:"Finance",label:"Finance",count:120,pct:9},{value:i,label:"(none)",count:52,pct:4},{value:l,label:"Other (14 values)",count:232,pct:18}],v={title:"Groups/AttributeSpreadBar",component:u,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"One attribute's value composition as a single segmented bar: how the populated part is distributed, which the card states nowhere else.\n\nBlanks get no segment — an absence is not a value people share — and the folded tail is hatched rather than tinted so it does not read as one more value. The bar is `aria-hidden`: it carries proportions and no labels, over content the card states in text one disclosure away."}}},argTypes:{rows:{description:"One attribute's distribution rows."},className:{description:"Layout classes only — never colour."}},args:{rows:p},decorators:[n=>c.jsx("div",{className:"w-72",children:c.jsx(n,{})})]},e={},a={args:{rows:p.filter(n=>n.value!==l)}},r={args:{rows:[{value:"Engineering",label:"Engineering",count:1284,pct:100}]}},s={args:{rows:Array.from({length:9},(n,o)=>({value:`V${o}`,label:`Value ${o}`,count:100-o*8,pct:11}))}},t={args:{rows:[{value:i,label:"(none)",count:1284,pct:100}]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Four named values, a blank bucket that is excluded, and a hatched tail.",...e.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    rows: rows.filter(row => row.value !== OTHER_VALUE)
  }
}`,...a.parameters?.docs?.source},description:{story:"Nothing folded away — every segment is a named value.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [{
      value: 'Engineering',
      label: 'Engineering',
      count: 1284,
      pct: 100
    }]
  }
}`,...r.parameters?.docs?.source},description:{story:"One value holds the whole group: a single segment, full width.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    rows: Array.from({
      length: 9
    }, (_, i) => ({
      value: \`V\${i}\`,
      label: \`Value \${i}\`,
      count: 100 - i * 8,
      pct: 11
    }))
  }
}`,...s.parameters?.docs?.source},description:{story:"More values than the ramp has stops: the extras reuse the last stop rather than wrapping.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [{
      value: NONE_VALUE,
      label: '(none)',
      count: 1284,
      pct: 100
    }]
  }
}`,...t.parameters?.docs?.source},description:{story:"Every member blank: the bar renders nothing rather than an empty track posing as a reading.",...t.parameters?.docs?.description}}};const w=["Default","NoTail","SingleValue","MoreValuesThanRampStops","OnlyBlanks"];export{e as Default,s as MoreValuesThanRampStops,a as NoTail,t as OnlyBlanks,r as SingleValue,w as __namedExportsOrder,v as default};
