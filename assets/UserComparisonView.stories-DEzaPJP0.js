import{U as q}from"./UserComparisonView-DSnX_0GU.js";import{m as N,a as Q}from"./fixtures-CsAiPaTu.js";import{c as V}from"./CauseWorklist-BP5lMtA6.js";import{D as U}from"./profileDisplayStore-CVAj7s6I.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./ComparisonSearchPhase-CqtZ00Ud.js";import"./UserSearchResults-A-1SA20Z.js";import"./useStaggerReveal-XqT17AGi.js";import"./userDisplay-xpx41Abi.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./ComparisonHero-B2VUlJh6.js";import"./ComparisonTabBar-DtT1dros.js";import"./ComparisonOverviewTab-B1tUxBO9.js";import"./ComparisonDiffTab-DYIRaIyU.js";import"./ComparisonAttributesTab-CtQ7hTbh.js";import"./ComparisonAttributeRow-D8-3vL11.js";import"./ProfileEditCell-DdhUiuAe.js";import"./ComparisonAttributesToolbar-dc3pEzSe.js";import"./profileAttributeBlocks-BIZLFcVk.js";import"./ProfileSaveModal-DPRDDHF5.js";import"./BlastRadiusReport-CB4UeF5q.js";import"./BlastRadiusGroupRow-CIRbFLni.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./membershipVerdict-79Na81vF.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";import"./BlastRadiusRuleRow-BGBdlvGL.js";import"./ruleUtils-Vt2BA8lQ.js";import"./AppScopeIndicator-DosuQ_3O.js";import"./GroupSourceIndicator-Dh0LXLeG.js";import"./CauseWorklistRow-CE38mMU8.js";import"./ClauseGroupList-0V5tF3Gv.js";import"./groupContext-D0LcfWax.js";import"./index-Dob3nYDb.js";const{expect:a,fn:r,userEvent:E,waitFor:A,within:S}=__STORYBOOK_MODULE_TEST__,F=N[10],O=N[11],P={id:"0prFAKErule00001",name:"Contractors → VPN Access",status:"ACTIVE",condition:'user.userType == "Contractor"',conditionExpression:'user.userType == "Contractor"',groupIds:["group456"],userAttributes:["userType"],created:"2026-01-01T00:00:00.000Z",lastUpdated:"2026-01-01T00:00:00.000Z"},k=(t,e,I={})=>({group:{...Q,id:t,profile:{name:e,description:""}},membershipType:"DIRECT",rules:[],attribution:"exact",...I}),H=k("group123","Engineering"),D=k("group456","VPN Access",{membershipType:"RULE_BASED",rules:[P],attribution:"exact"}),K=k("group789","Design Review"),s=(t,e,I,_,z,G={})=>({key:`profile.${t}`,name:t,label:e,kind:"base",contextValue:I,comparedValue:_,verdict:z,categoryKey:"organization",hiddenByConfig:!1,...G}),Z=[s("department","Department","Engineering","Design","differs"),s("manager","Manager","dana@example.com","","onlyContext"),s("costCenter","Cost center","","CC-42","onlyCompared"),s("userType","User type","Employee","Employee","same",{categoryKey:"identity"}),s("nickName","Nickname","","","bothEmpty",{categoryKey:""})],M=[s("employeeNumber","Employee number","E-0001","E-0002","differs",{hiddenByConfig:!0})],L={...U,categories:[{key:"identity",name:"Identity"},{key:"organization",name:"Organization"},{key:"contact-locale",name:"Contact & locale"}],assign:{userType:"identity",department:"organization",manager:"organization",costCenter:"organization",employeeNumber:"organization",nickName:""},attrOrder:["userType","department","manager","costCenter","employeeNumber","nickName"],hidden:{employeeNumber:!0}},R=(t,e)=>({key:t,userName:e,cells:{},isEditing:!1,isSaving:!1,hasChanges:!1,hasInvalid:!1,canEdit:!1,begin:r(),cancel:r(),requestSave:r()}),C=(t={})=>({comparedUser:null,searchQuery:"",setSearchQuery:r(),searchResults:[],isSearching:!1,activeTab:"overview",setActiveTab:r(),groupBuckets:{onlyCompared:[],shared:[],onlyContext:[]},appBuckets:{onlyCompared:[],shared:[],onlyContext:[]},causes:void 0,attributeParity:{rows:[],hiddenRows:[],hiddenDifferences:0,differenceCount:0},attributeConfig:U,attributeRuleReads:{},attributeEdit:{context:R("context","First11 Last11"),compared:R("compared","First12 Last12"),pendingSave:null},groupSimilarity:0,appSimilarity:0,overallSimilarity:0,similarityScope:"both",appsIncomplete:!1,isLoading:!1,loadError:null,addingGroupId:null,addError:null,setAddError:r(),addToContext:r(),addToCompared:r(),contextName:"First11 Last11",resolveGroupName:()=>{},comparedName:"",selectUser:r(),changeUser:r(),...t}),o=(t={})=>C({comparedUser:O,comparedName:"First12 Last12",groupBuckets:{onlyCompared:[D],shared:[H],onlyContext:[K]},appBuckets:{onlyCompared:[{id:"app2",label:"Salesforce",scope:"USER"},{id:"app4",label:"Zoom"}],shared:[{id:"app1",label:"Slack",scope:"USER"}],onlyContext:[{id:"app3",label:"Figma",scope:"GROUP"}]},causes:V({onlyCompared:[D],contextUser:F,rules:[P]}),groupSimilarity:33,appSimilarity:33,overallSimilarity:33,...t}),Re={title:"Users/UserComparisonView",component:q,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The two-user comparison surface, independent of how it is shown.\n\nPurely presentational: every piece of state — search, load, bucketing, similarity, optimistic group-copy — is owned by `useUserComparison` and handed in whole as the `comparison` prop. The host instantiates that hook, so a comparison survives its surface being hidden."}}},args:{contextUser:F,comparison:C()},argTypes:{contextUser:{description:'The "context" user being compared from (the user currently in focus).'},comparison:{description:"The whole comparison view model, from the host's `useUserComparison` instance."}}},n={},i={args:{comparison:C({searchQuery:"last12",isSearching:!0})}},c={args:{comparison:C({searchQuery:"last12",searchResults:[O]})}},p={args:{comparison:o()}},m={args:{comparison:o({activeTab:"groups"})}},d={args:{comparison:o({activeTab:"apps"})}},l={args:{comparison:o({isLoading:!0})}},u={args:{comparison:o({loadError:"Failed to load memberships"})}},y={args:{comparison:o({appsIncomplete:!0,appSimilarity:null,similarityScope:"groups-only",overallSimilarity:33})}},h={args:{comparison:o({activeTab:"apps",appsIncomplete:!0,appSimilarity:null,similarityScope:"groups-only",overallSimilarity:33,appBuckets:{onlyCompared:[],shared:[],onlyContext:[]}})}},g={args:{comparison:o({activeTab:"groups",addError:"Insufficient permissions"})}},b={args:{comparison:o({activeTab:"groups",addingGroupId:D.group.id})}},x=(t={})=>o({activeTab:"attributes",attributeParity:{rows:Z,hiddenRows:M,hiddenDifferences:1,differenceCount:3},attributeConfig:L,attributeRuleReads:{department:["Engineering → VPN Access"]},...t}),T={args:{comparison:x()},play:async({canvasElement:t})=>{const e=S(t);await E.click(e.getByRole("button",{name:/^All/})),await A(()=>a(e.getByText("User type")).toBeInTheDocument()),a(e.getByText("Nickname")).toBeInTheDocument(),a(e.getAllByText("— not set").length).toBeGreaterThan(0),a(e.queryByText("Contact & locale")).not.toBeInTheDocument()}},v={args:{comparison:x()},play:async({canvasElement:t})=>{const e=S(t);a(e.getByText("1 differing attribute hidden by your display config")).toBeInTheDocument(),a(e.queryByText("Employee number")).not.toBeInTheDocument(),await E.click(e.getByRole("button",{name:"Show"})),await A(()=>a(e.getByText("Employee number")).toBeInTheDocument()),a(e.getByText("Hidden")).toBeInTheDocument()}},f={args:{comparison:x({attributeConfig:{...L,showApiNames:!0}})},play:async({canvasElement:t})=>{const e=S(t);await A(()=>a(e.getByText("department")).toBeInTheDocument()),a(e.queryByText("Department")).not.toBeInTheDocument()}},w={args:{comparison:x()},play:async({canvasElement:t})=>{const e=S(t);await E.type(e.getByLabelText("Filter attributes by name or value"),"zzzz"),await A(()=>a(e.getByText("No attributes match")).toBeInTheDocument())}},B={args:{comparison:x()},parameters:{viewport:{value:"sidepanelCompact"}},play:async({canvasElement:t})=>{const e=S(t);await E.click(e.getByRole("button",{name:/^All/})),await A(()=>a(e.getByText("User type")).toBeInTheDocument())}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Phase 1 — no compared user picked yet, so the search phase is shown.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: comparison({
      searchQuery: 'last12',
      isSearching: true
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"Phase 1 with a committed query in flight.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: comparison({
      searchQuery: 'last12',
      searchResults: [comparedUser]
    })
  }
}`,...c.parameters?.docs?.source},description:{story:"Phase 1 with results to choose from.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded()
  }
}`,...p.parameters?.docs?.source},description:{story:"Phase 2 — the overview tab of a loaded comparison.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      activeTab: 'groups'
    })
  }
}`,...m.parameters?.docs?.source},description:{story:"Phase 2, Groups tab: the copyable diff in both directions.",...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      activeTab: 'apps'
    })
  }
}`,...d.parameters?.docs?.source},description:{story:"Phase 2, Apps tab: the same diff shape with no copy affordance, plus each row's\nassignment source. `Direct` is the scope Okta reports, not a claim that no group\nalso grants the app.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      isLoading: true
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"The hero and tab bar stay mounted while the two loads settle; only the body is gated.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      loadError: 'Failed to load memberships'
    })
  }
}`,...u.parameters?.docs?.source},description:{story:"A failed membership load replaces the tab body with a `danger` alert; the hero survives.",...u.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      appsIncomplete: true,
      appSimilarity: null,
      similarityScope: 'groups-only',
      // The group figure alone, not the blended 33% the other stories show.
      overallSimilarity: 33
    })
  }
}`,...y.parameters?.docs?.source},description:{story:'A failed app read is advisory: the tabs stay, the app card reports "overlap unavailable" rather than 0%, and the headline says it covers groups only.',...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      activeTab: 'apps',
      appsIncomplete: true,
      appSimilarity: null,
      similarityScope: 'groups-only',
      overallSimilarity: 33,
      // Nothing arrived at all — the case where the old empty text would have
      // claimed "Neither user is assigned any apps."
      appBuckets: {
        onlyCompared: [],
        shared: [],
        onlyContext: []
      }
    })
  }
}`,...h.parameters?.docs?.source},description:{story:"The same failure seen from the Apps tab, where the diff itself is the caveated thing.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      activeTab: 'groups',
      addError: 'Insufficient permissions'
    })
  }
}`,...g.parameters?.docs?.source},description:{story:"A failed group copy surfaces a dismissible `danger` alert above the diff.",...g.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: loaded({
      activeTab: 'groups',
      addingGroupId: gOnlyCompared.group.id
    })
  }
}`,...b.parameters?.docs?.source},description:{story:"A copy in flight: the lock is global, so every Add button disables while one request is outstanding.",...b.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: withAttributes()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /^All/
    }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
    // The two agreements and one of the non-answers.
    expect(canvas.getByText('Nickname')).toBeInTheDocument();
    expect(canvas.getAllByText('— not set').length).toBeGreaterThan(0);
    // A configured category nothing landed in is dropped, not rendered empty.
    expect(canvas.queryByText('Contact & locale')).not.toBeInTheDocument();
  }
}`,...T.parameters?.docs?.source},description:{story:"Phase 2, Attributes tab, switched to **All** so all five verdicts are on screen\nat once. `Department` carries a `1 rule` chip, and a configured category nothing\nlanded in is dropped rather than rendered empty.",...T.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: withAttributes()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('1 differing attribute hidden by your display config')).toBeInTheDocument();
    expect(canvas.queryByText('Employee number')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show'
    }));
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:`An attribute the display config hides but the two users differ on is counted and
disclosed rather than dropped; the play function reveals it and checks it arrives
marked as hidden.`,...v.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: withAttributes({
      attributeConfig: {
        ...ATTRIBUTE_CONFIG,
        showApiNames: true
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('department')).toBeInTheDocument());
    expect(canvas.queryByText('Department')).not.toBeInTheDocument();
  }
}`,...f.parameters?.docs?.source},description:{story:"`showApiNames` renders the Okta name in mono instead of the human label.",...f.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: withAttributes()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter attributes by name or value'), 'zzzz');
    await waitFor(() => expect(canvas.getByText('No attributes match')).toBeInTheDocument());
  }
}`,...w.parameters?.docs?.source},description:{story:'Filtered to nothing — distinct from "there are no attributes to compare".',...w.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    comparison: withAttributes()
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /^All/
    }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
  }
}`,...B.parameters?.docs?.source},description:{story:`The compact side panel: values wrap rather than truncate, so two values differing
only in their tails can never render identically.`,...B.parameters?.docs?.description}}};const Ne=["SearchPhase","Searching","SearchResults","OverviewTab","GroupsTab","AppsTab","Loading","LoadError","AppsIncomplete","AppsIncompleteOnAppsTab","AddError","CopyInFlight","AttributesTab","AttributesHiddenDifferences","AttributesApiNames","AttributesFilteredToNothing","AttributesCompactPanel"];export{g as AddError,y as AppsIncomplete,h as AppsIncompleteOnAppsTab,d as AppsTab,f as AttributesApiNames,B as AttributesCompactPanel,w as AttributesFilteredToNothing,v as AttributesHiddenDifferences,T as AttributesTab,b as CopyInFlight,m as GroupsTab,u as LoadError,l as Loading,p as OverviewTab,n as SearchPhase,c as SearchResults,i as Searching,Ne as __namedExportsOrder,Re as default};
