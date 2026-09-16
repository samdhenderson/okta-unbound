import{A as y}from"./AttributeSpreadSection-CJZO21pC.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./AttributeHealthCard-BRZ4C4H2.js";import"./RuleLinkRow-CWX4uAdz.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./chartPalette-Byit8206.js";import"./memberAnalytics-BqndU7JT.js";const{expect:a,fn:u,within:h}=__STORYBOOK_MODULE_TEST__,g=Array.from({length:40},(t,e)=>({id:`member${e+1}`,status:"ACTIVE",profile:{login:`member${e+1}@example.com`,email:`member${e+1}@example.com`,firstName:`First${e+1}`,lastName:`Last${e+1}`,department:e<25?"Engineering":e<28?"engineering":"Product",costCenter:`CC-${100+e%9}`,userType:e%4===0?"CONTRACTOR":"EMPLOYEE"}})),w=[{id:"0prFAKE1",name:"Eng & Product — full-time",status:"ACTIVE",userAttributes:["department"],condition:'department in {"Engineering", "Product"}',conditionExpression:'user.department in {"Engineering", "Product"}',groupIds:["00gFAKE1"],created:"2024-01-01T00:00:00.000Z",lastUpdated:"2025-01-01T00:00:00.000Z"}],E={title:"Groups/AttributeSpreadSection",component:y,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`The Insights tab's ranked stack of attribute cards, and the gate in front of the roster it needs. Three signals order the stack: near-duplicate spellings (weight 4), a hidden tail carrying a fifth of the group or more (2), and rule coupling (1) — coupling is lightest, because drift is what will break a rule.

Attributes with no signal render in the identical card under a **Nothing flagged** rule: that rule labels the order, not a second card shape.`}}},args:{memberCount:g.length,members:g,memberStatus:"done",error:null,onAnalyzeMembers:u(),feedingRules:w,onNavigateToRule:u(),onShowAll:u()}},r={play:async({canvas:t})=>{await a(t.getByText("2 near-duplicate values")).toBeVisible(),await a(t.getByText("A rule depends on it")).toBeVisible(),await a(t.getByText("30% hidden in the tail")).toBeVisible();const e=t.getAllByRole("button",{name:/^Show the value breakdown for/}).map(b=>b.getAttribute("aria-label"));await a(e[0]).toBe("Show the value breakdown for department"),await a(e[1]).toBe("Show the value breakdown for costCenter");const n=t.getByRole("group",{name:"Nothing flagged"});await a(h(n).getByText("userType")).toBeVisible()}},o={play:async({canvas:t,userEvent:e})=>{const n=t.getByRole("button",{name:"Show the value breakdown for department"});await a(n).toHaveAttribute("aria-expanded","false"),await e.click(n),await a(t.getByRole("button",{name:"Hide the value breakdown for department"})).toHaveAttribute("aria-expanded","true")}},s={args:{members:null,memberStatus:"idle"},play:async({args:t,canvas:e,userEvent:n})=>{await n.click(e.getByRole("button",{name:"Analyze"})),await a(t.onAnalyzeMembers).toHaveBeenCalled()}},i={args:{members:null,memberStatus:"idle",canAnalyze:!1},play:async({canvas:t})=>{await a(t.getByRole("button",{name:"Analyze"})).toBeDisabled()}},l={args:{members:null,memberStatus:"loading"}},d={args:{members:null,memberStatus:"error",error:"Okta returned 429."},play:async({args:t,canvas:e,userEvent:n})=>{await n.click(e.getByRole("button",{name:"Retry"})),await a(t.onAnalyzeMembers).toHaveBeenCalled()}},m={args:{members:[],memberCount:0,memberStatus:"done"}},c={args:{members:Array.from({length:20},(t,e)=>({id:`u${e}`,status:"ACTIVE",profile:{login:`u${e}@example.com`,email:`u${e}@example.com`,firstName:`First${e}`,lastName:`Last${e}`}})),memberCount:20,memberStatus:"done"}},p={args:{feedingRules:[],members:Array.from({length:20},(t,e)=>({id:`q${e}`,status:"ACTIVE",profile:{login:`q${e}@example.com`,email:`q${e}@example.com`,firstName:`First${e}`,lastName:`Last${e}`,department:e%2===0?"Engineering":"Sales"}})),memberCount:20},play:async({canvas:t})=>{await a(t.getByText("department")).toBeVisible(),await a(t.queryByRole("group",{name:"Nothing flagged"})).toBeNull()}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    // Every card's reason is legible without opening it.
    await expect(canvas.getByText('2 near-duplicate values')).toBeVisible();
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();

    // Drift + coupling outrank a tail, so \`department\` leads.
    const keys = canvas.getAllByRole('button', {
      name: /^Show the value breakdown for/
    }).map(button => button.getAttribute('aria-label'));
    await expect(keys[0]).toBe('Show the value breakdown for department');
    await expect(keys[1]).toBe('Show the value breakdown for costCenter');

    // The quiet attribute is labelled, not hidden and not reshaped.
    const quiet = canvas.getByRole('group', {
      name: 'Nothing flagged'
    });
    await expect(within(quiet).getByText('userType')).toBeVisible();
  }
}`,...r.parameters?.docs?.source},description:{story:"The ranking: drift first, then the hidden tail, then the quiet attribute under its own rule.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas,
    userEvent
  }) => {
    const toggle = canvas.getByRole('button', {
      name: 'Show the value breakdown for department'
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(canvas.getByRole('button', {
      name: 'Hide the value breakdown for department'
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...o.parameters?.docs?.source},description:{story:"Open a card's breakdown in place: the disclosure expands and the values are listed.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    members: null,
    memberStatus: 'idle'
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Analyze'
    }));
    await expect(args.onAnalyzeMembers).toHaveBeenCalled();
  }
}`,...s.parameters?.docs?.source},description:{story:"Nothing loaded yet: the cost of the read, stated, behind an explicit Analyze.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    members: null,
    memberStatus: 'idle',
    canAnalyze: false
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('button', {
      name: 'Analyze'
    })).toBeDisabled();
  }
}`,...i.parameters?.docs?.source},description:{story:"No Okta tab connected, so the gate button cannot be pressed.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    members: null,
    memberStatus: 'loading'
  }
}`,...l.parameters?.docs?.source},description:{story:"The roster is loading.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    members: null,
    memberStatus: 'error',
    error: 'Okta returned 429.'
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Retry'
    }));
    await expect(args.onAnalyzeMembers).toHaveBeenCalled();
  }
}`,...d.parameters?.docs?.source},description:{story:"The roster load failed, and the same call is offered as a retry.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    members: [],
    memberCount: 0,
    memberStatus: 'done'
  }
}`,...m.parameters?.docs?.source},description:{story:"An empty group: nothing to profile, and it says so rather than showing an empty grid.",...m.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    members: Array.from({
      length: 20
    }, (_, i) => ({
      id: \`u\${i}\`,
      status: 'ACTIVE',
      profile: {
        login: \`u\${i}@example.com\`,
        email: \`u\${i}@example.com\`,
        firstName: \`First\${i}\`,
        lastName: \`Last\${i}\`
      }
    })),
    memberCount: 20,
    memberStatus: 'done'
  }
}`,...c.parameters?.docs?.source},description:{story:"Every attribute is unique per member, so none has a spread worth reporting — a real answer, not an error.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    feedingRules: [],
    members: Array.from({
      length: 20
    }, (_, i) => ({
      id: \`q\${i}\`,
      status: 'ACTIVE',
      profile: {
        login: \`q\${i}@example.com\`,
        email: \`q\${i}@example.com\`,
        firstName: \`First\${i}\`,
        lastName: \`Last\${i}\`,
        department: i % 2 === 0 ? 'Engineering' : 'Sales'
      }
    })),
    memberCount: 20
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.queryByRole('group', {
      name: 'Nothing flagged'
    })).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"Nothing is flagged anywhere, so no divider is drawn — it would label an order that does not exist.",...p.parameters?.docs?.description}}};const R=["Ranked","OpenABreakdown","Idle","IdleDisconnected","Loading","LoadFailed","NoMembers","NothingWorthReporting","AllQuiet"];export{p as AllQuiet,s as Idle,i as IdleDisconnected,d as LoadFailed,l as Loading,m as NoMembers,c as NothingWorthReporting,o as OpenABreakdown,r as Ranked,R as __namedExportsOrder,E as default};
