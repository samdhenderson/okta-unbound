import{j as l}from"./iframe-tAvKsVeF.js";import{u,M as d}from"./useMemberFilters-LFYkVxqR.js";import{b,c as g}from"./memberAnalytics-BqndU7JT.js";import{t as h}from"./memberSourceBuckets-CMd9i71b.js";import{b as y}from"./memberSourceIndex-XhEnFrTq.js";import{M as w}from"./MemberSourceNotes-D0AtajgE.js";import"./preload-helper-PPVm8Dsz.js";import"./MemberFilterPanel-fb43Reif.js";import"./MfaScanButton-B10gRaS5.js";import"./MemberSourceFilterBar-Dx0w3ZXE.js";import"./AttributeFilterList-URvyoqeI.js";import"./chartPalette-Byit8206.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";import"./memberRuleAttribution-CD0Zofjz.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./provenance-C1K7H2p2.js";import"./RuleLinkRow-CWX4uAdz.js";const{expect:r,fn:i,userEvent:m}=__STORYBOOK_MODULE_TEST__,c=Array.from({length:30},(t,e)=>({id:`00uFAKE${e+1}`,status:e<4?"SUSPENDED":"ACTIVE",profile:{login:`member${e+1}@example.com`,email:`member${e+1}@example.com`,firstName:`First${e+1}`,lastName:`Last${e+1}`,department:["Engineering","Support","Finance"][e%3],title:e%2===0?"Manager":"Individual Contributor"}})),p={total:30,direct:30,ruleBased:0,unattributed:0,byRule:[]},f={index:y({id:"00gFAKE1",name:"Engineering",type:"OKTA_GROUP"},c,[]),segments:h(p)},B=t=>{const e=u();return l.jsx(d,{...t,memberFilters:e})},H={title:"Members/MemberFilterDrawer",component:B,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Every member control the explorer has, behind one disclosure: the membership-source strip and its notes, the status/MFA/sort panel, the routes into each profile attribute, and a pointer to the Insights tab. The contents stay mounted while closed — and `inert`, so they leave the tab order and the accessible tree — which is the contract these stories assert, since the headless runner loads no Tailwind and so cannot observe the collapsed height."}}},args:{id:"member-filter-drawer",open:!0,memberSource:f,sourceDetail:l.jsx(w,{breakdown:p}),statusRows:g(c,"status"),mfaResults:null,factorLabels:[],memberCount:c.length,scanStatus:"idle",onRunScanClick:i(),sortBy:"name",sortDesc:!1,onToggleSort:i(),attributes:b(c),filteredDimensions:new Set,onSelectAttribute:i()}},s={play:async({args:t,canvas:e})=>{await r(e.getByText("Source")).toBeVisible(),await r(e.getByText("Profile attributes")).toBeVisible(),await m.click(e.getByRole("button",{name:"Title: choose a value to filter by"})),await r(t.onSelectAttribute).toHaveBeenCalledWith("title")}},a={args:{open:!1},play:async({canvasElement:t})=>{const e=t.ownerDocument.getElementById("member-filter-drawer");await r(e).toHaveAttribute("inert")}},o={args:{memberSource:void 0,sourceDetail:void 0},play:async({canvas:t})=>{await r(t.queryByText("Source")).toBeNull(),await r(t.getByText("Profile attributes")).toBeVisible()}},n={args:{onOpenInsights:i()},play:async({args:t,canvas:e})=>{await m.click(e.getByRole("button",{name:"Open Insights"})),await r(t.onOpenInsights).toHaveBeenCalledTimes(1)}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas
  }) => {
    await expect(canvas.getByText('Source')).toBeVisible();
    await expect(canvas.getByText('Profile attributes')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Title: choose a value to filter by'
    }));
    await expect(args.onSelectAttribute).toHaveBeenCalledWith('title');
  }
}`,...s.parameters?.docs?.source},description:{story:"Open, with everything the Group Detail Members tab supplies.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    open: false
  },
  play: async ({
    canvasElement
  }) => {
    const region = canvasElement.ownerDocument.getElementById('member-filter-drawer');
    await expect(region).toHaveAttribute('inert');
  }
}`,...a.parameters?.docs?.source},description:{story:"Closed: mounted, but out of the tab order and the accessible tree.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    memberSource: undefined,
    sourceDetail: undefined
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText('Source')).toBeNull();
    await expect(canvas.getByText('Profile attributes')).toBeVisible();
  }
}`,...o.parameters?.docs?.source},description:{story:"No membership-source analysis has run: no strip, no notes — absent, not guessed.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenInsights: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open Insights'
    }));
    await expect(args.onOpenInsights).toHaveBeenCalledTimes(1);
  }
}`,...n.parameters?.docs?.source},description:{story:"With a route to the Insights tab, where the composition reports live.",...n.parameters?.docs?.description}}};const $=["Open","Closed","WithoutSourceAnalysis","WithInsightsPointer"];export{a as Closed,s as Open,n as WithInsightsPointer,o as WithoutSourceAnalysis,$ as __namedExportsOrder,H as default};
