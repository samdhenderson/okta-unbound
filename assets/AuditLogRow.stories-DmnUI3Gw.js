import{j as E,r as T}from"./iframe-tAvKsVeF.js";import{A as B}from"./AuditLogRow-C29gT-sd.js";import"./preload-helper-PPVm8Dsz.js";import"./undoManager-UZfuKMLz.js";const{expect:t,fn:f,userEvent:O,within:o}=__STORYBOOK_MODULE_TEST__,_=Date.now()-300*1e3,b=(e,n,a,r="completed")=>({id:e,type:a.type,timestamp:_,description:n,status:r,metadata:a}),w=(e,n,a)=>({name:e,label:e,beforeDisplay:n,beforeRaw:n,afterDisplay:a,restorable:!0}),U=(e,n,a)=>({name:e,label:e,afterDisplay:n,restorable:!1,omitted:a}),x=b("action_profile","Updated department, title on Ada Lovelace",{type:"UPDATE_USER_PROFILE",userId:"00uFAKE0000000000001",userLogin:"user@example.com",userName:"Ada Lovelace",changes:[w("department","Platform","Engineering"),w("title","Intern","Engineer")]}),A=b("action_mixed","Updated department and 4 more on Ada Lovelace",{type:"UPDATE_USER_PROFILE",userId:"00uFAKE0000000000001",userLogin:"user@example.com",userName:"Ada Lovelace",changes:[w("department","Platform","Engineering"),U("bio","A long biography that exceeded the capture cap","too-large"),w("title","Intern","Engineer"),U("notes","Another long note","too-many"),w("city","","Berlin")]}),S=b("action_removal","Removed Ada Lovelace from Engineering",{type:"REMOVE_USER_FROM_GROUP",userId:"00uFAKE0000000000001",userEmail:"user@example.com",userName:"Ada Lovelace",groupId:"00gFAKE0000000000001",groupName:"Engineering"}),L=b("action_consolidation","Consolidated 2 rules into Engineering — all",{type:"CONSOLIDATE_RULE",createdRuleId:"0prFAKE0000000000009",createdRuleName:"Engineering — all",createdGroupIds:["00gFAKE0000000000001","00gFAKE0000000000002"],retiredRules:[{id:"0prFAKE0000000000001",name:"Engineers by department",expression:'user.department=="Engineering"',groupIds:["00gFAKE0000000000001"]},{id:"0prFAKE0000000000002",name:"Engineers by title",expression:'user.title=="Engineer"',groupIds:["00gFAKE0000000000002"]}]}),N={...x,id:"action_undone",status:"undone",undoneByActionId:"action_undo"},F={...x,id:"action_partial",status:"partial"},I=e=>{if(e.status==="undone")return{undoable:!1,reason:"This action has already been undone."};if(e.status==="partial")return{undoable:!1,reason:"This write was never confirmed, so we do not know which values it actually set — and therefore cannot know what to restore."};if(e.status==="failed")return{undoable:!1,reason:"This action failed, so there is nothing to put back."};if(e.metadata.type!=="UPDATE_USER_PROFILE")return{undoable:!1,reason:"Only profile edits can be undone here. Every other action would need a new operation of its own rather than a restore."};const n=e.metadata.changes.length,a=e.metadata.changes.filter(r=>r.restorable).length;return a===0?{undoable:!1,reason:"No previous values were captured for this edit, so there is nothing to restore."}:{undoable:!0,restorable:a,total:n}},K={title:"Sidepanel/AuditLogRow",component:B,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"One recorded action: what happened, its type, when — and, for a profile write whose prior values were captured, an **Undo** button.\n\nUndo is offered or absent, never disabled; the reason an entry cannot be undone is a line inside the expanded body. An entry already undone wears `Undone`, and one whose outcome was never confirmed wears `Outcome unknown` and is never offered a restore."}}},decorators:[e=>E.jsx("div",{className:"bg-canvas p-4",children:E.jsx(e,{})})],args:{action:x,isExpanded:!1,onToggle:f(),onUndo:f(),undoability:I},argTypes:{action:{description:"The history entry this row is about."},isExpanded:{description:"Whether the disclosure is open. Owned by the list, so a refresh cannot close a row."},onToggle:{description:"Toggles this row's disclosure, by action id."},onUndo:{description:"Opens the undo confirmation. Omitted, no Undo button is rendered at all."},undoability:{description:"The pure eligibility test from `useUndoAction` — the row asks rather than deciding."}}},s={},i={args:{isExpanded:!1}},d={args:{isExpanded:!0}},c={args:{isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByRole("button",{name:"Undo"})).toBeVisible()}},l={args:{action:S,isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.queryByRole("button",{name:"Undo"})).toBeNull(),await t(n.getByText(/Only profile edits can be undone/)).toBeVisible()}},p={args:{action:N,isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByText("Undone")).toBeVisible(),await t(n.queryByRole("button",{name:"Undo"})).toBeNull()}},u={args:{action:F,isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByText("Outcome unknown")).toBeVisible(),await t(n.queryByRole("button",{name:"Undo"})).toBeNull()}},m={args:{action:A,isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.getAllByText("(previous value not captured)")).toHaveLength(2),await t(n.getByRole("button",{name:"Undo"})).toBeVisible()}},g={args:{action:L,isExpanded:!0},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByText("New rule:")).toBeVisible()}},y={args:{onUndo:void 0},play:async({canvasElement:e})=>{const n=o(e);await t(n.queryByRole("button",{name:"Undo"})).toBeNull()}},h={args:{isExpanded:!1},render:e=>{const n=()=>{const[a,r]=T.useState(!1);return E.jsx(B,{...e,isExpanded:a,onToggle:()=>r(R=>!R)})};return E.jsx(n,{})},play:async({canvasElement:e})=>{const n=o(e),a=n.getByRole("button",{name:"Show details for Updated department, title on Ada Lovelace"});await t(a).toHaveAttribute("aria-expanded","false"),await O.click(a),await t(n.getByRole("button",{name:"Hide details for Updated department, title on Ada Lovelace"})).toHaveAttribute("aria-expanded","true")}},v={args:{action:A},parameters:{viewport:{value:"sidepanelCompact"}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"A profile write, collapsed: description, type mark, relative time, and Undo.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    isExpanded: false
  }
}`,...i.parameters?.docs?.source},description:{story:"Closed, which is how every row starts — a history of thirty open bodies is unscannable.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    isExpanded: true
  }
}`,...d.parameters?.docs?.source},description:{story:"Open: who was edited, and every attribute this write changed, `before → after`.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Undo'
    })).toBeVisible();
  }
}`,...c.parameters?.docs?.source},description:{story:"The undoable case. Every attribute here has a captured prior value.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    action: groupRemoval,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
    await expect(canvas.getByText(/Only profile edits can be undone/)).toBeVisible();
  }
}`,...l.parameters?.docs?.source},description:{story:"A group removal: no Undo button at all, with the reason stated in the body.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    action: undone,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Undone')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"Already undone: marked, and never offered a second restore.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    action: partial,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Outcome unknown')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
  }
}`,...u.parameters?.docs?.source},description:{story:"The write's transport threw, so undo is withheld — we cannot say what it set.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    action: profileUpdateMixed,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('(previous value not captured)')).toHaveLength(2);
    await expect(canvas.getByRole('button', {
      name: 'Undo'
    })).toBeVisible();
  }
}`,...m.parameters?.docs?.source},description:{story:"Two prior values were never captured: they are annotated in place, and the other three still restore.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    action: consolidation,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('New rule:')).toBeVisible();
  }
}`,...g.parameters?.docs?.source},description:{story:"A rule consolidation, with its created rule and its retired ones.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onUndo: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Undo'
    })).toBeNull();
  }
}`,...y.parameters?.docs?.source},description:{story:"The row on a surface that cannot undo anything: the button is absent, not disabled.",...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    isExpanded: false
  },
  render: args => {
    const Harness = () => {
      const [expanded, setExpanded] = useState(false);
      return <AuditLogRow {...args} isExpanded={expanded} onToggle={() => setExpanded(prev => !prev)} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show details for Updated department, title on Ada Lovelace'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(canvas.getByRole('button', {
      name: 'Hide details for Updated department, title on Ada Lovelace'
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...h.parameters?.docs?.source},description:{story:`The disclosure wired to real state, so the chevron actually opens the body the
way a reader does.`,...h.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    action: profileUpdateMixed
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"The 360px floor: the badge cluster wraps and the description truncates rather than pushing the controls off.",...v.parameters?.docs?.description}}};const C=["Default","Collapsed","Expanded","Undoable","NotUndoable","Undone","OutcomeUnknown","MixedRestorability","Consolidation","WithoutUndoHandler","OpeningTheDisclosure","Compact"];export{i as Collapsed,v as Compact,g as Consolidation,s as Default,d as Expanded,m as MixedRestorability,l as NotUndoable,h as OpeningTheDisclosure,u as OutcomeUnknown,c as Undoable,p as Undone,y as WithoutUndoHandler,C as __namedExportsOrder,K as default};
