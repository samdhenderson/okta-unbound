import{_ as u,j as m,r as b}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:p,fn:S,userEvent:h,within:g}=__STORYBOOK_MODULE_TEST__,f={title:"Shared/Select",component:u,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Controlled native `<select>` dropdown built from an options array, with label and error state.\n\n`onChange` receives the chosen option value (not the event). When `error` is set the control turns red and shows the message below. Prefer this over a hand-rolled `<select>`; for free text use `Input`."}}},argTypes:{value:{description:"Controlled selected value."},onChange:{description:"Called with the newly selected option value."},options:{description:"Options to render."},label:{description:"Optional label rendered above the control."},ariaLabel:{description:"Accessible name for the control when no visible `label` is rendered (e.g. an inline selector)."},error:{description:"Error message; when set, applies danger styling and shows the message below."},disabled:{description:"Disables the control."},fullWidth:{description:"Stretch to fill the container width. Defaults to `true`."},className:{description:"Extra classes merged onto the outer container."}},args:{value:"ACTIVE",onChange:S(),options:[{value:"ACTIVE",label:"Active"},{value:"STAGED",label:"Staged"},{value:"PROVISIONED",label:"Provisioned"},{value:"SUSPENDED",label:"Suspended"},{value:"DEPROVISIONED",label:"Deprovisioned"}]}},e={args:{ariaLabel:"User status"}},s={args:{label:"User Status"}},a={args:{ariaLabel:"User status selector"}},r={args:{label:"User Status",error:"This field is required"}},t={args:{label:"User Status",disabled:!0}},o={args:{label:"Status",fullWidth:!1}},n={args:{label:"User Status",value:"SUSPENDED"}},v=()=>{const[i,d]=b.useState("ACTIVE");return m.jsx(u,{label:"User Status",value:i,onChange:d,options:[{value:"ACTIVE",label:"Active"},{value:"STAGED",label:"Staged"},{value:"SUSPENDED",label:"Suspended"}]})},l={render:()=>m.jsx(v,{}),play:async({canvasElement:i})=>{const c=g(i).getByRole("combobox",{name:"User Status"});await p(c).toHaveValue("ACTIVE"),await h.selectOptions(c,"SUSPENDED"),await p(c).toHaveValue("SUSPENDED")}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    ariaLabel: 'User status'
  }
}`,...e.parameters?.docs?.source},description:{story:"Default with no visible label (uses `ariaLabel` for an accessible name).",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'User Status'
  }
}`,...s.parameters?.docs?.source},description:{story:"With label.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    ariaLabel: 'User status selector'
  }
}`,...a.parameters?.docs?.source},description:{story:"With aria-label for accessibility (no visible label).",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'User Status',
    error: 'This field is required'
  }
}`,...r.parameters?.docs?.source},description:{story:"With error message.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'User Status',
    disabled: true
  }
}`,...t.parameters?.docs?.source},description:{story:"Disabled state.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Status',
    fullWidth: false
  }
}`,...o.parameters?.docs?.source},description:{story:"Not full width.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'User Status',
    value: 'SUSPENDED'
  }
}`,...n.parameters?.docs?.source},description:{story:"Different selected value.",...n.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <SelectHarness />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', {
      name: 'User Status'
    });
    await expect(select).toHaveValue('ACTIVE');
    await userEvent.selectOptions(select, 'SUSPENDED');
    await expect(select).toHaveValue('SUSPENDED');
  }
}`,...l.parameters?.docs?.source},description:{story:"Choosing an option reports its value, and the control shows the new selection.",...l.parameters?.docs?.description}}};const U=["Default","WithLabel","WithAriaLabel","ErrorState","Disabled","NotFullWidth","Suspended","Choosing"];export{l as Choosing,e as Default,t as Disabled,r as ErrorState,o as NotFullWidth,n as Suspended,a as WithAriaLabel,s as WithLabel,U as __namedExportsOrder,f as default};
