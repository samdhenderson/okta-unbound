import{j as B,R as S}from"./iframe-tAvKsVeF.js";import{U as L}from"./UserProfileAttributeList-CyAx5RFb.js";import"./preload-helper-PPVm8Dsz.js";import"./ProfileEditCell-DdhUiuAe.js";const{expect:a,fn:E,within:i}=__STORYBOOK_MODULE_TEST__,r=(e,t,s,o,n=!1)=>({key:s==="system"?e:`profile.${e}`,name:e,label:t,kind:s,value:o,raw:o,isEmpty:o==="",...n?{mono:!0}:{}}),C=[r("id","User ID","system","00uFAKE00000000000001",!0),r("login","Login","base","user@example.com"),r("firstName","First Name","base","Ada"),r("lastName","Last Name","base","Lovelace"),r("department","Department","base","Platform Engineering"),r("costCenter","Cost Center","base",""),r("employeeType","Employee Type","custom","FULL_TIME")],I=[r("streetAddress","Street Address","base","Flat 12, Whitfield House, 145 Great Portland Street, Fitzrovia, London, W1W 6QQ, United Kingdom"),r("login","Login","base","ada.lovelace.platform.engineering.contractor@example.com"),r("externalIdentifier","External Identifier","custom","urn:example:hr:worker:0000000000000000000000000000000000000042",!0)],D={id:{name:"id",editability:{editable:!1,reason:"system",explanation:"This is a system field, not a profile attribute, so it cannot be edited here."},dirty:!1},department:{name:"department",editability:{editable:!0,control:"text",required:!1},draft:"Identity Platform",dirty:!0,onChange:E()},employeeType:{name:"employeeType",editability:{editable:!0,control:"select",required:!1,options:[{value:"FULL_TIME",label:"Full time"},{value:"CONTRACTOR",label:"Contractor"}]},dirty:!1,onChange:E()},costCenter:{name:"costCenter",editability:{editable:!0,control:"text",required:!0},draft:"",dirty:!0,invalid:"Okta requires a value for this attribute.",onChange:E()}},q={department:["Platform engineers"],employeeType:["Full-time staff","Badge holders","Payroll sync"]},_={title:"Users/UserProfileAttributeList",component:L,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The label/value half of `UserProfilePane`: one category block, in whichever of the three layouts the admin chose — `rows`, `compact`, or `auto-fit` `grid` cards.\n\nNothing here truncates: every layout wraps and the value takes whatever height it needs, because the long values are the ones an admin most often opened the profile to read. Rendered as a `<dl>`, so each label is programmatically tied to its value, and an empty attribute renders `—` with a `No value` tooltip rather than a blank line."}}},decorators:[e=>B.jsx("div",{className:"bg-white p-4",children:B.jsx(e,{})})],args:{attributes:C,layout:"rows",showApiNames:!1,showRuleChips:!0,ruleReads:q},argTypes:{attributes:{description:"One category block's attributes, already filtered and in display order."},layout:{description:"Which of the three presentations to render.",control:"inline-radio",options:["rows","compact","grid"]},showApiNames:{description:"Show the Okta attribute name (`department`, in mono) instead of its label."},showRuleChips:{description:'Whether the "read by rules" chips render at all.'},ruleReads:{description:"Attribute name → the rules that read it; an absent name gets no chip."},cells:{description:"Attribute name → its edit cell while editing; absent is the read-only path."}}},c={args:{layout:"rows"}},l={args:{layout:"compact"}},p={args:{layout:"grid"}},u={args:{attributes:[C[4],C[5]]},play:async({canvasElement:e})=>{const t=i(e);await a(t.getByTitle("No value")).toBeInTheDocument()}},d={args:{attributes:I,layout:"rows"}},m={args:{attributes:I,layout:"grid"}},h={args:{showApiNames:!1},play:async({canvasElement:e})=>{const t=i(e);await a(t.getByText("Department")).toBeInTheDocument()}},y={args:{showApiNames:!0},play:async({canvasElement:e})=>{const t=i(e);await a(t.getByText("department")).toBeInTheDocument()}},g={args:{showRuleChips:!0},play:async({canvasElement:e})=>{const t=i(e);await a(t.getByText("1 rule")).toBeInTheDocument(),await a(t.getByText("3 rules")).toBeInTheDocument()}},w={args:{showRuleChips:!1},play:async({canvasElement:e})=>{const t=i(e);await a(t.queryByText("1 rule")).toBeNull()}},b={args:{attributes:[...C.filter(e=>e.name!=="login"),...I],layout:"rows"},parameters:{viewport:{value:"sidepanelCompact"}}},v={args:{cells:D},play:async({canvasElement:e})=>{const t=i(e);await a(t.getByRole("textbox",{name:"Department"})).toHaveValue("Identity Platform"),await a(t.getByRole("combobox",{name:"Employee Type"})).toBeInTheDocument(),await a(t.getByText("Okta requires a value for this attribute.")).toBeInTheDocument(),await a(t.queryByRole("textbox",{name:"User ID"})).not.toBeInTheDocument(),await a(t.getByText("00uFAKE00000000000001")).toBeInTheDocument(),await a(t.getByText("user@example.com")).toBeInTheDocument()}},f={args:{cells:D,layout:"grid"}},x={args:{cells:D},parameters:{viewport:{value:"sidepanelCompact"}}},O=e=>{const[t,s]=S.useState({department:"Identity Platform",costCenter:""}),o=(n,R,N)=>({name:n,editability:R,draft:t[n],dirty:t[n]!==N,invalid:n==="costCenter"&&t.costCenter===""?"Okta requires a value for this attribute.":void 0,onChange:A=>s(k=>({...k,[n]:A}))});return B.jsx(L,{...e,cells:{department:o("department",{editable:!0,control:"text",required:!1},"Platform Engineering"),costCenter:o("costCenter",{editable:!0,control:"text",required:!0},"")}})},T={render:e=>B.jsx(O,{...e}),play:async({canvas:e,userEvent:t})=>{await a(e.getByText("Okta requires a value for this attribute.")).toBeInTheDocument();const s=e.getByRole("textbox",{name:"Cost Center"});await t.type(s,"CC-100"),await a(s).toHaveValue("CC-100"),await a(e.queryByText("Okta requires a value for this attribute.")).toBeNull()}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    layout: 'rows'
  }
}`,...c.parameters?.docs?.source},description:{story:"`rows` — a wide label column beside the value. The default, and the readable one.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    layout: 'compact'
  }
}`,...l.parameters?.docs?.source},description:{story:"`compact` — the same shape with a narrower label column and a tighter gap.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    layout: 'grid'
  }
}`,...p.parameters?.docs?.source},description:{story:"`grid` — `auto-fit` cards, label above value, two per line at the panel floor.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    attributes: [attributes[4], attributes[5]]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('No value')).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"`costCenter` has no value: an em dash with a `No value` tooltip, not a blank to interpret.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    attributes: longValues,
    layout: 'rows'
  }
}`,...d.parameters?.docs?.source},description:{story:"Long, unbroken values in `rows`: they wrap over as many lines as they need.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    attributes: longValues,
    layout: 'grid'
  }
}`,...m.parameters?.docs?.source},description:{story:"The same long values in `grid`, where the card grows rather than clipping.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    showApiNames: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Department')).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"`showApiNames` off: the human label from the org's schema.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    showApiNames: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('department')).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"`showApiNames` on: the Okta name, in mono — what a rule expression references.",...y.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    showRuleChips: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 rule')).toBeInTheDocument();
    await expect(canvas.getByText('3 rules')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:'The rules chip never says "rules" for one: `department` is read by a single rule, `employeeType` by three.',...g.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    showRuleChips: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('1 rule')).toBeNull();
  }
}`,...w.parameters?.docs?.source},description:{story:"The same block with the chips turned off — the admin's own display toggle.",...w.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    // \`login\` appears in both fixtures; the long one is the interesting one here.
    attributes: [...attributes.filter(item => item.name !== 'login'), ...longValues],
    layout: 'rows'
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...b.parameters?.docs?.source},description:{story:"The 360px floor in `rows`: the label column holds its width and the value wraps beside it.",...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    cells: editCells
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // An editable attribute becomes a control named for its label.
    await expect(canvas.getByRole('textbox', {
      name: 'Department'
    })).toHaveValue('Identity Platform');
    await expect(canvas.getByRole('combobox', {
      name: 'Employee Type'
    })).toBeInTheDocument();

    // A drafted value that fails validation says so beside its own control.
    await expect(canvas.getByText('Okta requires a value for this attribute.')).toBeInTheDocument();

    // A locked attribute grows no control — it stays the value it already was.
    await expect(canvas.queryByRole('textbox', {
      name: 'User ID'
    })).not.toBeInTheDocument();
    await expect(canvas.getByText('00uFAKE00000000000001')).toBeInTheDocument();

    // An attribute with no cell is untouched by edit mode.
    await expect(canvas.getByText('user@example.com')).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:"Edit mode: only the attributes with a cell swap their `<dd>` for a control, and a\nlocked one grows none at all.",...v.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    cells: editCells,
    layout: 'grid'
  }
}`,...f.parameters?.docs?.source},description:{story:"The same cells in `grid`, where each control fills its card.",...f.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    cells: editCells
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...x.parameters?.docs?.source},description:{story:"Edit mode at the 360px floor: the controls take the full value column.",...x.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  render: args => <LiveEditingHarness {...args} />,
  play: async ({
    canvas,
    userEvent
  }) => {
    await expect(canvas.getByText('Okta requires a value for this attribute.')).toBeInTheDocument();
    const costCenter = canvas.getByRole('textbox', {
      name: 'Cost Center'
    });
    await userEvent.type(costCenter, 'CC-100');
    await expect(costCenter).toHaveValue('CC-100');
    await expect(canvas.queryByText('Okta requires a value for this attribute.')).toBeNull();
  }
}`,...T.parameters?.docs?.source},description:{story:"Type into a required field: the value follows the keystrokes and the error clears.",...T.parameters?.docs?.description}}};const H=["RowsLayout","CompactLayout","GridLayout","EmptyValue","LongValues","LongValuesInGrid","HumanLabels","ApiNames","WithRuleChips","WithoutRuleChips","Compact","Editing","EditingInGrid","EditingNarrow","EditingLive"];export{y as ApiNames,b as Compact,l as CompactLayout,v as Editing,f as EditingInGrid,T as EditingLive,x as EditingNarrow,u as EmptyValue,p as GridLayout,h as HumanLabels,d as LongValues,m as LongValuesInGrid,c as RowsLayout,g as WithRuleChips,w as WithoutRuleChips,H as __namedExportsOrder,_ as default};
