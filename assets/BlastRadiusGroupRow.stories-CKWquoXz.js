import{j as f,r as E}from"./iframe-tAvKsVeF.js";import{B as T}from"./BlastRadiusGroupRow-CIRbFLni.js";import"./preload-helper-PPVm8Dsz.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./membershipVerdict-79Na81vF.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";const{expect:a,fn:b,userEvent:A,within:n}=__STORYBOOK_MODULE_TEST__,s="0prFAKErule00001",r=t=>({contributingRuleIds:[s],currentlyHeld:!1,...t}),C={title:"Users/BlastRadiusGroupRow",component:T,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"What one profile edit is predicted to do to one group’s membership. The marker is a status, not a control: its accessible name is `Added` / `Removed`, so the row asserts the effect rather than qualifying it.\n\n`Not predicted` is a third peer kind, neutral rather than `danger` — it is emitted only where something was implicated and the engine declined to call it, and it always names why and shows how Okta credits the membership today."}}},decorators:[t=>f.jsx("ul",{className:"space-y-3",children:f.jsx(t,{})})],argTypes:{effect:{description:"One entry from `BlastRadiusReport.groups`; its names are untrusted tenant data."}},args:{onToggle:b(),effect:r({groupId:"00gFAKE00000000000001",groupName:"Sales-All",kind:"added",ruleId:s,ruleName:"Sales auto-add"})}},i={play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText("Sales-All")).toBeInTheDocument(),await a(e.getByRole("img",{name:"Added"})).toBeInTheDocument(),await a(e.queryByRole("img",{name:"Likely added"})).toBeNull(),await a(e.getByText(/starts matching this user/i)).toBeInTheDocument()}},d={args:{effect:r({groupId:"00gFAKE00000000000002",groupName:"Engineering-All",kind:"removed",ruleId:s,ruleName:"Eng auto-add",currentlyHeld:!0,currentBucket:"rule"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByRole("img",{name:"Removed"})).toBeInTheDocument(),await a(e.getByText(/stops matching this user/i)).toBeInTheDocument()}},u={args:{effect:r({groupId:"00gFAKE00000000000003",groupName:"EMEA-Everyone",kind:"added",contributingRuleIds:[s,"0prFAKErule00002","0prFAKErule00003"]})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText("3 rules start matching this user.")).toBeInTheDocument()}},l={args:{effect:r({groupId:"00gFAKE00000000000004",groupName:"Contractors",kind:"not-predicted",withheldReason:"another-active-rule-still-matches",blockingRuleName:"Contractor catch-all",currentlyHeld:!0,currentBucket:"rule"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByRole("img",{name:"Not predicted"})).toBeInTheDocument(),await a(e.getByText(/Contractor catch-all/)).toBeInTheDocument(),await a(e.getByText("Rule")).toBeInTheDocument()}},p={args:{effect:r({groupId:"00gFAKE00000000000005",groupName:"Ops-Handbook",kind:"not-predicted",withheldReason:"membership-not-credited-to-rule",currentlyHeld:!0,currentBucket:"direct"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText(/credits this membership to a direct add/i)).toBeInTheDocument(),await a(e.getByText("Direct")).toBeInTheDocument()}},m={args:{effect:r({groupId:"00gFAKE00000000000006",groupName:"Security-Reviewers",kind:"not-predicted",withheldReason:"membership-attribution-deduced",currentlyHeld:!0,currentBucket:"rule"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText(/was never established/i)).toBeInTheDocument()}},g={args:{effect:r({groupId:"00gFAKE00000000000007",groupName:"Finance-All",kind:"not-predicted",withheldReason:"rule-unevaluable-after",currentlyHeld:!0,currentBucket:"rule"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText(/could not be evaluated here/i)).toBeInTheDocument(),await a(e.getByText(/cannot say the membership ends/i)).toBeInTheDocument()}},h={args:{effect:r({groupId:"00gFAKE00000000000008",groupName:"Legacy-Interns",kind:"not-predicted",withheldReason:"rule-inactive"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText(/deactivated or no longer evaluable/i)).toBeInTheDocument(),await a(e.queryByText(/rule is inactive/i)).not.toBeInTheDocument()}},y={args:{effect:r({groupId:"00gFAKE00000000000009",groupName:"workday.contractors",kind:"not-predicted",withheldReason:"app-mastered-group",currentlyHeld:!0,currentBucket:"app"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByText(/managed by its application/i)).toBeInTheDocument(),await a(e.getByText("App")).toBeInTheDocument()}},v={parameters:{viewport:{value:"sidepanelCompact"}},args:{effect:r({groupId:"00gFAKE00000000000010",groupName:"emea-sales-enablement-contractors-2026",kind:"removed",ruleId:s,ruleName:"EMEA sales enablement — contractors only",currentlyHeld:!0,currentBucket:"rule"})}},o={args:{effect:r({groupId:"00gFAKE00000000000011",groupName:"New Hires",kind:"added",ruleId:s,ruleName:"Sales onboarding"}),expanded:!1,cascade:[{ruleId:"0prFAKErule00021",ruleName:"Downstream feeder",direction:"toward-match",matchedBy:"name",targetGroupNames:["Finance"]},{ruleId:"0prFAKErule00022",ruleName:"Contractor guard",direction:"away-from-match",matchedBy:"nameStartsWith",targetGroupNames:["Vendors","Temp Access"]}]},render:t=>{const e=()=>{const[c,I]=E.useState(!1);return f.jsx(T,{...t,expanded:c,onToggle:()=>I(x=>!x)})};return f.jsx(e,{})},play:async({canvasElement:t})=>{const e=n(t),c=e.getByRole("button",{name:/Rules that use this group/});await a(c).toHaveAttribute("aria-expanded","false"),await A.click(c),await a(c).toHaveAttribute("aria-expanded","true"),await a(e.getByText("Downstream feeder")).toBeInTheDocument()}},B={args:{...o.args,expanded:!0},play:async({canvasElement:t})=>{const e=n(t);await a(e.getByRole("button",{name:/Rules that use this group/})).toHaveAttribute("aria-expanded","true"),await a(e.getByText("Downstream feeder")).toBeInTheDocument(),await a(e.getByText(/Finance/)).toBeInTheDocument(),await a(e.getByText("Toward matching")).toBeInTheDocument(),await a(e.getByText(/Matched by name pattern/)).toBeInTheDocument(),await a(e.getByText(/prediction stops at one hop/i)).toBeInTheDocument()}},w={args:{effect:r({groupId:"00gFAKE00000000000012",groupName:"Sales-All",kind:"added",ruleId:s,ruleName:"Sales onboarding"})},play:async({canvasElement:t})=>{const e=n(t);await a(e.queryByRole("button",{name:/Rules that use/})).toBeNull()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    // The marker's accessible name asserts the effect outright.
    await expect(canvas.getByRole('img', {
      name: 'Added'
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('img', {
      name: 'Likely added'
    })).toBeNull();
    await expect(canvas.getByText(/starts matching this user/i)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"A gain: one rule starts matching, and the user does not already hold the group.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000002',
      groupName: 'Engineering-All',
      kind: 'removed',
      ruleId: RULE_ID,
      ruleName: 'Eng auto-add',
      currentlyHeld: true,
      currentBucket: 'rule'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', {
      name: 'Removed'
    })).toBeInTheDocument();
    await expect(canvas.getByText(/stops matching this user/i)).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"A loss: `warning`, not `danger`, because it is a consequence to flag rather than a failure that happened.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000003',
      groupName: 'EMEA-Everyone',
      kind: 'added',
      contributingRuleIds: [RULE_ID, '0prFAKErule00002', '0prFAKErule00003']
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('3 rules start matching this user.')).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"More than one rule is implicated, so the row counts them rather than naming whichever sorted first.",...u.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000004',
      groupName: 'Contractors',
      kind: 'not-predicted',
      withheldReason: 'another-active-rule-still-matches',
      blockingRuleName: 'Contractor catch-all',
      currentlyHeld: true,
      currentBucket: 'rule'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Neutral marker, hedged glyph, and a reason — never a quiet "no change".
    await expect(canvas.getByRole('img', {
      name: 'Not predicted'
    })).toBeInTheDocument();
    await expect(canvas.getByText(/Contractor catch-all/)).toBeInTheDocument();
    // How Okta credits it today is on the row, so the refusal is legible.
    await expect(canvas.getByText('Rule')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Withheld: a different active rule holds the membership open, and it is named.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000005',
      groupName: 'Ops-Handbook',
      kind: 'not-predicted',
      withheldReason: 'membership-not-credited-to-rule',
      currentlyHeld: true,
      currentBucket: 'direct'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/credits this membership to a direct add/i)).toBeInTheDocument();
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Withheld: Okta credits the membership to a direct add, so no rule can take it.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000006',
      groupName: 'Security-Reviewers',
      kind: 'not-predicted',
      withheldReason: 'membership-attribution-deduced',
      currentlyHeld: true,
      currentBucket: 'rule'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/was never established/i)).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"Withheld: the attribution behind the membership was itself a deduction.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000007',
      groupName: 'Finance-All',
      kind: 'not-predicted',
      withheldReason: 'rule-unevaluable-after',
      currentlyHeld: true,
      currentBucket: 'rule'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/could not be evaluated here/i)).toBeInTheDocument();
    // The sentence stops short of saying the membership survives, too.
    await expect(canvas.getByText(/cannot say the membership ends/i)).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:'Another rule targeting the group could not be evaluated, so an `unevaluable` is never read as a "no".',...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000008',
      groupName: 'Legacy-Interns',
      kind: 'not-predicted',
      withheldReason: 'rule-inactive'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // This reason fires whenever no candidate rule is ACTIVE — which includes
    // INVALID — so the copy names both cases rather than saying "inactive".
    await expect(canvas.getByText(/deactivated or no longer evaluable/i)).toBeInTheDocument();
    await expect(canvas.queryByText(/rule is inactive/i)).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"Withheld: the only implicated rule is INACTIVE, so it places nobody either way.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000009',
      groupName: 'workday.contractors',
      kind: 'not-predicted',
      withheldReason: 'app-mastered-group',
      currentlyHeld: true,
      currentBucket: 'app'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/managed by its application/i)).toBeInTheDocument();
    await expect(canvas.getByText('App')).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"Withheld: an `APP_GROUP` roster is fed by its application, not by group rules.",...y.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000010',
      groupName: 'emea-sales-enablement-contractors-2026',
      kind: 'removed',
      ruleId: RULE_ID,
      ruleName: 'EMEA sales enablement — contractors only',
      currentlyHeld: true,
      currentBucket: 'rule'
    })
  }
}`,...v.parameters?.docs?.source},description:{story:"The 360px floor: a long group name wraps rather than truncating.",...v.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000011',
      groupName: 'New Hires',
      kind: 'added',
      ruleId: RULE_ID,
      ruleName: 'Sales onboarding'
    }),
    expanded: false,
    cascade: [{
      ruleId: '0prFAKErule00021',
      ruleName: 'Downstream feeder',
      direction: 'toward-match',
      matchedBy: 'name',
      targetGroupNames: ['Finance']
    }, {
      ruleId: '0prFAKErule00022',
      ruleName: 'Contractor guard',
      direction: 'away-from-match',
      matchedBy: 'nameStartsWith',
      targetGroupNames: ['Vendors', 'Temp Access']
    }]
  },
  render: args => {
    const Harness = () => {
      const [expanded, setExpanded] = useState(false);
      return <BlastRadiusGroupRow {...args} expanded={expanded} onToggle={() => setExpanded(prev => !prev)} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: /Rules that use this group/
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:`Adding this group brings other rules into scope. The trigger carries no count —
the cascade scan under-reports by design, so a tally would be a completeness
claim it cannot back — and the disclosure is controlled by the report, so this
story supplies the state itself.`,...o.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    ...WithCascade.args,
    expanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Rules that use this group/
    })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
    await expect(canvas.getByText(/Finance/)).toBeInTheDocument();
    await expect(canvas.getByText('Toward matching')).toBeInTheDocument();
    // A pattern match says so: the link to the group above is not self-evident.
    await expect(canvas.getByText(/Matched by name pattern/)).toBeInTheDocument();
    await expect(canvas.getByText(/prediction stops at one hop/i)).toBeInTheDocument();
  }
}`,...B.parameters?.docs?.source},description:{story:"The same row already open — the false→true pair `WithCascade` starts.",...B.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000012',
      groupName: 'Sales-All',
      kind: 'added',
      ruleId: RULE_ID,
      ruleName: 'Sales onboarding'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /Rules that use/
    })).toBeNull();
  }
}`,...w.parameters?.docs?.source},description:{story:'Nothing reads this group, so there is no trigger at all — not a disabled one, and no "no rules" sentence.',...w.parameters?.docs?.description}}};const P=["AddedEffect","RemovedEffect","SeveralRules","NotPredictedAnotherRuleMatches","NotPredictedDirectMembership","NotPredictedAttributionHedged","NotPredictedRuleUnevaluable","NotPredictedRuleInactive","NotPredictedAppMastered","Compact","WithCascade","CascadeOpen","NoCascade"];export{i as AddedEffect,B as CascadeOpen,v as Compact,w as NoCascade,l as NotPredictedAnotherRuleMatches,y as NotPredictedAppMastered,m as NotPredictedAttributionHedged,p as NotPredictedDirectMembership,h as NotPredictedRuleInactive,g as NotPredictedRuleUnevaluable,d as RemovedEffect,u as SeveralRules,o as WithCascade,P as __namedExportsOrder,C as default};
