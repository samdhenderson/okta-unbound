import{j as D}from"./iframe-tAvKsVeF.js";import{U as A}from"./UserProfilePane-DR7OyECo.js";import"./preload-helper-PPVm8Dsz.js";import"./profileAttributeBlocks-BIZLFcVk.js";import"./UserProfileAttributeList-CyAx5RFb.js";import"./ProfileEditCell-DdhUiuAe.js";import"./UserProfilePaneHeader-k585POsb.js";import"./ProfileDisplayEditor-X8q1K9AS.js";import"./ProfileDisplayAttributeEditRow-CbwN7nRI.js";import"./ProfileDisplayGrip-Yw9dihMQ.js";import"./ProfileDisplayDragGhost-DwlRzOro.js";import"./ProfileDisplayOptions-BbWoDSJc.js";import"./ProfileDisplaySectionEditor-BF_vPohL.js";import"./profileDisplayStore-CVAj7s6I.js";import"./index-Dob3nYDb.js";const{expect:t,fn:s,userEvent:S,waitFor:N,within:o}=__STORYBOOK_MODULE_TEST__,a=(n,e,i,I={})=>({key:`profile.${n}`,name:n,label:e,kind:"base",value:i,raw:i,isEmpty:i==="",...I}),C=(n,e,i,I={})=>a(n,e,i,{key:n,kind:"system",...I}),R=[C("id","User ID","00uFAKE0001",{mono:!0}),C("status","Status","ACTIVE"),C("created","Created","12 Mar 2021"),C("lastLogin","Last Login","4 Aug 2026"),a("login","Login","samantha.henderson-oconnell@corporate.example.com"),a("email","Email","user@example.com"),a("firstName","First Name","Samantha"),a("lastName","Last Name","Henderson-O’Connell"),a("displayName","Display Name",""),a("secondEmail","Second Email",""),a("department","Department","Engineering"),a("title","Title","Staff Platform Engineer"),a("manager","Manager","manager@example.com"),a("division","Division","Product Engineering"),a("streetAddress","Street Address","1200 Northwest Continental Boulevard, Building 4, Suite 1750"),a("city","City","Vancouver"),a("state","State","Washington"),a("zipCode","Zip Code","98660"),a("countryCode","Country Code","US"),a("costCenter","Cost Center","CC-4471",{kind:"custom"}),a("employeeType","Employee Type","Full-time",{kind:"custom"})],r={layout:"rows",showApiNames:!1,showRuleChips:!0,showEmpty:!1,categories:[{key:"identity",name:"Identity"},{key:"organization",name:"Organization"},{key:"account-state",name:"Account state"},{key:"contact-locale",name:"Contact & locale"}],assign:{id:"identity",login:"identity",email:"identity",firstName:"identity",lastName:"identity",displayName:"identity",department:"organization",title:"organization",manager:"organization",division:"organization",status:"account-state",created:"account-state",lastLogin:"account-state",secondEmail:"contact-locale",streetAddress:"contact-locale",city:"contact-locale",state:"contact-locale",zipCode:"contact-locale",countryCode:"contact-locale"},attrOrder:["id","login","email","firstName","lastName","displayName","department","title","manager","division","status","created","lastLogin","secondEmail","streetAddress","city","state","zipCode","countryCode","costCenter","employeeType"],hidden:{state:!0}},f={canEdit:!0,isEditing:!1,changeCount:0,hasInvalid:!1,onBeginEdit:s(),onCancelEdit:s(),onSave:s()},z={id:{name:"id",editability:{editable:!1,reason:"system",explanation:"This is a system field, not a profile attribute, so it cannot be edited here."},dirty:!1},department:{name:"department",editability:{editable:!0,control:"text",required:!1},draft:"Identity Platform",dirty:!0,onChange:s()},title:{name:"title",editability:{editable:!0,control:"text",required:!1},dirty:!1,onChange:s()}},O={isCustomizing:!1,onBegin:s(),onCommit:s(),onCancel:s()},L={department:["Engineering → VPN Access","Engineering → Wiki"],title:["Staff+ → On-call Rotation"]},$={title:"Users/UserProfilePane",component:A,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The user's attributes, in the admin's own categories and order. Attributes are the evidence group rules read to grant access, so a `{n} rules` chip sits beside any value a currently *granting* rule consults. Anything filed under no category collects in a final **Uncategorized** block that can never silently vanish.\n\n`attributes`, `config` and `ruleReads` are props, not hooks: the pane renders, never fetches, and holds no configuration. The gear switches it into customize mode in place, and `edit` adds the pane-level edit verbs with one `cells` entry per editable attribute — an attribute with no cell renders exactly as it does in read mode. Both the Edit button and the gear are absent, never disabled, when they have nothing to do."}}},argTypes:{attributes:{description:"Every attribute of the profile, empty ones included."},config:{description:"The admin's reconciled display configuration."},ruleReads:{description:"Attribute name → the granting rules that read it."},edit:{description:"The pane-level edit verbs; absent means the pane is read-only."},cells:{description:"Attribute name → its edit cell. Empty outside edit mode."},customize:{description:"The customize-mode flag and verbs; absent means no gear and no editor."}},args:{attributes:R,config:r,ruleReads:L,customize:O},decorators:[n=>D.jsx("div",{className:"bg-canvas p-4",children:D.jsx("div",{className:"rounded-md border border-neutral-200 bg-white",children:D.jsx(n,{})})})]},c={play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("2 rules")).toBeInTheDocument(),await t(e.getByText("1 rule")).toBeInTheDocument(),await t(e.getByText("Product Engineering")).toBeInTheDocument(),await t(e.getByRole("region",{name:"Uncategorized"})).toBeInTheDocument(),await t(e.getByText("CC-4471")).toBeInTheDocument(),await t(e.queryByText("Washington")).not.toBeInTheDocument(),await t(e.queryByText("Second Email")).not.toBeInTheDocument()}},d={args:{config:{...r,layout:"compact"}}},l={args:{config:{...r,layout:"grid"}}},m={args:{config:{...r,showApiNames:!0}},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("streetAddress")).toBeInTheDocument(),await t(e.queryByText("Street Address")).not.toBeInTheDocument()}},u={args:{config:{...r,showEmpty:!0}},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("Second Email")).toBeInTheDocument(),await t(e.getAllByTitle("No value").length).toBeGreaterThan(0)}},p={args:{config:{...r,showRuleChips:!1}},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("Engineering")).toBeInTheDocument(),await t(e.queryByText("2 rules")).not.toBeInTheDocument()}},g={play:async({canvasElement:n})=>{const e=o(n);await S.click(e.getByRole("button",{name:"Used by rules"})),await N(()=>t(e.queryByText("CC-4471")).not.toBeInTheDocument()),await t(e.getByText("Engineering")).toBeInTheDocument(),await t(e.getByText("Staff Platform Engineer")).toBeInTheDocument()}},y={play:async({canvasElement:n})=>{const e=o(n);await S.type(e.getByRole("textbox",{name:"Filter attributes"}),"zzzzz");const i=await e.findByRole("button",{name:"Clear filter"});await t(e.getByText("No attributes match")).toBeInTheDocument(),await S.click(i),await N(()=>t(e.getByText("Engineering")).toBeInTheDocument())}},h={args:{config:{...r,hidden:Object.fromEntries(R.map(n=>[n.name,!0]))}}},T={args:{isLoading:!0}},B={parameters:{viewport:{value:"sidepanelCompact"}},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("samantha.henderson-oconnell@corporate.example.com")).toBeInTheDocument(),await t(e.getByText("1200 Northwest Continental Boulevard, Building 4, Suite 1750")).toBeInTheDocument()}},w={args:{edit:f},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByRole("button",{name:"Edit"})).toBeEnabled(),await t(e.queryByRole("textbox",{name:"Department"})).not.toBeInTheDocument()}},v={args:{edit:{...f,canEdit:!1}},play:async({canvasElement:n})=>{const e=o(n);await t(e.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument(),await t(e.getByRole("button",{name:"Configure attribute display"})).toBeInTheDocument()}},E={args:{edit:{...f,isEditing:!0,changeCount:1},cells:z},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByRole("textbox",{name:"Department"})).toHaveValue("Identity Platform"),await t(e.getByText("1 change")).toBeInTheDocument(),await t(e.getByRole("button",{name:"Save"})).toBeEnabled(),await t(e.getByText("1200 Northwest Continental Boulevard, Building 4, Suite 1750")).toBeInTheDocument()}},b={args:{edit:{...f,isEditing:!0,changeCount:1},cells:z},parameters:{viewport:{value:"sidepanelCompact"}}},x={args:{edit:f,customize:{...O,isCustomizing:!0}},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("Customizing display")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument(),await t(e.queryByRole("button",{name:"Configure attribute display"})).not.toBeInTheDocument(),await t(e.getByRole("button",{name:"Done"})).toBeInTheDocument()}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The chip is the pane's whole argument, and it is plural here.
    await expect(canvas.getByText('2 rules')).toBeInTheDocument();
    await expect(canvas.getByText('1 rule')).toBeInTheDocument();
    // An attribute no granting rule reads carries no chip.
    await expect(canvas.getByText('Product Engineering')).toBeInTheDocument();

    // Uncategorized is populated and last, and it cannot vanish.
    await expect(canvas.getByRole('region', {
      name: 'Uncategorized'
    })).toBeInTheDocument();
    await expect(canvas.getByText('CC-4471')).toBeInTheDocument();

    // A hidden attribute renders nowhere.
    await expect(canvas.queryByText('Washington')).not.toBeInTheDocument();

    // …and an empty one is out too, because showEmpty is off.
    await expect(canvas.queryByText('Second Email')).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"The default `rows` layout: a label column, then a wrapping value. `Engineering`\ncarries its `2 rules` chip, `Cost Center` collects in Uncategorized, and the hidden\n`state` attribute is simply not there.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      layout: 'compact'
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"`compact`: the same label-then-value structure at tighter gaps.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      layout: 'grid'
    }
  }
}`,...l.parameters?.docs?.source},description:{story:"`grid`: auto-fitting cards on the canvas, label above value.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      showApiNames: true
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('streetAddress')).toBeInTheDocument();
    await expect(canvas.queryByText('Street Address')).not.toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"`showApiNames` on: the label column becomes the raw Okta key in mono, which is\nthe vocabulary a rule condition actually uses.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      showEmpty: true
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Second Email')).toBeInTheDocument();
    await expect(canvas.getAllByTitle('No value').length).toBeGreaterThan(0);
  }
}`,...u.parameters?.docs?.source},description:{story:'`showEmpty` on: `Display Name` and `Second Email` appear with an em dash — the state\nthat answers "does this org define the attribute at all?".',...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      showRuleChips: false
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.queryByText('2 rules')).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"`showRuleChips` off: the values stay, the explanation goes.",...p.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Used by rules'
    }));
    await waitFor(() => expect(canvas.queryByText('CC-4471')).not.toBeInTheDocument());
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.getByText('Staff Platform Engineer')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:"The `Used by rules` pill: only the attributes a granting rule actually reads.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', {
      name: 'Filter attributes'
    }), 'zzzzz');
    const clear = await canvas.findByRole('button', {
      name: 'Clear filter'
    });
    await expect(canvas.getByText('No attributes match')).toBeInTheDocument();
    await userEvent.click(clear);
    await waitFor(() => expect(canvas.getByText('Engineering')).toBeInTheDocument());
  }
}`,...y.parameters?.docs?.source},description:{story:`Filtered to nothing: an empty state that names the cause and offers the way out,
rather than a blank pane.`,...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      hidden: Object.fromEntries(ATTRIBUTES.map(a => [a.name, true]))
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"Nothing to render and no filter to blame — the pane points at the gear instead.",...h.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true
  }
}`,...T.parameters?.docs?.source},description:{story:"Placeholders while the profile and the org schema load.",...T.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('samantha.henderson-oconnell@corporate.example.com')).toBeInTheDocument();
    await expect(canvas.getByText('1200 Northwest Continental Boulevard, Building 4, Suite 1750')).toBeInTheDocument();
  }
}`,...B.parameters?.docs?.source},description:{story:"The 360px floor: the long login and street address wrap in full rather than clipping.",...B.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    edit: EDIT_CONTROLS
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Edit'
    })).toBeEnabled();
    // Nothing has become a control yet.
    await expect(canvas.queryByRole('textbox', {
      name: 'Department'
    })).not.toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source},description:{story:`Editing is offered but not under way: one **Edit** button beside the gear, and
