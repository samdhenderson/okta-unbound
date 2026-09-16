import{P as y}from"./ProfileDisplayEditor-X8q1K9AS.js";import{a as d,b as f}from"./profileDisplayStoryFixture-5h2bzOG7.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./profileAttributeBlocks-BIZLFcVk.js";import"./ProfileDisplayAttributeEditRow-CbwN7nRI.js";import"./ProfileDisplayGrip-Yw9dihMQ.js";import"./ProfileDisplayDragGhost-DwlRzOro.js";import"./ProfileDisplayOptions-BbWoDSJc.js";import"./ProfileDisplaySectionEditor-BF_vPohL.js";import"./profileDisplayStore-CVAj7s6I.js";import"./index-Dob3nYDb.js";const{expect:c,fn:p,userEvent:m,within:g}=__STORYBOOK_MODULE_TEST__,S={title:"Users/ProfileDisplayEditor",component:y,tags:["autodocs"],parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"The Profile pane while an admin is arranging it: display options, every section with its attributes, the add-section form, and Reset / Cancel / Done. Nothing is written until Done — `Reset to default` acts on the draft too, so Cancel still undoes it.\n\nReordering works from the same handles with a pointer or the keyboard. A non-empty `filter` disables the grips: a drop into a partly-rendered list would compute its position against rows that are not all there."}}},argTypes:{attributes:{description:"Every attribute on this profile, empty ones included."},config:{description:"The reconciled configuration the draft starts from."},onCommit:{description:"Done — receives the whole edited configuration."},onCancel:{description:"Cancel — the draft is discarded and nothing is written."},ruleReads:{description:"Attribute Okta name → the rules that read it."},filter:{description:"The pane's live free-text filter; non-empty disables reordering."}},args:{attributes:f,config:d,onCommit:p(),onCancel:p(),ruleReads:{department:["Engineering auto-join"]}}},n={},a={args:{config:{...d,hidden:{...d.hidden,lastName:!0}}}},o={args:{filter:"name"}},i={args:{config:{...d,categories:[],assign:{},attrOrder:[]}}},r={play:async({args:t,canvasElement:l})=>{const e=g(l);await m.type(e.getByLabelText("New section name"),"Employment"),await m.click(e.getByRole("button",{name:"Add section"})),await c(e.getByRole("button",{name:"Rename Employment"})).toBeInTheDocument(),await m.click(e.getByRole("button",{name:"Done"})),await c(t.onCommit).toHaveBeenCalledTimes(1);const u=t.onCommit.mock.calls[0][0];await c(u.categories.map(h=>h.name)).toContain("Employment")}},s={play:async({args:t,canvasElement:l})=>{const e=g(l);await m.click(e.getByRole("button",{name:"Cancel"})),await c(t.onCancel).toHaveBeenCalledTimes(1),await c(t.onCommit).not.toHaveBeenCalled()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Two admin sections plus Uncategorized, with the rule mark on `department`.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...fixtureConfig,
      hidden: {
        ...fixtureConfig.hidden,
        lastName: true
      }
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"A hidden attribute keeps its row, struck through, so it can be restored where it lives.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    filter: 'name'
  }
}`,...o.parameters?.docs?.source},description:{story:"A live filter: the list narrows to a find, and the grips state why they are off.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...fixtureConfig,
      categories: [],
      assign: {},
      attrOrder: []
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"An org with no sections yet — everything lands in Uncategorized.",...i.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('New section name'), 'Employment');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Add section'
    }));
    await expect(canvas.getByRole('button', {
      name: 'Rename Employment'
    })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Done'
    }));
    await expect(args.onCommit).toHaveBeenCalledTimes(1);
    const committed = (args.onCommit as ReturnType<typeof fn>).mock.calls[0][0];
    await expect(committed.categories.map((c: {
      name: string;
    }) => c.name)).toContain('Employment');
  }
}`,...r.parameters?.docs?.source},description:{story:"Adding a section, then committing: the new section reaches `onCommit`.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onCommit).not.toHaveBeenCalled();
  }
}`,...s.parameters?.docs?.source},description:{story:"Cancel discards the draft: `onCancel` fires and nothing is committed.",...s.parameters?.docs?.description}}};const H=["Default","WithHiddenAttribute","Filtered","Empty","AddingASection","Cancelling"];export{r as AddingASection,s as Cancelling,n as Default,i as Empty,o as Filtered,a as WithHiddenAttribute,H as __namedExportsOrder,S as default};
