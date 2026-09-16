import{j as t,B as o}from"./iframe-tAvKsVeF.js";import{C as b}from"./ComparisonDiffTab-DYIRaIyU.js";import{G as y}from"./GroupSourceIndicator-Dh0LXLeG.js";import{A as g}from"./AppScopeIndicator-DosuQ_3O.js";import"./preload-helper-PPVm8Dsz.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";const{expect:h,fn:n,userEvent:f,waitFor:x,within:v}=__STORYBOOK_MODULE_TEST__,E=(e,r)=>({id:e,name:r,status:"ACTIVE",conditionExpression:'user.userType == "Contractor"',groupIds:["00gFAKEgroup0001"],userAttributes:["userType"]}),T=(e,r,u={})=>({group:{id:e,type:"OKTA_GROUP",profile:{name:r}},membershipType:"RULE_BASED",rules:[E("0prFAKErule00001","Contractors → VPN Access")],attribution:"exact",...u}),s=(e,r,u,w,C={})=>({id:e,label:r,inContext:u,inCompared:w,membership:T(e,r,C)}),A=[s("00gFAKEgroup0001","us.employees.union",!1,!0),s("00gFAKEgroup0002","okta.admins",!1,!0,{group:{id:"00gFAKEgroup0002",type:"APP_GROUP",profile:{name:"okta.admins"}},membershipType:"DIRECT",rules:[]}),s("00gFAKEgroup0003","emea.contractors",!0,!1,{membershipType:"DIRECT",rules:[]}),s("00gFAKEgroup0004","build.engineers",!0,!0),s("00gFAKEgroup0005","all.employees",!0,!0)],B=[{id:"app1",label:"Salesforce",inContext:!1,inCompared:!0},{id:"app2",label:"Figma",inContext:!0,inCompared:!1},{id:"app3",label:"Slack",inContext:!0,inCompared:!0}],I={title:"Users/Comparison/ComparisonDiffTab",component:b,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'One list where **every row states the comparison**: the context user on the left, the compared user on the right, and an equality marker between them. Every cell names its user in every state, and an Add button says `Add <recipient>` — the recipient being whichever side the button sits on.\n\nThe middle cell borrows the button silhouette but is inert: `role="img"` with a label, and `=`/`≠` are different glyphs so the state never depends on colour. A side that lacks the item and cannot be given it renders a stated non-answer rather than a button that would fail.'}}},args:{contextName:"Sam",comparedName:"Jordan",noun:"group",emptyText:"Neither user is in any groups.",rows:A}},a={args:{renderContextAction:(e,r)=>e.membership?.group.type==="APP_GROUP"?null:t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,onClick:n(),children:["Add ",r]}),renderComparedAction:(e,r)=>t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,onClick:n(),children:["Add ",r]}),renderMeta:e=>e.inContext&&e.inCompared?null:t.jsx(y,{membership:e.membership})}},i={args:{renderContextAction:(e,r)=>e.membership?.group.type==="APP_GROUP"?null:t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,loading:e.id==="00gFAKEgroup0001",disabled:!0,onClick:n(),children:["Add ",r]}),renderComparedAction:(e,r)=>t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,disabled:!0,onClick:n(),children:["Add ",r]})}},p={},c={args:{noun:"app",emptyText:"Neither user is assigned any apps.",rows:B,renderMeta:e=>e.inContext&&e.inCompared?t.jsx(g,{state:"notCompared"}):t.jsx(g,{state:e.inCompared?"USER":"GROUP"})}},d={args:{renderContextAction:(e,r)=>e.membership?.group.type==="APP_GROUP"?null:t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,onClick:n(),children:["Add ",r]}),renderComparedAction:(e,r)=>t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,onClick:n(),children:["Add ",r]}),renderMeta:e=>e.inContext&&e.inCompared?null:t.jsx(y,{membership:e.membership})},play:async({canvasElement:e})=>{const r=v(e);await h(r.queryByText("all.employees")).not.toBeInTheDocument(),await f.click(r.getByRole("button",{name:/^All/})),await x(()=>h(r.getByText("all.employees")).toBeInTheDocument()),await h(r.getByText("us.employees.union")).toBeInTheDocument()}},l={args:{rows:[]}},m={args:{rows:[...A,...Array.from({length:24},(e,r)=>s(`00gFAKEbulk${r}`,`bulk.group.${String(r).padStart(2,"0")}`,!0,!0))],renderContextAction:(e,r)=>t.jsxs(o,{size:"sm",variant:"primary",icon:"plus",fullWidth:!0,onClick:n(),children:["Add ",r]})}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    renderContextAction: (row, recipientName) => row.membership?.group.type === 'APP_GROUP' ? null : <Button size="sm" variant="primary" icon="plus" fullWidth onClick={fn()}>
          Add {recipientName}
        </Button>,
    renderComparedAction: (_row, recipientName) => <Button size="sm" variant="primary" icon="plus" fullWidth onClick={fn()}>
        Add {recipientName}
      </Button>,
    renderMeta: row => row.inContext && row.inCompared ? null : <GroupSourceIndicator membership={row.membership} />
  }
}`,...a.parameters?.docs?.source},description:{story:"The groups tab: both copy directions, provenance under each differing row.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    renderContextAction: (row, recipientName) => row.membership?.group.type === 'APP_GROUP' ? null : <Button size="sm" variant="primary" icon="plus" fullWidth loading={row.id === '00gFAKEgroup0001'} disabled onClick={fn()}>
          Add {recipientName}
        </Button>,
    renderComparedAction: (_row, recipientName) => <Button size="sm" variant="primary" icon="plus" fullWidth disabled onClick={fn()}>
        Add {recipientName}
      </Button>
  }
}`,...i.parameters?.docs?.source},description:{story:"A copy in flight: the global single-flight lock disables every other Add.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:"{}",...p.parameters?.docs?.source},description:{story:"No actions at all — how the list reads before the copy hooks are wired.",...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    noun: 'app',
    emptyText: 'Neither user is assigned any apps.',
    rows: APP_ROWS,
    renderMeta: row => row.inContext && row.inCompared ? <AppScopeIndicator state="notCompared" /> : <AppScopeIndicator state={row.inCompared ? 'USER' : 'GROUP'} />
  }
}`,...c.parameters?.docs?.source},description:{story:"The apps tab: same row, no buttons, scope instead of provenance.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    renderContextAction: (row, recipientName) => row.membership?.group.type === 'APP_GROUP' ? null : <Button size="sm" variant="primary" icon="plus" fullWidth onClick={fn()}>
          Add {recipientName}
        </Button>,
    renderComparedAction: (_row, recipientName) => <Button size="sm" variant="primary" icon="plus" fullWidth onClick={fn()}>
        Add {recipientName}
      </Button>,
    renderMeta: row => row.inContext && row.inCompared ? null : <GroupSourceIndicator membership={row.membership} />
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // The list opens on the differences, so a shared row is not there to begin with.
    await expect(canvas.queryByText('all.employees')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: /^All/
    }));
    await waitFor(() => expect(canvas.getByText('all.employees')).toBeInTheDocument());
    await expect(canvas.getByText('us.employees.union')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`Every row shape at once — an Add on the left, an Add on the right, a stated
non-answer, and two shared rows — which is the only view where the strip's three-track
grid can be judged: one marker column, one row height.`,...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    rows: []
  }
}`,...l.parameters?.docs?.source},description:{story:'Nothing to compare at all — distinct from "nothing matches the filter".',...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [...GROUP_ROWS, ...Array.from({
      length: 24
    }, (_, i) => groupRow(\`00gFAKEbulk\${i}\`, \`bulk.group.\${String(i).padStart(2, '0')}\`, true, true))],
    renderContextAction: (_row, recipientName) => <Button size="sm" variant="primary" icon="plus" fullWidth onClick={fn()}>
        Add {recipientName}
      </Button>
  }
}`,...m.parameters?.docs?.source},description:{story:"Enough rows that the list scrolls inside the panel rather than the page.",...m.parameters?.docs?.description}}};const W=["Groups","CopyInFlight","ReadOnly","Apps","AllRowShapes","Empty","LongList"];export{d as AllRowShapes,c as Apps,i as CopyInFlight,l as Empty,a as Groups,m as LongList,p as ReadOnly,W as __namedExportsOrder,I as default};
