import{j as x,r as N}from"./iframe-tAvKsVeF.js";import{C as D}from"./ComparisonAttributeRow-D8-3vL11.js";import"./preload-helper-PPVm8Dsz.js";import"./ProfileEditCell-DdhUiuAe.js";const{expect:n,fn:V,userEvent:T,waitFor:A,within:B}=__STORYBOOK_MODULE_TEST__,s=(t,e,a,b,S,k={})=>({key:`profile.${t}`,name:t,label:e,kind:"base",contextValue:a,comparedValue:b,verdict:S,categoryKey:"organization",hiddenByConfig:!1,...k}),r=(t,e={})=>({name:t,editability:{editable:!0,control:"text",required:!1},dirty:!1,onChange:V(),...e}),O=t=>x.jsx("ul",{className:"divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white",children:x.jsx(t,{})}),H={title:"Users/Comparison/ComparisonAttributeRow",component:D,tags:["autodocs"],decorators:[O],parameters:{layout:"padded",docs:{description:{component:"One row of the comparison's Attributes tab: the attribute's name and annotations, then the two users' values with an equality marker between them. The marker is not a control — a `role=\"img\"` span showing `=` or `≠`, two glyphs so the state never rides on colour — and values wrap rather than truncate, because two values differing only in their tails would render identically beside a `≠` nobody could explain.\n\nEither side is editable: given a cell for a side, that side delegates to `ProfileEditCell`, so an attribute locked in the Profile pane is locked identically here. The marker does not follow the typing — `=` / `≠` is a statement about what Okta holds — and a dirty side carries an `Edited` badge instead."}}},args:{row:s("department","Department","Engineering","Design","differs"),contextName:"Ada Context",comparedName:"Bo Compared",showApiNames:!1},argTypes:{row:{description:"The attribute and both users' values for it, from `attributeParityRows`."},contextName:{description:"Display name of the context user (baseline) — the LEFT cell."},comparedName:{description:"Display name of the compared user — the RIGHT cell."},showApiNames:{description:"Render the Okta name in mono instead of the human label (`config.showApiNames`)."},readers:{description:"Names of the rules that read this attribute and currently grant either user access. Absent renders no chip."},contextCell:{description:"The context user's editing cell, joined by `row.name`. Present only while that column is editing."},comparedCell:{description:"The compared user's editing cell. Same contract as `contextCell`."}}},o={},i={args:{row:s("userType","User type","Employee","Employee","same")}},d={args:{row:s("manager","Manager","dana@example.com","","onlyContext")}},c={args:{row:s("costCenter","Cost center","","CC-42","onlyCompared")}},l={args:{row:s("nickName","Nickname","","","bothEmpty")}},p={args:{readers:["Engineering → VPN Access","Contractors → VPN Access"]}},m={args:{showApiNames:!0}},u={args:{row:s("employeeNumber","Employee number","E-0001","E-0002","differs",{hiddenByConfig:!0})}},h={args:{row:s("streetAddress","Street address","1 Example Street, Exampleton, EX1 2AB, Exampleshire","1 Example Street, Exampleton, EX1 2AC, Exampleshire","differs")},parameters:{viewport:{value:"sidepanelCompact"}}},g={args:{comparedCell:r("department")},play:async({canvasElement:t})=>{const e=B(t);await A(()=>n(e.getByLabelText("Department")).toHaveValue("Design")),n(e.getByRole("img",{name:"The two users have different values"})).toBeVisible()}},y={args:{comparedCell:r("department",{draft:"Engineering",dirty:!0})},play:async({canvasElement:t})=>{const e=B(t);await A(()=>n(e.getByTitle(/Bo Compared has an unsaved change/)).toBeInTheDocument()),n(e.getByRole("img",{name:"The two users have different values"})).toBeVisible()}},f={args:{contextCell:r("department",{draft:"Design",dirty:!0}),comparedCell:r("department",{draft:"Design",dirty:!0})}},w={args:{comparedCell:r("department",{editability:{editable:!1,reason:"externally-mastered",explanation:"An external system masters this attribute (Active Directory), so it is changed there rather than here."},onChange:void 0})}},v={args:{comparedCell:r("department",{draft:"",dirty:!0,invalid:"Department is required."})}},C={args:{contextCell:r("department"),comparedCell:r("department",{draft:"Engineering",dirty:!0})},parameters:{viewport:{value:"sidepanelCompact"}}},E={render:function(e){const[a,b]=N.useState(void 0);return x.jsx(D,{...e,comparedCell:{name:"department",editability:{editable:!0,control:"text",required:!1},draft:a,dirty:a!==void 0&&a!==e.row.comparedValue,onChange:b}})},play:async({canvasElement:t})=>{const e=B(t),a=await e.findByLabelText("Department");await T.clear(a),await T.type(a,"Engineering"),await n(a).toHaveValue("Engineering"),await n(e.getByTitle(/Bo Compared has an unsaved change/)).toBeInTheDocument(),await n(e.getByRole("img",{name:"The two users have different values"})).toBeVisible()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"`differs` — both users have a value and the values disagree.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('userType', 'User type', 'Employee', 'Employee', 'same')
  }
}`,...i.parameters?.docs?.source},description:{story:"`same` — both users hold the same value, so the marker is `=`.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('manager', 'Manager', 'dana@example.com', '', 'onlyContext')
  }
}`,...d.parameters?.docs?.source},description:{story:"`onlyContext` — the compared user's cell states the non-answer rather than sitting empty.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared')
  }
}`,...c.parameters?.docs?.source},description:{story:"`onlyCompared` — the mirror image, on the other side.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('nickName', 'Nickname', '', '', 'bothEmpty')
  }
}`,...l.parameters?.docs?.source},description:{story:"`bothEmpty` — neither user has a value, which is an agreement, so the marker is `=`.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    readers: ['Engineering → VPN Access', 'Contractors → VPN Access']
  }
}`,...p.parameters?.docs?.source},description:{story:"A currently-granting rule reads this attribute — the chip that makes the diff an explanation.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    showApiNames: true
  }
}`,...m.parameters?.docs?.source},description:{story:"`showApiNames` swaps the human label for the Okta name, in mono.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
      hiddenByConfig: true
    })
  }
}`,...u.parameters?.docs?.source},description:{story:"A row the display config hides, revealed on demand and marked as such.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    row: row('streetAddress', 'Street address', '1 Example Street, Exampleton, EX1 2AB, Exampleshire', '1 Example Street, Exampleton, EX1 2AC, Exampleshire', 'differs')
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"Long values at 360px: both cells wrap, stay the same height, and the marker holds centre.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    comparedCell: editCell('department')
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Department')).toHaveValue('Design'));
    expect(canvas.getByRole('img', {
      name: 'The two users have different values'
    })).toBeVisible();
  }
}`,...g.parameters?.docs?.source},description:{story:"The compared column is editing; the context column and the marker are untouched.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    comparedCell: editCell('department', {
      draft: 'Engineering',
      dirty: true
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTitle(/Bo Compared has an unsaved change/)).toBeInTheDocument());
    expect(canvas.getByRole('img', {
      name: 'The two users have different values'
    })).toBeVisible();
  }
}`,...y.parameters?.docs?.source},description:{story:"A drafted value: the `Edited` badge names the side holding it, and the `≠` stays put.",...y.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    contextCell: editCell('department', {
      draft: 'Design',
      dirty: true
    }),
    comparedCell: editCell('department', {
      draft: 'Design',
      dirty: true
    })
  }
}`,...f.parameters?.docs?.source},description:{story:"Both columns edited at once — each badge says whose change it is.",...f.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    comparedCell: editCell('department', {
      editability: {
        editable: false,
        reason: 'externally-mastered',
        explanation: 'An external system masters this attribute (Active Directory), so it is changed there rather than here.'
      },
      onChange: undefined
    })
  }
}`,...w.parameters?.docs?.source},description:{story:"An externally-mastered attribute: the lock is stated with its reason, as in the Profile pane.",...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    comparedCell: editCell('department', {
      draft: '',
      dirty: true,
      invalid: 'Department is required.'
    })
  }
}`,...v.parameters?.docs?.source},description:{story:"A drafted value that fails validation, stated on the control it belongs to.",...v.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    contextCell: editCell('department'),
    comparedCell: editCell('department', {
      draft: 'Engineering',
      dirty: true
    })
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...C.parameters?.docs?.source},description:{story:"Editing at 360px: the same three-track grid, so nothing shifts on entering edit mode.",...C.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  render: function Live(args) {
    const [draft, setDraft] = useState<string | undefined>(undefined);
    return <ComparisonAttributeRow {...args} comparedCell={{
      name: 'department',
      editability: {
        editable: true,
        control: 'text',
        required: false
      },
      draft,
      dirty: draft !== undefined && draft !== args.row.comparedValue,
      onChange: setDraft
    }} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText('Department');
    await userEvent.clear(field);
    await userEvent.type(field, 'Engineering');
    await expect(field).toHaveValue('Engineering');
    await expect(canvas.getByTitle(/Bo Compared has an unsaved change/)).toBeInTheDocument();
    await expect(canvas.getByRole('img', {
      name: 'The two users have different values'
    })).toBeVisible();
  }
}`,...E.parameters?.docs?.source},description:{story:"Typing into an editing cell, live. The value follows the keystrokes and the\n`Edited` badge appears — and the marker still reads `≠`, because Okta has not\nchanged and the row never claims otherwise.",...E.parameters?.docs?.description}}};const I=["Differs","Same","OnlyContext","OnlyCompared","BothEmpty","WithRuleChip","ApiName","HiddenByConfig","LongValuesCompact","EditingOneSide","EditedDraft","BothSidesEdited","LockedWhileEditing","InvalidDraft","EditingCompact","TypingDoesNotMoveTheMarker"];export{m as ApiName,l as BothEmpty,f as BothSidesEdited,o as Differs,y as EditedDraft,C as EditingCompact,g as EditingOneSide,u as HiddenByConfig,v as InvalidDraft,w as LockedWhileEditing,h as LongValuesCompact,c as OnlyCompared,d as OnlyContext,i as Same,E as TypingDoesNotMoveTheMarker,p as WithRuleChip,I as __namedExportsOrder,H as default};
