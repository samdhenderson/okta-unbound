import{T as h,j as c,r as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:p,fn:m,userEvent:g,within:y}=__STORYBOOK_MODULE_TEST__,x={title:"Shared/Textarea",component:h,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Controlled multi-line text field with label, hint, and error state; vertically resizable. The multi-line sibling of `Input`: `onChange` receives the string value, not the event, and when `error` is set the message replaces the hint. Prefer this over a raw `<textarea>`."}}},argTypes:{value:{description:"Controlled value."},onChange:{description:"Called with the new string value on each change."},placeholder:{description:"Placeholder text shown when empty."},disabled:{description:"Disables the field."},error:{description:"Error message; when set, applies danger styling and hides `hint`."},label:{description:"Optional label rendered above the field."},hint:{description:"Helper text below the field, shown only when there is no `error`."},rows:{description:"Visible row count. Defaults to `4`."},fullWidth:{description:"Stretch to fill the container width. Defaults to `true`."},className:{description:"Extra classes merged onto the outer container."}},args:{value:"",onChange:m(),placeholder:"Enter text here..."}},e={},n={args:{label:"Notes",hint:"Add any relevant notes here",placeholder:"Type your notes..."}},o={args:{value:"Some invalid input",label:"Notes",error:"This field contains invalid characters"}},l={args:{disabled:!0,label:"Notes",value:"This field is disabled"}},a={args:{label:"Description",rows:8,placeholder:"Enter a longer description..."}},i={args:{label:"Comment",fullWidth:!1,placeholder:"Type a comment..."}},b=()=>{const[r,s]=u.useState("");return c.jsxs("div",{className:"w-[360px] space-y-2",children:[c.jsx(h,{label:"Notes",hint:"Saved with the group",value:r,onChange:s,placeholder:"Type your notes..."}),c.jsxs("p",{className:"text-xs text-neutral-600",children:[r.length," characters"]})]})},t={render:()=>c.jsx(b,{}),play:async({canvasElement:r})=>{const s=y(r),d=s.getByRole("textbox");await g.type(d,"Owned by Platform"),await p(d).toHaveValue("Owned by Platform"),await p(s.getByText("17 characters")).toBeInTheDocument()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Default empty textarea.",...e.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Notes',
    hint: 'Add any relevant notes here',
    placeholder: 'Type your notes...'
  }
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'Some invalid input',
    label: 'Notes',
    error: 'This field contains invalid characters'
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    label: 'Notes',
    value: 'This field is disabled'
  }
}`,...l.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Description',
    rows: 8,
    placeholder: 'Enter a longer description...'
  }
}`,...a.parameters?.docs?.source},description:{story:"A taller field via `rows`.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Comment',
    fullWidth: false,
    placeholder: 'Type a comment...'
  }
}`,...i.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTextarea />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // \`Textarea\` renders its label unassociated, so the control is found by role.
    const field = canvas.getByRole('textbox');
    await userEvent.type(field, 'Owned by Platform');
    await expect(field).toHaveValue('Owned by Platform');
    await expect(canvas.getByText('17 characters')).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source},description:{story:"Typing into the field updates the value and the character count beneath it.",...t.parameters?.docs?.description}}};const w=["Default","WithLabel","ErrorState","Disabled","LargeSize","ConstrainedWidth","Typing"];export{i as ConstrainedWidth,e as Default,l as Disabled,o as ErrorState,a as LargeSize,t as Typing,n as WithLabel,w as __namedExportsOrder,x as default};
