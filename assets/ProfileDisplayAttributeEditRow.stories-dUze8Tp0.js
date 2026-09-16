import{P as n}from"./ProfileDisplayAttributeEditRow-CbwN7nRI.js";import{f as a}from"./profileDisplayStoryFixture-5h2bzOG7.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./ProfileDisplayGrip-Yw9dihMQ.js";import"./profileDisplayStore-CVAj7s6I.js";import"./index-Dob3nYDb.js";const{fn:e}=__STORYBOOK_MODULE_TEST__,f={title:"Users/ProfileDisplayAttributeEditRow",component:n,tags:["autodocs"],parameters:{docs:{description:{component:`Grip, label, Okta name, a truncated value preview, and the eye that hides the attribute from the pane.

A hidden attribute keeps its row here, struck through and still showing its value, so it can be restored. An attribute with no value on this user says so in italics rather than rendering a blank line.`}}},argTypes:{attribute:{description:"The attribute this row describes."},isHidden:{description:"Whether the attribute is hidden from the profile pane."},isLifted:{description:"True while this row is the one lifted."},ruleNames:{description:"Rules that read this attribute; empty means no mark."},isReorderDisabled:{description:"Turns the grip off while a filter narrows the list."},gripDescribedBy:{description:"`id` of the grip keyboard-contract description."},onToggleHidden:{description:"Flip the attribute's visibility."},onGripPointerDown:{description:"Start a pointer drag from the grip."},onLift:{description:"Lift this row with the keyboard."},onStep:{description:"Move the lifted row one step."},onDrop:{description:"Drop the lifted row."},onCancelLift:{description:"Abandon the lift."}},args:{attribute:a("department","custom","Engineering","Department"),isHidden:!1,isLifted:!1,ruleNames:[],onToggleHidden:e(),onGripPointerDown:e(),onLift:e(),onStep:e(),onDrop:e(),onCancelLift:e()}},t={},r={args:{isHidden:!0}},i={args:{ruleNames:["Engineering auto-join"]}},s={args:{attribute:a("department","custom","","Department")}},o={args:{isLifted:!0}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"A visible attribute with a value.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    isHidden: true
  }
}`,...r.parameters?.docs?.source},description:{story:"Hidden: struck through, eye closed, and still here to be restored.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    ruleNames: ['Engineering auto-join']
  }
}`,...i.parameters?.docs?.source},description:{story:"An attribute a group rule reads, marked so its edits are known to matter.",...i.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: fixtureAttribute('department', 'custom', '', 'Department')
  }
}`,...s.parameters?.docs?.source},description:{story:"Empty on this user — stated, not left blank.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isLifted: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Lifted, mid-reorder.",...o.parameters?.docs?.description}}};const g=["Default","Hidden","ReadByRule","EmptyValue","Lifted"];export{t as Default,s as EmptyValue,r as Hidden,o as Lifted,i as ReadByRule,g as __namedExportsOrder,f as default};
