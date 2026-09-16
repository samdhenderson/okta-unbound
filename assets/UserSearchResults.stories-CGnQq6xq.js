import{j as y}from"./iframe-tAvKsVeF.js";import{U as T}from"./UserSearchResults-A-1SA20Z.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./userDisplay-xpx41Abi.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";const{expect:g,fn:S,userEvent:v,within:b}=__STORYBOOK_MODULE_TEST__,s=(t,e,a,w)=>({id:`00uFAKE000${t}`,status:w,profile:{login:`${e.toLowerCase()}.${a.toLowerCase()}@example.com`,email:`${e.toLowerCase()}.${a.toLowerCase()}@example.com`,firstName:e,lastName:a}}),r=s(1,"Ada","Lovelace","ACTIVE"),o=s(2,"Grace","Hopper","SUSPENDED"),E=s(3,"Alan","Turing","PROVISIONED"),f=s(4,"Katherine","Johnson","LOCKED_OUT"),A=s(5,"Margaret","Hamilton","STAGED"),k=s(6,"Annie","Easley","DEPROVISIONED"),x=[r,o,E,f,A,k],O={title:"Users/UserSearchResults",component:T,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Compact, clickable list of user search results with per-user status badges, under one quiet `Eyebrow` reading the match count.\n\nPresentational: each row is a `ListRow` at `compact` density showing a name, an email and a shared `Badge` coloured by `userStatusVariant`. It renders nothing when there are no results; the parent owns the search itself. The whole-row click target is a `StretchedButton` overlay rather than `ListRow as="button"`, because a row that holds a checkbox cannot also *be* a button (axe reports `nested-interactive`). Passing `onToggleSelect` adds the checkbox column that feeds the panel-wide selection basket; there is no Select-all, and a tick survives the next query wiping the list.'}}},decorators:[t=>y.jsx("div",{className:"max-w-7xl mx-auto px-6 py-6",children:y.jsx(t,{})})],args:{results:[r,o,E],onSelectUser:S()},argTypes:{results:{description:"Matching users to render; an empty array renders nothing."},onSelectUser:{description:"Invoked with the chosen user when a result row is clicked."},selectedIds:{description:"Ids of the users sitting in the selection basket — routinely including people ticked in an earlier search who are no longer among `results`."},onToggleSelect:{description:"Tick or untick one result, called with that user's id. Omitted renders no checkbox at all."},actionLabel:{description:"Accessible name for the whole-row click target, describing what activating a result does on this host. Defaults to 'View user details'."}}},n={},c={args:{results:x}},i={args:{results:[r]}},l={args:{results:[]}},d={args:{results:[s(7,"Bartholomew","Featherstonehaugh-Wintergreen","ACTIVE"),o,k]},parameters:{viewport:{value:"sidepanelCompact"}}},p={args:{results:[r,o]},play:async({args:t,canvasElement:e})=>{const a=b(e),[w]=a.getAllByRole("button");await v.tab(),await g(w).toHaveFocus(),await v.keyboard("{Enter}"),await g(t.onSelectUser).toHaveBeenCalledWith(r)}},u={args:{results:x.slice(0,4),selectedIds:new Set([o.id]),onToggleSelect:S()}},h={args:{results:[r,o],selectedIds:new Set,onToggleSelect:S()},play:async({args:t,canvasElement:e})=>{const a=b(e);await v.click(a.getByRole("checkbox",{name:"Select Ada Lovelace"})),await g(t.onToggleSelect).toHaveBeenCalledWith(r.id),await g(t.onSelectUser).not.toHaveBeenCalled()}},m={args:{results:Array.from({length:25},(t,e)=>s(100+e,`First${e+1}`,`Last${e+1}`,e%4===0?"SUSPENDED":"ACTIVE"))}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Several matching users under the demoted match count.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    results: everyStatus
  }
}`,...c.parameters?.docs?.source},description:{story:"Every status the badge palette can render, side by side.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    results: [active]
  }
}`,...i.parameters?.docs?.source},description:{story:"A single matching result — the count reads `1 match`, not `1 matches`.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    results: []
  }
}`,...l.parameters?.docs?.source},description:{story:"No matching results — the component renders nothing at all, count included.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    results: [user(7, 'Bartholomew', 'Featherstonehaugh-Wintergreen', 'ACTIVE'), suspended, deprovisioned]
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"At 360px the two lines truncate rather than wrap, and the status badge keeps its width.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    results: [active, suspended]
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const [firstRow] = canvas.getAllByRole('button');
    await userEvent.tab();
    await expect(firstRow).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSelectUser).toHaveBeenCalledWith(active);
  }
}`,...p.parameters?.docs?.source},description:{story:"Tab moves onto the first result and Enter selects it — the rows are real buttons.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    results: everyStatus.slice(0, 4),
    selectedIds: new Set([suspended.id]),
    onToggleSelect: fn()
  }
}`,...u.parameters?.docs?.source},description:{story:'The checkbox column, with one user already in the basket.\n\nThe ticked row paints `ListRow state="selected"` and keeps its checkbox\nvisible at rest — a pick that faded out on scroll is a pick the reader can no\nlonger see they made. This is also the axe case for the conversion: a row that\nis its own click target *and* holds a checkbox is `nested-interactive`, which\nthe `StretchedButton` overlay is what avoids.',...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    results: [active, suspended],
    selectedIds: new Set<string>(),
    onToggleSelect: fn()
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Select Ada Lovelace'
    }));
    await expect(args.onToggleSelect).toHaveBeenCalledWith(active.id);
    await expect(args.onSelectUser).not.toHaveBeenCalled();
  }
}`,...h.parameters?.docs?.source},description:{story:`Ticking a row adds that user to the basket without opening them.

The two targets overlap visually — the checkbox sits on top of a button that
covers the whole row — so the one thing worth proving is that pressing the box
reaches the box.`,...h.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:"{\n  args: {\n    results: Array.from({\n      length: 25\n    }, (_, i) => user(100 + i, `First${i + 1}`, `Last${i + 1}`, i % 4 === 0 ? 'SUSPENDED' : 'ACTIVE'))\n  }\n}",...m.parameters?.docs?.source},description:{story:"A large result set to see the list scroll and the count grow.",...m.parameters?.docs?.description}}};const N=["Default","MixedStatuses","SingleResult","Empty","Compact360","KeyboardActivation","WithSelection","TickingDoesNotOpenTheUser","ManyResults"];export{d as Compact360,n as Default,l as Empty,p as KeyboardActivation,m as ManyResults,c as MixedStatuses,i as SingleResult,h as TickingDoesNotOpenTheUser,u as WithSelection,N as __namedExportsOrder,O as default};
