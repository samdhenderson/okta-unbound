import{C as S}from"./ComparisonAttributesTab-CtQ7hTbh.js";import{D as R}from"./profileDisplayStore-CVAj7s6I.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./ComparisonAttributeRow-D8-3vL11.js";import"./ProfileEditCell-DdhUiuAe.js";import"./ComparisonAttributesToolbar-dc3pEzSe.js";import"./profileAttributeBlocks-BIZLFcVk.js";import"./index-Dob3nYDb.js";const{expect:n,fn:T,userEvent:C,waitFor:o,within:s}=__STORYBOOK_MODULE_TEST__,r=(t,e,a,I,A,N={})=>({key:`profile.${t}`,name:t,label:e,kind:"base",contextValue:a,comparedValue:I,verdict:A,categoryKey:"organization",hiddenByConfig:!1,...N}),D=[r("department","Department","Engineering","Design","differs"),r("manager","Manager","dana@example.com","","onlyContext"),r("costCenter","Cost center","","CC-42","onlyCompared"),r("userType","User type","Employee","Employee","same",{categoryKey:"identity"}),r("nickName","Nickname","","","bothEmpty",{categoryKey:""})],k=[r("employeeNumber","Employee number","E-0001","E-0002","differs",{hiddenByConfig:!0})],b={...R,categories:[{key:"identity",name:"Identity"},{key:"organization",name:"Organization"},{key:"contact-locale",name:"Contact & locale"}],assign:{userType:"identity",department:"organization",manager:"organization",costCenter:"organization",employeeNumber:"organization",nickName:""},attrOrder:["userType","department","manager","costCenter","employeeNumber","nickName"],hidden:{employeeNumber:!0}},O=(t,e={})=>({name:t,editability:{editable:!0,control:"text",required:!1},dirty:!1,onChange:T(),...e}),B=(t,e={})=>Object.fromEntries(t.map(a=>[a,O(a,e[a])])),i=(t,e,a={})=>({key:t,userName:e,cells:{},isEditing:!1,isSaving:!1,hasChanges:!1,hasInvalid:!1,canEdit:!0,begin:T(),cancel:T(),requestSave:T(),...a}),x=["department","manager","costCenter","userType","nickName","employeeNumber"],G={title:"Users/Comparison/ComparisonAttributesTab",component:S,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The comparison's fourth dimension: what is different about these two people, attribute by attribute, in the admin's own categories and order. The cells carry **values**, not checkmarks, and the rows arrive differences-first from `attributeParityRows` and are never re-sorted here.\n\nTwo rules govern it. A **hidden difference is disclosed, never dropped** — the attribute the config hides may be the one explaining an access gap — and the counts and markers describe what Okta holds, not what has been typed, so a dirty side takes an `Edited` badge instead. Either column is editable, one editor per side."}}},args:{contextName:"Ada Context",comparedName:"Bo Compared",rows:D,hiddenRows:k,hiddenDifferences:1,config:b,ruleReads:{department:["Engineering → VPN Access"]}},argTypes:{contextName:{description:"Display name of the context user — the LEFT cell of every row."},comparedName:{description:"Display name of the compared user — the RIGHT cell of every row."},rows:{description:"The config-visible rows from `attributeParityRows`, ordered differences-first."},hiddenRows:{description:"Rows the config hides, kept whole so this surface can reveal them on demand."},hiddenDifferences:{description:"How many of `hiddenRows` actually differ."},config:{description:"The admin's reconciled display configuration."},ruleReads:{description:"Okta attribute name → the rules that read it and grant either user access."},contextEdit:{description:"The context user's editor. Absent leaves the left column read-only."},comparedEdit:{description:"The compared user's editor. Same contract as `contextEdit`."}}},c={},d={play:async({canvasElement:t})=>{const e=s(t);await C.click(e.getByRole("button",{name:/^All/})),await o(()=>n(e.getByText("User type")).toBeInTheDocument()),n(e.getByText("Uncategorized")).toBeInTheDocument(),n(e.queryByText("Contact & locale")).not.toBeInTheDocument()}},m={play:async({canvasElement:t})=>{const e=s(t);n(e.queryByText("Employee number")).not.toBeInTheDocument(),await C.click(e.getByRole("button",{name:"Show"})),await o(()=>n(e.getByText("Employee number")).toBeInTheDocument()),n(e.getByText("Hidden")).toBeInTheDocument()}},p={args:{hiddenRows:[],hiddenDifferences:0}},l={args:{config:{...b,showApiNames:!0}},play:async({canvasElement:t})=>{const e=s(t);await o(()=>n(e.getByText("department")).toBeInTheDocument()),n(e.queryByText("Department")).not.toBeInTheDocument()}},u={args:{config:{...b,showRuleChips:!1}}},h={play:async({canvasElement:t})=>{const e=s(t);await C.type(e.getByLabelText("Filter attributes by name or value"),"zzzz"),await o(()=>n(e.getByText("No attributes match")).toBeInTheDocument())}},y={args:{rows:[],hiddenRows:[],hiddenDifferences:0}},g={args:{rows:[r("streetAddress","Street address","1 Example Street, Exampleton, EX1 2AB","2 Example Street, Exampleton, EX1 2AC","differs"),...D]},parameters:{viewport:{value:"sidepanelCompact"}}},f={args:{contextEdit:i("context","Ada Context"),comparedEdit:i("compared","Bo Compared",{isEditing:!0,cells:B(x)})},play:async({canvasElement:t})=>{const e=s(t);await o(()=>n(e.getByLabelText("Department")).toHaveValue("Design")),n(e.getByRole("button",{name:"Differences 3"})).toBeInTheDocument()}},w={args:{comparedEdit:i("compared","Bo Compared",{isEditing:!0,hasChanges:!0,cells:B(x,{department:{draft:"Engineering",dirty:!0}})})},play:async({canvasElement:t})=>{const e=s(t);await o(()=>n(e.getByText("Edited")).toBeInTheDocument()),n(e.getByRole("button",{name:"Differences 3"})).toBeInTheDocument()}},E={args:{comparedEdit:i("compared","Bo Compared",{isEditing:!0,hasChanges:!0,cells:B(x,{employeeNumber:{draft:"E-0003",dirty:!0}})})},play:async({canvasElement:t})=>{const e=s(t);await o(()=>n(e.getByText("Employee number")).toBeInTheDocument()),n(e.getByRole("button",{name:"Show"})).toBeInTheDocument(),n(e.getByText("Hidden")).toBeInTheDocument()}},v={args:{contextEdit:i("context","Ada Context",{isEditing:!0,hasChanges:!0,cells:B(x,{department:{draft:"Design",dirty:!0}})}),comparedEdit:i("compared","Bo Compared")},parameters:{viewport:{value:"sidepanelCompact"}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:"{}",...c.parameters?.docs?.source},description:{story:"The default view: differences only, with the `1 rule` chip that makes the diff an access explanation.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /^All/
    }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
    expect(canvas.getByText('Uncategorized')).toBeInTheDocument();
    expect(canvas.queryByText('Contact & locale')).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Every verdict at once. It also pins two grouping decisions: `Uncategorized` collects\nwhat the config has not placed, and a configured-but-empty category is dropped.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText('Employee number')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show'
    }));
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"An attribute the config hides, which the two users differ on, is counted and disclosed rather than dropped.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    hiddenRows: [],
    hiddenDifferences: 0
  }
}`,...p.parameters?.docs?.source},description:{story:"Nothing is hidden, so the disclosure line is absent entirely.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
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
    await waitFor(() => expect(canvas.getByText('department')).toBeInTheDocument());
    expect(canvas.queryByText('Department')).not.toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"`showApiNames` renders the Okta name in mono instead of the human label.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...CONFIG,
      showRuleChips: false
    }
  }
}`,...u.parameters?.docs?.source},description:{story:"`showRuleChips` off — the admin's configuration governs the chips too.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter attributes by name or value'), 'zzzz');
    await waitFor(() => expect(canvas.getByText('No attributes match')).toBeInTheDocument());
  }
}`,...h.parameters?.docs?.source},description:{story:'Filtered to nothing — distinct from "there are no attributes to compare".',...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [],
    hiddenRows: [],
    hiddenDifferences: 0
  }
}`,...y.parameters?.docs?.source},description:{story:'No attributes at all — a different statement from "nothing matches the filter".',...y.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [row('streetAddress', 'Street address', '1 Example Street, Exampleton, EX1 2AB', '2 Example Street, Exampleton, EX1 2AC', 'differs'), ...ROWS]
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"The compact side panel: values wrap rather than truncate, so two values differing only in their tails cannot render identically.",...g.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: side('context', 'Ada Context'),
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      cells: editCells(ALL_NAMES)
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Department')).toHaveValue('Design'));
    expect(canvas.getByRole('button', {
      name: 'Differences 3'
    })).toBeInTheDocument();
  }
}`,...f.parameters?.docs?.source},description:{story:"The compared column is editing: its cells become controls, and every count is unchanged.",...f.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, {
        department: {
          draft: 'Engineering',
          dirty: true
        }
      })
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Edited')).toBeInTheDocument());
    expect(canvas.getByRole('button', {
      name: 'Differences 3'
    })).toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source},description:{story:"A drafted change: the row says which side holds it, and the pill's count still describes Okta.",...w.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    comparedEdit: side('compared', 'Bo Compared', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, {
        employeeNumber: {
          draft: 'E-0003',
          dirty: true
        }
      })
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // The disclosure is collapsed — it still offers to "Show" — and the row is
    // listed anyway, still marked as one the config hides.
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByRole('button', {
      name: 'Show'
    })).toBeInTheDocument();
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  }
}`,...E.parameters?.docs?.source},description:{story:`A config-hidden row that was revealed, edited, then re-collapsed stays on screen —
otherwise the edit would be off screen and still in the patch.`,...E.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    contextEdit: side('context', 'Ada Context', {
      isEditing: true,
      hasChanges: true,
      cells: editCells(ALL_NAMES, {
        department: {
          draft: 'Design',
          dirty: true
        }
      })
    }),
    comparedEdit: side('compared', 'Bo Compared')
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"Editing at 360px: the value cells keep the same three-track grid the read-only rows use.",...v.parameters?.docs?.description}}};const V=["Default","AllVerdicts","HiddenDifferencesRevealed","NothingHidden","ApiNames","RuleChipsOff","FilteredToNothing","Empty","CompactPanel","EditingComparedColumn","EditedDraft","DirtyHiddenRowStaysListed","EditingCompact"];export{d as AllVerdicts,l as ApiNames,g as CompactPanel,c as Default,E as DirtyHiddenRowStaysListed,w as EditedDraft,v as EditingCompact,f as EditingComparedColumn,y as Empty,h as FilteredToNothing,m as HiddenDifferencesRevealed,p as NothingHidden,u as RuleChipsOff,V as __namedExportsOrder,G as default};
