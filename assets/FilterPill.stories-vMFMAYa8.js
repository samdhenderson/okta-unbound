import{F as v,j as u,r as h}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:g,fn:b,userEvent:A,within:x}=__STORYBOOK_MODULE_TEST__,F={title:"Shared/FilterPill",component:v,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Small two-state toggle pill for filter panels — solid primary when active, neutral outline when inactive.\n\nReflects its state as `aria-pressed` and supports a disabled (dimmed, non-interactive) state. For icon-only buttons use `IconButton`; for text CTAs use `Button`."}}},argTypes:{active:{description:"Toggle state; when true the pill is filled and `aria-pressed` is set."},onClick:{description:"Called when the pill is toggled."},children:{description:"Pill label content."},title:{description:"Native tooltip text for the pill."},disabled:{description:"When true the pill is dimmed and non-interactive."},inactiveClassName:{description:"Optional custom classes for the inactive state (e.g. semantic colors)."}},args:{children:"Filter label",onClick:b()}},s={args:{active:!1}},r={args:{active:!0}},a={args:{active:!1,disabled:!0}},i={args:{active:!0,disabled:!0}},n={args:{active:!1,title:"Click to toggle filter"}},o={args:{active:!1},parameters:{pseudo:{focusVisible:!0}}},c={args:{active:!0},parameters:{pseudo:{active:!0}}},l={args:{active:!1},render:e=>u.jsxs("div",{style:{display:"flex",gap:12,alignItems:"center"},children:[u.jsx(v,{...e,active:!1,children:"Inactive"}),u.jsx(v,{...e,active:!0,children:"Active"})]})},d={args:{active:!1},parameters:{pseudo:{hover:!0}}},p={args:{active:!1},render:e=>{const m=()=>{const[t,f]=h.useState(!1);return u.jsx(v,{...e,active:t,onClick:()=>f(y=>!y),children:"Active rules only"})};return u.jsx(m,{})},play:async({canvasElement:e})=>{const t=x(e).getByRole("button",{name:"Active rules only"});await g(t).toHaveAttribute("aria-pressed","false"),await A.click(t),await g(t).toHaveAttribute("aria-pressed","true")}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    active: false
  }
}`,...s.parameters?.docs?.source},description:{story:"Inactive state — outlined.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    active: true
  }
}`,...r.parameters?.docs?.source},description:{story:"Active state — solid primary fill.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    active: false,
    disabled: true
  }
}`,...a.parameters?.docs?.source},description:{story:"Disabled inactive.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    active: true,
    disabled: true
  }
}`,...i.parameters?.docs?.source},description:{story:"Disabled active.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    active: false,
    title: 'Click to toggle filter'
  }
}`,...n.parameters?.docs?.source},description:{story:"With optional title tooltip.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    active: false
  },
  parameters: {
    pseudo: {
      focusVisible: true
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"Focus-visible state (forced via the pseudo-states addon).",...o.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    active: true
  },
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...c.parameters?.docs?.source},description:{story:"Pressed state (forced via the pseudo-states addon).",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    active: false
  },
  render: args => <div style={{
    display: 'flex',
    gap: 12,
    alignItems: 'center'
  }}>
      <FilterPill {...args} active={false}>
        Inactive
      </FilterPill>
      <FilterPill {...args} active={true}>
        Active
      </FilterPill>
    </div>
}`,...l.parameters?.docs?.source},description:{story:"Two pills side by side showing active/inactive pair.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    active: false
  },
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"Hover state (forced via the pseudo-states addon).",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    active: false
  },
  render: args => {
    const Harness = () => {
      const [active, setActive] = useState(false);
      return <FilterPill {...args} active={active} onClick={() => setActive(prev => !prev)}>
          Active rules only
        </FilterPill>;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole('button', {
      name: 'Active rules only'
    });
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(pill);
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
  }
}`,...p.parameters?.docs?.source},description:{story:"Wired to real state: clicking the pill flips its fill and its `aria-pressed`.",...p.parameters?.docs?.description}}};const P=["Default","Active","Disabled","DisabledActive","WithTitle","Focus","Pressed","ActiveInactivePair","Hover","Toggling"];export{r as Active,l as ActiveInactivePair,s as Default,a as Disabled,i as DisabledActive,o as Focus,d as Hover,c as Pressed,p as Toggling,n as WithTitle,P as __namedExportsOrder,F as default};
