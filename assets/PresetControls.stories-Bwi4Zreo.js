import{P as y}from"./PresetControls-Hu2FMg0X.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:p,fn:m,userEvent:d,within:v}=__STORYBOOK_MODULE_TEST__,u=[{id:"p-1",entityId:"users",name:"Offboarding audit",enabledColumnIds:["id","status","email"],createdAt:new Date("2026-01-01T00:00:00Z"),version:1},{id:"p-2",entityId:"users",name:"Full profile",enabledColumnIds:["id","email","firstName","lastName","department"],filterText:'status eq "ACTIVE"',createdAt:new Date("2026-02-01T00:00:00Z"),version:1}],b={title:"Export/PresetControls",component:y,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Apply a saved column selection, save the current one under a name, or delete the applied preset. Persistence is owned by the tab hook: the only state this component holds is the name being typed."}}},argTypes:{presets:{description:"Saved presets for the active entity, newest first."},activePresetId:{description:"Id of the currently applied preset, or `null`."},onApply:{description:"Apply a saved preset by id."},onSave:{description:"Save the current selection under a name."},onDelete:{description:"Delete a saved preset by id."},canSave:{description:"Whether saving is allowed (e.g. at least one column enabled)."}},args:{presets:u,activePresetId:null,onApply:m(),onSave:m(),onDelete:m(),canSave:!0}},s={},n={args:{activePresetId:"p-1"},play:async({args:a,canvasElement:t})=>{const e=v(t);await d.click(e.getByRole("button",{name:/Delete/})),await p(a.onDelete).toHaveBeenCalledWith("p-1")}},r={args:{presets:[]}},o={args:{canSave:!1}},i={play:async({args:a,canvasElement:t})=>{const e=v(t),l=e.getByRole("button",{name:"Save"});await p(l).toBeDisabled(),await d.type(e.getByLabelText("Preset name"),"Contractors"),await p(l).toBeEnabled(),await d.click(l),await p(a.onSave).toHaveBeenCalledWith("Contractors")}},c={play:async({args:a,canvasElement:t})=>{const e=v(t);await d.selectOptions(e.getByLabelText("Apply a saved preset"),"p-2"),await p(a.onApply).toHaveBeenCalledWith("p-2")}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Presets available; none applied yet.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    activePresetId: 'p-1'
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Delete/
    }));
    await expect(args.onDelete).toHaveBeenCalledWith('p-1');
  }
}`,...n.parameters?.docs?.source},description:{story:"A preset is applied, so the delete affordance appears and reports the applied id.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    presets: []
  }
}`,...r.parameters?.docs?.source},description:{story:"No presets saved yet — the apply dropdown is disabled.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    canSave: false
  }
}`,...o.parameters?.docs?.source},description:{story:"Saving is blocked (no columns enabled).",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', {
      name: 'Save'
    });
    await expect(save).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Preset name'), 'Contractors');
    await expect(save).toBeEnabled();
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledWith('Contractors');
  }
}`,...i.parameters?.docs?.source},description:{story:"Naming a selection enables Save, and saving reports the trimmed name upward.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText('Apply a saved preset'), 'p-2');
    await expect(args.onApply).toHaveBeenCalledWith('p-2');
  }
}`,...c.parameters?.docs?.source},description:{story:"Picking a preset from the dropdown applies it by id.",...c.parameters?.docs?.description}}};const S=["Default","PresetApplied","Empty","CannotSave","SavingAPreset","ApplyingAPreset"];export{c as ApplyingAPreset,o as CannotSave,s as Default,r as Empty,n as PresetApplied,i as SavingAPreset,S as __namedExportsOrder,b as default};
