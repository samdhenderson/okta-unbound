import{C as R}from"./CollectionsSection-BXMhfhdX.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./dateFormat-tpkRVL7u.js";import"./collectionStore-Bmf5ll0f.js";const{expect:t,fn:v,userEvent:c,waitFor:T,within:i}=__STORYBOOK_MODULE_TEST__,x=Date.UTC(2026,2,5,9,30);function r(n,e,a={}){const s=[];for(let o=0;o<(a.user??0);o+=1)s.push({kind:"user",id:`00uFAKE${String(o).padStart(4,"0")}`});for(let o=0;o<(a.group??0);o+=1)s.push({kind:"group",id:`00gFAKE${String(o).padStart(4,"0")}`});for(let o=0;o<(a.app??0);o+=1)s.push({kind:"app",id:`0oaFAKE${String(o).padStart(4,"0")}`});for(let o=0;o<(a.rule??0);o+=1)s.push({kind:"rule",id:`0prFAKE${String(o).padStart(4,"0")}`});for(let o=0;o<(a.policy??0);o+=1)s.push({kind:"policy",id:`00pFAKE${String(o).padStart(4,"0")}`});return{id:n,name:e,rows:s,savedAt:x}}const B=[r("col-1","Payments on-call",{user:12,group:3}),r("col-2","Contractor access review",{user:1,policy:2}),r("col-3","App owners",{app:4})],f=[r("col-m1","Marketing leads",{user:5}),r("col-m2","Marketing contractors",{user:2,group:1}),r("col-m3","Marketing apps",{app:3}),...Array.from({length:9},(n,e)=>r(`col-o${e}`,`Engineering cohort ${e+1}`,{user:e+1}))],D=v(async()=>({collections:B,saved:null,refused:"duplicate-name"})),A={title:"Selection/CollectionsSection",component:R,tags:["autodocs"],parameters:{layout:"padded",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:'The named cohorts saved by `collectionStore`, one row each: what the collection holds per kind, when it was saved, and the three verbs that reach it — Load, an inline rename, and a confirmed delete.\n\nIt renders **nothing at all** while the first read is in flight, and nothing when the org has saved nothing. A list that has not been read is not "no collections" (`docs/claims.md`), and the Selection tab owns the page-level empty state.\n\nUnder an active query the heading keeps naming the whole set and the section states what it is showing of it (`Showing 3 of 12.`); a query that matches nothing states the absence by name rather than quietly rendering an empty section.\n\nDeleting is irreversible with no undo, so it asks first (`docs/action-bars.md`), and the confirmed row collapses out before the list closes the gap.'}}},args:{collections:B,isReading:!1,query:"",onLoad:v(),onDelete:v(),onRename:v(async()=>({collections:B,saved:null,refused:null}))},argTypes:{collections:{description:"The org's saved collections, newest first."},isReading:{description:"True until the first read settles — renders nothing while set."},query:{description:"Active search query. `''` means no filter."},onLoad:{description:"Put a collection's entities back in the basket."},onDelete:{description:"Forget one collection, once the confirm has been accepted."},onRename:{description:"Rename one; resolves to the outcome so a collision reports in place."}}},l={play:async({canvasElement:n})=>{const e=i(n);await t(e.getByRole("heading",{name:/Saved collections/})).toBeInTheDocument(),await t(e.getByText(/12 users · 3 groups/)).toBeInTheDocument(),await t(e.getByText(/1 user · 2 policies/)).toBeInTheDocument(),await t(e.getByRole("button",{name:"Load Payments on-call"})).toBeInTheDocument()}},m={args:{isReading:!0},play:async({canvasElement:n})=>{const e=i(n);await t(e.queryByRole("heading")).not.toBeInTheDocument(),await t(e.queryByRole("button")).not.toBeInTheDocument()}},d={args:{collections:[]},play:async({canvasElement:n})=>{const e=i(n);await t(e.queryByRole("heading")).not.toBeInTheDocument(),await t(e.queryByRole("button")).not.toBeInTheDocument()}},p={args:{collections:f,query:"market"},play:async({canvasElement:n})=>{const e=i(n);await t(e.getByText("Showing 3 of 12.")).toBeInTheDocument(),await t(e.getByTestId("detail-section-count")).toHaveTextContent("12"),await t(e.getByText("Marketing leads")).toBeInTheDocument(),await t(e.queryByText("Engineering cohort 1")).not.toBeInTheDocument()}},h={args:{collections:B,query:"market"},play:async({canvasElement:n})=>{const e=i(n);await t(e.getByText('No collections match "market".')).toBeInTheDocument(),await t(e.queryByText("Payments on-call")).not.toBeInTheDocument()}},y={args:{onRename:D},play:async({canvasElement:n})=>{const e=i(n);await c.click(e.getByRole("button",{name:"Rename App owners"}));const a=e.getByRole("textbox",{name:"Rename App owners"});await c.clear(a),await c.type(a,"Payments on-call{Enter}"),await t(await e.findByText("Another collection in this org already has that name.")).toBeInTheDocument(),await t(e.getByRole("textbox",{name:"Rename App owners"})).toBeInTheDocument()}},u={play:async({canvasElement:n,args:e})=>{const a=i(n);await c.click(a.getByRole("button",{name:"Rename App owners"}));const s=a.getByRole("textbox",{name:"Rename App owners"});await c.clear(s),await c.type(s,"Application owners"),await c.click(a.getByRole("button",{name:"Save"})),await T(()=>t(e.onRename).toHaveBeenCalledWith("col-3","Application owners")),await T(()=>t(a.queryByRole("textbox",{name:"Rename App owners"})).not.toBeInTheDocument())}},g={play:async({canvasElement:n,args:e})=>{const a=i(n);await c.click(a.getByRole("button",{name:"Delete Payments on-call"}));const s=i(await a.findByRole("dialog",{name:'Delete "Payments on-call"?'}));await t(s.getByText(/nothing restores the collection afterwards/)).toBeInTheDocument(),await c.click(s.getByRole("button",{name:"Cancel"})),await t(e.onDelete).not.toHaveBeenCalled(),await t(a.getByText("Payments on-call")).toBeInTheDocument()}},w={play:async({canvasElement:n,args:e})=>{const a=i(n);await c.click(a.getByRole("button",{name:"Delete Payments on-call"}));const s=i(await a.findByRole("dialog",{name:'Delete "Payments on-call"?'}));await c.click(s.getByRole("button",{name:"Delete"})),await T(()=>t(e.onDelete).toHaveBeenCalledWith("col-1"))}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', {
      name: /Saved collections/
    })).toBeInTheDocument();
    await expect(canvas.getByText(/12 users · 3 groups/)).toBeInTheDocument();
    // One policy short of the naive plural: \`2 policies\`, never \`2 policys\`.
    await expect(canvas.getByText(/1 user · 2 policies/)).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Load Payments on-call'
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:`Several saved cohorts. Each row's summary names only the kinds it actually
holds — no zero for the kinds it doesn't — and uses the irregular plural.`,...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    isReading: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:`The first read has not settled. Nothing renders — an unread list is not an
empty one, so there is no skeleton and no empty state to mistake for a fact.`,...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    collections: []
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"The org has saved nothing. The section is absent rather than an empty shell.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    collections: TWELVE,
    query: 'market'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Showing 3 of 12.')).toBeInTheDocument();
    // The true total stays visible beside the heading, not just inside the line.
    await expect(canvas.getByTestId('detail-section-count')).toHaveTextContent('12');
    await expect(canvas.getByText('Marketing leads')).toBeInTheDocument();
    await expect(canvas.queryByText('Engineering cohort 1')).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:`A filter that matches some. The heading still names the whole set, and the
section says exactly how much of it is on screen.`,...p.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    collections: THREE,
    query: 'market'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No collections match "market".')).toBeInTheDocument();
    await expect(canvas.queryByText('Payments on-call')).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"A filter that matches nothing states the absence, by the query that caused it.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onRename: collides
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Rename App owners'
    }));
    const field = canvas.getByRole('textbox', {
      name: 'Rename App owners'
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'Payments on-call{Enter}');
    await expect(await canvas.findByText('Another collection in this org already has that name.')).toBeInTheDocument();
    // Still editing — the reader keeps the name they typed and can fix it.
    await expect(canvas.getByRole('textbox', {
      name: 'Rename App owners'
    })).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:`Renaming a collection to a name another already holds. The store refuses by
reason code, the row stays in edit so the name can be fixed, and the refusal
is stated rather than hinted at.`,...y.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Rename App owners'
    }));
    const field = canvas.getByRole('textbox', {
      name: 'Rename App owners'
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'Application owners');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Save'
    }));
    await waitFor(() => expect(args.onRename).toHaveBeenCalledWith('col-3', 'Application owners'));
    await waitFor(() => expect(canvas.queryByRole('textbox', {
      name: 'Rename App owners'
    })).not.toBeInTheDocument());
  }
}`,...u.parameters?.docs?.source},description:{story:`Renaming to a free name commits and the row swaps back to its label — the
inline editor's Escape and Save paths share this commit.`,...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Delete Payments on-call'
    }));
    const dialog = within(await canvas.findByRole('dialog', {
      name: 'Delete "Payments on-call"?'
    }));
    await expect(dialog.getByText(/nothing restores the collection afterwards/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(canvas.getByText('Payments on-call')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:`Delete asks first, and Cancel means nothing happened: the collection is still
listed and nothing was forgotten. This is the assertion that catches a
regression back to an ungated delete.`,...g.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Delete Payments on-call'
    }));
    const dialog = within(await canvas.findByRole('dialog', {
      name: 'Delete "Payments on-call"?'
    }));
    await userEvent.click(dialog.getByRole('button', {
      name: 'Delete'
    }));
    await waitFor(() => expect(args.onDelete).toHaveBeenCalledWith('col-1'));
  }
}`,...w.parameters?.docs?.source},description:{story:"Accepting the confirm forgets exactly the collection the dialog named.",...w.parameters?.docs?.description}}};const C=["SeveralCollections","Loading","Empty","Filtered","FilteredNoMatch","RenameCollision","RenameAccepted","ConfirmDeleteCancelled","ConfirmDeleteAccepted"];export{w as ConfirmDeleteAccepted,g as ConfirmDeleteCancelled,d as Empty,p as Filtered,h as FilteredNoMatch,m as Loading,u as RenameAccepted,y as RenameCollision,l as SeveralCollections,C as __namedExportsOrder,A as default};
