import{B as l}from"./BlastRadiusCascade-CI6z_iR3.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,within:p}=__STORYBOOK_MODULE_TEST__,n=a=>({direction:"toward-match",matchedBy:"name",targetGroupNames:["Finance"],...a}),h={title:"Users/BlastRadiusCascade",component:l,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`**Every line is structure, not a prediction.** This rule reads this group; it named it this way; it assigns these groups. Nothing here claims the rule will fire, and the footer names that absence once rather than hedging every line.

**No count, and no negative.** The scan under-reports by design, so a group with no cascade renders nothing at all rather than asserting a completeness the engine cannot back. One component serves both row types: a group row passes the group it is about, a rule row one block per group it assigns into.`}}},args:{groups:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[n({ruleId:"0prFAKErule00061",ruleName:"Downstream feeder"})]}]}},r={play:async({canvasElement:a})=>{const e=p(a);await t(e.getByText("Downstream feeder")).toBeInTheDocument(),await t(e.getByText(/Finance/)).toBeInTheDocument(),await t(e.getByText("Toward matching")).toBeInTheDocument(),await t(e.getByText(/prediction stops at one hop/i)).toBeInTheDocument(),await t(e.queryByText("New Hires")).toBeNull()}},s={args:{groups:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[n({ruleId:"0prFAKErule00071",ruleName:"Downstream feeder"}),n({ruleId:"0prFAKErule00072",ruleName:"Contractor guard",direction:"away-from-match",targetGroupNames:["Vendors","Temp Access"]}),n({ruleId:"0prFAKErule00073",ruleName:"Both ways rule",direction:"undetermined",targetGroupNames:[]})]}]},play:async({canvasElement:a})=>{const e=p(a);await t(e.getByText("Toward matching")).toBeInTheDocument(),await t(e.getByText("Away from matching")).toBeInTheDocument(),await t(e.getByText("Uses it both ways")).toBeInTheDocument();const u=e.getByText("Both ways rule").closest("li");await t(u?.textContent).not.toMatch(/Assigns/)}},o={args:{groups:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[n({ruleId:"0prFAKErule00081",ruleName:"Prefix feeder",matchedBy:"nameStartsWith"})]}]},play:async({canvasElement:a})=>{const e=p(a);await t(e.getByText(/Matched by name pattern/)).toBeInTheDocument()}},i={args:{groups:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[n({ruleId:"0prFAKErule00091",ruleName:"Downstream feeder"})]},{groupId:"00gFAKEemea00001",groupName:"EMEA",lines:[n({ruleId:"0prFAKErule00092",ruleName:"EMEA tooling",targetGroupNames:["EMEA-Tools"]})]}]},play:async({canvasElement:a})=>{const e=p(a);await t(e.getByText("New Hires")).toBeInTheDocument(),await t(e.getByText("EMEA")).toBeInTheDocument(),await t(e.getAllByText(/prediction stops at one hop/i)).toHaveLength(1)}},c={parameters:{viewport:{value:"sidepanelCompact"}},args:{groups:[{groupId:"00gFAKEnewhires1",groupName:"New Hires",lines:[n({ruleId:"0prFAKErule00101",ruleName:"EMEA sales enablement — contractors only, phase two",targetGroupNames:["emea-sales-enablement-contractors-2026"]})]}]}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
    await expect(canvas.getByText(/Finance/)).toBeInTheDocument();
    await expect(canvas.getByText('Toward matching')).toBeInTheDocument();
    await expect(canvas.getByText(/prediction stops at one hop/i)).toBeInTheDocument();
    await expect(canvas.queryByText('New Hires')).toBeNull();
  }
}`,...r.parameters?.docs?.source},description:{story:"One group, one rule that reads it. No caption — the trigger named the group.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    groups: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [line({
        ruleId: '0prFAKErule00071',
        ruleName: 'Downstream feeder'
      }), line({
        ruleId: '0prFAKErule00072',
        ruleName: 'Contractor guard',
        direction: 'away-from-match',
        targetGroupNames: ['Vendors', 'Temp Access']
      }), line({
        ruleId: '0prFAKErule00073',
        ruleName: 'Both ways rule',
        direction: 'undetermined',
        targetGroupNames: []
      })]
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Toward matching')).toBeInTheDocument();
    await expect(canvas.getByText('Away from matching')).toBeInTheDocument();
    await expect(canvas.getByText('Uses it both ways')).toBeInTheDocument();
    // A rule that assigns nothing shows no "Assigns" line rather than an empty
    // one — scoped to that rule's own row, since the others legitimately have one.
    const bothWays = canvas.getByText('Both ways rule').closest('li');
    await expect(bothWays?.textContent).not.toMatch(/Assigns/);
  }
}`,...s.parameters?.docs?.source},description:{story:"All three directions. `Uses it both ways` is an assertion about the rule's text — one\nrule testing the group in both senses — so it earns a badge rather than a blank slot.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    groups: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [line({
        ruleId: '0prFAKErule00081',
        ruleName: 'Prefix feeder',
        matchedBy: 'nameStartsWith'
      })]
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Matched by name pattern/)).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:`A pattern match says so: with a literal id or name the link to the group above is
self-evident, and with a prefix, substring or regex it is not.`,...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    groups: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [line({
        ruleId: '0prFAKErule00091',
        ruleName: 'Downstream feeder'
      })]
    }, {
      groupId: '00gFAKEemea00001',
      groupName: 'EMEA',
      lines: [line({
        ruleId: '0prFAKErule00092',
        ruleName: 'EMEA tooling',
        targetGroupNames: ['EMEA-Tools']
      })]
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('New Hires')).toBeInTheDocument();
    await expect(canvas.getByText('EMEA')).toBeInTheDocument();
    await expect(canvas.getAllByText(/prediction stops at one hop/i)).toHaveLength(1);
  }
}`,...i.parameters?.docs?.source},description:{story:"Two groups, so each block is captioned. The one-hop line still appears once.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  args: {
    groups: [{
      groupId: '00gFAKEnewhires1',
      groupName: 'New Hires',
      lines: [line({
        ruleId: '0prFAKErule00101',
        ruleName: 'EMEA sales enablement — contractors only, phase two',
        targetGroupNames: ['emea-sales-enablement-contractors-2026']
      })]
    }]
  }
}`,...c.parameters?.docs?.source},description:{story:"The 360px floor: a long rule name wraps rather than truncating.",...c.parameters?.docs?.description}}};const w=["OneRule","EveryDirection","PatternMatch","TwoGroups","Compact"];export{c as Compact,s as EveryDirection,r as OneRule,o as PatternMatch,i as TwoGroups,w as __namedExportsOrder,h as default};
