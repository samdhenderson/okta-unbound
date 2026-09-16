import{j as b,r as h}from"./iframe-tAvKsVeF.js";import{C as w}from"./CreateFeedingRuleModal-DYDR6Aj1.js";import"./preload-helper-PPVm8Dsz.js";const{expect:n,fn:a,userEvent:y,within:o}=__STORYBOOK_MODULE_TEST__,C={title:"Groups/CreateFeedingRuleModal",component:w,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The confirm step for the Group Detail rung's *Create feeding rule* verb, which sits behind **More** because a rule grants memberships as it matches and deleting it later leaves every one of them in place.\n\nFully controlled — the draft, its checks and the write live in `useCreateFeedingRule`. Three things are always said before the confirm: the consequence, the mitigation (Okta creates the rule inactive), and the one thing that is not predicted — how many people the rule would add, withheld with its reason rather than invented."}}},args:{isOpen:!0,groupName:"Engineering",name:"",onNameChange:a(),nameError:null,expression:"",onExpressionChange:a(),expressionNotice:null,canSubmit:!1,isCreating:!1,error:null,createdRuleName:null,createdRuleId:null,onClose:a(),onConfirm:a(),onNavigateToRule:a()},argTypes:{isOpen:{description:"Whether the dialog is open."},groupName:{description:"The group the drafted rule assigns users into."},name:{description:"Controlled rule-name draft."},onNameChange:{description:"Called with the new rule name on each keystroke."},nameError:{description:"Why the drafted name is unacceptable (length), or null."},expression:{description:"Controlled match-expression draft."},onExpressionChange:{description:"Called with the new expression on each keystroke."},expressionNotice:{description:"Non-blocking notice about an expression this panel could not parse, or null."},canSubmit:{description:"Whether the confirm button may fire."},isCreating:{description:"True while the create request is in flight."},error:{description:"Message from a failed create, or null."},createdRuleName:{description:"The created rule’s name once the write landed — switches to the success step."},createdRuleId:{description:"The created rule’s id once the write landed, or null."},onClose:{description:"Close the dialog (Cancel, Done, Escape, overlay, header close)."},onConfirm:{description:"Run the create."},onNavigateToRule:{description:"Deep-links the created rule in the Rules tab; omitted renders no jump control."}}},s={play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body);await n(e.getByRole("button",{name:"Create rule"})).toBeDisabled(),await n(e.getByText(/does not take those memberships back/)).toBeVisible()}},i={args:{name:"Engineering intake",expression:'user.department == "Engineering"',canSubmit:!0},play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body);await n(e.getByRole("button",{name:"Create rule"})).toBeEnabled(),await n(e.getByText(/not predicted here/)).toBeVisible()}},c={args:{name:"Contractor intake",expression:"user.employeeType ?? ",expressionNotice:"The condition could not be parsed here. Okta is the authority on its own expression language — this panel reads a subset of it, so the rule may still be valid.",canSubmit:!0},play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body);await n(e.getByRole("button",{name:"Create rule"})).toBeEnabled()}},d={args:{name:"Engineering intake for everyone in the whole organisation",expression:'user.department == "Engineering"',nameError:"Okta allows 50 characters; this is 57."}},l={args:{name:"Engineering intake",expression:'user.department == "Engineering"',isCreating:!0}},p={args:{name:"Engineering intake",expression:'user.department == "Engineering"',canSubmit:!0,error:"A rule with this name already exists."}},x=()=>{const[t,e]=h.useState(""),[r,E]=h.useState("");return b.jsx(w,{isOpen:!0,groupName:"Engineering",name:t,onNameChange:e,nameError:t.length>50?`Okta allows 50 characters; this is ${t.length}.`:null,expression:r,onExpressionChange:E,expressionNotice:null,canSubmit:t.trim()!==""&&r.trim()!==""&&t.length<=50,isCreating:!1,error:null,createdRuleName:null,createdRuleId:null,onClose:a(),onConfirm:a(),onNavigateToRule:a()})},u={render:()=>b.jsx(x,{}),play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body),r=e.getByRole("button",{name:"Create rule"});await n(r).toBeDisabled(),await y.type(e.getByPlaceholderText("Engineering intake"),"Engineering intake"),await n(r).toBeDisabled(),await y.type(e.getByPlaceholderText('user.department == "Engineering"'),'user.department == "Eng"'),await n(r).toBeEnabled()}},m={args:{createdRuleName:"Engineering intake",createdRuleId:"0prFAKE000000000001"},play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body);await n(e.getByText(/Nobody has been added/)).toBeVisible(),await n(e.getByRole("button",{name:/Open in Rules tab/})).toBeVisible()}},g={args:{createdRuleName:"Engineering intake",createdRuleId:"0prFAKE000000000001",onNavigateToRule:void 0},play:async({canvasElement:t})=>{const e=o(t.ownerDocument.body);await n(e.queryByRole("button",{name:/Open in Rules tab/})).toBeNull(),await n(e.getByRole("button",{name:"Done"})).toBeVisible()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', {
      name: 'Create rule'
    })).toBeDisabled();
    await expect(body.getByText(/does not take those memberships back/)).toBeVisible();
  }
}`,...s.parameters?.docs?.source},description:{story:"An empty draft: the confirm is disabled, and the consequence is already on screen.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    canSubmit: true
  },
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', {
      name: 'Create rule'
    })).toBeEnabled();
    await expect(body.getByText(/not predicted here/)).toBeVisible();
  }
}`,...i.parameters?.docs?.source},description:{story:"A complete draft. The confirm is live, and the withheld prediction is stated, not omitted.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Contractor intake',
    expression: 'user.employeeType ?? ',
    expressionNotice: 'The condition could not be parsed here. Okta is the authority on its own expression language — this panel reads a subset of it, so the rule may still be valid.',
    canSubmit: true
  },
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', {
      name: 'Create rule'
    })).toBeEnabled();
  }
}`,...c.parameters?.docs?.source},description:{story:"An expression this panel cannot parse. A `warning`, not a `danger`, and the\nconfirm stays live — Okta is the authority on its own expression language.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Engineering intake for everyone in the whole organisation',
    expression: 'user.department == "Engineering"',
    nameError: 'Okta allows 50 characters; this is 57.'
  }
}`,...d.parameters?.docs?.source},description:{story:"The drafted name is longer than Okta accepts — the field carries the reason.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    isCreating: true
  }
}`,...l.parameters?.docs?.source},description:{story:"The create is in flight — the confirm shows its own spinner.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    canSubmit: true,
    error: 'A rule with this name already exists.'
  }
}`,...p.parameters?.docs?.source},description:{story:"Okta rejected the create; the draft is kept so it can be corrected and retried.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => <DraftHarness />,
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    const confirm = body.getByRole('button', {
      name: 'Create rule'
    });
    await expect(confirm).toBeDisabled();
    await userEvent.type(body.getByPlaceholderText('Engineering intake'), 'Engineering intake');
    await expect(confirm).toBeDisabled();
    await userEvent.type(body.getByPlaceholderText('user.department == "Engineering"'), 'user.department == "Eng"');
    await expect(confirm).toBeEnabled();
  }
}`,...u.parameters?.docs?.source},description:{story:"Typing a name and an expression is what arms the confirm; an empty draft leaves it dead.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    createdRuleName: 'Engineering intake',
    createdRuleId: '0prFAKE000000000001'
  },
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/Nobody has been added/)).toBeVisible();
    await expect(body.getByRole('button', {
      name: /Open in Rules tab/
    })).toBeVisible();
  }
}`,...m.parameters?.docs?.source},description:{story:"The write landed. The rule is inactive, and the jump that activates it is offered.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    createdRuleName: 'Engineering intake',
    createdRuleId: '0prFAKE000000000001',
    onNavigateToRule: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.queryByRole('button', {
      name: /Open in Rules tab/
    })).toBeNull();
    await expect(body.getByRole('button', {
      name: 'Done'
    })).toBeVisible();
  }
}`,...g.parameters?.docs?.source},description:{story:"No Rules tab to jump to — the deep link is absent rather than dead.",...g.parameters?.docs?.description}}};const k=["Default","Ready","UnparsedExpression","NameTooLong","Creating","ErrorState","Drafting","Created","CreatedWithoutNavigation"];export{m as Created,g as CreatedWithoutNavigation,l as Creating,s as Default,u as Drafting,p as ErrorState,d as NameTooLong,i as Ready,c as UnparsedExpression,k as __namedExportsOrder,C as default};
