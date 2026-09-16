import{j as b,r as w}from"./iframe-tAvKsVeF.js";import{C as l}from"./ComparisonTabBar-DtT1dros.js";import"./preload-helper-PPVm8Dsz.js";const{expect:e,fn:m,userEvent:r,within:g}=__STORYBOOK_MODULE_TEST__,x={title:"Users/Comparison/ComparisonTabBar",component:l,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Tab bar (Overview / Groups / Apps / Attributes) for the comparison surface — the shared `Tabs` in its default `underline` variant, purely presentational, with selection owned by the parent.\n\nThe four labels carry no glyphs and no diff-count badges: with them the strip measured 489px against the 328px of track a 360px side panel gives it. Each tab states its own difference count in its body instead."}}},args:{activeTab:"overview",onChange:m()},argTypes:{activeTab:{description:"Currently selected tab."},onChange:{description:"Invoked with the newly selected tab key."}}},s={},o={args:{activeTab:"groups"}},i={args:{activeTab:"apps"}},c={args:{activeTab:"attributes"}},n={args:{activeTab:"attributes"},parameters:{layout:"padded",viewport:{value:"sidepanelCompact"}}},y=({initial:u})=>{const[a,t]=w.useState(u);return b.jsx("div",{style:{width:480},children:b.jsx(l,{activeTab:a,onChange:t})})},p={render:()=>b.jsx(y,{initial:"overview"}),play:async({canvasElement:u})=>{const a=g(u),t=a.getByRole("tab",{name:"Overview"}),v=a.getByRole("tab",{name:/Groups/}),d=a.getByRole("tab",{name:/Attributes/});await e(t).toHaveAttribute("tabindex","0"),await e(v).toHaveAttribute("tabindex","-1"),t.focus(),await r.keyboard("{ArrowRight}"),await e(v).toHaveFocus(),await e(v).toHaveAttribute("aria-selected","true"),await e(t).toHaveAttribute("aria-selected","false"),await r.keyboard("{ArrowLeft}"),await e(t).toHaveFocus(),await e(t).toHaveAttribute("aria-selected","true"),await r.keyboard("{End}"),await e(d).toHaveFocus(),await e(d).toHaveAttribute("aria-selected","true"),await r.keyboard("{Home}"),await e(t).toHaveFocus(),await e(t).toHaveAttribute("aria-selected","true"),await r.keyboard("{ArrowLeft}"),await e(d).toHaveFocus(),await e(d).toHaveAttribute("aria-selected","true")}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Overview tab selected.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'groups'
  }
}`,...o.parameters?.docs?.source},description:{story:"Groups tab selected.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'apps'
  }
}`,...i.parameters?.docs?.source},description:{story:"Apps tab selected.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'attributes'
  }
}`,...c.parameters?.docs?.source},description:{story:"Attributes tab selected — the fourth dimension of the comparison.",...c.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'attributes'
  },
  parameters: {
    layout: 'padded',
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"The compact side panel: 292px of strip against 328px of track, so all four labels stay on one line.",...n.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <ControlledTabBar initial="overview" />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const overview = canvas.getByRole('tab', {
      name: 'Overview'
    });
    const groups = canvas.getByRole('tab', {
      name: /Groups/
    });
    const attributes = canvas.getByRole('tab', {
      name: /Attributes/
    });

    // Only the selected tab is in the page's tab order; Tab reaches the strip once.
    await expect(overview).toHaveAttribute('tabindex', '0');
    await expect(groups).toHaveAttribute('tabindex', '-1');
    overview.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(groups).toHaveFocus();
    await expect(groups).toHaveAttribute('aria-selected', 'true');
    await expect(overview).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(overview).toHaveFocus();
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    await expect(attributes).toHaveFocus();
    await expect(attributes).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    await expect(overview).toHaveFocus();
    await expect(overview).toHaveAttribute('aria-selected', 'true');

    // From the first tab, ArrowLeft wraps to the last.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(attributes).toHaveFocus();
    await expect(attributes).toHaveAttribute('aria-selected', 'true');
  }
}`,...p.parameters?.docs?.source},description:{story:`A tablist is one tab stop and the arrow keys move inside it: Right/Left step and wrap,
Home and End jump to the ends, and each both selects and focuses — automatic activation.`,...p.parameters?.docs?.description}}};const H=["Default","GroupsActive","AppsActive","AttributesActive","CompactPanel","KeyboardNavigation"];export{i as AppsActive,c as AttributesActive,n as CompactPanel,s as Default,o as GroupsActive,p as KeyboardNavigation,H as __namedExportsOrder,x as default};
