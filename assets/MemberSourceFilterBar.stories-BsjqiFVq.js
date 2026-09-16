import{M as w}from"./MemberSourceFilterBar-Dx0w3ZXE.js";import{I as y,C as B}from"./chartPalette-Byit8206.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,fn:m,userEvent:g,within:S}=__STORYBOOK_MODULE_TEST__,p={key:"rule:0prFAKE1",label:"Engineering department",description:"Solely explained by this rule.",count:42,percent:42,barClass:"",dotClass:"",color:y[0]},b={key:"rule:0prFAKE2",label:"Platform department",description:"Solely explained by this rule.",count:18,percent:18,barClass:"",dotClass:"",color:y[1]},h={key:"direct",label:"Manual",description:"Added directly — no rule accounts for this membership.",count:30,percent:30,barClass:"bg-neutral-400",dotClass:"bg-neutral-400"},v=[p,b,{key:"multiRule",label:"Multiple rules",description:"Matched by more than one rule, so no single rule explains it.",count:5,percent:5,barClass:"bg-primary-dark",dotClass:"bg-primary-dark"},{key:"unattributed",label:"Indeterminate",description:"A targeting rule could not be evaluated here, so the source is unconfirmed.",count:5,percent:5,barClass:"bg-warning",dotClass:"bg-warning"},h],E={title:"Members/MemberSourceFilterBar",component:w,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The membership-source split where the reader can act on it: the bar for proportion at a glance, and one full-size pill per segment to narrow the member list. The bar itself is `aria-hidden` and is never the click target — each pill states its bucket, its count and its share as text.\n\nZero-count segments are dropped rather than offered as a pill that filters to nobody, and an aggregated tail says in words how many rules it folded in."}}},argTypes:{segments:{description:"The exclusive segments, in render order, from `toMemberSourceSegments`."},activeKeys:{description:"Bucket keys currently filtered on."},total:{description:'Total analyzed members, shown on the "All" pill.'}},args:{segments:v,activeKeys:new Set,onToggle:m(),onClearAll:m(),total:100}},n={},a={args:{activeKeys:new Set(["rule:0prFAKE1"])}},r={args:{activeKeys:new Set(["direct","unattributed"])}},s={args:{segments:[{...p,count:100,percent:100}]}},o={args:{segments:[{...p,count:60,percent:60},{...b,count:0,percent:0},{...h,count:40,percent:40}]},play:async({canvas:e})=>{await t(e.queryByRole("button",{name:/Platform department/})).toBeNull(),await t(e.getByRole("button",{name:/Engineering department 60 \(60%\)/})).toBeVisible()}},l={args:{segments:[{...p,count:55,percent:55},{key:"otherRules",label:"Other rules",description:"Rules past the chart ramp, folded together.",count:45,percent:45,barClass:"",dotClass:"",color:B,aggregatedRuleCount:3}]},play:async({canvas:e})=>{await t(e.getByRole("button",{name:/Other rules 45 \(45%\)/})).toBeVisible(),await t(e.getByText(/folds in \+3 more rules/)).toBeVisible()}},i={play:async({canvas:e})=>{await t(e.getByRole("button",{name:/Engineering department 42 \(42%\)/})).toBeVisible(),await t(e.getByRole("button",{name:/Multiple rules 5 \(5%\)/})).toBeVisible(),await t(e.getByRole("button",{name:/Indeterminate 5 \(5%\)/})).toBeVisible(),await t(e.getByRole("button",{name:/Manual 30 \(30%\)/})).toBeVisible()}},c={args:{activeKeys:new Set(["direct"])},play:async({args:e,canvasElement:d})=>{const u=S(d);await g.click(u.getByRole("button",{name:/Manual 30/})),await t(e.onToggle).toHaveBeenCalledWith("direct","Manual"),await g.click(u.getByRole("button",{name:/All 100/})),await t(e.onClearAll).toHaveBeenCalled(),await t(d.querySelector('[aria-hidden="true"].flex.h-2')).not.toBeNull()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:'Nothing filtered: "All" is the pressed pill.',...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    activeKeys: new Set(['rule:0prFAKE1'])
  }
}`,...a.parameters?.docs?.source},description:{story:`One rule's slice selected — "All" releases, that pill presses.`,...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    activeKeys: new Set(['direct', 'unattributed'])
  }
}`,...r.parameters?.docs?.source},description:{story:"Source filters compose: two slices selected at once reads as a union.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    segments: [{
      ...engineering,
      count: 100,
      percent: 100
    }]
  }
}`,...s.parameters?.docs?.source},description:{story:"One rule explains everyone; the single full-width segment still gets its pill.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    segments: [{
      ...engineering,
      count: 60,
      percent: 60
    }, {
      ...platform,
      count: 0,
      percent: 0
    }, {
      ...manual,
      count: 40,
      percent: 40
    }]
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByRole('button', {
      name: /Platform department/
    })).toBeNull();
    await expect(canvas.getByRole('button', {
      name: /Engineering department 60 \\(60%\\)/
    })).toBeVisible();
  }
}`,...o.parameters?.docs?.source},description:{story:"A zero-count segment is dropped entirely: only the two non-empty buckets render.",...o.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    segments: [{
      ...engineering,
      count: 55,
      percent: 55
    }, {
      key: 'otherRules',
      label: 'Other rules',
      description: 'Rules past the chart ramp, folded together.',
      count: 45,
      percent: 45,
      barClass: '',
      dotClass: '',
      color: CHART_OTHER_COLOR,
      aggregatedRuleCount: 3
    }]
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('button', {
      name: /Other rules 45 \\(45%\\)/
    })).toBeVisible();
    await expect(canvas.getByText(/folds in \\+3 more rules/)).toBeVisible();
  }
}`,...l.parameters?.docs?.source},description:{story:"Past the chart ramp's stops the remaining rules fold into `Other rules`, with the folded count printed.",...l.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('button', {
      name: /Engineering department 42 \\(42%\\)/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Multiple rules 5 \\(5%\\)/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Indeterminate 5 \\(5%\\)/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Manual 30 \\(30%\\)/
    })).toBeVisible();
  }
}`,...i.parameters?.docs?.source},description:{story:"Every bucket's label and share as text: the pills are the entire accessible answer.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeKeys: new Set(['direct'])
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Manual 30/
    }));
    await expect(args.onToggle).toHaveBeenCalledWith('direct', 'Manual');
    await userEvent.click(canvas.getByRole('button', {
      name: /All 100/
    }));
    await expect(args.onClearAll).toHaveBeenCalled();

    // The swatch is decoration: the bar is \`aria-hidden\` and every count it
    // encodes is on a pill, so nothing here depends on seeing a colour.
    await expect(canvasElement.querySelector('[aria-hidden="true"].flex.h-2')).not.toBeNull();
  }
}`,...c.parameters?.docs?.source},description:{story:'Pressing a pill reports its bucket key and label; "All" clears instead.',...c.parameters?.docs?.description}}};const A=["Default","Filtered","MultipleSelected","SingleSegment","DropsEmptySegments","AggregatedTail","StatesEveryShare","TogglesAndClears"];export{l as AggregatedTail,n as Default,o as DropsEmptySegments,a as Filtered,r as MultipleSelected,s as SingleSegment,i as StatesEveryShare,c as TogglesAndClears,A as __namedExportsOrder,E as default};
