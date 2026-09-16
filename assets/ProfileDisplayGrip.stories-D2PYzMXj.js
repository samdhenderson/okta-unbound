import{P as l}from"./ProfileDisplayGrip-Yw9dihMQ.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:e,fn:o}=__STORYBOOK_MODULE_TEST__,u={title:"Users/ProfileDisplayGrip",component:l,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"A drag handle that also reorders from the keyboard: **Space or Enter** lifts and then drops, **the arrow keys** move (up/down within and across sections, left/right a whole section at a time), **Escape** puts it back.\n\n`aria-pressed` carries the lifted state, so a screen reader can tell a held item from a resting one without reading the live region. Disabled while the pane's filter is narrowing the list — a drop into a partly-rendered list would compute a position against rows that are not there — and the tooltip says so."}}},argTypes:{label:{description:"What this handle moves — an attribute label or a category name."},lifted:{description:"True while this handle's item is lifted; reflected as `aria-pressed`."},disabled:{description:"Turns the handle off while a filter is narrowing the list."},describedBy:{description:"`id` of the element describing the keyboard contract."},onPointerDown:{description:"Start a pointer drag."},onLift:{description:"Lift this item with the keyboard."},onStep:{description:"Move the lifted item one step."},onDrop:{description:"Drop the lifted item where it stands."},onCancel:{description:"Abandon the lift and put the item back."}},args:{label:"Department",lifted:!1,onPointerDown:o(),onLift:o(),onStep:o(),onDrop:o(),onCancel:o()}},s={},n={play:async({args:t,canvas:c,userEvent:a})=>{const r=c.getByRole("button",{name:"Reorder Department"});await e(r).toHaveAttribute("aria-pressed","false"),r.focus(),await a.keyboard("{ArrowDown}"),await e(t.onStep).not.toHaveBeenCalled(),await a.keyboard(" "),await e(t.onLift).toHaveBeenCalled()}},i={args:{lifted:!0}},d={args:{lifted:!0},play:async({args:t,canvas:c,userEvent:a})=>{const r=c.getByRole("button",{name:"Reorder Department"});await e(r).toHaveAttribute("aria-pressed","true"),r.focus(),await a.keyboard("{ArrowDown}"),await e(t.onStep).toHaveBeenCalledWith("down"),await a.keyboard("{ArrowRight}"),await e(t.onStep).toHaveBeenCalledWith("next-section"),await a.keyboard("{Escape}"),await e(t.onCancel).toHaveBeenCalled(),await a.keyboard(" "),await e(t.onDrop).toHaveBeenCalled()}},p={args:{disabled:!0}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"At rest, waiting for a press or a Space.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    const grip = canvas.getByRole('button', {
      name: 'Reorder Department'
    });
    await expect(grip).toHaveAttribute('aria-pressed', 'false');
    grip.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onStep).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    await expect(args.onLift).toHaveBeenCalled();
  }
}`,...n.parameters?.docs?.source},description:{story:"Space lifts the item; at rest the arrow keys do nothing.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    lifted: true
  }
}`,...i.parameters?.docs?.source},description:{story:"Lifted: `aria-pressed` is set and the arrow keys now move the item.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    lifted: true
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    const grip = canvas.getByRole('button', {
      name: 'Reorder Department'
    });
    await expect(grip).toHaveAttribute('aria-pressed', 'true');
    grip.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onStep).toHaveBeenCalledWith('down');
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onStep).toHaveBeenCalledWith('next-section');
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancel).toHaveBeenCalled();
    await userEvent.keyboard(' ');
    await expect(args.onDrop).toHaveBeenCalled();
  }
}`,...d.parameters?.docs?.source},description:{story:"Once lifted, the arrows step, Escape puts it back, and Space drops it where it stands.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...p.parameters?.docs?.source},description:{story:"Off while a filter is active; the tooltip states the reason.",...p.parameters?.docs?.description}}};const f=["Default","SpaceLifts","Lifted","LiftedKeyboardSteps","Disabled"];export{s as Default,p as Disabled,i as Lifted,d as LiftedKeyboardSteps,n as SpaceLifts,f as __namedExportsOrder,u as default};
