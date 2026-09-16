import{j as I,r as b}from"./iframe-tAvKsVeF.js";import{B as w}from"./BlastRadiusRuleRow-BGBdlvGL.js";import"./preload-helper-PPVm8Dsz.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./ruleUtils-Vt2BA8lQ.js";const{expect:t,fn:F,userEvent:R,within:s}=__STORYBOOK_MODULE_TEST__,v={id:"00uFAKEstory00000001",status:"ACTIVE",profile:{login:"ada@example.com",email:"ada@example.com",firstName:"Ada",lastName:"Lovelace",department:"Sales",title:"Account Executive"}},r=a=>({expression:'user.department == "Sales"',targetGroupIds:["00gFAKE00000000000001"],targetGroupNames:["Sales-All"],touchedAttributes:["department"],active:!0,...a}),M={title:"Users/BlastRadiusRuleRow",component:w,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The rule-centric mirror of `BlastRadiusGroupRow`: the groups view answers *what access changes*, this one answers *what is driving it* — the view an admin needs to go and fix a rule rather than a person.\n\n`Could not be evaluated` is neutral, not a fifth shade of unchanged: one of the two evaluations produced no answer, so the pair cannot be compared, and the sentence comes from the shared `unevaluableReasonText` table. The expression wraps and never truncates — the clause that decided the verdict is routinely the one past an ellipsis — and `Reads` is a display aid the engine never filters on."}}},decorators:[a=>I.jsx("ul",{className:"space-y-3",children:I.jsx(a,{})})],argTypes:{effect:{description:"One entry from `BlastRadiusReport.rules`. Its `ruleName`, `expression` and `targetGroupNames` are untrusted tenant data — rendered escaped, never logged."}},args:{onToggle:F(),effect:r({ruleId:"0prFAKErule00001",ruleName:"Sales auto-add",transition:"starts-matching"})}},c={play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("Sales auto-add")).toBeInTheDocument(),await t(e.getByText("Starts matching")).toBeInTheDocument(),await t(e.getByText("Sales-All")).toBeInTheDocument(),await t(e.getByText('user.department == "Sales"')).toBeInTheDocument()}},i={args:{effect:r({ruleId:"0prFAKErule00002",ruleName:"Eng auto-add",transition:"stops-matching",expression:'user.department == "Engineering"',targetGroupIds:["00gFAKE00000000000002"],targetGroupNames:["Engineering-All"]})},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("Stops matching")).toBeInTheDocument()}},u={args:{effect:r({ruleId:"0prFAKErule00003",ruleName:"Reviewers — by group",transition:"undetermined",afterReason:"regex-unsupported-syntax",expression:'isMemberOfGroupNameRegex("(?=sec)sec-.*")',targetGroupIds:["00gFAKE00000000000003"],targetGroupNames:["Security-Reviewers"],touchedAttributes:[]})},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("Could not be evaluated")).toBeInTheDocument(),await t(e.getByText(/syntax this panel does not implement/i)).toBeInTheDocument(),await t(e.queryByText(/Stops matching|Starts matching/)).toBeNull()}},d={args:{effect:r({ruleId:"0prFAKErule00004",ruleName:"Legacy intern auto-add",transition:"stops-matching",active:!1,status:"INACTIVE",expression:'user.title == "Intern"',targetGroupIds:["00gFAKE00000000000004"],targetGroupNames:["Legacy-Interns"],touchedAttributes:["title"]})},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("Not in force")).toBeInTheDocument(),await t(e.queryByText(/INACTIVE|Inactive/)).toBeNull(),await t(e.queryByText("Broken")).toBeNull()}},p={args:{effect:r({ruleId:"0prFAKErule00009",ruleName:"Contractors — deleted group reference",transition:"stops-matching",active:!1,status:"INVALID",expression:'isMemberOfGroup("00gDELETEDFAKE00001")',targetGroupIds:["00gFAKE00000000000004"],targetGroupNames:["Legacy-Interns"],touchedAttributes:[]})},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("Broken")).toBeInTheDocument(),await t(e.queryByText("Not in force")).toBeNull(),await t(e.queryByText(/INACTIVE|Inactive/)).toBeNull()}},l={args:{effect:r({ruleId:"0prFAKErule00005",ruleName:"Everyone",transition:"unchanged-match",expression:'user.status == "ACTIVE"',touchedAttributes:[]})}},m={args:{effect:r({ruleId:"0prFAKErule00006",ruleName:"Tokyo office",transition:"unchanged-no-match",expression:'user.city == "Tokyo"',touchedAttributes:[]})}},g={args:{effect:r({ruleId:"0prFAKErule00009",ruleName:"Contractor pattern",transition:"unchanged-unevaluable",expression:'isMemberOfGroupNameRegex("(?=contractor).*")',beforeReason:"regex-unsupported-syntax",afterReason:"regex-unsupported-syntax",touchedAttributes:[]})}},h={args:{effect:r({ruleId:"0prFAKErule00007",ruleName:"EMEA sales enablement",transition:"starts-matching",targetGroupIds:["00gFAKE00000000000001","00gFAKE00000000000005","00gFAKE00000000000006"],targetGroupNames:["Sales-All","EMEA-Everyone","Enablement-Readers"],touchedAttributes:["department","countryCode","employeeType"],expression:'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"'})}},y={parameters:{viewport:{value:"sidepanelCompact"}},args:{effect:r({ruleId:"0prFAKErule00008",ruleName:"EMEA sales enablement — contractors excluded",transition:"stops-matching",targetGroupIds:["00gFAKE00000000000001"],targetGroupNames:["emea-sales-enablement-contractors-2026"],touchedAttributes:["department","countryCode"],expression:'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"'})}},f={args:{effect:r({ruleId:"0prFAKErule00031",ruleName:"Sales onboarding",transition:"starts-matching",targetGroupIds:["00gFAKEnewhires1"],targetGroupNames:["New Hires"]}),expanded:!0,cascadeBlocks:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[{ruleId:"0prFAKErule00032",ruleName:"Downstream feeder",direction:"toward-match",matchedBy:"name",targetGroupNames:["Finance"]}]}]},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByRole("button",{name:/Rules that use New Hires/})).toHaveAttribute("aria-expanded","true"),await t(e.getByText("Downstream feeder")).toBeInTheDocument();const n=a.querySelector(".disclose");await t(n?.textContent).not.toMatch(/New Hires/)}},E={args:{effect:r({ruleId:"0prFAKErule00041",ruleName:"Regional onboarding",transition:"starts-matching",targetGroupIds:["00gFAKEnewhires1","00gFAKEemea00001"],targetGroupNames:["New Hires","EMEA"]}),expanded:!1,cascadeBlocks:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[{ruleId:"0prFAKErule00042",ruleName:"Downstream feeder",direction:"toward-match",matchedBy:"name",targetGroupNames:["Finance"]}]},{groupId:"00gFAKEemea00001",groupName:"EMEA",lines:[{ruleId:"0prFAKErule00043",ruleName:"EMEA tooling",direction:"toward-match",matchedBy:"nameContains",targetGroupNames:["EMEA-Tools"]}]}]},render:function(e){const[n,o]=b.useState(!1);return I.jsx(w,{...e,expanded:n,onToggle:T=>{e.onToggle?.(T),o(B=>!B)}})},play:async({canvasElement:a,args:e})=>{const n=s(a),o=n.getByRole("button",{name:/Rules that use these groups/});await t(o).toHaveAttribute("aria-expanded","false"),await R.click(o),await t(e.onToggle).toHaveBeenCalledWith("0prFAKErule00041"),await t(o).toHaveAttribute("aria-expanded","true"),await t(n.getByText("EMEA tooling")).toBeInTheDocument()}},A={args:{effect:r({ruleId:"0prFAKErule00051",ruleName:"Sales auto-add",transition:"starts-matching"})},play:async({canvasElement:a})=>{const e=s(a);await t(e.queryByRole("button",{name:/Rules that use/})).toBeNull()}},x={args:{effect:r({ruleId:"0prFAKErule00010",ruleName:"Sales enablement",transition:"starts-matching",expression:'user.department == "Sales" && user.title == "Account Executive"',touchedAttributes:["department"]}),drafted:v,groupContext:[]}},N={args:{effect:r({ruleId:"0prFAKErule00011",ruleName:"Regional enablement",transition:"undetermined",expression:'user.department == "Sales" && isMemberOfGroupNameRegex("(?=EMEA).*")',beforeReason:"regex-unsupported-syntax",afterReason:"regex-unsupported-syntax",touchedAttributes:["department"]}),drafted:v,groupContext:[]}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sales auto-add')).toBeInTheDocument();
    // The verdict is in words, so it never rides on colour alone.
    await expect(canvas.getByText('Starts matching')).toBeInTheDocument();
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    await expect(canvas.getByText('user.department == "Sales"')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"The rule did not match before the edit and does after it.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00002',
      ruleName: 'Eng auto-add',
      transition: 'stops-matching',
      expression: 'user.department == "Engineering"',
      targetGroupIds: ['00gFAKE00000000000002'],
      targetGroupNames: ['Engineering-All']
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Stops matching')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"The rule matched before the edit and does not after it.",...i.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00003',
      ruleName: 'Reviewers — by group',
      transition: 'undetermined',
      afterReason: 'regex-unsupported-syntax',
      expression: 'isMemberOfGroupNameRegex("(?=sec)sec-.*")',
      targetGroupIds: ['00gFAKE00000000000003'],
      targetGroupNames: ['Security-Reviewers'],
      touchedAttributes: []
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Could not be evaluated')).toBeInTheDocument();
    // The shared sentence, not a local rewrite of it.
    await expect(canvas.getByText(/syntax this panel does not implement/i)).toBeInTheDocument();
    // And it never claims a direction it did not establish.
    await expect(canvas.queryByText(/Stops matching|Starts matching/)).toBeNull();
  }
}`,...u.parameters?.docs?.source},description:{story:"One evaluation gave up, so the pair cannot be compared: neutral, with the shared sentence.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00004',
      ruleName: 'Legacy intern auto-add',
      transition: 'stops-matching',
      active: false,
      status: 'INACTIVE',
      expression: 'user.title == "Intern"',
      targetGroupIds: ['00gFAKE00000000000004'],
      targetGroupNames: ['Legacy-Interns'],
      touchedAttributes: ['title']
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not in force')).toBeInTheDocument();
    // Never a status word this row cannot support — and never the \`INVALID\` mark.
    await expect(canvas.queryByText(/INACTIVE|Inactive/)).toBeNull();
    await expect(canvas.queryByText('Broken')).toBeNull();
  }
}`,...d.parameters?.docs?.source},description:{story:'A rule an admin deactivated: the generic "Not in force" pill, not the `INVALID` mark.',...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00009',
      ruleName: 'Contractors — deleted group reference',
      transition: 'stops-matching',
      active: false,
      status: 'INVALID',
      expression: 'isMemberOfGroup("00gDELETEDFAKE00001")',
      targetGroupIds: ['00gFAKE00000000000004'],
      targetGroupNames: ['Legacy-Interns'],
      touchedAttributes: []
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Broken')).toBeInTheDocument();
    // Never the generic pill once the specific one applies.
    await expect(canvas.queryByText('Not in force')).toBeNull();
    await expect(canvas.queryByText(/INACTIVE|Inactive/)).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:'A rule Okta reports as `INVALID` gets the shared `Broken` mark rather than the\ngeneric "Not in force" pill a merely-paused rule keeps.',...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00005',
      ruleName: 'Everyone',
      transition: 'unchanged-match',
      expression: 'user.status == "ACTIVE"',
      touchedAttributes: []
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"Carried by the report but collapsed into a count by the report view.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00006',
      ruleName: 'Tokyo office',
      transition: 'unchanged-no-match',
      expression: 'user.city == "Tokyo"',
      touchedAttributes: []
    })
  }
}`,...m.parameters?.docs?.source},description:{story:"The other unchanged verdict.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00009',
      ruleName: 'Contractor pattern',
      transition: 'unchanged-unevaluable',
      expression: 'isMemberOfGroupNameRegex("(?=contractor).*")',
      beforeReason: 'regex-unsupported-syntax',
      afterReason: 'regex-unsupported-syntax',
      touchedAttributes: []
    })
  }
}`,...g.parameters?.docs?.source},description:{story:`Unreadable, but out of this edit's reach: "Unaffected by this edit" — not a verdict
nobody established, and not the badge for a rule the edit could have moved.`,...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00007',
      ruleName: 'EMEA sales enablement',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKE00000000000001', '00gFAKE00000000000005', '00gFAKE00000000000006'],
      targetGroupNames: ['Sales-All', 'EMEA-Everyone', 'Enablement-Readers'],
      touchedAttributes: ['department', 'countryCode', 'employeeType'],
      expression: 'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"'
    })
  }
}`,...h.parameters?.docs?.source},description:{story:"Several targets and several read attributes, both wrapping rather than clipping.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  args: {
    effect: effect({
      ruleId: '0prFAKErule00008',
      ruleName: 'EMEA sales enablement — contractors excluded',
      transition: 'stops-matching',
      targetGroupIds: ['00gFAKE00000000000001'],
      targetGroupNames: ['emea-sales-enablement-contractors-2026'],
      touchedAttributes: ['department', 'countryCode'],
      expression: 'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"'
    })
  }
}`,...y.parameters?.docs?.source},description:{story:"The 360px floor: a long condition wraps onto as many lines as it needs.",...y.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00031',
      ruleName: 'Sales onboarding',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKEnewhires1'],
      targetGroupNames: ['New Hires']
    }),
    expanded: true,
    cascadeBlocks: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [{
        ruleId: '0prFAKErule00032',
        ruleName: 'Downstream feeder',
        direction: 'toward-match',
        matchedBy: 'name',
        targetGroupNames: ['Finance']
      }]
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Rules that use New Hires/
    })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
    // One block, so the panel adds no caption repeating the group the trigger
    // already named. Scoped to the panel: the row's own "Targets" line names it
    // too, and that is not the duplication being guarded against.
    const panel = canvasElement.querySelector('.disclose');
    await expect(panel?.textContent).not.toMatch(/New Hires/);
  }
}`,...f.parameters?.docs?.source},description:{story:"One affected target group: the trigger names it, so the panel does not caption it again.",...f.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00041',
      ruleName: 'Regional onboarding',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKEnewhires1', '00gFAKEemea00001'],
      targetGroupNames: ['New Hires', 'EMEA']
    }),
    expanded: false,
    cascadeBlocks: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [{
        ruleId: '0prFAKErule00042',
        ruleName: 'Downstream feeder',
        direction: 'toward-match',
        matchedBy: 'name',
        targetGroupNames: ['Finance']
      }]
    }, {
      groupId: '00gFAKEemea00001',
      groupName: 'EMEA',
      lines: [{
        ruleId: '0prFAKErule00043',
        ruleName: 'EMEA tooling',
        direction: 'toward-match',
        matchedBy: 'nameContains',
        targetGroupNames: ['EMEA-Tools']
      }]
    }]
  },
  render: function Disclosure(args) {
    const [expanded, setExpanded] = useState(false);
    return <BlastRadiusRuleRow {...args} expanded={expanded} onToggle={ruleId => {
      args.onToggle?.(ruleId);
      setExpanded(open => !open);
    }} />;
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: /Rules that use these groups/
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith('0prFAKErule00041');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('EMEA tooling')).toBeInTheDocument();
  }
}`,...E.parameters?.docs?.source},description:{story:"Two affected target groups: one disclosure holds both, captioned per group.",...E.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00051',
      ruleName: 'Sales auto-add',
      transition: 'starts-matching'
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
}`,...A.parameters?.docs?.source},description:{story:"Nothing reads the groups this rule assigns, so no trigger renders at all.",...A.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00010',
      ruleName: 'Sales enablement',
      transition: 'starts-matching',
      expression: 'user.department == "Sales" && user.title == "Account Executive"',
      touchedAttributes: ['department']
    }),
    drafted: DRAFTED,
    groupContext: []
  }
}`,...x.parameters?.docs?.source},description:{story:`The condition broken down clause by clause against the drafted user, so "Starts
matching" is checkable rather than merely asserted.`,...x.parameters?.docs?.description}}};N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    effect: effect({
      ruleId: '0prFAKErule00011',
      ruleName: 'Regional enablement',
      transition: 'undetermined',
      expression: 'user.department == "Sales" && isMemberOfGroupNameRegex("(?=EMEA).*")',
      beforeReason: 'regex-unsupported-syntax',
      afterReason: 'regex-unsupported-syntax',
      touchedAttributes: ['department']
    }),
    drafted: DRAFTED,
    groupContext: []
  }
}`,...N.parameters?.docs?.source},description:{story:"A ledger where one clause could not be read: the declined clause carries its own reason.",...N.parameters?.docs?.description}}};const O=["StartsMatching","StopsMatching","Undetermined","NotInForceRule","BrokenRule","UnchangedMatch","UnchangedNoMatch","UnchangedUnevaluable","ManyTargets","Compact","CascadeSingleGroup","CascadeAcrossTwoGroups","NoCascade","WithClauseLedger","ClauseLedgerWithUnreadableClause"];export{p as BrokenRule,E as CascadeAcrossTwoGroups,f as CascadeSingleGroup,N as ClauseLedgerWithUnreadableClause,y as Compact,h as ManyTargets,A as NoCascade,d as NotInForceRule,c as StartsMatching,i as StopsMatching,l as UnchangedMatch,m as UnchangedNoMatch,g as UnchangedUnevaluable,u as Undetermined,x as WithClauseLedger,O as __namedExportsOrder,M as default};
