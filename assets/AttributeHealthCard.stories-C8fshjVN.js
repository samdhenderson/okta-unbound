import{j as s,r as N}from"./iframe-tAvKsVeF.js";import{A as S}from"./AttributeHealthCard-BRZ4C4H2.js";import{B as R}from"./BreakdownDetailsModal-BoybENQd.js";import{h as o,N as k,O as V}from"./memberAnalytics-BqndU7JT.js";import"./preload-helper-PPVm8Dsz.js";import"./RuleLinkRow-CWX4uAdz.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./chartPalette-Byit8206.js";import"./BreakdownReport-RtX7G5yn.js";const{expect:t,fn:A,userEvent:v,within:i}=__STORYBOOK_MODULE_TEST__,x={key:"department",label:"Department",distinct:2,populated:9,total:12,fillRate:75,rows:[{value:"Engineering",label:"Engineering",count:5,pct:41.7},{value:"Product",label:"Product",count:4,pct:33.3},{value:k,label:"(none)",count:3,pct:25}],driftValues:[]},O=[{ruleId:"0prFAKE1",ruleName:"Eng & Product — full-time"}],W={title:"Groups/AttributeHealthCard",component:S,tags:["autodocs"],parameters:{layout:"centered",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`One card in the Insights tab's attribute grid: how one profile attribute is actually populated across this group's members. Every attribute gets the same card — severity is carried by order and by badges, never by a second card shape — and the badges survive the collapse, so the ranking never looks arbitrary.

Three stages: collapsed (title, badges, spread bar, value count), expanded (the value list, the blank line, the dependent rules), and a modal reveal over the full distribution via \`onShowOther\`. Outliers are marked with the word "Outlier:", never corrected and never by colour alone.`}}},argTypes:{summary:{description:"The attribute's precomputed distribution."},signals:{description:"Why this attribute ranks where it does. Rendered as badges."},rules:{description:"Feeding rules referencing this attribute. Empty renders no block."},onNavigateToRule:{description:"Deep-links a dependent rule into the Rules tab."},onShowOther:{description:"Opens the full distribution, tail included."},defaultExpanded:{description:"Starts the card expanded. For stories and tests."}},args:{summary:x,rules:O,signals:o(x,1),onNavigateToRule:A()},decorators:[e=>s.jsx("div",{className:"w-72",children:s.jsx(e,{})})]},l={},u={play:async({canvas:e,canvasElement:n})=>{await t(e.getByText("A rule depends on it")).toBeVisible(),await t(e.queryByText("1")).toBeNull();const a=e.getByRole("button",{name:/Show the value breakdown/});await t(a).toHaveAttribute("aria-expanded","false");const r=a.getAttribute("aria-controls"),C=r?n.ownerDocument.getElementById(r):null;await t(C).not.toBeNull(),await t(C).toHaveAttribute("inert")}},d={args:{defaultExpanded:!0},play:async({canvas:e})=>{await t(e.getByText("Engineering")).toBeVisible(),await t(e.getByText("Depended on by 1 rule")).toBeVisible(),await t(e.getByText(/Blank in 3 of 12 members/)).toBeVisible(),await t(e.getByText("A rule depends on it")).toBeVisible()}},c={play:async({canvas:e})=>{const n=e.getByRole("button",{name:/Show the value breakdown/});n.focus(),await t(n).toHaveFocus(),await v.keyboard("{Enter}");const a=e.getByRole("button",{name:/Hide the value breakdown/});await t(a).toHaveAttribute("aria-expanded","true"),await t(e.getByText("Engineering")).toBeVisible(),await v.keyboard("{Enter}"),await t(e.getByRole("button",{name:/Show the value breakdown/})).toHaveAttribute("aria-expanded","false")}},p={args:{defaultExpanded:!0,signals:o(x,2),rules:[{ruleId:"0prFAKE1",ruleName:"Eng & Product — full-time"},{ruleId:"0prFAKE2",ruleName:"Legacy import"}]}},g={args:{defaultExpanded:!0,summary:{...x,populated:12,fillRate:100,rows:[{value:"Engineering",label:"Engineering",count:8,pct:66.7},{value:"Product",label:"Product",count:4,pct:33.3}]}},play:async({canvas:e})=>{await t(e.queryByText(/Blank in/)).toBeNull()}},y={args:{signals:[],rules:[]},play:async({canvas:e})=>{await t(e.getByText("department")).toBeVisible(),await t(e.getByRole("button",{name:/Show the value breakdown/})).toBeVisible()}},m={args:{rules:[],signals:[],defaultExpanded:!0},play:async({canvas:e})=>{await t(e.queryByText(/Depended on by/)).toBeNull(),await t(e.getByText("Engineering")).toBeVisible()}},E={key:"department",label:"Department",distinct:3,populated:100,total:100,fillRate:100,rows:[{value:"Engineering",label:"Engineering",count:94,pct:94},{value:"engineering",label:"engineering",count:4,pct:4},{value:"ENGINEERING",label:"ENGINEERING",count:2,pct:2}],driftValues:["Engineering","engineering","ENGINEERING"]},b={args:{rules:[],summary:E,signals:o(E,0),defaultExpanded:!0},play:async({canvas:e})=>{await t(e.getByText("3 near-duplicate values")).toBeVisible(),await t(e.getAllByText("Outlier:")).toHaveLength(2),await t(e.getByText("Engineering")).toBeVisible()}},T={key:"department",label:"Department",distinct:3,populated:100,total:100,fillRate:100,rows:[{value:"Engineering",label:"Engineering",count:40,pct:40},{value:"Sales",label:"Sales",count:35,pct:35},{value:"Support",label:"Support",count:25,pct:25}],driftValues:[]},h={args:{rules:[],summary:T,signals:o(T,0),defaultExpanded:!0},play:async({canvas:e})=>{await t(e.queryByText(/outlier/i)).toBeNull(),await t(e.queryByText(/near-duplicate/)).toBeNull()}},f={key:"costCenter",label:"Cost center",distinct:9,populated:40,total:40,fillRate:100,rows:[{value:"CC-1000",label:"CC-1000",count:12,pct:30},{value:"CC-1001",label:"CC-1001",count:10,pct:25},{value:"CC-1002",label:"CC-1002",count:6,pct:15},{value:V,label:"Other (6 values)",count:12,pct:30}],driftValues:[]},I=[{value:"CC-1000",label:"CC-1000",count:12,pct:30},{value:"CC-1001",label:"CC-1001",count:10,pct:25},{value:"CC-1002",label:"CC-1002",count:6,pct:15},{value:"CC-2001",label:"CC-2001",count:3,pct:7.5},{value:"CC-2002",label:"CC-2002",count:3,pct:7.5},{value:"CC-2003",label:"CC-2003",count:2,pct:5},{value:"CC-2004",label:"CC-2004",count:2,pct:5},{value:"CC-2005",label:"CC-2005",count:1,pct:2.5},{value:"CC-2006",label:"CC-2006",count:1,pct:2.5}],D=e=>{const[n,a]=N.useState(!1);return s.jsxs(s.Fragment,{children:[s.jsx(S,{...e,onShowOther:()=>a(!0)}),s.jsx(R,{isOpen:n,onClose:()=>a(!1),title:"Cost center",rows:I,activeValues:new Set})]})},w={args:{rules:[],summary:f,signals:o(f,0)},render:e=>s.jsx(D,{...e}),play:async({canvas:e,canvasElement:n})=>{const a=i(n.ownerDocument.body);await t(e.getByText("30% hidden in the tail")).toBeVisible(),await t(e.getByRole("button",{name:/Show the value breakdown/})).toHaveAttribute("aria-expanded","false"),await v.click(e.getByRole("button",{name:/Show the value breakdown/})),await t(e.getByText("CC-1000")).toBeVisible(),await t(e.queryByText("CC-2006")).toBeNull(),await v.click(e.getByRole("button",{name:/Show all 9 values/}));const r=await a.findByRole("dialog");await t(i(r).getByText("CC-2006")).toBeVisible(),await t(i(r).getByText("CC-2001")).toBeVisible(),await t(i(r).queryByText(/filter the member list/)).toBeNull(),await t(i(r).getByRole("button",{name:/CC-2006/})).toBeDisabled()}},B={args:{rules:[],summary:f,signals:o(f,0),defaultExpanded:!0},play:async({canvas:e})=>{await t(e.getByText("Other (6 values)")).toBeVisible(),await t(e.queryByRole("button",{name:/Show all/})).toBeNull()}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:"{}",...l.parameters?.docs?.source},description:{story:"Stage one: title, badges, spread bar, value count. Nothing else.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas,
    canvasElement
  }) => {
    // The reason is legible without opening anything…
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
    // …and it is a phrase, not a bare number.
    await expect(canvas.queryByText('1')).toBeNull();

    // The disclosure states it is closed, and the region it names is \`inert\` —
    // so the value list is out of the tab order and the accessibility tree.
    // (This runner loads no CSS, so the *visual* collapse is not assertable
    // here; the ARIA state is what actually carries the meaning anyway.)
    const toggle = canvas.getByRole('button', {
      name: /Show the value breakdown/
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const regionId = toggle.getAttribute('aria-controls');
    const region = regionId ? canvasElement.ownerDocument.getElementById(regionId) : null;
    await expect(region).not.toBeNull();
    await expect(region).toHaveAttribute('inert');
  }
}`,...u.parameters?.docs?.source},description:{story:"The badges are in stage one on purpose: the reason for the ranking travels with the card.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    defaultExpanded: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('Engineering')).toBeVisible();
    await expect(canvas.getByText('Depended on by 1 rule')).toBeVisible();
    // A blank is not a value: it gets its own line, not a row in the list.
    await expect(canvas.getByText(/Blank in 3 of 12 members/)).toBeVisible();
    // Badges are still there — they belong to every stage.
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
  }
}`,...d.parameters?.docs?.source},description:{story:"Stage two: the same card, opened.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    const toggle = canvas.getByRole('button', {
      name: /Show the value breakdown/
    });
    toggle.focus();
    await expect(toggle).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const opened = canvas.getByRole('button', {
      name: /Hide the value breakdown/
    });
    await expect(opened).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Engineering')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', {
      name: /Show the value breakdown/
    })).toHaveAttribute('aria-expanded', 'false');
  }
}`,...c.parameters?.docs?.source},description:{story:"The disclosure is a real button: it takes focus, Enter activates, `aria-expanded` tracks.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    defaultExpanded: true,
    signals: attributeSignals(summary, 2),
    rules: [{
      ruleId: '0prFAKE1',
      ruleName: 'Eng & Product — full-time'
    }, {
      ruleId: '0prFAKE2',
      ruleName: 'Legacy import'
    }]
  }
}`,...p.parameters?.docs?.source},description:{story:"Two rules depend on the same attribute.",...p.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    defaultExpanded: true,
    summary: {
      ...summary,
      populated: 12,
      fillRate: 100,
      rows: [{
        value: 'Engineering',
        label: 'Engineering',
        count: 8,
        pct: 66.7
      }, {
        value: 'Product',
        label: 'Product',
        count: 4,
        pct: 33.3
      }]
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText(/Blank in/)).toBeNull();
  }
}`,...g.parameters?.docs?.source},description:{story:"Fully populated — no blank line at all.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    signals: [],
    rules: []
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Show the value breakdown/
    })).toBeVisible();
  }
}`,...y.parameters?.docs?.source},description:{story:"Nothing flagged: the same card with no badges, demoted by position rather than by shape.",...y.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [],
    signals: [],
    defaultExpanded: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText(/Depended on by/)).toBeNull();
    await expect(canvas.getByText('Engineering')).toBeVisible();
  }
}`,...m.parameters?.docs?.source},description:{story:'No feeding rule reads this attribute: the block is omitted rather than shown as "0 rules".',...m.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [],
    summary: driftSummary,
    signals: attributeSignals(driftSummary, 0),
    defaultExpanded: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('3 near-duplicate values')).toBeVisible();
    await expect(canvas.getAllByText('Outlier:')).toHaveLength(2);
    // The dominant value is never itself an outlier.
    await expect(canvas.getByText('Engineering')).toBeVisible();
  }
}`,...b.parameters?.docs?.source},description:{story:"Config drift: one dominant spelling and two stragglers. The badge counts\nnear-duplicates anywhere; the `Outlier:` markers are the narrower per-value claim.",...b.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [],
    summary: spreadSummary,
    signals: attributeSignals(spreadSummary, 0),
    defaultExpanded: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText(/outlier/i)).toBeNull();
    await expect(canvas.queryByText(/near-duplicate/)).toBeNull();
  }
}`,...h.parameters?.docs?.source},description:{story:"A legitimate three-way split: no house style to diverge from, so nothing is flagged.",...h.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [],
    summary: truncated,
    signals: attributeSignals(truncated, 0)
  },
  render: args => <OtherDrillIn {...args} />,
  play: async ({
    canvas,
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Stage one: the tail is measured on the collapsed card, and it says so.
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Show the value breakdown/
    })).toHaveAttribute('aria-expanded', 'false');

    // Stage two.
    await userEvent.click(canvas.getByRole('button', {
      name: /Show the value breakdown/
    }));
    await expect(canvas.getByText('CC-1000')).toBeVisible();
    // The card names the tail's size and still none of its contents.
    await expect(canvas.queryByText('CC-2006')).toBeNull();

    // Stage three.
    await userEvent.click(canvas.getByRole('button', {
      name: /Show all 9 values/
    }));
    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-2006')).toBeVisible();
    await expect(within(dialog).getByText('CC-2001')).toBeVisible();

    // Read-only here: nothing offers a filter it could not apply.
    await expect(within(dialog).queryByText(/filter the member list/)).toBeNull();
    await expect(within(dialog).getByRole('button', {
      name: /CC-2006/
    })).toBeDisabled();
  }
}`,...w.parameters?.docs?.source},description:{story:"All three stages in order: the tail is measured, then the kept values, then the folded six.",...w.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [],
    summary: truncated,
    signals: attributeSignals(truncated, 0),
    defaultExpanded: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('Other (6 values)')).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: /Show all/
    })).toBeNull();
  }
}`,...B.parameters?.docs?.source},description:{story:"Without a handler the third stage is not offered at all: no control that goes nowhere.",...B.parameters?.docs?.description}}};const U=["Collapsed","CollapsedKeepsItsBadges","Expanded","KeyboardOperable","MultipleRules","FullyPopulated","Quiet","NoDependentRules","WithDrift","LegitimateSpreadIsNotDrift","ThreeStages","NoRevealWhenUnwired"];export{l as Collapsed,u as CollapsedKeepsItsBadges,d as Expanded,g as FullyPopulated,c as KeyboardOperable,h as LegitimateSpreadIsNotDrift,p as MultipleRules,m as NoDependentRules,B as NoRevealWhenUnwired,y as Quiet,w as ThreeStages,b as WithDrift,U as __namedExportsOrder,W as default};
