import{j as l,a as p}from"./iframe-tAvKsVeF.js";import{R as d}from"./RuleLinkRow-CWX4uAdz.js";import"./preload-helper-PPVm8Dsz.js";const{expect:i,fn:u,within:c}=__STORYBOOK_MODULE_TEST__,v={title:"Groups/RuleLinkRow",component:d,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"A rule name, an optional secondary detail line, and an optional trailing node (a status pill, a member count) — with or without a click that opens the rule in the Rules tab. Without `onSelect` the row is non-interactive markup, so a caller with nowhere to navigate never ships a button that goes nowhere."}}},argTypes:{name:{description:"Rule name — the row's visible label and accessible name."},trailing:{description:"Optional right-aligned node (a status pill, a member count)."},detail:{description:"Optional secondary line under the name (e.g. a condition expression)."},onSelect:{description:"Deep-links this rule in the Rules tab. Omit to render a non-interactive row."}},args:{name:"All Engineers",onSelect:u()}},e={play:async({canvasElement:o})=>{const s=c(o);await i(s.getByRole("button",{name:"Open rule All Engineers in the Rules tab"})).toBeInTheDocument()}},t={args:{onSelect:void 0},play:async({canvasElement:o})=>{const s=c(o);await i(s.queryByRole("button")).not.toBeInTheDocument(),await i(s.getByText("All Engineers")).toBeInTheDocument()}},n={args:{detail:'user.department == "Engineering"'}},a={args:{trailing:l.jsx(p,{variant:"success",children:"ACTIVE"})}},r={parameters:{pseudo:{hover:!0}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Open rule All Engineers in the Rules tab'
    })).toBeInTheDocument();
  }
}`,...e.parameters?.docs?.source},description:{story:"The interactive form: a real button naming the rule it opens.",...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    onSelect: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText('All Engineers')).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source},description:{story:"No `onSelect` — inert markup, not a button that goes nowhere.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    detail: 'user.department == "Engineering"'
  }
}`,...n.parameters?.docs?.source},description:{story:"A secondary detail line, e.g. the rule's condition expression.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    trailing: <Badge variant="success">ACTIVE</Badge>
  }
}`,...a.parameters?.docs?.source},description:{story:"A trailing node — here, a status pill.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"Hover state (forced via the pseudo-states addon).",...r.parameters?.docs?.description}}};const y=["Default","Static","WithDetail","WithTrailing","Hover"];export{e as Default,r as Hover,t as Static,n as WithDetail,a as WithTrailing,y as __namedExportsOrder,v as default};
