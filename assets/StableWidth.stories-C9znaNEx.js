import{z as c,j as e}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:d,within:l}=__STORYBOOK_MODULE_TEST__,h={title:"Shared/StableWidth",component:c,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Reserves the width a slot will need by rendering its widest state invisibly in the same grid cell, so a label that changes after mount cannot re-lay-out the `min-w-0` text beside it. A hard-coded `min-w-[…]` would be a guess about a font the panel does not control; the hidden twin lets the browser measure it in the reader's own font.\n\nThe twin is `aria-hidden`, `invisible`, and carries `data-reserve-width`, which the test setup adds to Testing Library's `defaultIgnore` — so a text query sees exactly what a reader sees. It reserves the box but does not stabilise digits: a numeric readout still needs `tabular-nums`."}}},argTypes:{reserve:{description:"The widest state this slot will ever hold."},children:{description:"What is actually shown."},align:{description:"How the live child sits in the reserved box; `start` by default."},className:{description:"Extra classes for the outer box — layout only."}},args:{reserve:"Not evaluated",children:"Pass"}},t={},s={render:()=>e.jsx("div",{className:"max-w-[360px] space-y-2",children:["Pass","Not evaluated"].map(n=>e.jsxs("div",{className:"flex items-start gap-3 rounded-md border p-2",children:[e.jsx("p",{className:"min-w-0 flex-1 font-mono text-xs break-words",children:'user.department == "Engineering" AND isMemberOfAnyGroup("00gFAKE")'}),e.jsx(c,{reserve:"Not evaluated",align:"end",children:e.jsx("span",{className:"rounded-md border px-2 py-0.5 text-xs whitespace-nowrap",children:n})})]},n))})},a={args:{reserve:"00",children:null,align:"center"}},r={args:{reserve:"100%",align:"end",children:e.jsx("span",{className:"font-mono text-sm font-bold tabular-nums",children:"7%"})}},o={args:{reserve:"Not evaluated",children:"Pass"},play:async({canvasElement:n})=>{const i=l(n);await d(i.getByText("Pass")).toBeInTheDocument(),await d(i.queryByText("Not evaluated")).not.toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"The shortest of three labels, holding the width of the longest.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="max-w-[360px] space-y-2">
      {['Pass', 'Not evaluated'].map(label => <div key={label} className="flex items-start gap-3 rounded-md border p-2">
          <p className="min-w-0 flex-1 font-mono text-xs break-words">
            user.department == &quot;Engineering&quot; AND isMemberOfAnyGroup(&quot;00gFAKE&quot;)
          </p>
          <StableWidth reserve="Not evaluated" align="end">
            <span className="rounded-md border px-2 py-0.5 text-xs whitespace-nowrap">{label}</span>
          </StableWidth>
        </div>)}
    </div>
}`,...s.parameters?.docs?.source},description:{story:"The row the component exists for, in both states: the two sentences break at the same point.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    reserve: '00',
    children: null,
    align: 'center'
  }
}`,...a.parameters?.docs?.source},description:{story:"A slot held open for a value that has not arrived: the badge is absent, the space it will take is not.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    reserve: '100%',
    align: 'end',
    children: <span className="font-mono text-sm font-bold tabular-nums">7%</span>
  }
}`,...r.parameters?.docs?.source},description:{story:"A right-aligned percentage reserving `100%`, with `tabular-nums` so the digits do not twitch.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    reserve: 'Not evaluated',
    children: 'Pass'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Pass')).toBeInTheDocument();
    await expect(canvas.queryByText('Not evaluated')).not.toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"The twin is invisible to a text query, exactly as it is to a reader.",...o.parameters?.docs?.description}}};const u=["Default","HoldsTheRowStill","ReservedBeforeTheValueArrives","NumericReadout","TheTwinIsNotQueryable"];export{t as Default,s as HoldsTheRowStill,r as NumericReadout,a as ReservedBeforeTheValueArrives,o as TheTwinIsNotQueryable,u as __namedExportsOrder,h as default};
