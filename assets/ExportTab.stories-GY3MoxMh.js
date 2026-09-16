import{j as l}from"./iframe-tAvKsVeF.js";import{ExportTab as m}from"./index-Ct8qbnKc.js";import{O as u}from"./OrgEntityIndexContext--wR1D6q_.js";import{s as c}from"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./index-Dob3nYDb.js";import"./csvUtils-DgNWYp8m.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./ruleOrphans-DKT5VstI.js";import"./types-aoYpQiYS.js";import"./dateFormat-tpkRVL7u.js";import"./homeReports-5OcK7tHC.js";import"./orgFigures-Cf-XQIgx.js";import"./useSelection-DlTpY3y-.js";import"./EntityPicker-jBCPLf1x.js";import"./ExportContextBar-Kptm7WPs.js";import"./ExportFilterBox-B0xYA_h5.js";import"./ColumnPicker-BD3tvQ2E.js";import"./PresetControls-Hu2FMg0X.js";import"./ExportPreviewTable-CMCHHMCx.js";import"./useOrgSnapshot-XJDRwdwN.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./ruleUtils-Vt2BA8lQ.js";const{expect:s,userEvent:p,within:d}=__STORYBOOK_MODULE_TEST__,q={title:"Export/ExportTab",component:m,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Descriptor-driven Export tab, orchestrated by `useExportTab`. The `pick` phase lists exportable entities; choosing one enters `configure` — context picker, filter box, column picker, presets, preview and download."}}},decorators:[t=>l.jsx(u,{oktaOrigin:null,targetTabId:null,enabled:!1,children:l.jsx(t,{})})],argTypes:{targetTabId:{description:"Chrome tab id of the connected Okta tab; export/preview are disabled when absent."},oktaOrigin:{description:"Okta org origin used to build per-row deep links in the preview."}},args:{targetTabId:42,oktaOrigin:"https://example.okta.com"}},n={},a={play:async({canvasElement:t})=>{const e=d(t);await p.click(e.getByRole("button",{name:/^App Groups/}));const i=await e.findByRole("button",{name:"All exports"});await s(e.getByRole("heading",{level:2,name:"App Groups"})).toBeVisible(),await p.click(i),await s(e.queryByRole("button",{name:"All exports"})).toBeNull()}},o={play:async({canvasElement:t})=>{const e=d(t);c.clearAll();try{await s(e.queryByRole("button",{name:/^Selected Users/})).toBeNull(),c.replaceKind("user",[{kind:"user",id:"00uFAKE1",name:"Ada Fake"},{kind:"user",id:"00uFAKE2",name:"Grace Fake"}]);const i=await e.findByRole("button",{name:/^Selected Users/});await p.click(i),await s(await e.findByText(/exactly the 2 users ticked in the selection basket/)).toBeVisible()}finally{c.clearAll()}}},r={args:{targetTabId:void 0}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Connected to an Okta tab, showing the entity hub.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /^App Groups/
    }));
    const back = await canvas.findByRole('button', {
      name: 'All exports'
    });
    await expect(canvas.getByRole('heading', {
      level: 2,
      name: 'App Groups'
    })).toBeVisible();
    await userEvent.click(back);
    await expect(canvas.queryByRole('button', {
      name: 'All exports'
    })).toBeNull();
  }
}`,...a.parameters?.docs?.source},description:{story:"Picking an entity enters `configure`, and **All exports** walks back out of it.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    selectionStore.clearAll();
    try {
      // Absent, not disabled: an export of nothing is not an export.
      await expect(canvas.queryByRole('button', {
        name: /^Selected Users/
      })).toBeNull();
      selectionStore.replaceKind('user', [{
        kind: 'user',
        id: '00uFAKE1',
        name: 'Ada Fake'
      }, {
        kind: 'user',
        id: '00uFAKE2',
        name: 'Grace Fake'
      }]);
      const entry = await canvas.findByRole('button', {
        name: /^Selected Users/
      });
      await userEvent.click(entry);
      await expect(await canvas.findByText(/exactly the 2 users ticked in the selection basket/)).toBeVisible();
    } finally {
      selectionStore.clearAll();
    }
  }
}`,...o.parameters?.docs?.source},description:{story:`A selection-scoped export is **absent** until something is ticked, then it
appears in the hub and states the exact cohort it will read.`,...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: undefined
  }
}`,...r.parameters?.docs?.source},description:{story:"No Okta tab connected — a banner explains export is disabled.",...r.parameters?.docs?.description}}};const P=["Default","PickingAnEntity","ScopedToTheSelectionBasket","Disconnected"];export{n as Default,r as Disconnected,a as PickingAnEntity,o as ScopedToTheSelectionBasket,P as __namedExportsOrder,q as default};
