import{G as g}from"./GroupsListActionBar-MQxaoHyo.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:e,fn:r,userEvent:h,within:o}=__STORYBOOK_MODULE_TEST__,B={title:"Groups/GroupsListActionBar",component:g,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The groups-list rung's action bar: a page-scoped action row and a selection-scoped register, which `ActionBar` renders as a recessed well one tonal step below the row. *Export list* acts on the filter and is present in every state; *Export (N)* acts on the ticked rows and is gone the moment they are unticked.\n\nThe register is passed unconditionally, so ticking a row adds controls to a row that already exists and nothing below the band moves. Its first control is always the selection toggle, never a verb that writes. Selection-scoped verbs are omitted below their threshold rather than shipped disabled; *Export list* and *Select all (M)* are the two that stay disabled instead, each carrying its reason in its accessible description."}}},args:{selectedCount:0,filteredCount:42,onSelectAll:r(),onDeselectAll:r(),onCompare:r(),onExportSelection:r(),onExportGroupsList:r()},argTypes:{selectedCount:{description:"Number of currently selected groups."},filteredCount:{description:"Number of groups after filtering."},onSelectAll:{description:"Selects every filtered group."},onDeselectAll:{description:"Clears the selection."},onCompare:{description:"Opens the comparison modal (offered only for 2–5 selections)."},onExportSelection:{description:"Exports the selected groups."},onExportGroupsList:{description:"Exports the current (filtered) groups list."}}},i={play:async({args:a,canvasElement:t})=>{const n=o(t),s=n.getByRole("group",{name:"Selection actions for the groups list"});await e(o(s).getAllByRole("button")).toHaveLength(1),await e(o(s).getByRole("button",{name:"Select all (42)"})).toBeEnabled(),await e(n.queryByRole("button",{name:"Deselect all"})).not.toBeInTheDocument(),await e(n.queryByRole("button",{name:/^Compare/})).not.toBeInTheDocument(),await h.click(o(s).getByRole("button",{name:"Select all (42)"})),await e(a.onSelectAll).toHaveBeenCalledTimes(1)}},c={args:{selectedCount:3},play:async({canvasElement:a})=>{const t=o(a),n=t.getByRole("group",{name:"Selection actions for the groups list"}),s=o(n).getAllByRole("button")[0];await e(s).toHaveAccessibleName("Deselect all"),await e(t.getByRole("button",{name:"Export (3)"})).toBeInTheDocument(),await e(o(n).queryByRole("button",{name:"Export (3)"})).not.toBeInTheDocument()}},l={args:{selectedCount:3},play:async({canvasElement:a})=>{const t=o(a),n=t.getByRole("group",{name:"Selection actions for the groups list"}),s=o(n).getAllByRole("button")[0];await e(s).toHaveAccessibleName("Deselect all"),await e(o(n).getByRole("button",{name:"Select all (42)"})).toBeEnabled(),await e(o(n).getByRole("button",{name:"Compare (3)"})).toBeInTheDocument(),await e(t.getByRole("button",{name:"Export (3)"})).toBeInTheDocument()}},p={args:{selectedCount:12},play:async({canvasElement:a})=>{const t=o(a);await e(t.queryByRole("button",{name:/^Compare/})).not.toBeInTheDocument(),await e(t.getByRole("button",{name:"Export (12)"})).toBeInTheDocument()}},u={args:{selectedCount:3},play:async({canvasElement:a})=>{const t=o(a),n=t.getByRole("button",{name:"Export list"});await e(n).toBeEnabled();const s=t.getByRole("group",{name:"Selection actions for the groups list"});await e(o(s).queryByRole("button",{name:"Export list"})).not.toBeInTheDocument()}},m={args:{selectedCount:42},play:async({canvasElement:a})=>{const t=o(a),n=t.getByRole("group",{name:"Selection actions for the groups list"});await e(o(n).getAllByRole("button")[0]).toHaveAccessibleName("Deselect all");const s=t.getByRole("button",{name:"Select all (42)"});await e(s).toBeDisabled(),await e(s).toHaveAccessibleDescription("All 42 groups matching the filter are already selected"),await e(t.getByRole("button",{name:"Deselect all"})).toBeEnabled()}},d={args:{filteredCount:0},play:async({canvasElement:a})=>{const t=o(a),n=t.getByRole("button",{name:"Export list"});await e(n).toBeDisabled(),await e(n).toHaveAccessibleDescription("No groups match the current filter, so there is nothing to export");const s=t.getByRole("button",{name:"Select all (0)"});await e(s).toBeDisabled(),await e(s).toHaveAccessibleDescription("No groups match the current filter")}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', {
      name: 'Selection actions for the groups list'
    });
    await expect(within(register).getAllByRole('button')).toHaveLength(1);
    await expect(within(register).getByRole('button', {
      name: 'Select all (42)'
    })).toBeEnabled();
    await expect(canvas.queryByRole('button', {
      name: 'Deselect all'
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Compare/
    })).not.toBeInTheDocument();
    await userEvent.click(within(register).getByRole('button', {
      name: 'Select all (42)'
    }));
    await expect(args.onSelectAll).toHaveBeenCalledTimes(1);
  }
}`,...i.parameters?.docs?.source},description:{story:"The register at rest: it already holds `Select all (42)`, and no selection-scoped verb\nis offered yet — not even disabled.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCount: 3
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', {
      name: 'Selection actions for the groups list'
    });
    const first = within(register).getAllByRole('button')[0];
    await expect(first).toHaveAccessibleName('Deselect all');
    // Non-vacuity: a selection-scoped verb really is on the strip at this size —
    // it is just nowhere near position one.
    await expect(canvas.getByRole('button', {
      name: 'Export (3)'
    })).toBeInTheDocument();
    await expect(within(register).queryByRole('button', {
      name: 'Export (3)'
    })).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:`The safety property: with a selection large enough for the register to carry verbs, the
