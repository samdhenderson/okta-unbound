import{k as x,j as e,b as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const y={title:"Shared/LoadingSpinner",component:x,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Spinning loading indicator with `role="status"`; optional caption and centering.\n\nWith neither `message` nor `centered`, renders a bare inline spinner; otherwise it is wrapped in a centered column with the message beneath.\n\nFive sizes: `sm` (16px), `md` (20px), `lg` (24px), `xl` (32px, the default), `2xl` (48px). The first four names mean the same pixels they do in the `Icon` registry, so a spinner can be asked for by the size name of the glyph it sits beside or replaces.'}}},argTypes:{size:{description:"Spinner size. Defaults to `xl` (32px)."},message:{description:"Optional caption rendered below the spinner."},centered:{description:"Center the spinner (and message) within a padded flex block."},className:{description:"Extra classes merged onto the spinner element."}}},s={},r={args:{size:"sm"}},a={args:{size:"md"}},t={args:{size:"lg"}},n={args:{size:"xl"}},i={args:{size:"2xl"}},o={args:{message:"Loading data…"}},c={args:{centered:!0}},d={args:{size:"2xl",message:"Please wait…",centered:!0}},p={render:l=>e.jsx("div",{className:"flex items-center gap-6",children:["sm","md","lg","xl","2xl"].map(g=>e.jsxs("div",{className:"flex flex-col items-center gap-2",children:[e.jsx(x,{...l,size:g}),e.jsx("span",{className:"text-neutral-600 text-xs",children:g})]},g))})},m={render:l=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(u,{type:"search",size:"md",className:"text-neutral-400"}),e.jsx(x,{...l,size:"md"}),e.jsx("span",{className:"text-neutral-700 text-sm",children:"Searching…"})]})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Inline spinner at the default size (`xl`, 32px).",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  }
}`,...r.parameters?.docs?.source},description:{story:'16px — inline beside body copy or an `Icon size="sm"`.',...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...a.parameters?.docs?.source},description:{story:'20px — inline in a form control or list row; matches `Icon size="md"`.',...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg'
  }
}`,...t.parameters?.docs?.source},description:{story:'24px — matches `Icon size="lg"`.',...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'xl'
  }
}`,...n.parameters?.docs?.source},description:{story:"32px — the section-level busy state, and the default.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    size: '2xl'
  }
}`,...i.parameters?.docs?.source},description:{story:"48px — the full-view / tab-level busy state.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    message: 'Loading data…'
  }
}`,...o.parameters?.docs?.source},description:{story:"With a message below.",...o.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    centered: true
  }
}`,...c.parameters?.docs?.source},description:{story:"Centered with padding.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    size: '2xl',
    message: 'Please wait…',
    centered: true
  }
}`,...d.parameters?.docs?.source},description:{story:"Centered with message.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-center gap-6">
      {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map(size => <div key={size} className="flex flex-col items-center gap-2">
          <LoadingSpinner {...args} size={size} />
          <span className="text-neutral-600 text-xs">{size}</span>
        </div>)}
    </div>
}`,...p.parameters?.docs?.source},description:{story:"Every size side by side, smallest to largest.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-center gap-2">
      <Icon type="search" size="md" className="text-neutral-400" />
      <LoadingSpinner {...args} size="md" />
      <span className="text-neutral-700 text-sm">Searching…</span>
    </div>
}`,...m.parameters?.docs?.source},description:{story:"A 20px (`md`) spinner beside a 20px `Icon` — the two scales agree name for\nname, so an inline spinner swaps in for a glyph without shifting the row.",...m.parameters?.docs?.description}}};const f=["Default","Small","Medium","Large","ExtraLarge","TwoExtraLarge","WithMessage","Centered","CenteredWithMessage","Sizes","MatchesIconScale"];export{c as Centered,d as CenteredWithMessage,s as Default,n as ExtraLarge,t as Large,m as MatchesIconScale,a as Medium,p as Sizes,r as Small,i as TwoExtraLarge,o as WithMessage,f as __namedExportsOrder,y as default};
