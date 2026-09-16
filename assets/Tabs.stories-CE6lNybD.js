import{Y as g,j as e,r as S}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:v,userEvent:w,within:f}=__STORYBOOK_MODULE_TEST__,m=[{key:"account",label:"Account"},{key:"org",label:"Org"},{key:"contact",label:"Contact"},{key:"custom",label:"Custom",count:7},{key:"all",label:"All"}],A=[{key:"overview",label:"Overview",icon:"chart"},{key:"groups",label:"Groups",icon:"users",count:3,countDisplay:"nonzero"},{key:"apps",label:"Apps",icon:"app",count:12,countDisplay:"nonzero"},{key:"attributes",label:"Attributes",icon:"list",count:0,countDisplay:"nonzero"}],R=[{key:"attrs",label:"Attributes",count:9},{key:"mfa",label:"MFA factors"}],h=[{key:"home",label:"Home",icon:"home"},{key:"users",label:"Users",icon:"user"},{key:"groups",label:"Groups",icon:"users"},{key:"apps",label:"Apps",icon:"app"},{key:"rules",label:"Rules",icon:"bolt"},{key:"policies",label:"Policies",icon:"shield"},{key:"export",label:"Export",icon:"download"},{key:"explorer",label:"Explorer",icon:"terminal"},{key:"history",label:"History",icon:"clipboard"}],C={title:"Shared/Tabs",component:g,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Accessible tab bar with `underline` and `rail` variants. It renders the strip only — callers own the panels and toggle them on the active key — and implements the ARIA tablist pattern with roving `tabindex` and Left/Right/Home/End navigation.\n\nThe `rail` variant is icon-first: inactive tabs show only their glyph while the active tab's label unfurls beside it, so many sections fit a narrow panel. Every rail tab carries its label as `aria-label` and a tooltip naming it on hover and focus."}}},argTypes:{tabs:{description:"Tabs to render, in display order."},activeKey:{description:"Key of the currently selected tab."},onChange:{description:"Invoked with the newly selected tab key."},variant:{description:"`underline` (default) for section navigation; `rail` for icon-first navigation in a narrow panel."},ariaLabel:{description:"Accessible label for the tablist (e.g. “User profile sections”)."},className:{description:"Extra classes merged onto the tablist container."}},args:{tabs:m,activeKey:"account",onChange:()=>{}}},a=({tabs:p,initial:t,variant:u,width:b})=>{const[y,T]=S.useState(t);return e.jsxs("div",{style:{width:b},children:[e.jsx(g,{tabs:p,activeKey:y,onChange:T,variant:u,ariaLabel:"Demo"}),e.jsxs("p",{className:"text-sm text-neutral-600",style:{padding:12},children:["Active: ",e.jsx("strong",{children:y})]})]})},r={render:()=>e.jsx(a,{tabs:m,initial:"account",variant:"underline",width:340})},i={render:()=>e.jsx(a,{tabs:R,initial:"attrs",variant:"underline",width:260})},n={render:()=>e.jsx(a,{tabs:A,initial:"overview",variant:"underline",width:480})},o={parameters:{layout:"padded"},render:()=>e.jsx(a,{tabs:A.map(({icon:p,count:t,countDisplay:u,...b})=>b),initial:"groups",variant:"underline",width:330})},s={render:()=>e.jsx(a,{tabs:h,initial:"home",variant:"rail",width:360})},c={parameters:{motion:"on"},render:()=>e.jsx(a,{tabs:h,initial:"groups",variant:"rail",width:360})},l={render:()=>e.jsx(a,{tabs:h,initial:"history",variant:"rail",width:720})},d={render:()=>e.jsx(a,{tabs:m,initial:"account",variant:"underline",width:340}),play:async({canvasElement:p})=>{const t=f(p);t.getByRole("tab",{name:"Account"}).focus(),await w.keyboard("{ArrowRight}"),await v(t.getByRole("tab",{name:"Org"})).toHaveAttribute("aria-selected","true"),await w.keyboard("{Home}"),await v(t.getByRole("tab",{name:"Account"})).toHaveAttribute("aria-selected","true")}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={SECTION_TABS} initial="account" variant="underline" width={340} />
}`,...r.parameters?.docs?.source},description:{story:"Underline variant — section navigation inside a card.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={COMPOSITION_TABS} initial="attrs" variant="underline" width={260} />
}`,...i.parameters?.docs?.source},description:{story:"A compact two-way toggle inside a section — the same strip at a small width.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={COMPARISON_TABS} initial="overview" variant="underline" width={480} />
}`,...n.parameters?.docs?.source},description:{story:"A tab's `icon` renders before its label in every variant, and `countDisplay: 'nonzero'` suppresses a count of `0`.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    layout: 'padded'
  },
  render: () => <ControlledTabs tabs={COMPARISON_TABS.map(({
    icon: _icon,
    count: _count,
    countDisplay: _cd,
    ...tab
  }) => tab)} initial="groups" variant="underline" width={330} />
}`,...o.parameters?.docs?.source},description:{story:"Four bare labels at the narrowest panel width, where the strip still fits its track without scrolling.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="home" variant="rail" width={360} />
}`,...s.parameters?.docs?.source},description:{story:"Rail variant — nine sections in a 360px panel, with only the active label unfurled.",...s.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="groups" variant="rail" width={360} />
}`,...c.parameters?.docs?.source},description:{story:"The rail with motion enabled, to review the sequence: the underline slides first, then the labels cross over.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="history" variant="rail" width={720} />
}`,...l.parameters?.docs?.source},description:{story:"Rail at a comfortable width, where the whole strip fits and no edge fades.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabs tabs={SECTION_TABS} initial="account" variant="underline" width={340} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const account = canvas.getByRole('tab', {
      name: 'Account'
    });
    account.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', {
      name: 'Org'
    })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    await expect(canvas.getByRole('tab', {
      name: 'Account'
    })).toHaveAttribute('aria-selected', 'true');
  }
}`,...d.parameters?.docs?.source},description:{story:`The tablist driven from the keyboard: Right and Home move selection and follow
focus, which is the automatic-activation half of the ARIA pattern.`,...d.parameters?.docs?.description}}};const _=["Underline","UnderlineCompact","UnderlineWithIcons","UnderlineCompactPanel","Rail","RailMotion","RailWide","KeyboardNavigation"];export{d as KeyboardNavigation,s as Rail,c as RailMotion,l as RailWide,r as Underline,i as UnderlineCompact,o as UnderlineCompactPanel,n as UnderlineWithIcons,_ as __namedExportsOrder,C as default};
