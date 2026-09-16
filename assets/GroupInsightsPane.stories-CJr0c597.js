import{G as C}from"./GroupInsightsPane-CqAAKXw0.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./GroupMetadataSection-BM0RqBd_.js";import"./dateFormat-tpkRVL7u.js";import"./AttributeSpreadSection-CJZO21pC.js";import"./AttributeHealthCard-BRZ4C4H2.js";import"./RuleLinkRow-CWX4uAdz.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./chartPalette-Byit8206.js";import"./memberAnalytics-BqndU7JT.js";import"./GroupMfaCoverageSection-DrD-hGWG.js";import"./MfaScanButton-B10gRaS5.js";import"./useMemberMfaScan-BWVC8bU_.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./BreakdownDetailsModal-BoybENQd.js";import"./BreakdownReport-RtX7G5yn.js";const{expect:a,fn:n,userEvent:s,within:A}=__STORYBOOK_MODULE_TEST__,r=Array.from({length:12},(e,t)=>({id:`user${t+1}`,status:"ACTIVE",profile:{login:`user${t+1}@example.com`,email:`user${t+1}@example.com`,firstName:`First${t+1}`,lastName:`Last${t+1}`,department:t<9?t%2===0?"Engineering":"Product":void 0,title:t%3===0?"Manager":"Individual Contributor"}})),E=[{id:"0prFAKE1",name:"Eng & Product — full-time",status:"ACTIVE",userAttributes:["department"],condition:'department in {"Engineering", "Product"}',conditionExpression:'user.department in {"Engineering", "Product"}',groupIds:["00gFAKE1"],created:"2024-01-01T00:00:00.000Z",lastUpdated:"2025-01-01T00:00:00.000Z"},{id:"0prFAKE2",name:"Managers",status:"ACTIVE",userAttributes:["title"],condition:'title == "Manager"',conditionExpression:'user.title == "Manager"',groupIds:["00gFAKE1"],created:"2024-01-01T00:00:00.000Z",lastUpdated:"2025-01-01T00:00:00.000Z"}],M=new Map(r.map((e,t)=>[e.id,{userId:e.id,factors:[],enrolled:t%4!==0,factorCount:t%4===0?0:1,factorLabels:t%4===0?[]:["Okta Verify"]}])),j={title:"Groups/GroupInsightsPane",component:C,tags:["autodocs"],parameters:{docs:{description:{component:`Group Detail's Insights tab: attribute-spread cards from \`discoverAttributeBreakdowns\`, a gated opt-in MFA-coverage scan that never auto-runs, and the group's own reference facts folded into a closed "About this group" section.

Fully presentational — the caller owns every load and passes its state through. Every discovered attribute gets a card; the feeding rules only influence the order, never which cards exist.`}}},argTypes:{groupId:{description:"The group's Okta id."},memberCount:{description:"The group's member count, used for the attribute gate's cost estimate."},members:{description:"The group's roster, once analyzed; `null` before then."},memberStatus:{description:"Status of the gated member analysis (shared with the Members tab)."},error:{description:"Error message when the member analysis failed."},canAnalyze:{description:"`false` when no Okta tab is connected; disables both gate buttons."},feedingRules:{description:"The feeding rules, layered onto the cards as an annotation and the lightest ranking input."},mfaResults:{description:"Per-member MFA scan results, or `null` before a scan has run."},scanStatus:{description:"Current MFA scan lifecycle status."}},args:{groupId:"00gFAKEgroup00001",memberCount:r.length,members:null,memberStatus:"idle",error:null,onAnalyzeMembers:n(),canAnalyze:!0,feedingRules:E,onNavigateToRule:n(),mfaResults:null,scanStatus:"idle",onRunScan:n(),onRequestConfirm:n(),onCancelConfirm:n(),description:"Engineering and Product — full-time.",created:new Date("2022-03-01T12:00:00Z"),lastUpdated:new Date("2025-11-14T09:30:00Z")}},v=async(e,t)=>{await s.click(e.getByRole("button",{name:t}))},o={},i={args:{memberStatus:"loading"}},c={args:{memberStatus:"error",error:"Members could not be read."}},d={args:{members:r,memberStatus:"done"},play:async({canvas:e})=>{await v(e,/Attribute spread/),await a(e.getByText("department")).toBeVisible()}},m={args:{members:r,memberStatus:"done",scanStatus:"complete",mfaResults:M},play:async({canvas:e})=>{await a(e.getByText("2 attributes · 2 flagged")).toBeVisible(),await a(e.getByText("3 of 12 members scanned have no MFA factor enrolled.")).toBeVisible(),await a(e.getByRole("button",{name:/Attribute spread/})).toHaveAttribute("aria-expanded","false"),await a(e.getByRole("button",{name:/MFA coverage/})).toHaveAttribute("aria-expanded","false")}},l={play:async({canvas:e})=>{await a(e.getByText("Not analyzed yet.")).toBeVisible(),await a(e.getByText("Load members first.")).toBeVisible(),await a(e.queryByText(/0 attributes/)).toBeNull()}},p={args:{members:r,memberStatus:"done",feedingRules:[]},play:async({canvas:e})=>{await v(e,/Attribute spread/),await a(e.getByText("department")).toBeVisible(),await a(e.queryByText(/Depended on by/)).toBeNull()}},u={args:{members:r,memberStatus:"done"}},g={args:{members:r,memberStatus:"done",scanStatus:"confirming"}},b={args:{members:r,memberStatus:"done",scanStatus:"scanning"}},y={args:{members:r,memberStatus:"done",scanStatus:"complete",mfaResults:M}},h={args:{members:r,memberStatus:"done",scanStatus:"error"}},w={args:{canAnalyze:!1}},f={args:{members:r,memberStatus:"done",onFilterMembers:n()},play:async({args:e,canvas:t})=>{await v(t,/Attribute spread/),await s.click(t.getByRole("button",{name:"Show the value breakdown for department"})),await s.click(t.getByRole("button",{name:/^Open Members filtered by Department: Engineering/})),await a(e.onFilterMembers).toHaveBeenCalledWith(a.objectContaining({dimension:"department",value:"Engineering"}))}},S={args:{members:r,memberStatus:"done"},play:async({canvas:e})=>{await v(e,/Attribute spread/),await s.click(e.getByRole("button",{name:"Show the value breakdown for department"})),await a(e.getByText("Engineering")).toBeVisible(),await a(e.queryByRole("button",{name:/Open Members filtered by/})).toBeNull()}},x=Array.from({length:40},(e,t)=>({id:`wide${t+1}`,status:"ACTIVE",profile:{login:`wide${t+1}@example.com`,email:`wide${t+1}@example.com`,firstName:`First${t+1}`,lastName:`Last${t+1}`,department:t%2===0?"Engineering":"Product",costCenter:`CC-${100+t%9}`}})),B={args:{members:x,memberCount:x.length,memberStatus:"done"},play:async({canvas:e,canvasElement:t})=>{const R=A(t.ownerDocument.body);await v(e,/Attribute spread/),await a(e.getByText("costCenter")).toBeVisible(),await a(e.getByText("30% hidden in the tail")).toBeVisible(),await s.click(e.getByRole("button",{name:"Show the value breakdown for costCenter"})),await s.click(e.getByRole("button",{name:/Show all 9 values/}));const T=await R.findByRole("dialog");await a(A(T).getByText("CC-108")).toBeVisible(),await a(A(T).getByText("CC-100")).toBeVisible(),await a(A(T).queryByText(/Members tab/)).toBeNull()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:'Roster not yet loaded — the attribute gate offers "Analyze" and the MFA section nudges\nto load members first. Only reached for a group over `AUTO_LOAD_MEMBER_CAP` or a\ndisconnected Okta tab.',...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    memberStatus: 'loading'
  }
}`,...i.parameters?.docs?.source},description:{story:"Reading and classifying every member.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    memberStatus: 'error',
    error: 'Members could not be read.'
  }
}`,...c.parameters?.docs?.source},description:{story:"The member analysis failed and offers a retry.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done'
  },
  play: async ({
    canvas
  }) => {
    await openSection(canvas, /Attribute spread/);
    await expect(canvas.getByText('department')).toBeVisible();
  }
}`,...d.parameters?.docs?.source},description:{story:"Roster loaded and the section opened: a card per discovered attribute, ranked.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    scanStatus: 'complete',
    mfaResults
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('2 attributes · 2 flagged')).toBeVisible();
    await expect(canvas.getByText('3 of 12 members scanned have no MFA factor enrolled.')).toBeVisible();

    // Closed, not absent: each heading is a real disclosure control.
    await expect(canvas.getByRole('button', {
      name: /Attribute spread/
    })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByRole('button', {
      name: /MFA coverage/
    })).toHaveAttribute('aria-expanded', 'false');
  }
}`,...m.parameters?.docs?.source},description:{story:"How the tab arrives: three folded sections, each stating its own headline fact.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('Not analyzed yet.')).toBeVisible();
    await expect(canvas.getByText('Load members first.')).toBeVisible();
    await expect(canvas.queryByText(/0 attributes/)).toBeNull();
  }
}`,...l.parameters?.docs?.source},description:{story:"A roster that has not loaded reports **absent**, never `0 attributes`.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    feedingRules: []
  },
  play: async ({
    canvas
  }) => {
    await openSection(canvas, /Attribute spread/);
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.queryByText(/Depended on by/)).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"No feeding rule references any user attribute — the cards render anyway, because that is where undetected drift lives.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done'
  }
}`,...u.parameters?.docs?.source},description:{story:"Roster loaded, MFA scan idle — the trigger is enabled (below `MFA_AUTO_THRESHOLD`).",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    scanStatus: 'confirming'
  }
}`,...g.parameters?.docs?.source},description:{story:"A large-group MFA scan gated behind confirmation.",...g.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    scanStatus: 'scanning'
  }
}`,...b.parameters?.docs?.source},description:{story:"MFA scan in progress.",...b.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    scanStatus: 'complete',
    mfaResults
  }
}`,...y.parameters?.docs?.source},description:{story:'MFA scan complete — the enrollment and factor-type cards, plus a "Rescan" trigger.',...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    scanStatus: 'error'
  }
}`,...h.parameters?.docs?.source},description:{story:"The MFA scan failed and offers a retry via the same trigger.",...h.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    canAnalyze: false
  }
}`,...w.parameters?.docs?.source},description:{story:"No Okta tab connected — both gate buttons disable.",...w.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done',
    onFilterMembers: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    await openSection(canvas, /Attribute spread/);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show the value breakdown for department'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /^Open Members filtered by Department: Engineering/
    }));
    await expect(args.onFilterMembers).toHaveBeenCalledWith(expect.objectContaining({
      dimension: 'department',
      value: 'Engineering'
    }));
  }
}`,...f.parameters?.docs?.source},description:{story:`A card's value row is the filter control. The pane holds no member list, so a click
applies the filter on Members and moves — which the row's accessible name says first.`,...f.parameters?.docs?.description}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    members,
    memberStatus: 'done'
  },
  play: async ({
    canvas
  }) => {
    await openSection(canvas, /Attribute spread/);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show the value breakdown for department'
    }));

    // The value is still stated; it just does not promise to take you anywhere.
    await expect(canvas.getByText('Engineering')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: /Open Members filtered by/
    })).toBeNull();
  }
}`,...S.parameters?.docs?.source},description:{story:"With no `onFilterMembers` wired, the card still renders — its spread bar, badges and\ncounts are worth reading — but the value rows stop being controls.",...S.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    members: wideMembers,
    memberCount: wideMembers.length,
    memberStatus: 'done'
  },
  play: async ({
    canvas,
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await openSection(canvas, /Attribute spread/);

    // Stage one: the collapsed card measures the tail and says so in words.
    await expect(canvas.getByText('costCenter')).toBeVisible();
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();

    // Stage two: this card's own disclosure, named for the attribute it opens.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show the value breakdown for costCenter'
    }));

    // Stage three.
    await userEvent.click(canvas.getByRole('button', {
      name: /Show all 9 values/
    }));
    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-108')).toBeVisible();
    // Every value, not just the hidden three.
    await expect(within(dialog).getByText('CC-100')).toBeVisible();
    await expect(within(dialog).queryByText(/Members tab/)).toBeNull();
  }
}`,...B.parameters?.docs?.source},description:{story:"The aggregated tail is reachable in three steps: the closed card measures it, the\ncard's disclosure lists what it kept, and **Show all** opens the full distribution in\n`BreakdownDetailsModal` — re-derived from the roster already in hand, with no refetch.",...B.parameters?.docs?.description}}};const J=["RosterNotLoaded","RosterLoading","RosterError","AttributeCards","AllSectionsClosed","ClosedSummariesWithoutARoster","NoDependentAttributes","MfaIdle","MfaConfirming","MfaScanning","MfaComplete","MfaError","Disabled","ValueJumpsToMembersFromCard","ValueRowsInertWithNowhereToGo","HiddenTailRevealedInThreeStages"];export{m as AllSectionsClosed,d as AttributeCards,l as ClosedSummariesWithoutARoster,w as Disabled,B as HiddenTailRevealedInThreeStages,y as MfaComplete,g as MfaConfirming,h as MfaError,u as MfaIdle,b as MfaScanning,p as NoDependentAttributes,c as RosterError,i as RosterLoading,o as RosterNotLoaded,f as ValueJumpsToMembersFromCard,S as ValueRowsInertWithNowhereToGo,J as __namedExportsOrder,j as default};
