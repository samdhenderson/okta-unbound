import{V as l}from"./VerbList-IR5vn6Vm.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./costSentence-DbR6FENm.js";import"./registry-CyxUpvmG.js";import"./userDisplay-xpx41Abi.js";import"./groupRuleIndex-CUdSMoPG.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./ruleUtils-Vt2BA8lQ.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./selectionStore-DExy1RDY.js";import"./memberRuleAttribution-CD0Zofjz.js";import"./undoManager-UZfuKMLz.js";import"./profileAttributes-DCAWW3PA.js";import"./dateFormat-tpkRVL7u.js";import"./profileFields-BZvCtc6D.js";import"./profileDraft-BAjvfbBV.js";import"./memberAnalytics-BqndU7JT.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";const{expect:n,fn:h,within:c}=__STORYBOOK_MODULE_TEST__,p=e=>({picked:e.map((t,s)=>({kind:t,id:`${t}-${s}`,name:`${t} ${s}`,pickedAt:17e11+s}))}),u=e=>{const t={};for(const s of e.picked)t[s.kind]=(t[s.kind]??0)+1;return t},m=e=>({label:e.id,path:"write",cost:()=>({requests:1,writes:1}),run:async()=>({status:"done",summary:"Done."}),...e}),g=m({id:"turn-off",label:"Turn these rules off",title:"Turn these rules off, so they stop assigning members",needs:["rule"]}),b=m({id:"overlap",label:"Members these groups share",title:"Report which members these groups share",path:"read",needs:["group"],isAvailable:e=>e.picked.filter(t=>t.kind==="group").length>=2,unavailableReason:"Needs at least two groups — an overlap of one group is not a question.",cost:()=>({requests:1,writes:0})}),d=m({id:"add-users",label:"Add to these groups",title:"Add these users to these groups",needs:["user","group"],cost:e=>{const t=e.picked.filter(i=>i.kind==="user").length,s=e.picked.filter(i=>i.kind==="group").length;return{requests:t*s,writes:t*s}}}),V={title:"Selection/panes/VerbList",component:l,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"One row per verb, naming what it acts on and what it costs. The panes’ own stories cover the two headline absences; this covers what only a list can show — several verbs held back for **different** reasons at once, and a combination verb appearing the moment its second partition fills."}}},args:{onRun:h(),emptyIcon:"bolt",emptyTitle:"No actions yet",emptyDescription:"None are wired yet."}},o={args:(()=>{const e=p(["group"]);return{verbs:[g,b],basket:e,counts:u(e)}})(),play:async({canvasElement:e})=>{const t=c(e);await n(t.getByText(/Tick some rules and these appear\./)).toBeInTheDocument(),await n(t.getByText(/Needs at least two groups/)).toBeInTheDocument()}},a={args:(()=>{const e=p(["user"]);return{verbs:[d],basket:e,counts:u(e)}})(),play:async({canvasElement:e})=>{const t=c(e);await n(t.getByText(/Tick some groups and these appear\./)).toBeInTheDocument(),await n(t.queryByRole("button")).not.toBeInTheDocument()}},r={args:(()=>{const e=p(["user","user","user","group","group"]);return{verbs:[d],basket:e,counts:u(e)}})(),play:async({canvasElement:e})=>{const t=c(e);await n(t.getByText("Add these users to these groups")).toBeInTheDocument(),await n(t.getByText("Takes 6 requests. Changes 6 entities in Okta.")).toBeInTheDocument()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: (() => {
    const basket = basketOf(['group']);
    return {
      verbs: [NEEDS_RULES, NEEDS_TWO],
      basket,
      counts: countsOf(basket)
    };
  })(),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Tick some rules and these appear\\./)).toBeInTheDocument();
    await expect(canvas.getByText(/Needs at least two groups/)).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:`Two verbs, held back for two different reasons. Both are reported: an empty
partition explains itself by name, and an extra condition quotes the verb's
own sentence. Collapsing them into one "nothing here" would lose the reason.`,...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: (() => {
    const basket = basketOf(['user']);
    return {
      verbs: [COMBO],
      basket,
      counts: countsOf(basket)
    };
  })(),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Tick some groups and these appear\\./)).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source},description:{story:"One partition is ticked — the combination verb is still absent, not disabled.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: (() => {
    const basket = basketOf(['user', 'user', 'user', 'group', 'group']);
    return {
      verbs: [COMBO],
      basket,
      counts: countsOf(basket)
    };
  })(),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Add these users to these groups')).toBeInTheDocument();
    await expect(canvas.getByText('Takes 6 requests. Changes 6 entities in Okta.')).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"Both partitions are ticked — it appears, quoting the real N×M cost.",...r.parameters?.docs?.description}}};const F=["BothReasonsAtOnce","ComboWaitsForItsSecondPartition","ComboAppearsAndPricesItself"];export{o as BothReasonsAtOnce,r as ComboAppearsAndPricesItself,a as ComboWaitsForItsSecondPartition,F as __namedExportsOrder,V as default};
