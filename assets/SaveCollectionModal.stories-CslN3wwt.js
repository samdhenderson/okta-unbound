import{S as b}from"./SaveCollectionModal-BTvrTX52.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./collectionStore-Bmf5ll0f.js";const{expect:t,fn:w,userEvent:s,waitFor:B,within:a}=__STORYBOOK_MODULE_TEST__,v={collections:[],saved:{id:"local-0001",name:"Marketing rename",rows:[],savedAt:0},refused:null},S={title:"Selection/SaveCollectionModal",component:b,tags:["autodocs"],parameters:{docs:{description:{component:"A collection differs from the basket in one word — **deliberately** — and this is where that deliberation happens: a name is typed, a partition is chosen, and one storage decision is made.\n\n**A kind with nothing ticked is absent, not zero.** It gets no pill and appears in no sentence. When exactly one kind is non-empty, `Everything` and that kind name the same set, so only `Everything` is offered.\n\n**Remember display names is absent, never disabled,** whenever the chosen scope holds no users — there is no question to put. When it is on screen both answers state a fact: names go to this device unencrypted, or a reopen costs exactly one request per user. Neither answer estimates a duration, because this dialog does not know one.\n\n**A refusal is rendered from the store’s reason code**, never by reading a message string, and the dialog stays open with the draft intact.\n\nRelated internals: `sidepanel/selection/collectionStore`, `shared/utils/plural`."}}},args:{isOpen:!0,onClose:w(),counts:{user:12,group:3},existingNames:["Q3 offboarding"],onSave:w(async()=>v)},argTypes:{isOpen:{description:"Whether the dialog is open."},onClose:{description:"Close without saving (Cancel, Escape, overlay, header close)."},counts:{description:"Per-kind basket counts. Kinds with nothing ticked are absent, not zero."},existingNames:{description:"Names already used in this org, for the duplicate check."},onSave:{description:"Commit. Resolves to the store’s outcome so a refusal can be reported in place."}}},i={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await t(e.getByRole("button",{name:"Everything (15)"})).toHaveAttribute("aria-pressed","true"),await t(e.getByRole("button",{name:"Users (12)"})).toBeInTheDocument(),await t(e.getByRole("button",{name:"Groups (3)"})).toBeInTheDocument(),await t(e.getByText("Saves 12 users and 3 groups.")).toBeInTheDocument()}},r={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await s.click(e.getByRole("button",{name:"Groups (3)"})),await t(e.getByText("Saves 3 groups.")).toBeInTheDocument(),await t(e.queryByRole("checkbox",{name:/Remember display names/})).not.toBeInTheDocument()}},c={args:{counts:{user:12}},play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await t(e.getByRole("button",{name:"Everything (12)"})).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Users (12)"})).not.toBeInTheDocument(),await t(e.getByText("Saves 12 users.")).toBeInTheDocument()}},l={args:{counts:{group:3,policy:2}},play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await t(e.queryByRole("checkbox",{name:/Remember display names/})).not.toBeInTheDocument(),await t(e.getByText("Saves 3 groups and 2 policies.")).toBeInTheDocument()}},d={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog")),o=e.getByRole("checkbox",{name:/Remember display names/});await t(o).toBeChecked(),await t(e.getByText("Names are stored unencrypted on this device.")).toBeInTheDocument(),await s.click(o),await t(e.getByText("Reopening will look up 12 users — one request each.")).toBeInTheDocument()}},m={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await s.type(e.getByLabelText("Name"),"  q3 OFFBOARDING  "),await t(e.getByText("This org already has a collection called “Q3 offboarding”.")).toBeInTheDocument(),await t(e.getByRole("button",{name:"Save"})).toBeDisabled()}},g={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await s.type(e.getByLabelText("Name"),"x".repeat(81)),await t(e.getByText("A name may be 80 characters; this is 81.")).toBeInTheDocument(),await t(e.getByRole("button",{name:"Save"})).toBeDisabled()}},y={play:async({canvasElement:n})=>{const e=a(a(n.ownerDocument.body).getByRole("dialog"));await t(e.getByRole("button",{name:"Save"})).toBeDisabled(),await t(e.getByText("Unique within this org, up to 80 characters.")).toBeInTheDocument()}},p={args:{onSave:w(async()=>({collections:[],saved:null,refused:"too-many"}))},play:async({canvasElement:n,args:e})=>{const o=a(a(n.ownerDocument.body).getByRole("dialog"));await s.type(o.getByLabelText("Name"),"Marketing rename"),await s.click(o.getByRole("button",{name:"Save"})),await B(async()=>{await t(o.getByText("This org already holds 20 collections, which is the limit. Delete one, then save again.")).toBeInTheDocument()}),await t(e.onClose).not.toHaveBeenCalled()}},u={play:async({canvasElement:n,args:e})=>{const o=a(a(n.ownerDocument.body).getByRole("dialog"));await s.type(o.getByLabelText("Name"),"  Marketing rename  "),await s.click(o.getByRole("button",{name:"Users (12)"})),await s.click(o.getByRole("checkbox",{name:/Remember display names/})),await s.click(o.getByRole("button",{name:"Save"})),await B(async()=>{await t(e.onSave).toHaveBeenCalledWith("Marketing rename","user",!1)}),await t(e.onClose).toHaveBeenCalled()}},h={play:async({canvasElement:n,args:e})=>{const o=a(a(n.ownerDocument.body).getByRole("dialog"));await s.type(o.getByLabelText("Name"),"Marketing rename{Enter}"),await B(async()=>{await t(e.onSave).toHaveBeenCalledWith("Marketing rename","all",!0)})}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await expect(dialog.getByRole('button', {
      name: 'Everything (15)'
    })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', {
      name: 'Users (12)'
    })).toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: 'Groups (3)'
    })).toBeInTheDocument();
    await expect(dialog.getByText('Saves 12 users and 3 groups.')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Users and groups: both pills, plus `Everything`, and a sentence naming both counts.",...i.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', {
      name: 'Groups (3)'
    }));
    await expect(dialog.getByText('Saves 3 groups.')).toBeInTheDocument();
    // No users in this scope, so the storage question does not exist.
    await expect(dialog.queryByRole('checkbox', {
      name: /Remember display names/
    })).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:`Narrowing to one kind restates the scope, and the checkbox survives because
users are still in it.`,...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 12
    }
  },
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await expect(dialog.getByRole('button', {
      name: 'Everything (12)'
    })).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: 'Users (12)'
    })).not.toBeInTheDocument();
    await expect(dialog.getByText('Saves 12 users.')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"One non-empty kind: `Everything` and `Users` would name the same set, so only\n`Everything` is offered.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      group: 3,
      policy: 2
    }
  },
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await expect(dialog.queryByRole('checkbox', {
      name: /Remember display names/
    })).not.toBeInTheDocument();
    // \`policies\`, not \`policys\`.
    await expect(dialog.getByText('Saves 3 groups and 2 policies.')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:`No users anywhere in the basket — the display-names checkbox is **absent**,
not disabled.`,...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    const box = dialog.getByRole('checkbox', {
      name: /Remember display names/
    });
    await expect(box).toBeChecked();
    await expect(dialog.getByText('Names are stored unencrypted on this device.')).toBeInTheDocument();
    await userEvent.click(box);
    await expect(dialog.getByText('Reopening will look up 12 users — one request each.')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Unticking the box states the exact cost of a reopen: one request per user.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), '  q3 OFFBOARDING  ');
    await expect(dialog.getByText('This org already has a collection called “Q3 offboarding”.')).toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: 'Save'
    })).toBeDisabled();
  }
}`,...m.parameters?.docs?.source},description:{story:"A name already used in this org, matched case- and trim-insensitively.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'x'.repeat(81));
    await expect(dialog.getByText('A name may be 80 characters; this is 81.')).toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: 'Save'
    })).toBeDisabled();
  }
}`,...g.parameters?.docs?.source},description:{story:"Over the 80-character cap — the error names both numbers.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await expect(dialog.getByRole('button', {
      name: 'Save'
    })).toBeDisabled();
    await expect(dialog.getByText('Unique within this org, up to 80 characters.')).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"A blank field disables Save without shouting at a field nobody has filled in yet.",...y.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    onSave: fn(async () => ({
      collections: [],
      saved: null,
      refused: 'too-many'
    }) as SaveOutcome)
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'Marketing rename');
    await userEvent.click(dialog.getByRole('button', {
      name: 'Save'
    }));
    await waitFor(async () => {
      await expect(dialog.getByText('This org already holds 20 collections, which is the limit. Delete one, then save again.')).toBeInTheDocument();
    });
    await expect(args.onClose).not.toHaveBeenCalled();
  }
}`,...p.parameters?.docs?.source},description:{story:"The store refused the write. The dialog stays open, draft intact, and says why.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), '  Marketing rename  ');
    await userEvent.click(dialog.getByRole('button', {
      name: 'Users (12)'
    }));
    await userEvent.click(dialog.getByRole('checkbox', {
      name: /Remember display names/
    }));
    await userEvent.click(dialog.getByRole('button', {
      name: 'Save'
    }));
    await waitFor(async () => {
      await expect(args.onSave).toHaveBeenCalledWith('Marketing rename', 'user', false);
    });
    await expect(args.onClose).toHaveBeenCalled();
  }
}`,...u.parameters?.docs?.source},description:{story:"Typing a name and pressing Save commits the name, the scope and the storage choice.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'Marketing rename{Enter}');
    await waitFor(async () => {
      await expect(args.onSave).toHaveBeenCalledWith('Marketing rename', 'all', true);
    });
  }
}`,...h.parameters?.docs?.source},description:{story:"Enter in the name field commits, so a one-field dialog needs no reach for the mouse.",...h.parameters?.docs?.description}}};const k=["MixedKinds","NarrowedToGroups","UsersOnly","NoUsersInScope","NamesNotRemembered","DuplicateName","NameTooLong","BlankName","RefusedByStore","SavesTheChosenScope","EnterCommits"];export{y as BlankName,m as DuplicateName,h as EnterCommits,i as MixedKinds,g as NameTooLong,d as NamesNotRemembered,r as NarrowedToGroups,l as NoUsersInScope,p as RefusedByStore,u as SavesTheChosenScope,c as UsersOnly,k as __namedExportsOrder,S as default};
