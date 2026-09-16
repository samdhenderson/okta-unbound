import{G as v}from"./GroupDetailView-BcUC5VFL.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./GroupOverviewPane-B2Obh1r4.js";import"./GroupMembersSection-D3UeX2bX.js";import"./MemberExplorer-CzoKVp7t.js";import"./useDebouncedValue-gYL4cHMr.js";import"./useMemberMfaScan-BWVC8bU_.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./selectionStore-DExy1RDY.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./userDisplay-xpx41Abi.js";import"./MemberSearchBar-CN-EWnJT.js";import"./useMemberFilters-LFYkVxqR.js";import"./MemberFilterPanel-fb43Reif.js";import"./MfaScanButton-B10gRaS5.js";import"./MemberSourceFilterBar-Dx0w3ZXE.js";import"./AttributeFilterList-URvyoqeI.js";import"./memberAnalytics-BqndU7JT.js";import"./ActiveFilterChips-DX7-p1iN.js";import"./CopyMembersModal-D36olA9y.js";import"./BreakdownDetailsModal-BoybENQd.js";import"./BreakdownReport-RtX7G5yn.js";import"./MemberList-DciIOLLY.js";import"./useStaggerReveal-XqT17AGi.js";import"./MemberRow-Dl-pQSx-.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";import"./MemberSourceNotes-D0AtajgE.js";import"./RuleLinkRow-CWX4uAdz.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";import"./GroupAccessSection-Bf58aySx.js";import"./GroupAppRow-BL6kdfYQ.js";import"./dateFormat-tpkRVL7u.js";import"./appFilters-B4zycet6.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./GroupRulesSection-CXK5bPU1.js";import"./RuleCard-DOJWVDy0.js";import"./ruleUtils-Vt2BA8lQ.js";import"./GroupPushSection-DqaD8zzP.js";import"./GroupInsightsPane-CqAAKXw0.js";import"./GroupMetadataSection-BM0RqBd_.js";import"./AttributeSpreadSection-CJZO21pC.js";import"./AttributeHealthCard-BRZ4C4H2.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./GroupMfaCoverageSection-DrD-hGWG.js";import"./GroupActionBar-Cln1Hwce.js";import"./AddGroupMemberModal-DdRXzanx.js";import"./CompareGroupModal-CQnBobZq.js";import"./CreateFeedingRuleModal-DYDR6Aj1.js";import"./GroupComparisonModal-SMAOQFHU.js";import"./csvUtils-DgNWYp8m.js";import"./memberSourceIndex-XhEnFrTq.js";import"./memberRuleAttribution-CD0Zofjz.js";import"./memberSourceCache-BoDWg628.js";import"./useOwedLoad-DMHsWWoG.js";import"./groupRuleIndex-CUdSMoPG.js";import"./useGroupNameResolver-D8p1YH0d.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./useDebouncedUserSearch-CZQzsugy.js";import"./consolidation-JtCo9PAQ.js";import"./useWorkingSetEntry-u-jegqSL.js";import"./workingSetStore-DPT9Q6n6.js";import"./useRefreshSubject-C1Lrhmtk.js";const{expect:d,fn:u,userEvent:b,within:y}=__STORYBOOK_MODULE_TEST__,g={id:"00gFAKEGROUP0001",name:"Engineering — All",description:"Everyone in the Engineering org, fed by the department rule.",type:"OKTA_GROUP",memberCount:412,hasRules:!0,ruleCount:1,created:new Date("2024-01-15T09:00:00Z"),lastUpdated:new Date("2026-06-01T14:30:00Z")},w={...g,id:"00gFAKEGROUP0002",name:"Platform Leads",memberCount:6,hasRules:!1,ruleCount:0},qe={title:"Groups/GroupDetailView",component:v,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"The container half of the Group Detail rung: five panes behind one `Tabs` strip — Overview, Members, Access, Rules and Insights — none gated behind another, with `activeTab` as page-local state rather than sub-navigation.\n\nIt owns the read-only loads and hands their state to pure sections. `initialPane` only chooses where a caller lands; nothing costly runs unasked, and the Insights pane leaves its per-member MFA scan armed and un-run."}}},argTypes:{group:{description:"The group to explain; changing its identity re-opens the loads."},targetTabId:{description:"Connected Okta tab id; reads are disabled when null."},oktaOrigin:{description:'Org origin behind every "View in Okta" affordance.'},onNavigateToRule:{description:"Deep-links a rule in the Rules tab."},initialPane:{description:"Which pane the caller asked to land on."},isActive:{description:"Whether the Groups tab is the visible one; hidden defers the loads."},onExportGroup:{description:"Opens the Export tab scoped to this group; omitting it omits the action."}},args:{group:g,targetTabId:42,oktaOrigin:"https://example.okta.com",onNavigateToRule:u(),onExportGroup:u(),isActive:!0}},e={},t={args:{initialPane:"members"}},r={args:{initialPane:"access"}},a={args:{initialPane:"rules"}},o={args:{initialPane:"insights"}},s={args:{group:w}},i={args:{targetTabId:null}},n={args:{onExportGroup:void 0}},p={args:{isActive:!1}},c={play:async({canvasElement:h})=>{const m=y(h),l=m.getByRole("tab",{name:"Overview"});await d(l).toHaveAttribute("aria-selected","true"),await b.click(m.getByRole("tab",{name:"Access"})),await d(m.getByRole("tab",{name:"Access"})).toHaveAttribute("aria-selected","true"),await d(l).toHaveAttribute("aria-selected","false")}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"A plain drill-in: the Overview pane, with the other four one tap away.",...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    initialPane: 'members'
  }
}`,...t.parameters?.docs?.source},description:{story:"Landed on Members — the one pane a caller can ask for that also runs its analysis.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    initialPane: 'access'
  }
}`,...r.parameters?.docs?.source},description:{story:"Landed on Access: what membership grants, plus app push.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    initialPane: 'rules'
  }
}`,...a.parameters?.docs?.source},description:{story:"Landed on Rules: the two rule relationships, listed apart.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    initialPane: 'insights'
  }
}`,...o.parameters?.docs?.source},description:{story:"Landed on Insights, whose MFA scan stays armed and un-run until asked.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    group: smallGroup
  }
}`,...s.parameters?.docs?.source},description:{story:"A small group, where the roster is inside the auto-load budget.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  }
}`,...i.parameters?.docs?.source},description:{story:"No Okta tab connected: every read is disabled rather than failing quietly.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    onExportGroup: undefined
  }
}`,...n.parameters?.docs?.source},description:{story:"No export wired by the host, so the action is omitted rather than shipped disabled.",...n.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    isActive: false
  }
}`,...p.parameters?.docs?.source},description:{story:"Another top-level tab is on screen: the rung stays mounted and defers its loads.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const overview = canvas.getByRole('tab', {
      name: 'Overview'
    });
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(canvas.getByRole('tab', {
      name: 'Access'
    }));
    await expect(canvas.getByRole('tab', {
      name: 'Access'
    })).toHaveAttribute('aria-selected', 'true');
    await expect(overview).toHaveAttribute('aria-selected', 'false');
  }
}`,...c.parameters?.docs?.source},description:{story:`The pane strip driven the way a reader drives it: selecting Access moves the
body without leaving the rung.`,...c.parameters?.docs?.description}}};const Ye=["Default","MembersPane","AccessPane","RulesPane","InsightsPane","SmallGroup","Disconnected","WithoutExport","Inactive","SwitchingPanes"];export{r as AccessPane,e as Default,i as Disconnected,p as Inactive,o as InsightsPane,t as MembersPane,a as RulesPane,s as SmallGroup,c as SwitchingPanes,n as WithoutExport,Ye as __namedExportsOrder,qe as default};