every value still read-only. This is the pane an admin lands on.`,...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...EDIT_CONTROLS,
      canEdit: false
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Edit'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Configure attribute display'
    })).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:`A profile with nothing editable. The button is gone, not disabled: there would be no
controls behind it and no lock reasons to explain.`,...v.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...EDIT_CONTROLS,
      isEditing: true,
      changeCount: 1
    },
    cells: EDIT_CELLS
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', {
      name: 'Department'
    })).toHaveValue('Identity Platform');
    await expect(canvas.getByText('1 change')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Save'
    })).toBeEnabled();

    // An attribute with no cell is untouched by edit mode — including the long
    // street address this pane exists to stop clipping.
    await expect(canvas.getByText('1200 Northwest Continental Boulevard, Building 4, Suite 1750')).toBeInTheDocument();
  }
}`,...E.parameters?.docs?.source},description:{story:"Edit mode with one attribute drafted: `department` is a text field holding the new\nvalue, `id` says why it is locked, and every attribute without a cell is untouched.",...E.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...EDIT_CONTROLS,
      isEditing: true,
      changeCount: 1
    },
    cells: EDIT_CELLS
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...b.parameters?.docs?.source},description:{story:`Edit mode at the 360px floor: the header's control cluster wraps onto its own row
rather than squeezing the summary sentence.`,...b.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    edit: EDIT_CONTROLS,
    customize: {
      ...CUSTOMIZE_CONTROLS,
      isCustomizing: true
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Customizing display')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Edit'
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Configure attribute display'
    })).not.toBeInTheDocument();
    // The read-mode list is gone; the editor's verbs are on screen instead.
    await expect(canvas.getByRole('button', {
      name: 'Done'
    })).toBeInTheDocument();
  }
}`,...x.parameters?.docs?.source},description:{story:"Customize mode: `ProfileDisplayEditor` replaces the section list in place, the header\ncarries a `Customizing display` badge instead of Edit and the gear, and the editor's\nfooter holds Reset to default / Cancel / Done.",...x.parameters?.docs?.description}}};const J=["Default","CompactLayout","GridLayout","ApiNames","ShowingEmptyAttributes","WithoutRuleChips","UsedByRulesOnly","FilteredToNothing","NothingConfiguredToShow","Loading","Narrow","Editable","NothingEditable","Editing","EditingNarrow","Customizing"];export{m as ApiNames,d as CompactLayout,x as Customizing,c as Default,w as Editable,E as Editing,b as EditingNarrow,y as FilteredToNothing,l as GridLayout,T as Loading,B as Narrow,h as NothingConfiguredToShow,v as NothingEditable,u as ShowingEmptyAttributes,g as UsedByRulesOnly,p as WithoutRuleChips,J as __namedExportsOrder,$ as default};
