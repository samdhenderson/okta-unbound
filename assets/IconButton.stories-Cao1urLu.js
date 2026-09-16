import{j as e,I as t,b as a}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:S,fn:I,userEvent:f,within:B}=__STORYBOOK_MODULE_TEST__,j={title:"Shared/IconButton",component:t,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Icon-only button primitive (close, remove, clear, expand). `label` is required and becomes the accessible name plus default tooltip. Three low-emphasis variants (`ghost`, `subtle`, `danger`), two sizes, and optional toggle (`active` → `aria-pressed`) or disclosure (`expanded` + `controls`) semantics."}}},argTypes:{label:{description:"Accessible name — required. Also the default tooltip."},onClick:{description:"Click handler."},children:{description:"The icon to render (an `<svg>` or `<Icon />`); it controls its own dimensions."},variant:{description:"Low-emphasis treatment: `ghost` and `subtle` differ in hover intensity; `danger` hovers red."},size:{description:"`sm` (p-1) or `md` (p-1.5) padding around the glyph."},disabled:{description:"Disables the button and dims it."},type:{description:"Native button type. Defaults to `button`."},title:{description:"Tooltip text; defaults to `label`."},active:{description:"For toggle buttons — reflected as `aria-pressed`."},expanded:{description:"For disclosure triggers — reflected as `aria-expanded`."},controls:{description:"`id` of the region this button shows/hides — reflected as `aria-controls`."},className:{description:"Extra classes merged onto the button."}},args:{label:"Close",onClick:I(),children:e.jsx(a,{type:"trash"})}},r={args:{variant:"ghost"},play:async({args:s,canvasElement:x})=>{const y=B(x).getByRole("button",{name:"Close"});await f.click(y),await S(s.onClick).toHaveBeenCalledTimes(1)}},n={args:{label:"Remove member",variant:"danger"},parameters:{a11y:{config:{rules:[{id:"button-name",enabled:!0}]}}}},o={args:{variant:"subtle"}},i={args:{variant:"danger",label:"Delete"}},c={args:{disabled:!0},play:async({args:s,canvasElement:x})=>{const y=B(x).getByRole("button",{name:"Close"});await S(y).toBeDisabled(),await f.click(y),await S(s.onClick).not.toHaveBeenCalled()}},d={args:{active:!0,label:"Settings active"}},l={render:s=>e.jsxs("div",{children:[e.jsx(t,{...s,label:"Collapse",expanded:!0,controls:"disclosure-demo-panel",children:e.jsx(a,{type:"chevron-right",className:"rotate-90"})}),e.jsx("div",{id:"disclosure-demo-panel",className:"mt-2 text-sm text-neutral-700",children:"The region the button controls."})]})},p={args:{size:"sm"}},m={args:{size:"md"}},u={render:s=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(t,{...s,size:"sm",label:"Small",children:e.jsx(a,{type:"trash",size:"sm"})}),e.jsx(t,{...s,size:"md",label:"Medium",children:e.jsx(a,{type:"trash"})})]})},g={render:s=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(t,{...s,variant:"ghost",label:"Ghost",children:e.jsx(a,{type:"trash"})}),e.jsx(t,{...s,variant:"subtle",label:"Subtle",children:e.jsx(a,{type:"trash"})}),e.jsx(t,{...s,variant:"danger",label:"Delete",children:e.jsx(a,{type:"trash"})})]})},h={parameters:{pseudo:{hover:!0}}},b={parameters:{pseudo:{focusVisible:!0}}},v={parameters:{pseudo:{active:!0}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'ghost'
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Close'
    });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  }
}`,...r.parameters?.docs?.source},description:{story:"Ghost variant — lowest emphasis.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Remove member',
    variant: 'danger'
  },
  parameters: {
    a11y: {
      // The whole point of this story: the icon button exposes an accessible name.
      config: {
        rules: [{
          id: 'button-name',
          enabled: true
        }]
      }
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"Icon-only buttons have no visible text, so the required `label` supplies the\naccessible name (rendered as `aria-label`). This story makes that contract\nexplicit; the a11y addon verifies the button is reachable by name.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'subtle'
  }
}`,...o.parameters?.docs?.source},description:{story:"Subtle variant — slightly higher emphasis.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'danger',
    label: 'Delete'
  }
}`,...i.parameters?.docs?.source},description:{story:"Danger variant — hovers red.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Close'
    });
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  }
}`,...c.parameters?.docs?.source},description:{story:"Disabled — the click never reaches the handler.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    active: true,
    label: 'Settings active'
  }
}`,...d.parameters?.docs?.source},description:{story:"Toggle button — aria-pressed set when active.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <div>
      <IconButton {...args} label="Collapse" expanded controls="disclosure-demo-panel">
        <Icon type="chevron-right" className="rotate-90" />
      </IconButton>
      <div id="disclosure-demo-panel" className="mt-2 text-sm text-neutral-700">
        The region the button controls.
      </div>
    </div>
}`,...l.parameters?.docs?.source},description:{story:"Disclosure trigger — `expanded` + `controls` emit `aria-expanded` and `aria-controls`.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  }
}`,...p.parameters?.docs?.source},description:{story:"Small padding.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...m.parameters?.docs?.source},description:{story:"Medium padding (default).",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-center gap-3">
      <IconButton {...args} size="sm" label="Small">
        <Icon type="trash" size="sm" />
      </IconButton>
      <IconButton {...args} size="md" label="Medium">
        <Icon type="trash" />
      </IconButton>
    </div>
}`,...u.parameters?.docs?.source},description:{story:"Both sizes side by side.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-center gap-3">
      <IconButton {...args} variant="ghost" label="Ghost">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="subtle" label="Subtle">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="danger" label="Delete">
        <Icon type="trash" />
      </IconButton>
    </div>
}`,...g.parameters?.docs?.source},description:{story:"All three variants side by side.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"Hover state (forced via the pseudo-states addon).",...h.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  parameters: {
    pseudo: {
      focusVisible: true
    }
  }
}`,...b.parameters?.docs?.source},description:{story:"Focus-visible state (forced via the pseudo-states addon).",...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"Pressed state (forced via the pseudo-states addon).",...v.parameters?.docs?.description}}};const C=["Default","AccessibleName","Subtle","Danger","Disabled","Active","Disclosure","Small","Medium","Sizes","Variants","Hover","Focus","Pressed"];export{n as AccessibleName,d as Active,i as Danger,r as Default,c as Disabled,l as Disclosure,b as Focus,h as Hover,m as Medium,v as Pressed,u as Sizes,p as Small,o as Subtle,g as Variants,C as __namedExportsOrder,j as default};
