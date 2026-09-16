import{j as n}from"./iframe-tAvKsVeF.js";const t=({value:e})=>n.jsx("span",{"aria-hidden":e===null?"true":void 0,className:"flex shrink-0 items-center self-stretch",children:n.jsx("span",{className:`min-w-[2.6ch] text-right text-3xl leading-none tabular-nums ${e===null?"font-normal text-neutral-400":"font-semibold text-neutral-900"}`,children:e===null?"—":e.toLocaleString()})});try{t.displayName="FigureNumber",t.__docgenInfo={description:`A row's leading number.

At least \`2.6ch\` of \`tabular-nums\`, so the sentences beside it share one left
edge and an em dash occupies the space a number would. A minimum rather than a
fixed width: a four-digit org widens the column instead of spilling out of it.
\`self-stretch\` takes the height from the text block, so the column stays
matched if a note wraps.

A missing value dims to \`text-neutral-400\` and is hidden from assistive
technology — the sentence beside it already says what is missing.`,displayName:"FigureNumber",filePath:"/home/runner/work/Okta-Unbound-Dev/Okta-Unbound-Dev/src/sidepanel/components/home/FigureNumber.tsx",methods:[],props:{value:{defaultValue:null,declarations:[{fileName:"Okta-Unbound-Dev/src/sidepanel/components/home/FigureNumber.tsx",name:"FigureNumberProps"}],description:"The count, or `null` when nothing behind it can support one.",name:"value",parent:{fileName:"Okta-Unbound-Dev/src/sidepanel/components/home/FigureNumber.tsx",name:"FigureNumberProps"},required:!0,tags:{},type:{name:"number | null"}}},tags:{param:"props - See {@link FigureNumberProps }."}}}catch{}export{t as F};
