import{j as U}from"./iframe-tAvKsVeF.js";import q from"./AuditLogViewer-CFm2N3IK.js";import"./preload-helper-PPVm8Dsz.js";import"./undoManager-UZfuKMLz.js";import"./redact-D38qASmd.js";import"./useUndoAction-DkDC4oTa.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./profileAttributes-DCAWW3PA.js";import"./dateFormat-tpkRVL7u.js";import"./profileFields-BZvCtc6D.js";import"./AuditLogRow-C29gT-sd.js";import"./AuditLogUndoModal-_WXLSvGO.js";import"./RequestLogRow-Cwb1Pb6K.js";const{expect:a,userEvent:b,within:n}=__STORYBOOK_MODULE_TEST__,A=Date.now()-300*1e3,h=(t,e,o,i="completed")=>({id:t,type:o.type,timestamp:A,description:e,status:i,metadata:o}),R=(t,e,o)=>({name:t,label:t,beforeDisplay:e,beforeRaw:e,afterDisplay:o,restorable:!0}),s=h("action_profile","Updated department, title on Ada Lovelace",{type:"UPDATE_USER_PROFILE",userId:"00uFAKE0000000000001",userLogin:"user@example.com",userName:"Ada Lovelace",changes:[R("department","Platform","Engineering"),R("title","Intern","Engineer")]}),T={...s,id:"action_undone",description:"Updated city on Grace Hopper",status:"undone",undoneByActionId:"action_undo"},H={...s,id:"action_partial",description:"Updated manager on Alan Turing",status:"partial"},O=h("action_removal","Removed Ada Lovelace from Engineering",{type:"REMOVE_USER_FROM_GROUP",userId:"00uFAKE0000000000001",userEmail:"user@example.com",userName:"Ada Lovelace",groupId:"00gFAKE0000000000001",groupName:"Engineering"}),S=h("action_bulk","Removed 12 deprovisioned users from Contractors",{type:"BULK_REMOVE_USERS_FROM_GROUP",users:Array.from({length:12},(t,e)=>({userId:`00uFAKEbulk${e}`,userEmail:`user${e}@example.com`,userName:`User ${e}`})),groupId:"00gFAKE0000000000002",groupName:"Contractors",operationType:"deprovisioned"}),k=h("action_rule",'Deactivated rule "Engineering — US"',{type:"DEACTIVATE_RULE",ruleId:"0prFAKE0000000000001",ruleName:"Engineering — US"}),B=[s,T,H,O,S,k],E=(t,e=[])=>async()=>{const o=chrome.storage.local.get,i={actions:t,maxSize:50},_={entries:e,maxSize:50};return chrome.storage.local.get=(x=>{const f={};return x.includes("undoHistory")&&(f.undoHistory=i),x.includes("apiRequestLog")&&(f.apiRequestLog=_),Promise.resolve(f)}),()=>{chrome.storage.local.get=o}},r=t=>E(t,[]),V=(t,e,o,i)=>({id:t,timestamp:A,reason:e,requestCount:o,endpoints:[{method:"GET",endpoint:i}],endpointsTruncated:!1,durationMs:800,outcome:"all"}),W={title:"Sidepanel/AuditLogViewer",component:q,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The recorded action history, read from `chrome.storage` and live-refreshed while the tab is active. A profile write whose prior values were captured carries an **Undo**, confirmed through `AuditLogUndoModal`; every other shape states its outcome instead.\n\nUndo is a forward write, so it can be refused on drift or fail outright — both keep the dialog open and explain themselves there."}}},decorators:[t=>U.jsx("div",{className:"bg-canvas p-4",children:U.jsx(t,{})})],argTypes:{targetTabId:{description:"Tab hosting the live Okta session an undo's restoring write is scoped to."},isActive:{description:"Whether the History tab is visible. Gates the `chrome.storage` listener."}}},c={beforeEach:r(B),play:async({canvasElement:t})=>{const e=n(t);await a(await e.findByText("6 actions logged")).toBeVisible(),await a(e.getAllByRole("button",{name:"Undo"})).toHaveLength(1),await a(e.getByText("Undone")).toBeVisible(),await a(e.getByText("Outcome unknown")).toBeVisible()}},d={beforeEach:E([s],[V("req_log_1","Populate Groups page",42,"/api/v1/groups?limit=200")]),play:async({canvasElement:t})=>{const e=n(t);await a(await e.findByText("1 action logged")).toBeVisible(),await a(e.queryByText(/Populate Groups page/)).toBeNull()}},l={beforeEach:E([s],[V("req_log_1","Populate Groups page",42,"/api/v1/groups?limit=200")]),play:async({canvasElement:t})=>{const e=n(t);await b.click(await e.findByRole("checkbox",{name:/Verbose/})),await a(await e.findByText("1 action, 1 request batch logged")).toBeVisible(),await a(e.getByText("42 requests — Populate Groups page")).toBeVisible()}},p={beforeEach:r([]),play:async({canvasElement:t})=>{const e=n(t);await a(await e.findByText("No audit history")).toBeVisible(),await a(e.queryByRole("button",{name:"Clear History"})).toBeNull()}},u={beforeEach:r([s]),play:async({canvasElement:t})=>{const e=n(t),o=await e.findByRole("button",{name:"Show details for Updated department, title on Ada Lovelace"});await a(o).toHaveAttribute("aria-expanded","false"),await b.click(o),await a(e.getByRole("button",{name:"Hide details for Updated department, title on Ada Lovelace"})).toHaveAttribute("aria-expanded","true")}},m={beforeEach:r([T]),play:async({canvasElement:t})=>{const e=n(t);await a(await e.findByText("Undone")).toBeVisible(),await a(e.queryByRole("button",{name:"Undo"})).toBeNull()}},y={beforeEach:r([H]),play:async({canvasElement:t})=>{const e=n(t);await a(await e.findByText("Outcome unknown")).toBeVisible(),await a(e.queryByRole("button",{name:"Undo"})).toBeNull()}},g={beforeEach:r([s]),play:async({canvasElement:t})=>{const e=n(t);await b.click(await e.findByRole("button",{name:"Undo"}));const o=await n(document.body).findByRole("dialog");await a(n(o).getByText("Restore previous values")).toBeVisible()}},w={beforeEach:r(B),play:async({canvasElement:t})=>{const e=n(t);await b.click(await e.findByRole("button",{name:"Clear History"}));const o=await n(document.body).findByRole("dialog");await a(o).toHaveAttribute("aria-modal","true"),await a(n(o).getByRole("button",{name:"Clear history"})).toBeVisible()}},v={beforeEach:r(B),parameters:{viewport:{value:"sidepanelCompact"}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory(mixedHistory),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('6 actions logged')).toBeVisible();
    await expect(canvas.getAllByRole('button', {
      name: 'Undo'
    })).toHaveLength(1);
    await expect(canvas.getByText('Undone')).toBeVisible();
    await expect(canvas.getByText('Outcome unknown')).toBeVisible();
  }
}`,...c.parameters?.docs?.source},description:{story:"Every recorded shape at once; only the completed profile write offers an Undo.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  beforeEach: seedAll([profileUpdate], [requestBatch('req_log_1', 'Populate Groups page', 42, '/api/v1/groups?limit=200')]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('1 action logged')).toBeVisible();
    await expect(canvas.queryByText(/Populate Groups page/)).toBeNull();
  }
}`,...d.parameters?.docs?.source},description:{story:"Verbose off by default: the request log is recorded but hidden until the admin opts in.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  beforeEach: seedAll([profileUpdate], [requestBatch('req_log_1', 'Populate Groups page', 42, '/api/v1/groups?limit=200')]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', {
      name: /Verbose/
    }));
    await expect(await canvas.findByText('1 action, 1 request batch logged')).toBeVisible();
    await expect(canvas.getByText('42 requests — Populate Groups page')).toBeVisible();
  }
}`,...l.parameters?.docs?.source},description:{story:"Toggling Verbose merges the request log in — a large batch collapses to one row.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory([]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No audit history')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Clear History'
    })).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"Nothing recorded yet — the empty state, with no Clear History to offer.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory([profileUpdate]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', {
      name: 'Show details for Updated department, title on Ada Lovelace'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(canvas.getByRole('button', {
      name: 'Hide details for Updated department, title on Ada Lovelace'
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...u.parameters?.docs?.source},description:{story:"A profile write, opened from its disclosure button.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory([undoneEntry]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Undone')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
  }
}`,...m.parameters?.docs?.source},description:{story:"Already undone: the reason there is no second restore is a sentence, not a disabled button.",...m.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory([partialEntry]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Outcome unknown')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
  }
}`,...y.parameters?.docs?.source},description:{story:"A write Okta never confirmed — no restore, because we do not know what it set.",...y.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory([profileUpdate]),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', {
      name: 'Undo'
    }));
    const dialog = await within(document.body).findByRole('dialog');
    await expect(within(dialog).getByText('Restore previous values')).toBeVisible();
  }
}`,...g.parameters?.docs?.source},description:{story:"Undo opens a confirmation rather than writing — the restore is itself a write.",...g.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory(mixedHistory),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', {
      name: 'Clear History'
    }));
    const dialog = await within(document.body).findByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(within(dialog).getByRole('button', {
      name: 'Clear history'
    })).toBeVisible();
  }
}`,...w.parameters?.docs?.source},description:{story:"Clear History is irreversible, so it confirms in the shared `Modal`.",...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  beforeEach: seedHistory(mixedHistory),
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"The 360px floor, where the count strip, badges and row controls share one width.",...v.parameters?.docs?.description}}};const Y=["Populated","VerboseModeOff","VerboseModeOn","Empty","ProfileUpdate","Undone","OutcomeUnknown","UndoConfirmation","ClearHistoryConfirm","Compact"];export{w as ClearHistoryConfirm,v as Compact,p as Empty,y as OutcomeUnknown,c as Populated,u as ProfileUpdate,g as UndoConfirmation,m as Undone,d as VerboseModeOff,l as VerboseModeOn,Y as __namedExportsOrder,W as default};