first control in the register is still *Deselect all*, never one of them. *Export (3)* is
the non-vacuity witness — a selection-scoped verb present at this size, nowhere near
position one.

Scoped to the register, not the whole strip: the strip's first control is the page row's
\`primary\`, which is constant.`,...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCount: 3
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', {
      name: 'Selection actions for the groups list'
    });
    const first = within(register).getAllByRole('button')[0];
    await expect(first).toHaveAccessibleName('Deselect all');
    await expect(within(register).getByRole('button', {
      name: 'Select all (42)'
    })).toBeEnabled();
    await expect(within(register).getByRole('button', {
      name: 'Compare (3)'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Export (3)'
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:`Three selected — *Compare (3)* joins the register beside the two selection
controls; *Export (3)* sits in the tier.`,...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCount: 12
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /^Compare/
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Export (12)'
    })).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:`Twelve selected — past Compare's 2–5 window, so Compare is gone, while *Export (12)*,
which has no upper bound, stays.`,...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCount: 3
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const exportList = canvas.getByRole('button', {
      name: 'Export list'
    });
    // Present with a selection too — a page verb does not come and go with rows.
    await expect(exportList).toBeEnabled();

    // And it is a page verb, so it is never in the selection register.
    const register = canvas.getByRole('group', {
      name: 'Selection actions for the groups list'
    });
    await expect(within(register).queryByRole('button', {
      name: 'Export list'
    })).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"*Export list* is this rung's `primary`: present in every state, pinned out of the\noverflow, and never in the selection register. Every other export in the app is `tier`.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCount: 42
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', {
      name: 'Selection actions for the groups list'
    });
    await expect(within(register).getAllByRole('button')[0]).toHaveAccessibleName('Deselect all');
    const selectAll = canvas.getByRole('button', {
      name: 'Select all (42)'
    });
    await expect(selectAll).toBeDisabled();
    await expect(selectAll).toHaveAccessibleDescription('All 42 groups matching the filter are already selected');
    // The way out is a separate, live control — not this one under another name.
    await expect(canvas.getByRole('button', {
      name: 'Deselect all'
    })).toBeEnabled();
  }
}`,...m.parameters?.docs?.source},description:{story:"Everything taken — *Select all* stays for its count, disabled, with the reason in its\naccessible description. `(M)` is the strip's only statement of how many rows match.",...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    filteredCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const exportList = canvas.getByRole('button', {
      name: 'Export list'
    });
    await expect(exportList).toBeDisabled();
    await expect(exportList).toHaveAccessibleDescription('No groups match the current filter, so there is nothing to export');
    const selectAll = canvas.getByRole('button', {
      name: 'Select all (0)'
    });
    await expect(selectAll).toBeDisabled();
    await expect(selectAll).toHaveAccessibleDescription('No groups match the current filter');
  }
}`,...d.parameters?.docs?.source},description:{story:`Nothing matches the filter — both deliberately-disabled controls stay, and the
two say different things, because they are sitting on different boundaries.`,...d.parameters?.docs?.description}}};const v=["Default","FirstRegisterControlIsAlwaysSelection","WithSelection","LargeSelection","ExportListIsTheRungsPrimary","AllSelected","NoFilteredGroups"];export{m as AllSelected,i as Default,u as ExportListIsTheRungsPrimary,c as FirstRegisterControlIsAlwaysSelection,p as LargeSelection,d as NoFilteredGroups,l as WithSelection,v as __namedExportsOrder,B as default};
