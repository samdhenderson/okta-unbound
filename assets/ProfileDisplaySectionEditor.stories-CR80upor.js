import{j as f}from"./iframe-tAvKsVeF.js";import{P as v}from"./ProfileDisplaySectionEditor-BF_vPohL.js";import{P as h}from"./ProfileDisplayAttributeEditRow-CbwN7nRI.js";import{f as w}from"./profileDisplayStoryFixture-5h2bzOG7.js";import"./preload-helper-PPVm8Dsz.js";import"./ProfileDisplayGrip-Yw9dihMQ.js";import"./profileDisplayStore-CVAj7s6I.js";import"./index-Dob3nYDb.js";const{expect:i,fn:e,userEvent:n,within:y}=__STORYBOOK_MODULE_TEST__,b={isHidden:!1,isLifted:!1,ruleNames:[],onToggleHidden:e(),onGripPointerDown:e(),onLift:e(),onStep:e(),onDrop:e(),onCancelLift:e()},R=[f.jsx(h,{attribute:w("firstName","base","Ada","First name"),...b},"firstName"),f.jsx(h,{attribute:w("lastName","base","Lovelace","Last name"),...b},"lastName")],L={title:"Users/ProfileDisplaySectionEditor",component:v,tags:["autodocs"],parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`A section grip, its name, its field count, its delete control, and the rows filed under it.

**The name is a button until it is clicked.** A column of text fields reads as a form to be filled in; a name that becomes a field only when you aim at it reads as a label you can correct. Enter and blur commit, Escape reverts.

**Deleting confirms inline and states the consequence** — "Its 2 attributes return to Uncategorized" — because an admin should not have to guess whether a delete takes attributes off the profile with it. It does not. Uncategorized itself renders fixed: no grip, no delete, and the editor pins it last.`}}},argTypes:{sectionKey:{description:"The section's stable key; `''` is Uncategorized."},name:{description:"The section's current name in the draft."},fieldCount:{description:"How many of the profile's attributes are filed under it."},isFixed:{description:"True for Uncategorized: no grip, no delete."},isLifted:{description:"True while this section is the one lifted."},isReorderDisabled:{description:"Turns the grip off while a filter narrows the list."},onRename:{description:"Commit a new name for this section."},onDelete:{description:"Delete it, returning its attributes to Uncategorized."},children:{description:"The section rows, and any drop indicator between them."}},args:{sectionKey:"identity",name:"Identity",fieldCount:2,onRename:e(),onDelete:e(),onGripPointerDown:e(),onLift:e(),onStep:e(),onDrop:e(),onCancelLift:e(),children:R}},s={},r={args:{sectionKey:"",name:"Uncategorized",isFixed:!0}},c={args:{name:"Contact & locale",fieldCount:0,children:[]}},d={args:{isLifted:!0}},l={args:{isReorderDisabled:!0}},m={play:async({canvasElement:o,args:a})=>{const t=y(o);await n.click(t.getByRole("button",{name:"Rename Identity"}));const g=t.getByRole("textbox",{name:"Rename Identity"});await n.clear(g),await n.type(g,"Who they are{Enter}"),await i(a.onRename).toHaveBeenCalledWith("Who they are")}},p={play:async({canvasElement:o,args:a})=>{const t=y(o);await n.click(t.getByRole("button",{name:"Rename Identity"}));const g=t.getByRole("textbox",{name:"Rename Identity"});await n.type(g," team{Escape}"),await i(a.onRename).not.toHaveBeenCalled(),await i(t.getByRole("button",{name:"Rename Identity"})).toBeVisible()}},u={play:async({canvasElement:o,args:a})=>{const t=y(o);await n.click(t.getByRole("button",{name:"Delete Identity"})),await i(t.getByText(/return to Uncategorized/)).toBeVisible(),await i(a.onDelete).not.toHaveBeenCalled(),await n.click(t.getByRole("button",{name:/^Delete$/})),await i(a.onDelete).toHaveBeenCalledTimes(1)}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"An admin-defined section with two attributes under it.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    sectionKey: '',
    name: 'Uncategorized',
    isFixed: true
  }
}`,...r.parameters?.docs?.source},description:{story:"Uncategorized: no grip, no delete, pinned last by the editor.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    name: 'Contact & locale',
    fieldCount: 0,
    children: []
  }
}`,...c.parameters?.docs?.source},description:{story:"A section holding nothing — a valid landing place, not an error.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    isLifted: true
  }
}`,...d.parameters?.docs?.source},description:{story:"Lifted, mid-reorder.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    isReorderDisabled: true
  }
}`,...l.parameters?.docs?.source},description:{story:"Reordering off while the pane's filter is narrowing the list.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Rename Identity'
    }));
    const field = canvas.getByRole('textbox', {
      name: 'Rename Identity'
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'Who they are{Enter}');
    await expect(args.onRename).toHaveBeenCalledWith('Who they are');
  }
}`,...m.parameters?.docs?.source},description:{story:"Clicking the name turns it into a field; Enter commits the new name.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Rename Identity'
    }));
    const field = canvas.getByRole('textbox', {
      name: 'Rename Identity'
    });
    await userEvent.type(field, ' team{Escape}');
    await expect(args.onRename).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', {
      name: 'Rename Identity'
    })).toBeVisible();
  }
}`,...p.parameters?.docs?.source},description:{story:"Escape leaves the name exactly as it was — nothing is committed.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Delete Identity'
    }));
    await expect(canvas.getByText(/return to Uncategorized/)).toBeVisible();
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', {
      name: /^Delete$/
    }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
  }
}`,...u.parameters?.docs?.source},description:{story:"Deleting confirms inline and states where the attributes go.",...u.parameters?.docs?.description}}};const U=["Default","Uncategorized","Empty","Lifted","Disabled","RenamingASection","CancellingARename","ConfirmingADelete"];export{p as CancellingARename,u as ConfirmingADelete,s as Default,l as Disabled,c as Empty,d as Lifted,m as RenamingASection,r as Uncategorized,U as __namedExportsOrder,L as default};
