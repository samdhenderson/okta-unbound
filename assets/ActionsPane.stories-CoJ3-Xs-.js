import{A as l}from"./ActionsPane-DMVqLRIH.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./VerbList-IR5vn6Vm.js";import"./costSentence-DbR6FENm.js";import"./registry-CyxUpvmG.js";import"./userDisplay-xpx41Abi.js";import"./groupRuleIndex-CUdSMoPG.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./ruleUtils-Vt2BA8lQ.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./selectionStore-DExy1RDY.js";import"./memberRuleAttribution-CD0Zofjz.js";import"./undoManager-UZfuKMLz.js";import"./profileAttributes-DCAWW3PA.js";import"./dateFormat-tpkRVL7u.js";import"./profileFields-BZvCtc6D.js";import"./profileDraft-BAjvfbBV.js";import"./memberAnalytics-BqndU7JT.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";const{expect:a,fn:h,userEvent:y,within:p}=__STORYBOOK_MODULE_TEST__,d=t=>({picked:t.map((e,n)=>({kind:e,id:`${e}-${n}`,name:`${e} ${n}`,pickedAt:17e11+n}))}),m=t=>{const e={};for(const n of t.picked)e[n.kind]=(e[n.kind]??0)+1;return e},i={id:"remove-inactive",label:"Remove inactive members",title:"Remove deactivated, suspended and locked-out members from these groups",path:"write",needs:["group"],cost:t=>({requests:0,walks:t.picked.filter(e=>e.kind==="group").length,writes:0}),run:async()=>({status:"done",summary:"Done."})},c=d(["group","group"]),u=d(["user"]),W={title:"Selection/panes/ActionsPane",component:l,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Renders `write` verbs from the registry. Three states, and the pane says which one it is in: no verbs wired at all, verbs that do not apply to what is ticked (naming the partitions they wait on), or the runnable list. Reporting the first two with one sentence would lose the reason for the absence (`docs/claims.md`)."}}},args:{onRun:h()}},o={args:{verbs:[],basket:c,counts:m(c)},play:async({canvasElement:t})=>{const e=p(t);await a(e.getByText("No actions yet")).toBeInTheDocument(),await a(e.queryByRole("button")).not.toBeInTheDocument()}},s={args:{verbs:[i],basket:u,counts:m(u)},play:async({canvasElement:t})=>{const e=p(t);await a(e.getByText("Nothing here applies yet")).toBeInTheDocument(),await a(e.getByText(/Tick some groups/)).toBeInTheDocument(),await a(e.queryByRole("button")).not.toBeInTheDocument()}},r={args:{verbs:[i],basket:c,counts:m(c)},play:async({canvasElement:t,args:e})=>{const n=p(t);await a(n.getByText(i.title)).toBeInTheDocument(),await a(n.getByText("Takes 2 membership walks.")).toBeInTheDocument(),await y.click(n.getByRole("button",{name:i.title})),await a(e.onRun).toHaveBeenCalledWith(i)}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    verbs: [],
    basket: GROUPS,
    counts: countsOf(GROUPS)
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No actions yet')).toBeInTheDocument();
    // A verb with no handler is omitted, never shipped disabled (\`docs/claims.md\`).
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"Nothing wired yet — the seat is held and names what belongs in it.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    verbs: [REMOVE_INACTIVE],
    basket: USERS_ONLY,
    counts: countsOf(USERS_ONLY)
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing here applies yet')).toBeInTheDocument();
    await expect(canvas.getByText(/Tick some groups/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:`Verbs exist but none applies. The pane names the partition they are waiting
on — the reader's next action rather than a bare "nothing here".`,...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    verbs: [REMOVE_INACTIVE],
    basket: GROUPS,
    counts: countsOf(GROUPS)
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(REMOVE_INACTIVE.title)).toBeInTheDocument();
    // The cost is a count of requests, never an estimate of seconds.
    await expect(canvas.getByText('Takes 2 membership walks.')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: REMOVE_INACTIVE.title
    }));
    await expect(args.onRun).toHaveBeenCalledWith(REMOVE_INACTIVE);
  }
}`,...r.parameters?.docs?.source},description:{story:"The verb's object is ticked — it appears, stating what it will spend.",...r.parameters?.docs?.description}}};const Y=["NoVerbsWired","NothingApplies","Runnable"];export{o as NoVerbsWired,s as NothingApplies,r as Runnable,Y as __namedExportsOrder,W as default};
