import u from"./AppsTab-CTuu6qIf.js";import{u as g,m as f}from"./useOktaApi.mock-bZSfZMMp.js";import{c as w,s as h}from"./iframe-tAvKsVeF.js";import{o as d}from"./orgSnapshotStore-BNo8k5ja.js";import"./AppsToolbar-CItnWmfQ.js";import"./AppsListPanel-5SkoTPi2.js";import"./useStaggerReveal-XqT17AGi.js";import"./AppListItem-C9ztEllB.js";import"./revealOnHover-DU3PDCIu.js";import"./useEntityQuery-Dec7sZ1f.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./dateFormat-tpkRVL7u.js";import"./appFilters-B4zycet6.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./useOwedLoad-DMHsWWoG.js";import"./useOrgSnapshot-XJDRwdwN.js";import"./useRefreshSubject-C1Lrhmtk.js";import"./types-aoYpQiYS.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./index-Dob3nYDb.js";const{expect:l,fn:S,userEvent:b,within:y}=__STORYBOOK_MODULE_TEST__,m="https://example.okta.com";async function p(a){await d.clearOrigin(m),a.length>0&&await d.upsertMany("apps",m,a.map(e=>({id:e.id,entity:e})),Date.now()),await d.patchMeta("apps",m,{complete:!0,lastFullWalkAt:Date.now(),itemCount:a.length})}const A=[{id:"0oaFAKE0001",name:"salesforce",label:"Salesforce",status:"ACTIVE",signOnMode:"SAML_2_0",created:"2026-01-15T09:00:00.000Z",lastUpdated:"2026-06-02T11:30:00.000Z"},{id:"0oaFAKE0002",name:"workday",label:"Workday HR",status:"INACTIVE",signOnMode:"SAML_2_0",created:"2026-03-01T09:00:00.000Z"},{id:"0oaFAKE0003",name:"bookmark",label:"Internal Wiki",status:"ACTIVE",signOnMode:"BOOKMARK",created:"2025-11-20T09:00:00.000Z"},{id:"0oaFAKE0004",name:"okta_org2org",status:"ACTIVE",signOnMode:"SAML_2_0"}],z={title:"Apps/AppsTab",component:u,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"Applications tab shell: browse, search, filter and sort the org's application inventory. It is read-only by construction — the rows come from the background-owned org snapshot, and the tab reaches for the API only lazily, per expanded row. A failed load surfaces as a dismissible `danger` banner rather than an empty list presented as complete."}}},argTypes:{targetTabId:{description:"Chrome tab id of the connected Okta tab; the inventory load is skipped when null."},oktaOrigin:{description:`Okta org origin used to build each row's "Open in Okta" deep link.`}},args:{targetTabId:1,oktaOrigin:"https://example.okta.com"},beforeEach:async()=>{w(),g.mockReturnValue(f({getAppAssignmentCounts:S(async()=>({users:128,groups:4}))})),await p(A)}},t={play:async({canvasElement:a})=>{await l(await y(a).findByText("Salesforce")).toBeInTheDocument()}},r={play:async({canvasElement:a})=>{const e=y(a);await e.findByText("Salesforce"),await b.type(e.getByRole("searchbox",{name:"Search applications"}),"Workday"),await l(await e.findByText("Workday HR")).toBeInTheDocument(),await l(e.queryByText("Salesforce")).not.toBeInTheDocument()}},s={beforeEach:async()=>{await p([]),h(()=>new Promise(()=>{}))}},o={beforeEach:async()=>{await p([])}},n={beforeEach:async()=>{await p([]),h(async()=>({success:!1,error:"Failed to fetch apps"}))}},i={args:{targetTabId:null}},c={beforeEach:async()=>{await p(Array.from({length:60},(a,e)=>({id:`0oaFAKE${String(e).padStart(4,"0")}`,name:`sample_app_${e}`,label:`Sample App ${e+1}`,status:e%4===0?"INACTIVE":"ACTIVE",signOnMode:e%3===0?"BOOKMARK":"SAML_2_0",created:"2026-02-01T09:00:00.000Z"})))}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  // The rows come from IndexedDB, not a mocked fetch, so this asserts the seed reached
  // the screen: without it the story would "pass" while rendering the empty state.
  play: async ({
    canvasElement
  }) => {
    await expect(await within(canvasElement).findByText('Salesforce')).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source},description:{story:"Four applications loaded — the populated list with its toolbar.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Salesforce');
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Search applications'
    }), 'Workday');
    await expect(await canvas.findByText('Workday HR')).toBeInTheDocument();
    await expect(canvas.queryByText('Salesforce')).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"Searching narrows the inventory to the rows whose label matches.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  beforeEach: async () => {
    await seedInventory([]);
    setSyncSnapshotResponder(() => new Promise<unknown>(() => {}));
  }
}`,...s.parameters?.docs?.source},description:{story:"The inventory sync is still in flight — full-panel spinner.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  beforeEach: async () => {
    await seedInventory([]);
  }
}`,...o.parameters?.docs?.source},description:{story:'An org with no applications — the "nothing loaded" empty state.',...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  beforeEach: async () => {
    await seedInventory([]);
    setSyncSnapshotResponder(async () => ({
      success: false,
      error: 'Failed to fetch apps'
    }));
  }
}`,...n.parameters?.docs?.source},description:{story:"The inventory load failed — dismissible `danger` banner above the empty list.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  }
}`,...i.parameters?.docs?.source},description:{story:"No Okta tab connected — nothing is fetched and Refresh is disabled.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  beforeEach: async () => {
    await seedInventory(Array.from({
      length: 60
    }, (_, i) => ({
      id: \`0oaFAKE\${String(i).padStart(4, '0')}\`,
      name: \`sample_app_\${i}\`,
      label: \`Sample App \${i + 1}\`,
      status: i % 4 === 0 ? 'INACTIVE' : 'ACTIVE',
      signOnMode: i % 3 === 0 ? 'BOOKMARK' : 'SAML_2_0',
      created: '2026-02-01T09:00:00.000Z'
    })) as OktaAppListItem[]);
  }
}`,...c.parameters?.docs?.source},description:{story:"A larger inventory (60 generated apps), exercising the scrollable list.",...c.parameters?.docs?.description}}};const G=["Default","Searching","Loading","Empty","ErrorState","Disconnected","LargeInventory"];export{t as Default,i as Disconnected,o as Empty,n as ErrorState,c as LargeInventory,s as Loading,r as Searching,G as __namedExportsOrder,z as default};
