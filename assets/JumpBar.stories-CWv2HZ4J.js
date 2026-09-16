import{J as v}from"./JumpBar-xxU0WuB9.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./JumpResultRow-C0dNkF2a.js";import"./jumpDestinations-CKYQltfE.js";import"./tabs-3T7DVjf-.js";const{expect:E,fn:j}=__STORYBOOK_MODULE_TEST__,e=(r={})=>({query:"",setQuery:j(),mode:"idle",results:[],error:null,isIdQuery:!1,resolution:null,submit:j(),clear:j(),...r}),s={kind:"group",id:"00gFAKE0000000000001",name:"Engineering"},f={kind:"rule",id:"0prFAKE0000000000001",name:"Eng — All ICs",secondary:"Active"},y={kind:"user",id:"00uFAKE0000000000001",name:"Ada Lovelace",secondary:"ada@example.com"},b={title:"Home/JumpBar",component:v,parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`The Home tab's first region: one input that **resolves** an id or **searches** names and emails. The distinction is the whole point — an admin usually already has the id, and a name search cannot match one.

| Input | Before Enter | On Enter |
| --- | --- | --- |
| A well-formed id | nothing | one local lookup; a request only on a miss |
| 3+ characters of a name | one debounced search | re-runs it immediately |
| 0–2 characters | nothing | nothing |

The footnote reports what the resolution actually cost: groups, rules and apps sit in the local org snapshot and resolve at zero requests, while users are never stored, so a user id always costs one.`}}},argTypes:{jump:{description:"Live resolver state from `useJumpResolver`."},onSelect:{description:"Open a result on its owning tab."},canReach:{description:"Whether a result’s kind has a destination in this build."},autoFocus:{description:"Focus on mount. The tab passes this only on first activation."}},args:{onSelect:j(),canReach:r=>!0,oktaOrigin:"https://example.okta.com",jump:e()}},n={},a={args:{jump:e({query:"00gFAKE0000000000001",isIdQuery:!0})}},t={args:{jump:e({query:"engineering",mode:"searching"})}},o={args:{jump:e({query:"engineering",mode:"searching",results:[s,y]})}},i={args:{jump:e({query:"00gFAKE0000000000001",isIdQuery:!0,mode:"results",results:[s,f],resolution:{cost:0}})}},c={args:{jump:e({query:"00uFAKE0000000000001",isIdQuery:!0,mode:"results",results:[y],resolution:{cost:1}})}},u={args:{jump:e({query:"eng",mode:"results",results:[s,y]})}},d={args:{jump:e({query:"eng",mode:"results",results:[s,y]})},play:async({args:r,canvas:S,userEvent:R})=>{await R.click(S.getByRole("button",{name:/^Engineering — open in/})),await E(r.onSelect).toHaveBeenCalledWith(s)}},p={args:{jump:e({query:"eng",mode:"results",results:[s,y]})},play:async({args:r,canvas:S,userEvent:R})=>{await R.click(S.getByRole("button",{name:"Clear"})),await E(r.jump.clear).toHaveBeenCalled(),await E(S.getByRole("textbox",{name:"Search groups, apps, users, rules"})).toHaveFocus()}},m={args:{canReach:r=>r!=="app",jump:e({query:"datadog",mode:"results",results:[{kind:"app",id:"0oaFAKE0000000000001",name:"Datadog"}]})}},l={args:{jump:e({query:"00gFAKE0000000000009",isIdQuery:!0,mode:"results",resolution:{cost:0}})}},g={args:{jump:e({query:"zzzz",mode:"results"})}},h={args:{jump:e({query:"eng",mode:"error",error:"Search failed. Check the connection to Okta and try again."})}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Resting state. The placeholder names what the field reaches; nothing else does.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: '00gFAKE0000000000001',
      isIdQuery: true
    })
  }
}`,...a.parameters?.docs?.source},description:{story:"A well-formed id has been pasted and no request has been issued; nothing happens until Enter.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'engineering',
      mode: 'searching'
    })
  }
}`,...t.parameters?.docs?.source},description:{story:"A name search in flight: the spinner shares the trailing slot with Clear.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'engineering',
      mode: 'searching',
      results: [GROUP, USER]
    })
  }
}`,...o.parameters?.docs?.source},description:{story:'A refining search: a newer query is in flight, but the previous rows stay on screen and the spinner carries the "newer answer coming" signal.',...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: '00gFAKE0000000000001',
      isIdQuery: true,
      mode: 'results',
      results: [GROUP, RULE],
      resolution: {
        cost: 0
      }
    })
  }
}`,...i.parameters?.docs?.source},description:{story:"An id returned the entity and the rules touching it, from the local snapshot — so the footnote says **no request**.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: '00uFAKE0000000000001',
      isIdQuery: true,
      mode: 'results',
      results: [USER],
      resolution: {
        cost: 1
      }
    })
  }
}`,...c.parameters?.docs?.source},description:{story:"The same shape for a user id, which the snapshot cannot hold — one request.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'eng',
      mode: 'results',
      results: [GROUP, USER]
    })
  }
}`,...u.parameters?.docs?.source},description:{story:"Name-search results across kinds. No footnote: nothing was *resolved*.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'eng',
      mode: 'results',
      results: [GROUP, USER]
    })
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: /^Engineering — open in/
    }));
    await expect(args.onSelect).toHaveBeenCalledWith(GROUP);
  }
}`,...d.parameters?.docs?.source},description:{story:"Pressing a result row opens that entity on its owning tab.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'eng',
      mode: 'results',
      results: [GROUP, USER]
    })
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear'
    }));
    await expect(args.jump.clear).toHaveBeenCalled();
    await expect(canvas.getByRole('textbox', {
      name: 'Search groups, apps, users, rules'
    })).toHaveFocus();
  }
}`,...p.parameters?.docs?.source},description:{story:"Clear empties the field through the resolver and returns focus to it.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    canReach: (kind: JumpResult['kind']): boolean => kind !== 'app',
    jump: jumpState({
      query: 'datadog',
      mode: 'results',
      results: [{
        kind: 'app',
        id: '0oaFAKE0000000000001',
        name: 'Datadog'
      }]
    })
  }
}`,...m.parameters?.docs?.source},description:{story:'An app result with no in-panel destination: the row keeps a real route, "Open in Okta".',...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: '00gFAKE0000000000009',
      isIdQuery: true,
      mode: 'results',
      resolution: {
        cost: 0
      }
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"An id that resolved to nothing. The copy differs from the name-search miss.",...l.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'zzzz',
      mode: 'results'
    })
  }
}`,...g.parameters?.docs?.source},description:{story:"A name that matched nothing.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    jump: jumpState({
      query: 'eng',
      mode: 'error',
      error: 'Search failed. Check the connection to Okta and try again.'
    })
  }
}`,...h.parameters?.docs?.source},description:{story:'Every search leg failed, which is a different claim from "nothing matched" — so the bar says so.',...h.parameters?.docs?.description}}};const U=["Idle","IdTyped","Searching","SearchingOverResults","ResolvedFromSnapshot","ResolvedFromOkta","SearchResults","OpeningAResult","ClearingTheField","UnreachableKind","NoSuchId","NoMatches","Failed"];export{p as ClearingTheField,h as Failed,a as IdTyped,n as Idle,g as NoMatches,l as NoSuchId,d as OpeningAResult,c as ResolvedFromOkta,i as ResolvedFromSnapshot,u as SearchResults,t as Searching,o as SearchingOverResults,m as UnreachableKind,U as __namedExportsOrder,b as default};
