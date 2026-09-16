import{E as p}from"./ExportPreviewTable-CMCHHMCx.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const n=[{id:"id",label:"User ID",group:"base",defaultEnabled:!0,accessor:e=>e.id},{id:"status",label:"Status",group:"base",defaultEnabled:!0,accessor:e=>e.status},{id:"email",label:"Email",group:"profile",defaultEnabled:!0,accessor:e=>e.email}],i=Array.from({length:12},(e,d)=>({id:`00uFAKE${String(d).padStart(4,"0")}`,status:d%3===0?"SUSPENDED":"ACTIVE",email:`user${d}@example.com`})),m={title:"Export/ExportPreviewTable",component:p,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Read-only preview of the first rows an export will produce, using the exact projection the engine uses. Empty results self-diagnose: "the server returned nothing" and "every row was dropped by schema validation" are distinct states.'}}},argTypes:{columns:{description:"Enabled columns, in catalog order (headers + projection order)."},rows:{description:"All fetched rows; only the first 100 are shown."},fetched:{description:"Total raw rows the server returned (before validation)."},dropped:{description:"Rows skipped for failing schema validation."},capped:{description:"Whether the descriptor's row cap was hit."},linkify:{description:"Optional deep-link configuration for one column."},oktaOrigin:{description:"Okta org origin used to build the deep links."}},args:{columns:n,rows:i,fetched:i.length,dropped:0,capped:!1,linkify:{idColumnId:"id",target:e=>({type:"user",id:e.id})},oktaOrigin:"https://example.okta.com"}},r={},s={args:{fetched:i.length+3,dropped:3}},o={args:{capped:!0}},t={args:{rows:[],fetched:0}},a={args:{rows:[],fetched:12,dropped:12}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"A typical preview with deep-linked ids.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    fetched: rows.length + 3,
    dropped: 3
  }
}`,...s.parameters?.docs?.source},description:{story:"Some rows failed schema validation and were skipped.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    capped: true
  }
}`,...o.parameters?.docs?.source},description:{story:"The export hit the descriptor's row cap.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [],
    fetched: 0
  }
}`,...t.parameters?.docs?.source},description:{story:"The server returned nothing.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [],
    fetched: 12,
    dropped: 12
  }
}`,...a.parameters?.docs?.source},description:{story:"Rows were returned but every one failed validation.",...a.parameters?.docs?.description}}};const h=["Default","WithDropped","Capped","Empty","AllDropped"];export{a as AllDropped,o as Capped,r as Default,t as Empty,s as WithDropped,h as __namedExportsOrder,m as default};
