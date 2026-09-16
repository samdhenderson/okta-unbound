import{j as m,Q as y}from"./iframe-tAvKsVeF.js";import{M as w}from"./MembershipRuleEvidence-B1QOrUY6.js";import"./preload-helper-PPVm8Dsz.js";import"./ruleExpression-nPAdgj2W.js";const{expect:a,fn:s,within:p}=__STORYBOOK_MODULE_TEST__,T={rule:s(),group:s(),user:s(),app:s(),policy:s()},b={id:"00uFAKE00000000000001",status:"ACTIVE",profile:{login:"user@example.com",email:"user@example.com",firstName:"Ada",lastName:"Lovelace",department:"Engineering",title:"Intern",countryCode:"GB"}},h=(e,t,v)=>({id:e,name:t,status:"ACTIVE",conditionExpression:v}),x=h("0prFAKErule00001","Auto-add Engineers",'user.department == "Engineering"'),g=h("0prFAKErule00002","EMEA engineering interns",'user.department == "Engineering" && user.countryCode == "GB" && user.title == "Intern"'),E=h("0prFAKErule00003","Cost-centre 4100",'user.costCenter == "4100"'),C=h("0prFAKErule00004","Contractor VPN",'isMemberOfGroup("00gFAKE00000000000009")'),N={title:"Users/MembershipRuleEvidence",component:w,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The evidence card behind one membership: a link to the rule, the profile attributes its condition **reads**, and the condition itself. The `Reads` chips come from walking the parsed AST, so an unparseable condition yields no chips rather than an empty `Reads` row.\n\nWith a `user`, the condition is rendered by `ClauseLedger` — the tree the tenant wrote, with the profile value that drove each clause. Without one there is nothing to evaluate against, so the raw condition is shown instead."}}},decorators:[e=>m.jsx(y,{handlers:T,children:m.jsx("div",{className:"bg-white p-4",children:m.jsx(e,{})})})],args:{rule:x,user:b},argTypes:{rule:{description:"One rule this membership is attributed to."},user:{description:"The user to explain the condition against. Omitted, the raw condition is shown — an explanation would have nothing to evaluate."}}},r={},n={play:async({canvasElement:e})=>{const t=p(e);await a(t.getAllByText("department")).toHaveLength(2),await a(t.getByText("Pass")).toBeInTheDocument()}},o={args:{user:void 0},play:async({canvasElement:e})=>{const t=p(e);await a(t.getByText('user.department == "Engineering"')).toBeInTheDocument(),await a(t.queryByText("Pass")).toBeNull()}},i={args:{rule:g}},c={args:{rule:g,user:void 0}},l={args:{rule:E},play:async({canvasElement:e})=>{const t=p(e);await a(t.getAllByText("costCenter")).toHaveLength(2)}},u={args:{rule:C},play:async({canvasElement:e})=>{const t=p(e);await a(t.getByText("Not evaluated")).toBeInTheDocument()}},d={args:{rule:g},parameters:{viewport:{value:"sidepanelCompact"}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"A user is supplied, so the condition is explained clause by clause against them.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // The attribute is named twice — as the chip above the ledger, and as the subject
    // of the clause phrase inside it — so this asserts the pair.
    await expect(canvas.getAllByText('department')).toHaveLength(2);
    // …and the checklist states the outcome in words, never in colour alone.
    await expect(canvas.getByText('Pass')).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source},description:{story:"The same rule with the clause ledger resolving to `Pass`.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    user: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('user.department == "Engineering"')).toBeInTheDocument();
    await expect(canvas.queryByText('Pass')).toBeNull();
  }
}`,...o.parameters?.docs?.source},description:{story:`No user, so the card falls back to the raw condition text: the absence of an
explanation, not a degraded one.`,...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    rule: multiClause
  }
}`,...i.parameters?.docs?.source},description:{story:"Three clauses over three attributes. Each gets its own row with the value that\ndrove it, which is the whole reason this replaced a flat `<code>` dump.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    rule: multiClause,
    user: undefined
  }
}`,...c.parameters?.docs?.source},description:{story:"The same multi-clause rule with no user: one block of text, and no verdicts.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    rule: missingAttribute
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Named in both places the ledger names an attribute, so the rule reading it
    // survives the attribute being absent from the user.
    await expect(canvas.getAllByText('costCenter')).toHaveLength(2);
  }
}`,...l.parameters?.docs?.source},description:{story:"The condition reads `costCenter`, which this user does not have. The chip still\nnames the attribute — the rule genuinely reads it — and the clause resolves to\na stated `Fail` rather than to a blank row.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    rule: unevaluable
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not evaluated')).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:`A clause the evaluator cannot resolve renders neutrally: "we could not check this"
never borrows the treatment reserved for "this person does not qualify".`,...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    rule: multiClause
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"The 360px floor: a long condition wraps inside the card rather than clipping.",...d.parameters?.docs?.description}}};const S=["Default","EvaluatedAgainstUser","WithoutUser","MultiClauseCondition","MultiClauseWithoutUser","AttributeTheUserLacks","UnevaluableClause","Compact"];export{l as AttributeTheUserLacks,d as Compact,r as Default,n as EvaluatedAgainstUser,i as MultiClauseCondition,c as MultiClauseWithoutUser,u as UnevaluableClause,o as WithoutUser,S as __namedExportsOrder,N as default};
