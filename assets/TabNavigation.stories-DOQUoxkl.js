import{j as w}from"./iframe-tAvKsVeF.js";import{T as f}from"./TabNavigation-CZzhR0OF.js";import"./preload-helper-PPVm8Dsz.js";import"./tabs-3T7DVjf-.js";const{expect:t,fn:T,userEvent:B,within:v}=__STORYBOOK_MODULE_TEST__,E={title:"Sidepanel/TabNavigation",component:f,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Sticky top icon rail for switching between the side panel's main views. Renders `RAIL_TAB_DEFS` through the shared `Tabs` strip (`rail` variant); the caller owns which tab is active and hears selection through `onTabChange`.\n\nThe rail seats fewer sections than the panel has: Explorer and History are `railHidden` and reached through the ⌘K button at the trailing end, so on either of them no tab is selected and no indicator is drawn."}}},argTypes:{activeTab:{description:"Currently selected tab, rendered with its label unfurled and the indicator beneath."},onTabChange:{description:"Called with the chosen tab id when a tab is clicked."},onOpenCommandPalette:{description:"Opens the ⌘K palette. Wire to `useCommandPalette().open` in the shell."},shortcutPlatform:{description:"Which chord glyph to print. Defaults to the running platform, detected from the user agent."}},args:{activeTab:"home",onTabChange:T(),onOpenCommandPalette:T()}},r={play:async({args:a,canvasElement:e})=>{const n=v(e);await t(n.getByRole("tab",{name:"Home"})).toHaveAttribute("aria-selected","true"),await B.click(n.getByRole("tab",{name:"Groups"})),await t(a.onTabChange).toHaveBeenCalledWith("groups")}},s={args:{activeTab:"users"}},o={args:{activeTab:"groups"}},i={args:{activeTab:"rules"}},g=a=>function(n){return w.jsx("div",{style:{width:a},className:"border border-neutral-200",children:w.jsx(f,{...n})})},c={args:{activeTab:"policies"},globals:{viewport:{value:"sidepanelCompact"}},render:g(360)},l={args:{activeTab:"export"},globals:{viewport:{value:"sidepanelDefault"}},render:g(480)},p={args:{activeTab:"apps"},globals:{viewport:{value:"sidepanelWide"}},render:g(720)},d={args:{activeTab:"history"},play:async({canvasElement:a})=>{const e=v(a),n=e.getAllByRole("tab");await t(e.queryByRole("tab",{name:"History"})).not.toBeInTheDocument(),await t(e.queryByRole("tab",{name:"Explorer"})).not.toBeInTheDocument(),await t(e.getByRole("tab",{name:"Home"})).toBeVisible();for(const y of n)await t(y).toHaveAttribute("aria-selected","false");await t(n.filter(y=>y.getAttribute("tabindex")==="0")).toHaveLength(1)}},m={args:{shortcutPlatform:"apple"},play:async({canvasElement:a})=>{const e=v(a);await t(e.getByRole("button",{name:"Search and jump to a section, Command K"})).toBeVisible(),await t(e.getByText("⌘K")).toBeVisible()}},u={args:{shortcutPlatform:"other",activeTab:"explorer"},play:async({canvasElement:a})=>{const e=v(a);await t(e.getByRole("button",{name:"Search and jump to a section, Ctrl K"})).toBeVisible()}},h={args:{activeTab:"policies",shortcutPlatform:"other"},globals:{viewport:{value:"sidepanelCompact"}},render:g(360),play:async({canvasElement:a,args:e})=>{const n=v(a);await B.click(n.getByRole("button",{name:/Search and jump to a section/})),await t(e.onOpenCommandPalette).toHaveBeenCalled()}},b={args:{activeTab:"groups"},parameters:{motion:"on"},globals:{viewport:{value:"sidepanelCompact"}},render:g(360)};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('tab', {
      name: 'Home'
    })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(canvas.getByRole('tab', {
      name: 'Groups'
    }));
    await expect(args.onTabChange).toHaveBeenCalledWith('groups');
  }
}`,...r.parameters?.docs?.source},description:{story:"Home tab active. Clicking another seat reports it and moves the selection.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'users'
  }
}`,...s.parameters?.docs?.source},description:{story:"Users tab active.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'groups'
  }
}`,...o.parameters?.docs?.source},description:{story:"Groups tab active.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'rules'
  }
}`,...i.parameters?.docs?.source},description:{story:"Rules tab active.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'policies'
  },
  globals: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  render: atPanelWidth(360)
}`,...c.parameters?.docs?.source},description:{story:"360px — the narrowest the panel is dragged; every seat is still hittable.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'export'
  },
  globals: {
    viewport: {
      value: 'sidepanelDefault'
    }
  },
  render: atPanelWidth(480)
}`,...l.parameters?.docs?.source},description:{story:"480px — the width the side panel opens at.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'apps'
  },
  globals: {
    viewport: {
      value: 'sidepanelWide'
    }
  },
  render: atPanelWidth(720)
}`,...p.parameters?.docs?.source},description:{story:"720px — a dragged-out panel, where the whole rail fits with room to spare.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'history'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');

    // Named, not counted: History and Explorer are the two that lose a glyph.
    await expect(canvas.queryByRole('tab', {
      name: 'History'
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tab', {
      name: 'Explorer'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('tab', {
      name: 'Home'
    })).toBeVisible();
    for (const tab of tabs) {
      await expect(tab).toHaveAttribute('aria-selected', 'false');
    }
    // The property that keeps the rail reachable at all from here.
    await expect(tabs.filter(tab => tab.getAttribute('tabindex') === '0')).toHaveLength(1);
  }
}`,...d.parameters?.docs?.source},description:{story:`Standing on a section the rail has no seat for: nothing is selected, and the
tablist still keeps exactly one tab stop so a keyboard user can arrow out.`,...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    shortcutPlatform: 'apple'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Search and jump to a section, Command K'
    })).toBeVisible();
    await expect(canvas.getByText('⌘K')).toBeVisible();
  }
}`,...m.parameters?.docs?.source},description:{story:'On a Mac the chord draws as `⌘K`; the accessible name spells "Command K" out.',...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    shortcutPlatform: 'other',
    activeTab: 'explorer'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Search and jump to a section, Ctrl K'
    })).toBeVisible();
  }
}`,...u.parameters?.docs?.source},description:{story:"Everywhere else the control prints `Ctrl K`, and name and label agree.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'policies',
    shortcutPlatform: 'other'
  },
  globals: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  render: atPanelWidth(360),
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Search and jump to a section/
    }));
    await expect(args.onOpenCommandPalette).toHaveBeenCalled();
  }
}`,...h.parameters?.docs?.source},description:{story:"The ⌘K button survives the narrowest panel: the rail scrolls, the button does not shrink.",...h.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'groups'
  },
  parameters: {
    motion: 'on'
  },
  globals: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  render: atPanelWidth(360)
}`,...b.parameters?.docs?.source},description:{story:"Motion enabled, so the label unfurl and indicator slide run at `--dur-move`. No `play` — it would race.",...b.parameters?.docs?.description}}};const P=["Default","UsersActive","GroupsActive","RulesActive","Compact","DefaultWidth","Wide","RailHiddenSectionActive","ApplePlatform","NonApplePlatform","CompactWithShortcut","MotionShowcase"];export{m as ApplePlatform,c as Compact,h as CompactWithShortcut,r as Default,l as DefaultWidth,o as GroupsActive,b as MotionShowcase,u as NonApplePlatform,d as RailHiddenSectionActive,i as RulesActive,s as UsersActive,p as Wide,P as __namedExportsOrder,E as default};
