import{j as T}from"./iframe-tAvKsVeF.js";import{U as O}from"./UserRungHeader-BBP3oaZl.js";import"./preload-helper-PPVm8Dsz.js";import"./userDisplay-xpx41Abi.js";import"./dateFormat-tpkRVL7u.js";import"./status-Bn0B6Ou-.js";import"./useWorkingSet-xtNd8BCe.js";import"./workingSetStore-DPT9Q6n6.js";const{expect:t,fn:s,within:v}=__STORYBOOK_MODULE_TEST__,n={id:"00uFAKE00000000000001",status:"ACTIVE",created:"2024-03-11T09:12:00.000Z",lastLogin:"2026-08-17T08:41:00.000Z",profile:{login:"user@example.com",email:"user@example.com",firstName:"Ada",lastName:"Lovelace",department:"Platform Engineering",title:"Staff Engineer"}},w={...n,id:"00uFAKE00000000000002",status:"PROVISIONED",profile:{...n.profile,firstName:"Wilhelmina-Constance",lastName:"Featherstonehaugh-Villanueva"}},C=e=>{const a=[{key:"root",label:"User Search",depth:0,isCurrent:e.length===0,...e.length===0?{}:{onSelect:s()}},...e.map((y,b)=>({key:`${y.kind}-${y.userId}`,label:y.kind==="compare"?"Compare users":y.userName,depth:b+1,isCurrent:b===e.length-1,...b===e.length-1?{}:{onSelect:s()}}))];return{entries:e,currentEntry:e[e.length-1],depth:e.length,isRoot:e.length===0,trail:a,transition:null,push:s(),pop:s(),popTo:s(),reset:s()}},f=C([]),B=C([{kind:"detail",userId:n.id,userName:"Ada Lovelace"}]),N=C([{kind:"detail",userId:w.id,userName:"Wilhelmina-Constance Featherstonehaugh-Villanueva"}]),x=C([{kind:"detail",userId:n.id,userName:"Ada Lovelace"},{kind:"compare",userId:n.id,userName:"Ada Lovelace"}]),R={title:"Users/UserRungHeader",component:O,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"What the Users tab’s single `PageHeader` says on each rung of its view stack: **search** shows the stack’s root label, **detail** the user’s display name plus the `userIdentity` region, and **compare** `Compare users`, because the subject there is two users.\n\nAn unloaded count is absent, not `0` — `appCount: undefined` drops the metric entirely, and the group count does the same while memberships load. The header never falls back to the entity detected on the live Okta tab; that is `ContextBar`’s subject."}}},decorators:[e=>T.jsx("div",{className:"bg-canvas",children:T.jsx(e,{})})],args:{nav:B,isDetailOpen:!0,isCompareOpen:!1,selectedUser:n,membershipCount:12,isLoadingMemberships:!1,appCount:void 0,oktaOrigin:"https://example.okta.com",isActive:!0},argTypes:{nav:{description:"The tab’s sub-navigation stack: search → a user’s detail → comparison."},isDetailOpen:{description:"Whether a user’s detail page is the view on screen."},isCompareOpen:{description:"Whether a comparison is the view on screen."},selectedUser:{description:"The user the tab has loaded, or `null`."},membershipCount:{description:"How many groups that user is in."},isLoadingMemberships:{description:"True while memberships load — the group count is then omitted, not zeroed."},appCount:{description:"How many apps the user has; `undefined` omits the metric rather than zeroing it."},oktaOrigin:{description:'Origin for the header’s "Open in Okta" link; it hides without one.'},isActive:{description:"Whether the Users tab is the visible one, so a hidden panel publishes no `--header-h`."}}},r={},o={args:{nav:f,isDetailOpen:!1,selectedUser:null,membershipCount:0},play:async({canvasElement:e})=>{const a=v(e);await t(a.getByRole("heading",{level:1,name:"User Search"})).toBeInTheDocument()}},i={args:{appCount:void 0},play:async({canvasElement:e})=>{const a=v(e);await t(a.getByText("12")).toBeInTheDocument(),await t(a.queryByText("apps")).toBeNull(),await t(a.queryByText("app")).toBeNull()}},p={args:{appCount:7},play:async({canvasElement:e})=>{const a=v(e);await t(a.getByText("apps")).toBeInTheDocument()}},c={args:{appCount:1},play:async({canvasElement:e})=>{const a=v(e);await t(a.getByText("app")).toBeInTheDocument()}},l={args:{isLoadingMemberships:!0,appCount:void 0}},m={args:{nav:N,selectedUser:w,membershipCount:41,appCount:23}},d={args:{nav:x,isCompareOpen:!0},play:async({canvasElement:e})=>{const a=v(e);await t(a.getByRole("heading",{level:1,name:"Compare users"})).toBeInTheDocument()}},u={args:{selectedUser:null}},h={args:{oktaOrigin:null,appCount:7}},g={args:{nav:N,selectedUser:w,membershipCount:41,appCount:23},parameters:{viewport:{value:"sidepanelCompact"}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"The detail rung, with memberships loaded and the apps count not yet known.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    nav: searchNav,
    isDetailOpen: false,
    selectedUser: null,
    membershipCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', {
      level: 1,
      name: 'User Search'
    })).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"The root rung: no identity region, no breadcrumbs, and the tab’s own subtitle.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    appCount: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('12')).toBeInTheDocument();
    await expect(canvas.queryByText('apps')).toBeNull();
    await expect(canvas.queryByText('app')).toBeNull();
  }
}`,...i.parameters?.docs?.source},description:{story:"The Apps pane has not answered yet, so there is no apps metric at all — not `0 apps`.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    appCount: 7
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('apps')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"The same rung once the Apps pane resolved: the metric appears, stating a fact.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    appCount: 1
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('app')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Exactly one app: the metric pluralises with the number rather than saying `1 apps`.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    isLoadingMemberships: true,
    appCount: undefined
  }
}`,...l.parameters?.docs?.source},description:{story:"Memberships still loading, so the group count is omitted on the same principle.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    nav: longNameNav,
    selectedUser: longNameUser,
    membershipCount: 41,
    appCount: 23
  }
}`,...m.parameters?.docs?.source},description:{story:"A long display name at full width, with the status badge in the trailing cluster so the title keeps its line.",...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    nav: compareNav,
    isCompareOpen: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', {
      level: 1,
      name: 'Compare users'
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"The comparison rung: the subject is two users, so there is no identity region at all.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    selectedUser: null
  }
}`,...u.parameters?.docs?.source},description:{story:"The loaded user is not yet the one this rung is for, so the push-time snapshot name stands alone.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: null,
    appCount: 7
  }
}`,...h.parameters?.docs?.source},description:{story:'No org origin, so the header carries no "Open in Okta" action rather than a broken one.',...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    nav: longNameNav,
    selectedUser: longNameUser,
    membershipCount: 41,
    appCount: 23
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"The 360px floor, where the title, the status badge and the identity facts all compete.",...g.parameters?.docs?.description}}};const W=["Default","SearchRung","DetailWithoutAppsMetric","DetailWithAppsMetric","DetailWithOneApp","Loading","LongDisplayName","CompareRung","SnapshotNameOnly","WithoutOktaOrigin","Compact"];export{g as Compact,d as CompareRung,r as Default,p as DetailWithAppsMetric,c as DetailWithOneApp,i as DetailWithoutAppsMetric,l as Loading,m as LongDisplayName,o as SearchRung,u as SnapshotNameOnly,h as WithoutOktaOrigin,W as __namedExportsOrder,R as default};
