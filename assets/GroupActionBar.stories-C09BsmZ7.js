import{G as E}from"./GroupActionBar-Cln1Hwce.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,fn:c,userEvent:s,within:a}=__STORYBOOK_MODULE_TEST__,R={id:"00gFAKE000000000001",name:"Engineering",description:"All engineering staff across every team.",type:"OKTA_GROUP",memberCount:128,hasRules:!1,ruleCount:0,usedInRuleCount:0,created:new Date("2023-01-15"),lastUpdated:new Date("2026-06-01")},T={title:"Groups/GroupActionBar",component:E,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Every verb whose object is the whole group. `Add` is the `primary` and sits in the row beside `Compare`: one writes but is undone by a remove, the other only reads. `Export members` forwards to the Export tab rather than producing a file in place, so like every export descriptor in the app it starts behind **More**.\n\nThe tier holds two verbs, one of each shape `ActionBar` offers: **Remove deprovisioned** as a descriptor behind a confirm `Modal`, and **Create feeding rule** in the `expansion` slot, where it can carry the line of prose stating what a rule leaves behind. A verb that cannot honestly run is absent, never disabled forever — no wire, an `APP_GROUP`, or an unknown deprovisioned count all omit it."}}},args:{group:R,targetTabId:1,onExportGroup:c(),onAddMember:c(),onCompare:c(),onRemoveDeprovisioned:c(),deprovisionedCount:3,onCreateFeedingRule:c(),sticky:!1},argTypes:{group:{description:"The group every verb in the strip acts on."},targetTabId:{description:"`Add` and `Compare` both disable without a connected tab."},onExportGroup:{description:"Opens the Export tab pre-scoped to this group's members. Omitted → no action."},onAddMember:{description:"Opens the Add-member modal."},onCompare:{description:"Opens the picker for the second group in a comparison."},deprovisionedCount:{description:"How many loaded members are `DEPROVISIONED`. `undefined` and `0` both omit it."},onRemoveDeprovisioned:{description:"Runs the bulk removal once the confirm modal is accepted. Omitted → no action."},isRemoving:{description:"Holds the confirm button in its loading state while the run is in flight."},removeError:{description:"The last error the run reported, shown inside the confirm modal."},onCreateFeedingRule:{description:"Opens the create-feeding-rule confirm dialog."},sticky:{description:"Pin the strip below the header."}}},d={},p={play:async({canvasElement:n})=>{const e=a(n),o=e.getByRole("button",{name:"More"});await t(o).toHaveAttribute("aria-expanded","false");const r=document.getElementById(o.getAttribute("aria-controls")??"");if(!r)throw new Error("the More control names no region");await t(a(r).getByRole("button",{name:/Export members/})).toBeInTheDocument(),await t(a(r).queryByRole("button",{name:"Add"})).not.toBeInTheDocument(),await t(e.getByRole("button",{name:"Add"})).toBeEnabled(),await s.click(o),await t(o).toHaveAttribute("aria-expanded","true")}},m={args:{onExportGroup:void 0},play:async({canvasElement:n})=>{const e=a(n);await t(e.queryByRole("button",{name:/Export members/})).not.toBeInTheDocument(),await t(e.getByRole("button",{name:"Add"})).toBeEnabled()}},l={args:{targetTabId:null},play:async({canvasElement:n})=>{const e=a(n);await t(e.getByRole("button",{name:"Add"})).toBeDisabled(),await t(e.getByRole("button",{name:"Compare"})).toBeDisabled(),await t(e.getByRole("button",{name:/Export members/})).toBeEnabled()}},u={play:async({canvasElement:n,args:e})=>{const o=a(n),r=a(n.ownerDocument.body),i=o.getByRole("button",{name:"More"});await t(i).toHaveAttribute("aria-expanded","false"),await s.click(i),await t(i).toHaveAttribute("aria-expanded","true"),await s.click(o.getByRole("button",{name:/Remove 3 deprovisioned/}));const B=r.getByRole("dialog",{name:"Remove deprovisioned members"});await t(B).toHaveTextContent(/3 deprovisioned members from Engineering/),await t(e.onRemoveDeprovisioned).not.toHaveBeenCalled(),await s.click(a(B).getByRole("button",{name:"Remove 3"})),await t(e.onRemoveDeprovisioned).toHaveBeenCalledTimes(1)}},v={args:{removeError:"403 Forbidden: you lack permission to modify this group"},play:async({canvasElement:n})=>{const e=a(n),o=a(n.ownerDocument.body);await s.click(e.getByRole("button",{name:"More"})),await s.click(e.getByRole("button",{name:/Remove 3 deprovisioned/})),await t(o.getByRole("dialog")).toHaveTextContent(/403 Forbidden/)}},b={args:{deprovisionedCount:0},play:async({canvasElement:n})=>{const e=a(n);await t(e.queryByRole("button",{name:/deprovisioned/i})).not.toBeInTheDocument()}},y={args:{deprovisionedCount:void 0},play:async({canvasElement:n})=>{const e=a(n);await t(e.queryByRole("button",{name:/deprovisioned/i})).not.toBeInTheDocument()}},h={args:{group:{...R,type:"APP_GROUP",name:"Salesforce Users"},deprovisionedCount:12},play:async({canvasElement:n})=>{const e=a(n);await t(e.queryByRole("button",{name:/deprovisioned/i})).not.toBeInTheDocument()}},g={play:async({canvasElement:n,args:e})=>{const o=a(n),r=o.getByRole("button",{name:"More"});await t(r).toHaveAttribute("aria-expanded","false"),await s.click(r),await t(r).toHaveAttribute("aria-expanded","true"),await t(o.getByText("Memberships a rule grants outlive the rule")).toBeVisible();const i=o.getByRole("button",{name:"Create feeding rule"});await t(i).toBeVisible(),await s.click(i),await t(e.onCreateFeedingRule).toHaveBeenCalledTimes(1)}},w={args:{targetTabId:null},play:async({canvasElement:n})=>{const e=a(n);await s.click(e.getByRole("button",{name:"More"}));const o=e.getByRole("button",{name:"Create feeding rule"});await t(o).toBeDisabled(),await t(o).toHaveAttribute("title","Connect an Okta tab to create a rule")}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:"{}",...d.parameters?.docs?.source},description:{story:"Every action wired: Add and Compare in the row, the other three behind **More**.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Asserted structurally, through the region the **More** control names —
    // the same shape \`GroupDetailView.test.tsx\` uses for the tier. "Is it
    // visible" would not do it: a closed tier is a \`0fr\` grid row, which is a
    // laid-out box either way.
    const more = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const tier = document.getElementById(more.getAttribute('aria-controls') ?? '');
    if (!tier) throw new Error('the More control names no region');
    await expect(within(tier).getByRole('button', {
      name: /Export members/
    })).toBeInTheDocument();
    await expect(within(tier).queryByRole('button', {
      name: 'Add'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Add'
    })).toBeEnabled();

    // And it is reachable: pressing More discloses it.
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
  }
}`,...p.parameters?.docs?.source},description:{story:"The verb that acts is in the row and the export that leaves is behind the disclosure.\nOnly the arrangement is asserted: the headless runner loads no Tailwind, so `variant`\nhas no visible consequence to check.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    onExportGroup: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /Export members/
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Add'
    })).toBeEnabled();
  }
}`,...m.parameters?.docs?.source},description:{story:"No `onExportGroup` — the strip renders only `Add`, never a disabled ghost button.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Add'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Compare'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: /Export members/
    })).toBeEnabled();
  }
}`,...l.parameters?.docs?.source},description:{story:"No connected Okta tab — `Add` disables; `Export members` (a client-side navigation) does not.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const more = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', {
      name: /Remove 3 deprovisioned/
    }));
    const dialog = body.getByRole('dialog', {
      name: 'Remove deprovisioned members'
    });
    await expect(dialog).toHaveTextContent(/3 deprovisioned members from Engineering/);
    await expect(args.onRemoveDeprovisioned).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', {
      name: 'Remove 3'
    }));
    await expect(args.onRemoveDeprovisioned).toHaveBeenCalledTimes(1);
  }
}`,...u.parameters?.docs?.source},description:{story:"The tier's descriptor half: it is accepting the confirm that calls the handler, not the verb.",...u.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    removeError: '403 Forbidden: you lack permission to modify this group'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', {
      name: 'More'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /Remove 3 deprovisioned/
    }));
    await expect(body.getByRole('dialog')).toHaveTextContent(/403 Forbidden/);
  }
}`,...v.parameters?.docs?.source},description:{story:"The confirm, mid-run and then failed — the error lands in the dialog, not a toast.",...v.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    deprovisionedCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /deprovisioned/i
    })).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:'Nobody is deprovisioned: the verb is gone, not a disabled "Remove 0" behind **More**.',...b.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    deprovisionedCount: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /deprovisioned/i
    })).not.toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"Roster not analyzed: absent is not zero, so no verb whose label would state a count.",...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    group: {
      ...group,
      type: 'APP_GROUP',
      name: 'Salesforce Users'
    },
    deprovisionedCount: 12
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /deprovisioned/i
    })).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"An APP_GROUP: the operation refuses these, so the strip does not offer the verb.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Memberships a rule grants outlive the rule')).toBeVisible();
    const create = canvas.getByRole('button', {
      name: 'Create feeding rule'
    });
    await expect(create).toBeVisible();
    await userEvent.click(create);
    await expect(args.onCreateFeedingRule).toHaveBeenCalledTimes(1);
  }
}`,...g.parameters?.docs?.source},description:{story:"The tier's `expansion` half: *Create feeding rule*, with its consequence stated beside it.",...g.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'More'
    }));
    const create = canvas.getByRole('button', {
      name: 'Create feeding rule'
    });
    await expect(create).toBeDisabled();
    await expect(create).toHaveAttribute('title', 'Connect an Okta tab to create a rule');
  }
}`,...w.parameters?.docs?.source},description:{story:"No connected tab: the write verb disables with a reason, rather than disappearing.",...w.parameters?.docs?.description}}};const C=["Default","AddIsThePrimaryAndExportIsBehindMore","ExportOmitted","NoConnectedTab","RemoveDeprovisioned","RemoveFailed","NoDeprovisionedMembers","RosterNotLoaded","AppGroupHasNoRemove","TierOpen","TierWithoutConnectedTab"];export{p as AddIsThePrimaryAndExportIsBehindMore,h as AppGroupHasNoRemove,d as Default,m as ExportOmitted,l as NoConnectedTab,b as NoDeprovisionedMembers,u as RemoveDeprovisioned,v as RemoveFailed,y as RosterNotLoaded,g as TierOpen,w as TierWithoutConnectedTab,C as __namedExportsOrder,T as default};
