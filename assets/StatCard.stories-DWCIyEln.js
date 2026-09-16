import{j as f,r as R,B as E}from"./iframe-tAvKsVeF.js";import{S as C}from"./StatCard-DmVy9h_z.js";import"./preload-helper-PPVm8Dsz.js";const{expect:k,fn:x,userEvent:w,waitFor:U,within:S}=__STORYBOOK_MODULE_TEST__,F={title:"Shared/StatCard",component:C,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Single metric tile — an uppercase title, a large value, and an optional top-right icon — used to build the Overview stat grids. Numeric values are localized with thousands separators; `color` selects the semantic icon/border token set; passing `onClick` turns the whole card into a real button (a tab stop, Enter/Space).\n\n`countUp` interpolates a numeric value up to its figure when it resolves or changes, and tints the settled figure for a beat — it never fires on an incidental re-render and is instant under `prefers-reduced-motion`."}}},argTypes:{title:{description:"Uppercase label above the value."},value:{description:"The metric; numbers are rendered with thousands separators."},color:{description:"Semantic color, selecting the icon and border token set; defaults to `neutral`."},icon:{description:"Optional icon shown at the top-right."},subtitle:{description:"Optional caption below the value."},onClick:{description:"When provided, makes the card a clickable button."},countUp:{description:"Count a numeric value up to its figure over `--dur-tell` when it resolves or changes. Ignored for string values; instant under reduced motion."}},args:{title:"Active Users",value:1250,onClick:x()}},s={},o={args:{value:"N/A"}},n={args:{subtitle:"Last updated today"}},c={args:{icon:"users"}},i={args:{color:"primary",icon:"bolt"}},l={args:{color:"success",title:"Completed Tasks",value:42,icon:"check"}},d={args:{color:"warning",title:"Pending Reviews",value:8,icon:"alert"}},p={args:{color:"danger",title:"Failed Requests",value:3,icon:"alert"}},r={args:{title:"Click me",value:999,icon:"chart"},play:async({args:e,canvasElement:a})=>{const t=S(a).getByRole("button",{name:/Click me/});await w.click(t),await k(e.onClick).toHaveBeenCalledTimes(1),t.focus(),await k(t).toHaveFocus(),await w.keyboard("{Enter}"),await k(e.onClick).toHaveBeenCalledTimes(2)}},u={...r,play:void 0,parameters:{pseudo:{hover:!0}}},m={...r,play:void 0,parameters:{pseudo:{focusVisible:!0}}},g={...r,play:void 0,parameters:{pseudo:{active:!0}}},v={args:{title:"Total Records",value:1234567,color:"primary"}},h={parameters:{motion:"on"},args:{title:"Total Members",value:4820,color:"primary",icon:"users",countUp:!0}},B=e=>{const[a,t]=R.useState(4820);return f.jsxs("div",{className:"flex flex-col items-start gap-3",children:[f.jsx(C,{...e,value:a}),f.jsx(E,{size:"sm",onClick:()=>t(T=>T+137),children:"Refresh"})]})},b={parameters:{motion:"on"},render:e=>f.jsx(B,{...e}),args:{title:"Total Members",color:"primary",icon:"users",countUp:!0},play:async({canvasElement:e})=>{const a=S(e);await w.click(a.getByRole("button",{name:"Refresh"})),await U(()=>k(a.getByText("4,957")).toBeInTheDocument())}},y={args:{title:"Total Members",value:4820,color:"primary",icon:"users",countUp:!0}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Default card with numeric value.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'N/A'
  }
}`,...o.parameters?.docs?.source},description:{story:"String value (no localization).",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    subtitle: 'Last updated today'
  }
}`,...n.parameters?.docs?.source},description:{story:"With subtitle.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    icon: 'users'
  }
}`,...c.parameters?.docs?.source},description:{story:"With icon.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    color: 'primary',
    icon: 'bolt'
  }
}`,...i.parameters?.docs?.source},description:{story:"Primary color variant.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    color: 'success',
    title: 'Completed Tasks',
    value: 42,
    icon: 'check'
  }
}`,...l.parameters?.docs?.source},description:{story:"Success color variant.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    color: 'warning',
    title: 'Pending Reviews',
    value: 8,
    icon: 'alert'
  }
}`,...d.parameters?.docs?.source},description:{story:"Warning color variant.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    color: 'danger',
    title: 'Failed Requests',
    value: 3,
    icon: 'alert'
  }
}`,...p.parameters?.docs?.source},description:{story:"Danger color variant.",...p.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Click me',
    value: 999,
    icon: 'chart'
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const card = within(canvasElement).getByRole('button', {
      name: /Click me/
    });
    await userEvent.click(card);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    card.focus();
    await expect(card).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  }
}`,...r.parameters?.docs?.source},description:{story:`Clickable card — a real activatable button, so a pointer click and a keyboard
Enter both reach the handler.`,...r.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  ...Clickable,
  play: undefined,
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...u.parameters?.docs?.source},description:{story:"Hover state of a clickable card (forced via the pseudo-states addon).",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  ...Clickable,
  play: undefined,
  parameters: {
    pseudo: {
      focusVisible: true
    }
  }
}`,...m.parameters?.docs?.source},description:{story:"Focus-visible state of a clickable card (forced via the pseudo-states addon).",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  ...Clickable,
  play: undefined,
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"Pressed state of a clickable card (forced via the pseudo-states addon).",...g.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Total Records',
    value: 1234567,
    color: 'primary'
  }
}`,...v.parameters?.docs?.source},description:{story:"Large number with thousands separator.",...v.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  args: {
    title: 'Total Members',
    value: 4820,
    color: 'primary',
    icon: 'users',
    countUp: true
  }
}`,...h.parameters?.docs?.source},description:{story:"`countUp` motion showcase: the figure counts from zero the way a stat card behaves\nthe moment its data resolves. Motion is opted back on for this story, so it\ndeliberately carries no `play` function.",...h.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  render: args => <RefreshDemo {...args} />,
  args: {
    title: 'Total Members',
    color: 'primary',
    icon: 'users',
    countUp: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Refresh'
    }));
    await waitFor(() => expect(canvas.getByText('4,957')).toBeInTheDocument());
  }
}`,...b.parameters?.docs?.source},description:{story:`A value that changes *after* mount — a refresh, not the initial resolve. Click
"Refresh" to watch the figure count to its new value, tinted, then ease back.`,...b.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Total Members',
    value: 4820,
    color: 'primary',
    icon: 'users',
    countUp: true
  }
}`,...y.parameters?.docs?.source},description:{story:"The same card with motion suppressed — `countUp` is a no-op and the figure is\ncorrect on the first painted frame. This is what every reduced-motion user sees.",...y.parameters?.docs?.description}}};const H=["Default","StringValue","WithSubtitle","WithIcon","Primary","Success","Warning","ErrorState","Clickable","ClickableHover","ClickableFocus","ClickablePressed","LargeNumber","CountUp","Refreshed","CountUpReducedMotion"];export{r as Clickable,m as ClickableFocus,u as ClickableHover,g as ClickablePressed,h as CountUp,y as CountUpReducedMotion,s as Default,p as ErrorState,v as LargeNumber,i as Primary,b as Refreshed,o as StringValue,l as Success,d as Warning,c as WithIcon,n as WithSubtitle,H as __namedExportsOrder,F as default};
