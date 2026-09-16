import{n as s,j as e,a as c,B as p}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const u={title:"Shared/Eyebrow",component:s,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'The small uppercase label that titles a section — the one place the recipe `text-xs font-semibold uppercase tracking-wide text-neutral-600` lives.\n\nThere is deliberately no colour, size or tracking prop: `className` is for layout and spacing only. An eyebrow is a label, never a control, and `as="h3"` is for when it is a real section heading that should join the document outline.'}}},argTypes:{children:{description:"The label text; short, because an eyebrow titles a section."},as:{description:"Element to render: `span` (default), `div` for a block box, or `h3` when the eyebrow is a real section heading."},className:{description:"Extra classes — layout and spacing only, never colour or type."},title:{description:"Native `title` tooltip, for a label whose full meaning does not fit."},testId:{description:"Optional test handle."}},args:{children:"Membership source"}},r={},a={parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}}},render:()=>e.jsxs("div",{className:"space-y-2",children:[e.jsx(s,{as:"span",className:"block",children:"span — decorative label"}),e.jsx(s,{as:"div",children:"div — decorative block"}),e.jsx(s,{as:"h3",children:"h3 — real section heading"})]})},t={parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}}},render:()=>e.jsxs("div",{className:"w-96 rounded-md border border-neutral-200 bg-white px-4 py-3",children:[e.jsxs("div",{className:"flex items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-2",children:[e.jsx(s,{as:"h3",children:"Members"}),e.jsx(c,{variant:"neutral",children:"248"})]}),e.jsx(p,{variant:"secondary",size:"sm",children:"Load"})]}),e.jsx("p",{className:"mt-2 text-xs text-neutral-500",children:"Everyone who resolves into this group, from every source."})]})},n={render:()=>e.jsx("dl",{className:"w-72 space-y-3",children:[["Group type","Okta group"],["Source","Rule — Engineering EMEA"],["Last updated","19 Aug 2026"]].map(([d,l])=>e.jsxs("div",{children:[e.jsx("dt",{children:e.jsx(s,{children:d})}),e.jsx("dd",{className:"mt-0.5 text-sm text-neutral-900",children:l})]},d))})},o={parameters:{viewport:{value:"sidepanelCompact"}},render:()=>e.jsxs("div",{className:"w-full space-y-3 p-4",children:[e.jsx(s,{className:"block",children:"Membership source breakdown"}),e.jsx("p",{className:"text-sm text-neutral-700",children:"248 members: 190 assigned directly, 58 from two rules."})]})},i={args:{children:"App push",title:"Where this group’s members are provisioned downstream."}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"The default: a decorative `span` label carrying the one fixed recipe.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    // heading-order disabled: this story renders an \`h3\` in isolation with no
    // surrounding page outline, so axe flags a heading that starts below h1.
    // The \`as="h3"\` case is the one worth showing, and the real call sites
    // supply the ancestor headings that make the order legal.
    a11y: {
      config: {
        rules: [{
          id: 'heading-order',
          enabled: false
        }]
      }
    }
  },
  render: () => <div className="space-y-2">
      <Eyebrow as="span" className="block">
        span — decorative label
      </Eyebrow>
      <Eyebrow as="div">div — decorative block</Eyebrow>
      <Eyebrow as="h3">h3 — real section heading</Eyebrow>
    </div>
}`,...a.parameters?.docs?.source},description:{story:"All three elements render identically — `as` changes semantics, never the type.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    // heading-order disabled: an \`h3\` section heading rendered without the page
    // shell that would supply its \`h1\`/\`h2\` ancestors.
    a11y: {
      config: {
        rules: [{
          id: 'heading-order',
          enabled: false
        }]
      }
    }
  },
  render: () => <div className="w-96 rounded-md border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Eyebrow as="h3">Members</Eyebrow>
          <Badge variant="neutral">248</Badge>
        </div>
        <Button variant="secondary" size="sm">
          Load
        </Button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Everyone who resolves into this group, from every source.
      </p>
    </div>
}`,...t.parameters?.docs?.source},description:{story:"In its real job: the eyebrow names the section, a `Badge` counts it and a `Button`\nacts on it — the verb lives in the button, never in the label.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <dl className="w-72 space-y-3">
      {[['Group type', 'Okta group'], ['Source', 'Rule — Engineering EMEA'], ['Last updated', '19 Aug 2026']].map(([label, value]) => <div key={label}>
          <dt>
            <Eyebrow>{label}</Eyebrow>
          </dt>
          <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
        </div>)}
    </dl>
}`,...n.parameters?.docs?.source},description:{story:"Stacked eyebrows in a fact list: one element repeated, so the column reads as a column.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  render: () => <div className="w-full space-y-3 p-4">
      <Eyebrow className="block">Membership source breakdown</Eyebrow>
      <p className="text-sm text-neutral-700">
        248 members: 190 assigned directly, 58 from two rules.
      </p>
    </div>
}`,...o.parameters?.docs?.source},description:{story:"At 360px, the narrowest side-panel width: a long label wraps rather than truncating.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    children: 'App push',
    title: 'Where this group’s members are provisioned downstream.'
  }
}`,...i.parameters?.docs?.source},description:{story:"A label whose full meaning does not fit, carrying the rest on `title`.",...i.parameters?.docs?.description}}};const b=["Default","Elements","SectionHeader","InAFactList","Compact","WithTooltip"];export{o as Compact,r as Default,a as Elements,n as InAFactList,t as SectionHeader,i as WithTooltip,b as __namedExportsOrder,u as default};
