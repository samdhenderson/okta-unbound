import{B as v}from"./BlastRadiusReport-CB4UeF5q.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./BlastRadiusGroupRow-CIRbFLni.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./membershipVerdict-79Na81vF.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";import"./BlastRadiusRuleRow-BGBdlvGL.js";import"./ruleUtils-Vt2BA8lQ.js";const{expect:t,userEvent:o,within:r}=__STORYBOOK_MODULE_TEST__,g="0prFAKErule00001",h="0prFAKErule00002",w=[{groupId:"00gFAKE00000000000001",groupName:"Sales-All",kind:"added",ruleId:g,ruleName:"Sales auto-add",contributingRuleIds:[g],currentlyHeld:!1},{groupId:"00gFAKE00000000000002",groupName:"Engineering-All",kind:"removed",ruleId:h,ruleName:"Eng auto-add",contributingRuleIds:[h],currentlyHeld:!0,currentBucket:"rule"},{groupId:"00gFAKE00000000000003",groupName:"Contractors",kind:"not-predicted",contributingRuleIds:[h],withheldReason:"membership-not-credited-to-rule",currentlyHeld:!0,currentBucket:"direct"}],B=[{ruleId:g,ruleName:"Sales auto-add",expression:'user.department == "Sales"',transition:"starts-matching",targetGroupIds:["00gFAKE00000000000001"],targetGroupNames:["Sales-All"],touchedAttributes:["department"],active:!0},{ruleId:h,ruleName:"Eng auto-add",expression:'user.department == "Engineering"',transition:"stops-matching",targetGroupIds:["00gFAKE00000000000002"],targetGroupNames:["Engineering-All"],touchedAttributes:["department"],active:!0},{ruleId:"0prFAKErule00003",ruleName:"Reviewers — by group",expression:'isMemberOfGroupNameRegex("(?=sec)sec-.*")',transition:"undetermined",afterReason:"regex-unsupported-syntax",targetGroupIds:["00gFAKE00000000000004"],targetGroupNames:["Security-Reviewers"],touchedAttributes:[],active:!0},{ruleId:"0prFAKErule00004",ruleName:"Everyone",expression:'user.status == "ACTIVE"',transition:"unchanged-match",targetGroupIds:["00gFAKE00000000000005"],targetGroupNames:["Everyone"],touchedAttributes:[],active:!0},{ruleId:"0prFAKErule00005",ruleName:"Tokyo office",expression:'user.city == "Tokyo"',transition:"unchanged-no-match",targetGroupIds:["00gFAKE00000000000006"],targetGroupNames:["Tokyo-Everyone"],touchedAttributes:[],active:!0}],T={status:"computed",groups:w,rules:B,counts:{added:1,removed:1,notPredicted:1,starts:1,stops:1,undetermined:1},cascades:[{groupId:"00gFAKE00000000000001",rules:[{ruleId:"0prFAKErule00005",direction:"toward-match",matchedBy:"name"},{ruleId:"0prFAKErule00004",direction:"away-from-match",matchedBy:"nameStartsWith"}]}]},y=a=>({status:a,groups:[],rules:[],counts:{added:0,removed:0,notPredicted:0,starts:0,stops:0,undetermined:0},cascades:[]}),G={title:"Users/BlastRadiusReport",component:v,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'What a profile edit is predicted to do to a user’s group access. The engine behind it is pure and synchronous — it reads the user, the draft, the membership list and the rule inventory the panel already holds — so the report costs zero API calls and recomputes on nothing.\n\nThree statuses say three different things: `not-computed` renders nothing, because the parent owns the button that asks; `unavailable` says the rule inventory could not be loaded, so no prediction is possible, which is never the same as "no changes"; `computed` renders the report, and a computed report with zero effects says so explicitly. The Groups and Rules pills are two views of the one answer — nothing is recomputed by the switch.'}}},argTypes:{report:{description:"The report from `useBlastRadius`. Every string on it is untrusted."},className:{description:"Layout and spacing classes on the outer container."}},args:{report:T}},s={play:async({canvasElement:a})=>{const e=r(a);await t(e.getByRole("heading",{name:"Added"})).toBeInTheDocument(),await t(e.getByRole("heading",{name:"Removed"})).toBeInTheDocument(),await t(e.getByRole("heading",{name:"Not predicted"})).toBeInTheDocument(),await t(e.getByText("Sales-All")).toBeInTheDocument(),await t(e.getByText("Engineering-All")).toBeInTheDocument(),await t(e.getByText(/credits this membership to a direct add/i)).toBeInTheDocument(),await t(e.getByRole("button",{name:/Rules that use this group/})).toBeInTheDocument()}},i={play:async({canvasElement:a})=>{const e=r(a),n=e.getByRole("button",{name:"Rules 3"});await t(n).toHaveAttribute("aria-pressed","false"),await o.click(n),await t(n).toHaveAttribute("aria-pressed","true"),await t(e.getByRole("heading",{name:"Starts matching"})).toBeInTheDocument(),await t(e.getByRole("heading",{name:"Stops matching"})).toBeInTheDocument(),await t(e.getByRole("heading",{name:"Could not be evaluated"})).toBeInTheDocument(),await t(e.getByText("And 2 rules are unaffected by this edit.")).toBeInTheDocument(),await o.click(e.getByRole("button",{name:"Groups 3"})),await t(e.getByText("Sales-All")).toBeInTheDocument()}},c={args:{report:y("unavailable")},play:async({canvasElement:a})=>{const e=r(a);await t(e.getByText(/could not be loaded/i)).toBeInTheDocument(),await t(e.getByText(/not the same as predicting no change/i)).toBeInTheDocument(),await t(e.queryByRole("button",{name:/^Groups/})).toBeNull()}},u={args:{report:y("computed")},play:async({canvasElement:a})=>{const e=r(a);await t(e.getByText("No group changes predicted")).toBeInTheDocument(),await t(e.queryByText(/Predictions are likely, not certain/i)).toBeNull()}},d={args:{report:y("not-computed")},play:async({canvasElement:a})=>{await t(a.textContent?.trim()).toBe("")}},p={parameters:{viewport:{value:"sidepanelCompact"}}},l={play:async({canvasElement:a})=>{const e=r(a),n=e.getByRole("button",{name:/Rules that use this group/});await t(n).toHaveAttribute("aria-expanded","false"),await o.click(n),await t(n).toHaveAttribute("aria-expanded","true"),await t(e.getByText("Tokyo office")).toBeInTheDocument(),await t(e.getByText(/Tokyo-Everyone/)).toBeInTheDocument(),await t(e.getAllByText(/prediction stops at one hop/i)).toHaveLength(1)}},m={play:async({canvasElement:a})=>{const e=r(a);await o.click(e.getByRole("button",{name:/Rules that use this group/})),await o.click(e.getByRole("button",{name:/^Rules \d/})),await o.click(e.getByRole("button",{name:/^Groups \d/})),await t(e.getByRole("button",{name:/Rules that use this group/})).toHaveAttribute("aria-expanded","true")}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Each block is a real section heading rather than a decorative label.
    await expect(canvas.getByRole('heading', {
      name: 'Added'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', {
      name: 'Removed'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', {
      name: 'Not predicted'
    })).toBeInTheDocument();
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    await expect(canvas.getByText('Engineering-All')).toBeInTheDocument();

    // The withheld row names its reason rather than reading as "no change".
    await expect(canvas.getByText(/credits this membership to a direct add/i)).toBeInTheDocument();

    // Second-order effects are still named rather than resolved — now on the row
    // of the group that pulls them in, rather than in a flat footnote.
    await expect(canvas.getByRole('button', {
      name: /Rules that use this group/
    })).toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"The groups view: access gained, access lost, and what the engine declined to call.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const rules = canvas.getByRole('button', {
      name: 'Rules 3'
    });
    await expect(rules).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(rules);
    await expect(rules).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('heading', {
      name: 'Starts matching'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', {
      name: 'Stops matching'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', {
      name: 'Could not be evaluated'
    })).toBeInTheDocument();

    // The unchanged rules are carried, not dropped: how much was examined is a fact.
    await expect(canvas.getByText('And 2 rules are unaffected by this edit.')).toBeInTheDocument();

    // Switching back leaves the groups view intact.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Groups 3'
    }));
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"The rules view, reached by the pill. The same report — nothing is recomputed.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    report: EMPTY('unavailable')
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/could not be loaded/i)).toBeInTheDocument();
    await expect(canvas.getByText(/not the same as predicting no change/i)).toBeInTheDocument();
    // No pills, because there is no report to switch views of.
    await expect(canvas.queryByRole('button', {
      name: /^Groups/
    })).toBeNull();
  }
}`,...c.parameters?.docs?.source},description:{story:'The rule inventory could not be loaded: a finding in its own right, and not "no changes".',...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    report: EMPTY('computed')
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No group changes predicted')).toBeInTheDocument();
    // No standing hedge accompanies it — the report asserts its predictions.
    await expect(canvas.queryByText(/Predictions are likely, not certain/i)).toBeNull();
  }
}`,...u.parameters?.docs?.source},description:{story:"A computed report with nothing in it says so — an absence is never left implicit.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    report: EMPTY('not-computed')
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.textContent?.trim()).toBe('');
  }
}`,...d.parameters?.docs?.source},description:{story:"Nobody has asked yet, so the report renders nothing at all.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...p.parameters?.docs?.source},description:{story:"The 360px floor: the pills wrap before a count is lost.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
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
    await expect(canvas.getByText('Tokyo office')).toBeInTheDocument();
    await expect(canvas.getByText(/Tokyo-Everyone/)).toBeInTheDocument();
    await expect(canvas.getAllByText(/prediction stops at one hop/i)).toHaveLength(1);
  }
}`,...l.parameters?.docs?.source},description:{story:"The cascade disclosure, opened — and the one-hop caveat appearing exactly once.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Rules that use this group/
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /^Rules \\d/
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /^Groups \\d/
    }));
    await expect(canvas.getByRole('button', {
      name: /Rules that use this group/
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...m.parameters?.docs?.source},description:{story:"An open panel survives the pill switch, because `expanded` is owned by the report.",...m.parameters?.docs?.description}}};const C=["Default","RulesView","Unavailable","NoEffects","NotComputed","Compact","OpeningACascade","CascadeSurvivesTheViewSwitch"];export{m as CascadeSurvivesTheViewSwitch,p as Compact,s as Default,u as NoEffects,d as NotComputed,l as OpeningACascade,i as RulesView,c as Unavailable,C as __namedExportsOrder,G as default};
