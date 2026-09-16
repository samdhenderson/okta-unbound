import{j as b,Q as A,r as P}from"./iframe-tAvKsVeF.js";import{U as T}from"./UserDetailPanel-gNXlefUX.js";import{a as v,m as k}from"./fixtures-CsAiPaTu.js";import{D as x}from"./profileDisplayStore-CVAj7s6I.js";import"./preload-helper-PPVm8Dsz.js";import"./GroupMembershipsList-q3jce_D6.js";import"./GroupMembershipRow-DUICEuop.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./selectionStore-DExy1RDY.js";import"./groupContext-D0LcfWax.js";import"./groupRuleIndex-CUdSMoPG.js";import"./useGroupNameResolver-D8p1YH0d.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./ruleUtils-Vt2BA8lQ.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./UserAppsList-DWMO2jLO.js";import"./appSourceSummary-Cm8F9h35.js";import"./UserProfilePane-DR7OyECo.js";import"./profileAttributeBlocks-BIZLFcVk.js";import"./UserProfileAttributeList-CyAx5RFb.js";import"./ProfileEditCell-DdhUiuAe.js";import"./UserProfilePaneHeader-k585POsb.js";import"./ProfileDisplayEditor-X8q1K9AS.js";import"./ProfileDisplayAttributeEditRow-CbwN7nRI.js";import"./ProfileDisplayGrip-Yw9dihMQ.js";import"./ProfileDisplayDragGhost-DwlRzOro.js";import"./ProfileDisplayOptions-BbWoDSJc.js";import"./ProfileDisplaySectionEditor-BF_vPohL.js";import"./ProfileSaveModal-DPRDDHF5.js";import"./BlastRadiusReport-CB4UeF5q.js";import"./BlastRadiusGroupRow-CIRbFLni.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./BlastRadiusRuleRow-BGBdlvGL.js";import"./userDisplay-xpx41Abi.js";const{expect:h,fn:s,userEvent:f,within:E}=__STORYBOOK_MODULE_TEST__,S={rule:s(),group:s(),user:s(),app:s(),policy:s()},B={...k[10],status:"ACTIVE",created:"2023-01-15T10:00:00.000Z",lastLogin:"2026-07-15T08:30:00.000Z"},y="00gFAKE00000000000010",G={group:v,membershipType:"DIRECT",rules:[],attribution:"exact"},L={group:{id:y,type:"OKTA_GROUP",profile:{name:"Engineering Team",description:"All engineering department employees"}},membershipType:"RULE_BASED",rules:[{id:"0prFAKErule00001",name:"Auto-add Engineers",status:"ACTIVE",conditionExpression:'String.stringContains(user.department, "Engineering")',groupIds:[y],userAttributes:["department"]}],attribution:"exact"},C=[G,L],I=[{id:"0oaFAKEapp000001",label:"Salesforce",scope:"USER",grantGroupId:y,isProfileSource:!1},{id:"0oaFAKEapp000002",label:"Workday",scope:"GROUP",grantGroupId:y,isProfileSource:!0},{id:"0oaFAKEapp000003",label:"Figma",scope:"GROUP",isProfileSource:!1}],R={[y]:["Salesforce","Workday"]},a=(t,e,r,w={})=>({key:`profile.${t}`,name:t,label:e,kind:"base",value:r,raw:r,isEmpty:r==="",...w}),O=[a("id","User ID","00uFAKE0001",{key:"id",kind:"system",mono:!0}),a("status","Status","ACTIVE",{key:"status",kind:"system"}),a("login","Login","user@example.com"),a("email","Email","user@example.com"),a("firstName","First Name","Ada"),a("lastName","Last Name","Lovelace"),a("department","Department","Engineering"),a("title","Title","Staff Platform Engineer"),a("costCenter","Cost Center","CC-4471",{kind:"custom"})],U={department:["Auto-add Engineers"]},Re={title:"Users/UserDetailPanel",component:T,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"The Users tab’s selected-user surface: Groups, Apps and Profile as three panes of one card, with source attribution on every row. Panes are hidden, not unmounted, so each keeps its own filter text, source pills and open disclosures across a switch; the inactive ones carry the `hidden` attribute as well as the class, so they leave the accessibility tree.\n\nA count the panel does not have is omitted, never zeroed: the Apps tab shows no count until the pane has been visited and the list resolved. Page-level verbs live in `UserActionBar` above this card, not here."}}},decorators:[t=>b.jsx(A,{handlers:S,children:b.jsx("div",{className:"bg-canvas p-4",children:b.jsx(t,{})})})],args:{user:B,oktaOrigin:null,pane:"groups",onPaneChange:s(),memberships:C,isLoadingMemberships:!1,apps:I,isLoadingApps:!1,appsComplete:!0,appsByGroupId:R,attributes:O,isLoadingProfile:!1,profileConfig:x,onProfileConfigChange:s(),ruleReads:U},argTypes:{user:{description:"The selected user to render."},oktaOrigin:{description:"Okta origin for admin-console deep links; absent hides them."},pane:{description:"Which pane is on screen. Lifted, because the header reads it too."},onPaneChange:{description:"Selects a pane. The rung’s apps and schema loads gate on it."},memberships:{description:"The user’s memberships, each already classified as direct or rule-based."},isLoadingMemberships:{description:"True while the memberships are being loaded/analysed."},currentGroupId:{description:"Id of the detected group, highlighted in the list."},apps:{description:"The user’s app assignments, granting group filled in where known."},appsComplete:{description:"False when the app pagination walk did not finish; the pane must say so."},appsByGroupId:{description:"Applications each group grants, keyed by group id. Absent is not empty."},attributes:{description:"Every attribute of this user’s profile, empty ones included."},ruleReads:{description:"Attribute name → the rules that read it and grant access."}}},n={play:async({canvasElement:t})=>{const e=E(t),r=e.getByLabelText("Filter group memberships");await h(e.getByText(v.profile.name)).toBeInTheDocument(),await f.type(r,"Engineering"),await h(e.queryByText(v.profile.name)).toBeNull(),await h(e.getAllByText(/Engineering Team/).length).toBeGreaterThan(0)}},o={args:{pane:"apps"}},i={args:{pane:"profile"}},p={args:{memberships:[],isLoadingMemberships:!0}},c={args:{pane:"apps",apps:[],isLoadingApps:!0,appsByGroupId:{}},play:async({canvasElement:t})=>{const r=E(t).getByRole("tab",{name:/^Apps$/});await h(r).not.toHaveTextContent("0")}},m={args:{pane:"apps",appsComplete:!1}},d={args:{currentGroupId:v.id}},l={args:{oktaOrigin:"https://example.okta.com"}},u={render:t=>{const[e,r]=P.useState("groups");return b.jsx(T,{...t,pane:e,onPaneChange:r})},play:async({canvasElement:t})=>{const e=E(t),r=e.getByLabelText("Filter group memberships");await f.type(r,"Engineering"),await f.click(e.getByRole("tab",{name:/Profile/})),await f.click(e.getByRole("tab",{name:/Groups/})),await h(e.getByLabelText("Filter group memberships")).toHaveValue("Engineering")}},g={parameters:{viewport:{value:"sidepanelCompact"}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const filter = canvas.getByLabelText('Filter group memberships');
    await expect(canvas.getByText(mockGroup.profile.name)).toBeInTheDocument();
    await userEvent.type(filter, 'Engineering');

    // The rule-based membership survives the filter; the unrelated direct one does not.
    await expect(canvas.queryByText(mockGroup.profile.name)).toBeNull();
    await expect(canvas.getAllByText(/Engineering Team/).length).toBeGreaterThan(0);
  }
}`,...n.parameters?.docs?.source},description:{story:"The Groups pane — the default, so opening a user never pays for the other two.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    pane: 'apps'
  }
}`,...o.parameters?.docs?.source},description:{story:"The Apps pane: which apps the user has, and the group behind each one.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    pane: 'profile'
  }
}`,...i.parameters?.docs?.source},description:{story:"The Profile pane: every attribute, in the admin's categories, with rule reads marked.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [],
    isLoadingMemberships: true
  }
}`,...p.parameters?.docs?.source},description:{story:"Memberships are still loading — the Groups tab shows no count and the pane shows skeletons.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    pane: 'apps',
    apps: [],
    isLoadingApps: true,
    appsByGroupId: {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const appsTab = canvas.getByRole('tab', {
      name: /^Apps$/
    });
    await expect(appsTab).not.toHaveTextContent('0');
  }
}`,...c.parameters?.docs?.source},description:{story:"The Apps pane before its first load: no count at all, rather than a `0`.",...c.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    pane: 'apps',
    appsComplete: false
  }
}`,...m.parameters?.docs?.source},description:{story:"The app pagination walk did not finish, so the pane carries a standing caveat.",...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    currentGroupId: mockGroup.id
  }
}`,...d.parameters?.docs?.source},description:{story:"The group open in the admin page is highlighted in the membership list.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com'
  }
}`,...l.parameters?.docs?.source},description:{story:"Deep links to the Okta admin console render when an org origin is known.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: args => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [pane, setPane] = useState<UserDetailPane>('groups');
    return <UserDetailPanel {...args} pane={pane} onPaneChange={setPane} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const filter = canvas.getByLabelText('Filter group memberships');
    await userEvent.type(filter, 'Engineering');
    await userEvent.click(canvas.getByRole('tab', {
      name: /Profile/
    }));
    await userEvent.click(canvas.getByRole('tab', {
      name: /Groups/
    }));
    await expect(canvas.getByLabelText('Filter group memberships')).toHaveValue('Engineering');
  }
}`,...u.parameters?.docs?.source},description:{story:"A pane switch keeps the pane you left mounted, filter text and all.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"The 360px floor: three tabs with counts must not overflow the panel.",...g.parameters?.docs?.description}}};const Oe=["GroupsPane","AppsPane","ProfilePane","LoadingMemberships","AppsNotLoadedYet","IncompleteAppWalk","CurrentGroupHighlighted","WithOktaOriginLinks","PaneStateSurvivesASwitch","Narrow"];export{c as AppsNotLoadedYet,o as AppsPane,d as CurrentGroupHighlighted,n as GroupsPane,m as IncompleteAppWalk,p as LoadingMemberships,g as Narrow,u as PaneStateSurvivesASwitch,i as ProfilePane,l as WithOktaOriginLinks,Oe as __namedExportsOrder,Re as default};
