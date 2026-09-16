import{j as y}from"./iframe-tAvKsVeF.js";import{U as E}from"./UserProfilePaneHeader-k585POsb.js";import"./preload-helper-PPVm8Dsz.js";const{expect:n,fn:o,userEvent:w,within:a}=__STORYBOOK_MODULE_TEST__,s={canEdit:!0,isEditing:!1,changeCount:0,hasInvalid:!1,onBeginEdit:o(),onCancelEdit:o(),onSave:o()},B={isCustomizing:!1,onBegin:o(),onCommit:o(),onCancel:o()},x={title:"Users/UserProfilePaneHeader",component:E,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The Profile pane's top strip: a constant summary sentence, and beside it a cluster that names the mode — **Edit** plus the gear in read mode, **Cancel + Save** with a dirty count in value-edit mode, a `Customizing display` badge in customize mode.\n\nA verb that cannot act is **absent, not disabled**: no Edit when nothing is editable, no gear mid-draft or while customizing. Save refuses an empty or invalid edit, and the line beside it always says why."}}},argTypes:{shown:{description:"How many attributes the filter and configuration leave on screen."},total:{description:"How many distinct attributes the profile has in total."},ruleReadCount:{description:"How many of the shown attributes a granting rule reads."},customize:{description:"The display-customization mode flag and verbs. Absent renders no gear at all."},edit:{description:"The edit verbs; absent on a surface that does not offer editing."}},args:{shown:12,total:21,ruleReadCount:2,customize:B},decorators:[t=>y.jsx("div",{className:"bg-canvas p-4",children:y.jsx("div",{className:"rounded-md border border-neutral-200 bg-white",children:y.jsx(t,{})})})]},i={play:async({canvasElement:t})=>{const e=a(t);await n(e.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument(),await n(e.getByRole("button",{name:"Configure attribute display"})).toBeInTheDocument()}},r={args:{edit:{...s,canEdit:!1}},play:async({canvasElement:t})=>{const e=a(t);await n(e.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument()}},c={args:{edit:s},play:async({canvasElement:t,args:e})=>{const v=a(t),b=v.getByRole("button",{name:"Edit"});await n(b).toBeEnabled(),await w.click(b),await n(e.edit?.onBeginEdit).toHaveBeenCalledTimes(1),await w.click(v.getByRole("button",{name:"Configure attribute display"})),await n(e.customize?.onBegin).toHaveBeenCalledTimes(1)}},d={args:{edit:{...s,isEditing:!0}},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Save"})).toBeDisabled(),await n(e.getByText("No changes yet")).toBeInTheDocument()}},l={args:{edit:{...s,isEditing:!0,changeCount:2}},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByText("2 changes")).toBeInTheDocument(),await n(e.getByRole("button",{name:"Save"})).toBeEnabled()}},u={args:{edit:{...s,isEditing:!0,changeCount:1}},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByText("1 change")).toBeInTheDocument()}},m={args:{edit:{...s,isEditing:!0,changeCount:2,hasInvalid:!0}},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Save"})).toBeDisabled(),await n(e.getByText("Fix the highlighted values")).toBeInTheDocument()}},p={args:{edit:s,customize:{...B,isCustomizing:!0}},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByText("Customizing display")).toBeInTheDocument(),await n(e.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:"Configure attribute display"})).not.toBeInTheDocument()}},g={args:{customize:void 0,edit:s},play:async({canvasElement:t})=>{const e=a(t);await n(e.queryByRole("button",{name:"Configure attribute display"})).not.toBeInTheDocument(),await n(e.getByRole("button",{name:"Edit"})).toBeEnabled()}},h={args:{edit:{...s,isEditing:!0,changeCount:2}},parameters:{viewport:{value:"sidepanelCompact"}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
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
}`,...i.parameters?.docs?.source},description:{story:`A surface that does not offer editing at all — the Compare view's read-only
columns, or the pane before the org's schema has arrived. Summary and gear only.`,...i.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
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
  }
}`,...r.parameters?.docs?.source},description:{story:`Editing is offered, but this profile has nothing editable — the button is gone
rather than dead.`,...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    edit: controls
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const edit = canvas.getByRole('button', {
      name: 'Edit'
    });
    await expect(edit).toBeEnabled();
    await userEvent.click(edit);
    await expect(args.edit?.onBeginEdit).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Configure attribute display'
    }));
    await expect(args.customize?.onBegin).toHaveBeenCalledTimes(1);
  }
}`,...c.parameters?.docs?.source},description:{story:"At least one attribute can be edited, so the verb is offered beside the gear — and pressing it begins the edit.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
      isEditing: true
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Save'
    })).toBeDisabled();
    await expect(canvas.getByText('No changes yet')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`Edit mode, nothing typed. Save is disabled and the line beside it says so — the
state a bare disabled button would leave unexplained.`,...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
      isEditing: true,
      changeCount: 2
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('2 changes')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Save'
    })).toBeEnabled();
  }
}`,...l.parameters?.docs?.source},description:{story:"Two attributes drafted: the count names what Save would write, and Save is live.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
      isEditing: true,
      changeCount: 1
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 change')).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:'One change, singular — the count never says "changes" for one.',...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
      isEditing: true,
      changeCount: 2,
      hasInvalid: true
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Save'
    })).toBeDisabled();
    await expect(canvas.getByText('Fix the highlighted values')).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:`A drafted value fails validation. Save refuses even though there are changes,
and the reason is stated ahead of the count rather than instead of the button.`,...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    edit: controls,
    customize: {
      ...customize,
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
  }
}`,...p.parameters?.docs?.source},description:{story:`Customize mode: the rows below have become the display editor, so the header carries
the mode and nothing else.`,...p.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    customize: undefined,
    edit: controls
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Configure attribute display'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Edit'
    })).toBeEnabled();
  }
}`,...g.parameters?.docs?.source},description:{story:`A surface with no customization wired at all — no gear, rather than a gear
that would do nothing.`,...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    edit: {
      ...controls,
      isEditing: true,
      changeCount: 2
    }
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"The 360px floor: the edit cluster wraps onto its own row rather than being squeezed.",...h.parameters?.docs?.description}}};const R=["ReadOnly","NothingEditable","Editable","EditingClean","EditingDirty","EditingOneChange","EditingInvalid","Customizing","NoCustomization","Narrow"];export{p as Customizing,c as Editable,d as EditingClean,l as EditingDirty,m as EditingInvalid,u as EditingOneChange,h as Narrow,g as NoCustomization,r as NothingEditable,i as ReadOnly,R as __namedExportsOrder,x as default};
