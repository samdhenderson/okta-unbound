import{j as m,J as E,Q as w}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:f,userEvent:x,within:v}=__STORYBOOK_MODULE_TEST__,b={id:"00uFAKELEDGER1",status:"ACTIVE",profile:{login:"ada@example.com",email:"ada@example.com",firstName:"Ada",lastName:"Lovelace",department:"Engineering",title:"Intern",projectCode:null}},g=[{id:"00gFAKELEDGER1",name:"Engineering"},{id:"00gFAKELEDGER2",name:"SecOps-Contractors"}];function h(e){const r='user.department == "Engineering"';return e===0?r:`${r} ${e%2===0?"&&":"||"} (${h(e-1)})`}function y(e){return Array.from({length:e},(r,t)=>`user.department == "Team ${t}"`).join(" || ")}const R={title:"Shared/ClauseLedger",component:E,tags:["autodocs"],parameters:{docs:{description:{component:'Explains a rule condition against one user as a **tree** — the `&&`/`||` structure the tenant actually wrote, rather than a flattened row-per-clause list.\n\nA `not-evaluated` clause is never dressed up as a failure: the "Raw expression" toggle switches to the tenant\'s own EL text, whose footer states `true`/`false` or, for an unevaluable condition, the reason — it never rounds "cannot tell" down to `false`.'}}},decorators:[e=>m.jsx(w,{handlers:{group:f()},children:m.jsx(e,{})})],argTypes:{expression:{description:"The rule's condition expression (untrusted Okta rule text)."},user:{description:"The user the condition is explained against."},groupContext:{description:`The user's **complete** group list. Omit rather than passing a subset — a partial list is read as a confident "not a member" for every group it leaves out.`},maxClauses:{description:"Cap on tree leaves; defaults to the explainer's own default."},resolveGroupName:{description:"Names group ids the `groupContext` cannot. Never fetches."},defaultShowRaw:{description:"Initial state of the raw/tree toggle. Defaults to the tree view."}},args:{expression:'user.department == "Engineering"',user:b}},s={args:{expression:'user.department == "Engineering" || isMemberOfGroupNameRegex("(?=.*Ops).*")',groupContext:g}},a={args:{expression:'!isMemberOfAnyGroup("00gFAKELEDGER2")',groupContext:g}},o={args:{expression:"user.department =="}},n={args:{expression:h(10),maxClauses:256}},i={args:{expression:y(70)}},p={args:{defaultShowRaw:!0}},c={args:{expression:'isMemberOfAnyGroup("00gFAKELEDGER1")'}},u={args:{expression:'user.department == "Engineering" && user.title != "Intern"',groupContext:g},play:async({canvasElement:e})=>{const r=v(e),t=r.getByRole("button",{name:"Raw expression"});await l(t).toHaveAttribute("aria-pressed","false"),await x.click(t),await l(t).toHaveAttribute("aria-pressed","true"),await l(r.getByText(/user\.title != "Intern"/)).toBeVisible(),await x.click(t),await l(t).toHaveAttribute("aria-pressed","false")}},d={args:{expression:'user.department == "Engineering" && (isMemberOfAnyGroup("00gFAKELEDGER1") || user.title != "Intern")',groupContext:g},parameters:{viewport:{value:"sidepanelCompact"}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department == "Engineering" || isMemberOfGroupNameRegex("(?=.*Ops).*")',
    groupContext: groups
  }
}`,...s.parameters?.docs?.source},description:{story:"A nested OR where one alternative passes and a sibling regex clause is declined for a\nlookahead `safeRegex` will not run, so the note explains what already decided the OR.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    expression: '!isMemberOfAnyGroup("00gFAKELEDGER2")',
    groupContext: groups
  }
}`,...a.parameters?.docs?.source},description:{story:"A negated group clause: the rule excludes members of a group this user is in.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department =='
  }
}`,...o.parameters?.docs?.source},description:{story:'A condition that never parsed: reported as not evaluated, never as "matches nothing".',...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    expression: nested(10),
    maxClauses: 256
  }
}`,...n.parameters?.docs?.source},description:{story:"Nesting past `MAX_TREE_DEPTH`: the collapsed subtree's nearest surviving ancestor says so.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    expression: flatOr(70)
  }
}`,...i.parameters?.docs?.source},description:{story:"Past the clause cap with no nesting at all: 70 flat `||`-joined clauses exceed the\ndefault 64-clause cap, and the same disclosure fires as for a collapsed subtree.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    defaultShowRaw: true
  }
}`,...p.parameters?.docs?.source},description:{story:"Opened straight to the raw EL text, whose footer states the resolved value.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'isMemberOfAnyGroup("00gFAKELEDGER1")'
  }
}`,...c.parameters?.docs?.source},description:{story:"No `groupContext` at all: a group-membership clause is honestly unevaluated, never a guessed chip.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department == "Engineering" && user.title != "Intern"',
    groupContext: groups
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', {
      name: 'Raw expression'
    });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText(/user\\.title != "Intern"/)).toBeVisible();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  }
}`,...u.parameters?.docs?.source},description:{story:"The toggle switches between the clause tree and the tenant's own EL text, and back.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    expression: 'user.department == "Engineering" && (isMemberOfAnyGroup("00gFAKELEDGER1") || user.title != "Intern")',
    groupContext: groups
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"The panel dragged to its narrowest supported width.",...d.parameters?.docs?.description}}};const O=["MatchWithKleeneNote","NoMatchNonMemberPolarity","Unevaluable","TruncatedDeepNesting","TruncatedClauseCap","RawViewOpen","NoGroupContext","TogglingTheRawView","CompactPanel"];export{d as CompactPanel,s as MatchWithKleeneNote,c as NoGroupContext,a as NoMatchNonMemberPolarity,p as RawViewOpen,u as TogglingTheRawView,i as TruncatedClauseCap,n as TruncatedDeepNesting,o as Unevaluable,O as __namedExportsOrder,R as default};
