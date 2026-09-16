import{j as o,ai as m}from"./iframe-tAvKsVeF.js";import{I as e,a as g,C as l,M as i}from"./chartPalette-Byit8206.js";import"./preload-helper-PPVm8Dsz.js";const c=[{key:"engineering",title:"Engineering — 402 (31%)",count:402,background:e[0]},{key:"sales",title:"Sales — 288 (22%)",count:288,background:e[1]},{key:"support",title:"Support — 190 (15%)",count:190,background:e[2]},{key:"finance",title:"Finance — 120 (9%)",count:120,background:e[3]},{key:"none",title:"(none) — 52 (4%)",count:52,background:g},{key:"other",title:"Other (14 values) — 232 (18%)",count:232,background:l}],u=[{key:"none",title:"No factors enrolled — 2 (5%)",count:2,background:i.none},{key:"single",title:"One factor — 7 (18%)",count:7,background:i.single},{key:"multiple",title:"Two or more factors — 31 (78%)",count:31,background:i.multiple}],k={title:"Shared/SpreadBar",component:m,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"A distribution as a single segmented bar: each segment is sized by `count` through `flex-grow`, so any consistent unit works, and a one-member segment keeps a minimum width. The component owns the geometry only — which colour a segment takes is always the caller’s decision, from the theme chart palette.\n\nThe bar is `aria-hidden` and its tooltips are pointer-only, so a caller that renders it **must** state the same distribution in words somewhere a screen reader reaches. The stories below do that in the caption under each bar."}}},argTypes:{segments:{description:"The segments to draw, in order; empty renders nothing."},className:{description:"Layout classes only — never colour."}},args:{segments:c},decorators:[d=>o.jsxs("div",{className:"w-72 space-y-1",children:[o.jsx(d,{}),o.jsx("p",{className:"text-xs text-neutral-600",children:"The distribution this bar draws is stated in words by whichever card renders it."})]})]},t={},s={args:{segments:u}},n={args:{segments:[c[0]]}},r={args:{segments:[{key:"bulk",title:"Engineering — 999",count:999,background:e[0]},{key:"sliver",title:"Facilities — 1",count:1,background:e[3]}]}},a={args:{segments:[]}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Six segments from the sequential ramp, including a blank bucket and a folded tail.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    segments: mfaSegments
  }
}`,...s.parameters?.docs?.source},description:{story:"A bucket-keyed palette: the same geometry, painted by what each bucket means.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    segments: [rampSegments[0]]
  }
}`,...n.parameters?.docs?.source},description:{story:"One value holds everything: a single full-width segment.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    segments: [{
      key: 'bulk',
      title: 'Engineering — 999',
      count: 999,
      background: INDIGO_RAMP[0]
    }, {
      key: 'sliver',
      title: 'Facilities — 1',
      count: 1,
      background: INDIGO_RAMP[3]
    }]
  }
}`,...r.parameters?.docs?.source},description:{story:"A segment of one against a segment of hundreds still draws wide enough to see.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    segments: []
  }
}`,...a.parameters?.docs?.source},description:{story:"No segments at all: the bar renders nothing rather than an empty track posing as a reading.",...a.parameters?.docs?.description}}};const b=["Default","BucketKeyedPaint","SingleSegment","TinySegment","Empty"];export{s as BucketKeyedPaint,t as Default,a as Empty,n as SingleSegment,r as TinySegment,b as __namedExportsOrder,k as default};
