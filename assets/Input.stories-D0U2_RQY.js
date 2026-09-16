import{d as I,j as e,b as a,I as E,k as L,r as k}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:W,fn:C,userEvent:j,within:B}=__STORYBOOK_MODULE_TEST__,O={title:"Shared/Input",component:I,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Controlled single-line text field with optional label, hint, size scale, leading/trailing adornments and error state. `onChange` receives the string value, not the event; when `error` is set the field turns red and the message replaces the hint. For multi-line use `Textarea`; for choices use `Select`.\n\nThree sizes (`sm` ≈ 30px, `md` ≈ 38px, `lg` ≈ 46px) and two in-field slots — `icon` and `trailing` — which reserve their padding automatically. A `trailing` node is inert by default; set `trailingInteractive` when it holds a control."}}},argTypes:{value:{description:"Controlled value."},onChange:{description:"Called with the new string value on each change."},placeholder:{description:"Placeholder text shown when empty."},type:{description:"Native input type. Defaults to `text`."},disabled:{description:"Disables the field."},error:{description:"Error message; when set, applies danger styling and hides `hint`."},label:{description:"Optional field label rendered above the input."},ariaLabel:{description:"Accessible name for the control when no visible `label` is rendered (e.g. an inline field)."},hint:{description:"Helper text below the input, shown only when there is no `error`."},fullWidth:{description:"Stretch to fill the container width. Defaults to `true`."},size:{description:"Field height/type scale (`sm` ≈ 30px, `md` ≈ 38px, `lg` ≈ 46px). Defaults to `md`."},icon:{description:"Optional leading icon rendered inside the field; left padding is reserved automatically."},trailing:{description:"Optional node rendered inside the field at its trailing edge (clear button, spinner). Right padding is reserved automatically and scales with `size`."},trailingInteractive:{description:"Set when `trailing` holds something the user clicks. By default the slot is `pointer-events-none` so a decorative adornment cannot swallow clicks aimed at the field."},className:{description:"Extra classes merged onto the outer container."},autoFocus:{description:"Focus the input on mount."},onKeyDown:{description:"Key handler on the input (e.g. Enter to submit, Escape to cancel)."}},args:{value:"",onChange:C(),placeholder:"Enter text…"}},t={},i={args:{value:"Sample text"}},o={args:{label:"Username"}},n={args:{label:"Email address",hint:"Use your company email"}},l={args:{label:"Email address",value:"invalid",error:"Invalid email format"}},c={args:{label:"Locked field",value:"Cannot edit",disabled:!0}},d={args:{label:"Search groups",placeholder:"Type to search…",icon:e.jsx(a,{type:"search",size:"sm"})}},p={args:{type:"email",label:"Email",placeholder:"name@company.com",hint:"We will never share your email"}},m={args:{type:"password",label:"Password",placeholder:"••••••••"}},h={args:{type:"search",label:"Search",placeholder:"Find users…",icon:e.jsx(a,{type:"search",size:"sm"})}},u={args:{label:"City",placeholder:"Type…",fullWidth:!1}},g={render:r=>e.jsxs("div",{className:"flex w-80 flex-col gap-3",children:[e.jsx(I,{...r,size:"sm",ariaLabel:"Small field",placeholder:"sm — 30px"}),e.jsx(I,{...r,size:"md",ariaLabel:"Medium field",placeholder:"md — 38px (default)"}),e.jsx(I,{...r,size:"lg",ariaLabel:"Large field",placeholder:"lg — 46px"})]}),args:{icon:e.jsx(a,{type:"search",size:"sm"})}},y={args:{size:"lg",label:"Search users",placeholder:"Search by email, name, or login…",icon:e.jsx(a,{type:"search",size:"sm"})}},b={args:{size:"sm",label:"Filter",placeholder:"Filter rows…"}},v={args:{label:"Search groups",value:"engineering",trailingInteractive:!0,trailing:e.jsx(E,{label:"Clear search",variant:"ghost",size:"sm",onClick:C(),children:e.jsx(a,{type:"close",size:"sm"})})}},S={args:{size:"lg",label:"Search users",value:"a-very-long-query-that-would-otherwise-run-under-the-clear-button@example.com",icon:e.jsx(a,{type:"search",size:"sm"}),trailingInteractive:!0,trailing:e.jsx(E,{label:"Clear search",variant:"ghost",size:"sm",onClick:C(),children:e.jsx(a,{type:"close",size:"sm"})})}},f={args:{type:"search",label:"Search groups",value:"engineering",icon:e.jsx(a,{type:"search",size:"sm"}),trailingInteractive:!0,trailing:e.jsx(E,{label:"Clear search",variant:"ghost",size:"sm",onClick:C(),children:e.jsx(a,{type:"close",size:"sm"})})}},x={args:{size:"lg",label:"Search users",value:"ada",icon:e.jsx(a,{type:"search",size:"sm"}),trailing:e.jsx(L,{size:"sm"})}},F=()=>{const[r,s]=k.useState("");return e.jsx(I,{ariaLabel:"Search groups",value:r,onChange:s,placeholder:"Type to search…",icon:e.jsx(a,{type:"search",size:"sm"}),trailingInteractive:r!=="",trailing:r?e.jsx(E,{label:"Clear search",variant:"ghost",size:"sm",onClick:()=>s(""),children:e.jsx(a,{type:"close",size:"sm"})}):void 0})},w={render:()=>e.jsx(F,{}),play:async({canvasElement:r})=>{const s=B(r),T=s.getByRole("textbox",{name:"Search groups"});await j.type(T,"engineering"),await W(T).toHaveValue("engineering"),await j.click(s.getByRole("button",{name:"Clear search"})),await W(T).toHaveValue("")}},z={args:{size:"lg",label:"Email address",value:"invalid",error:"Invalid email format",icon:e.jsx(a,{type:"search",size:"sm"})}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Empty input, no label.",...t.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'Sample text'
  }
}`,...i.parameters?.docs?.source},description:{story:"With a text value.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Username'
  }
}`,...o.parameters?.docs?.source},description:{story:"With label.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Email address',
    hint: 'Use your company email'
  }
}`,...n.parameters?.docs?.source},description:{story:"With label and hint text.",...n.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Email address',
    value: 'invalid',
    error: 'Invalid email format'
  }
}`,...l.parameters?.docs?.source},description:{story:"With error message (replaces hint).",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Locked field',
    value: 'Cannot edit',
    disabled: true
  }
}`,...c.parameters?.docs?.source},description:{story:"Disabled state.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Search groups',
    placeholder: 'Type to search…',
    icon: <Icon type="search" size="sm" />
  }
}`,...d.parameters?.docs?.source},description:{story:"With leading icon.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'email',
    label: 'Email',
    placeholder: 'name@company.com',
    hint: 'We will never share your email'
  }
}`,...p.parameters?.docs?.source},description:{story:"Email type with label and hint.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'password',
    label: 'Password',
    placeholder: '••••••••'
  }
}`,...m.parameters?.docs?.source},description:{story:"Password type with label.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'search',
    label: 'Search',
    placeholder: 'Find users…',
    icon: <Icon type="search" size="sm" />
  }
}`,...h.parameters?.docs?.source},description:{story:"Search type with icon.",...h.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'City',
    placeholder: 'Type…',
    fullWidth: false
  }
}`,...u.parameters?.docs?.source},description:{story:"Not full width.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex w-80 flex-col gap-3">
      <Input {...args} size="sm" ariaLabel="Small field" placeholder="sm — 30px" />
      <Input {...args} size="md" ariaLabel="Medium field" placeholder="md — 38px (default)" />
      <Input {...args} size="lg" ariaLabel="Large field" placeholder="lg — 46px" />
    </div>,
  args: {
    icon: <Icon type="search" size="sm" />
  }
}`,...g.parameters?.docs?.source},description:{story:"The three size steps stacked, each with the leading icon so the reserved padding is visible.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    label: 'Search users',
    placeholder: 'Search by email, name, or login…',
    icon: <Icon type="search" size="sm" />
  }
}`,...y.parameters?.docs?.source},description:{story:"The taller field a search bar uses as the primary control of a view.",...y.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm',
    label: 'Filter',
    placeholder: 'Filter rows…'
  }
}`,...b.parameters?.docs?.source},description:{story:'Compact field for a dense toolbar row; lines up with `Button size="sm"`.',...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Search groups',
    value: 'engineering',
    trailingInteractive: true,
    trailing: <IconButton label="Clear search" variant="ghost" size="sm" onClick={fn()}>
        <Icon type="close" size="sm" />
      </IconButton>
  }
}`,...v.parameters?.docs?.source},description:{story:"Trailing slot holding a clear button — needs `trailingInteractive` to be clickable.",...v.parameters?.docs?.description}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    label: 'Search users',
    value: 'a-very-long-query-that-would-otherwise-run-under-the-clear-button@example.com',
    icon: <Icon type="search" size="sm" />,
    trailingInteractive: true,
    trailing: <IconButton label="Clear search" variant="ghost" size="sm" onClick={fn()}>
        <Icon type="close" size="sm" />
      </IconButton>
  }
}`,...S.parameters?.docs?.source},description:{story:"Both slots at once: leading glyph plus a trailing clear button.",...S.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'search',
    label: 'Search groups',
    value: 'engineering',
    icon: <Icon type="search" size="sm" />,
    trailingInteractive: true,
    trailing: <IconButton label="Clear search" variant="ghost" size="sm" onClick={fn()}>
        <Icon type="close" size="sm" />
      </IconButton>
  }
}`,...f.parameters?.docs?.source},description:{story:'`type="search"` with a custom trailing clear button. The field suppresses\nthe browser\'s own WebKit cancel-button (`::-webkit-search-cancel-button`)\nso only this one clear affordance renders — without the suppression,\nChrome would paint its native × next to this one.',...f.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    label: 'Search users',
    value: 'ada',
    icon: <Icon type="search" size="sm" />,
    trailing: <LoadingSpinner size="sm" />
  }
}`,...x.parameters?.docs?.source},description:{story:"Search in flight: a decorative trailing spinner, left inert so clicks reach the field.",...x.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  render: () => <InputHarness />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', {
      name: 'Search groups'
    });
    await userEvent.type(field, 'engineering');
    await expect(field).toHaveValue('engineering');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear search'
    }));
    await expect(field).toHaveValue('');
  }
}`,...w.parameters?.docs?.source},description:{story:"Typing updates the controlled value, and the trailing clear button empties it.",...w.parameters?.docs?.description}}};z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    label: 'Email address',
    value: 'invalid',
    error: 'Invalid email format',
    icon: <Icon type="search" size="sm" />
  }
}`,...z.parameters?.docs?.source},description:{story:"Error state at a non-default size.",...z.parameters?.docs?.description}}};const _=["Default","WithValue","WithLabel","WithHint","ErrorState","Disabled","WithIcon","EmailType","PasswordType","SearchType","NotFullWidth","Sizes","Large","Small","WithTrailing","WithIconAndTrailing","SearchWithClear","Searching","Typing","ErrorStateLarge"];export{t as Default,c as Disabled,p as EmailType,l as ErrorState,z as ErrorStateLarge,y as Large,u as NotFullWidth,m as PasswordType,h as SearchType,f as SearchWithClear,x as Searching,g as Sizes,b as Small,w as Typing,n as WithHint,d as WithIcon,S as WithIconAndTrailing,o as WithLabel,v as WithTrailing,i as WithValue,_ as __namedExportsOrder,O as default};
