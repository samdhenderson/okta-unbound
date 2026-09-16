import{ah as p,j as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,fn:m,within:o}=__STORYBOOK_MODULE_TEST__,y={title:"Shared/SelectionSummaryButton",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Reports the size of the current selection with one glyph and one total, and opens the surface that manages it.\n\n**Nothing to act on is nothing shown.** At a total of zero this renders `null` — never a disabled control, never a `(0)` — because the basket is in-memory and so is never merely "not yet read" (`docs/claims.md`).\n\n**The breakdown is a convenience, never load-bearing.** The accessible name states the whole breakdown as a sentence — `"3 users, 1 group and 1 rule selected"` — at rest. Hovering or focusing the control discloses the same breakdown visually, per kind, growing leftward out of flow so it can cover the subject beside it without moving the Refresh control on its other side or changing the row height.'}}},argTypes:{counts:{description:"One entry per **non-empty** kind. A kind with nothing selected is absent from this object — never present holding `0`."},total:{description:"How many entities are ticked across every kind. Zero renders nothing."},onOpen:{description:"Open the surface that manages the selection."}},args:{onOpen:m()}},s={args:{counts:{},total:0},play:async({canvasElement:e})=>{const n=o(e);await t(n.queryByRole("button")).not.toBeInTheDocument()}},a={args:{counts:{user:3},total:3},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByRole("button",{name:"3 users selected"})).toBeInTheDocument()}},r={args:{counts:{user:3,group:1},total:4},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByRole("button",{name:"3 users and 1 group selected"})).toBeInTheDocument()}},c={args:{counts:{user:3,group:1,app:2,rule:1,policy:1},total:8},play:async({canvasElement:e})=>{const n=o(e);await t(n.getByRole("button",{name:"3 users, 1 group, 2 apps, 1 rule and 1 policy selected"})).toBeInTheDocument()}},i={args:{counts:{user:1204},total:1204},play:async({canvasElement:e})=>{const l=o(e).getByRole("button",{name:"1,204 users selected"});await t(l).toBeInTheDocument(),await t(o(l).getByText("1,204")).toBeInTheDocument()}},d={args:{counts:{user:3,group:1,app:2,rule:1,policy:1},total:8},decorators:[e=>u.jsx("div",{className:"flex w-[360px] justify-end border border-neutral-200 p-2",children:u.jsx(e,{})})]};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {},
    total: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"A total of zero is nothing to act on, so the control renders nothing at all.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 3
    },
    total: 3
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: '3 users selected'
    })).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source},description:{story:"One kind selected — the plainest sentence the breakdown produces.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 3,
      group: 1
    },
    total: 4
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: '3 users and 1 group selected'
    })).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:'Two kinds join with a bare "and" — no Oxford comma.',...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 3,
      group: 1,
      app: 2,
      rule: 1,
      policy: 1
    },
    total: 8
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: '3 users, 1 group, 2 apps, 1 rule and 1 policy selected'
    })).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Every kind at once, in the stable declared order — user, group, app, rule, policy.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 1204
    },
    total: 1204
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', {
      name: '1,204 users selected'
    });
    await expect(button).toBeInTheDocument();
    // The rest-state number and the (aria-hidden) breakdown both read "1,204" —
    // scope to the button so the assertion doesn't collide with the decoration.
    await expect(within(button).getByText('1,204')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"A large count is localised with thousands separators, both at rest and in the sentence.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      user: 3,
      group: 1,
      app: 2,
      rule: 1,
      policy: 1
    },
    total: 8
  },
  decorators: [Story => <div className="flex w-[360px] justify-end border border-neutral-200 p-2">
        <Story />
      </div>]
}`,...d.parameters?.docs?.source},description:{story:`The panel's narrowest supported width (360px). The control's rest state is
one glyph and one number regardless of how many kinds the breakdown holds,
so it never grows the row even at the compact density.`,...d.parameters?.docs?.description}}};const w=["NothingSelected","OneKind","TwoKinds","AllKinds","LargeCount","NarrowPanel"];export{c as AllKinds,i as LargeCount,d as NarrowPanel,s as NothingSelected,a as OneKind,r as TwoKinds,w as __namedExportsOrder,y as default};
