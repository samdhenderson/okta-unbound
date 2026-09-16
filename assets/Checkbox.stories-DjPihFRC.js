import{C as b,j as p,r as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:d,fn:m,userEvent:h,within:g}=__STORYBOOK_MODULE_TEST__,w={title:"Shared/Checkbox",component:b,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Controlled checkbox primitive. With no `label` it emits a bare styled `<input>` so the caller owns layout — supply `aria-label` in that case; with a `label` it wraps the box in a clickable `<label>` plus optional helper text."}}},argTypes:{checked:{description:"Controlled checked state."},onChange:{description:"Called with the new checked value on toggle."},label:{description:"Visible label. When omitted, pass `aria-label` so the control has an accessible name."},description:{description:"Secondary helper text rendered beneath the label."},disabled:{description:"Disables the control and dims it."},className:{description:"Extra classes for the wrapping `<label>` (when labeled) or the `<input>` (when bare)."}},args:{checked:!1,onChange:m()}},a={args:{"aria-label":"Bare checkbox"}},t={args:{checked:!0,"aria-label":"Bare checkbox"}},s={args:{label:"Include deprovisioned users"}},o={args:{label:"Include deprovisioned users",description:"Also match users whose Okta status is DEPROVISIONED"}},r={args:{disabled:!0,label:"Unavailable option"}},c={args:{checked:!0,disabled:!0,label:"Locked option",description:"This option cannot be changed"}},k=()=>{const[i,e]=u.useState(!1);return p.jsxs("div",{className:"flex flex-col gap-4",children:[p.jsx(b,{checked:i,onChange:e,label:"Toggle me",description:"Click to see state change"}),p.jsxs("p",{className:"text-xs text-neutral-600",children:["Current state: ",i?"checked":"unchecked"]})]})},n={render:()=>p.jsx(k,{}),play:async({canvasElement:i})=>{const e=g(i),l=e.getByRole("checkbox",{name:/Toggle me/});await d(l).not.toBeChecked(),await h.click(e.getByText("Toggle me")),await d(l).toBeChecked(),await d(e.getByText("Current state: checked")).toBeInTheDocument(),await h.click(l),await d(l).not.toBeChecked()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    'aria-label': 'Bare checkbox'
  }
}`,...a.parameters?.docs?.source},description:{story:"Bare checkbox without label (caller owns layout).",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    checked: true,
    'aria-label': 'Bare checkbox'
  }
}`,...t.parameters?.docs?.source},description:{story:"Checked state.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Include deprovisioned users'
  }
}`,...s.parameters?.docs?.source},description:{story:"With label text.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Include deprovisioned users',
    description: 'Also match users whose Okta status is DEPROVISIONED'
  }
}`,...o.parameters?.docs?.source},description:{story:"With label and description text.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    label: 'Unavailable option'
  }
}`,...r.parameters?.docs?.source},description:{story:"Disabled state.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    checked: true,
    disabled: true,
    label: 'Locked option',
    description: 'This option cannot be changed'
  }
}`,...c.parameters?.docs?.source},description:{story:"Disabled and checked.",...c.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledCheckbox />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', {
      name: /Toggle me/
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(canvas.getByText('Toggle me'));
    await expect(box).toBeChecked();
    await expect(canvas.getByText('Current state: checked')).toBeInTheDocument();
    await userEvent.click(box);
    await expect(box).not.toBeChecked();
  }
}`,...n.parameters?.docs?.source},description:{story:"Real state behind the control, so clicking the label actually toggles the box.",...n.parameters?.docs?.description}}};const y=["Default","Checked","WithLabel","WithDescription","Disabled","DisabledChecked","ControlledDemo"];export{t as Checked,n as ControlledDemo,a as Default,r as Disabled,c as DisabledChecked,o as WithDescription,s as WithLabel,y as __namedExportsOrder,w as default};
