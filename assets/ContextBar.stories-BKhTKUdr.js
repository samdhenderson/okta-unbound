import{r as D,j as E,B as A}from"./iframe-tAvKsVeF.js";import{C as S}from"./ContextBar-B0WKHzpH.js";import{s as r}from"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./useSelection-DlTpY3y-.js";import"./jumpDestinations-CKYQltfE.js";import"./tabs-3T7DVjf-.js";const{expect:n,fn:o,userEvent:R,within:s}=__STORYBOOK_MODULE_TEST__,K={title:"Sidepanel/ContextBar",component:S,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:`One line of top chrome: a hue-coded connection wire along the panel's top edge, the live Okta tab's entity name, and the session-chrome controls (the Selection count, then Refresh). The wire costs no layout height at rest and thickens into a labelled strip with a real Reconnect control when the connection is down.

It describes the **live tab**, never what the panel is browsing — the browsed entity's name reaches Refresh's accessible name and tooltip only. Presentational: refresh and selection behaviour belong to the caller.`}}},argTypes:{pageType:{description:"Detected page type; drives the label fallback and dot colour."},entityName:{description:"Display name of the detected entity, if resolved."},connectionStatus:{description:"Connection state to the Okta tab."},isLoading:{description:"Whether page context is still resolving."},error:{description:"Connection/context error message, or `null` when healthy."},onRefresh:{description:"Re-read whatever the panel is showing, and re-probe the live context."},handoff:{description:"The live Okta tab's entity, offered to be opened in the panel. Rendered into the identity region in place of the plain name."},onAcceptHandoff:{description:"Open the offered entity in the panel."},onDismissHandoff:{description:"Decline the offer, for that entity only."},refreshSubjectName:{description:"What Refresh will act on, in the reader's words. Reaches the control's tooltip and accessible name only — never visible text in the band."},onReconnect:{description:"Reload the Okta tab to re-establish the content script, then re-detect. Shown only on error."}},args:{pageType:"group",entityName:"Engineering Team",connectionStatus:"connected",isLoading:!1,error:null,onRefresh:o(),onReconnect:o()}},i={},c={args:{entityName:"Engineering Team",refreshSubjectName:"Payments Team"},play:async({canvasElement:t})=>{const a=s(t).getByRole("button",{name:"Refresh Payments Team"});await n(a).toBeEnabled(),await n(a).toHaveAttribute("title","Refresh Payments Team"),await n(t).toHaveTextContent("Engineering Team"),await n(t).not.toHaveTextContent("Payments Team")}},d={args:{refreshSubjectName:null},play:async({canvasElement:t})=>{const e=s(t);await n(e.getByRole("button",{name:"Refresh"})).toBeInTheDocument()}},l={args:{pageType:"user",entityName:"Jordan Rivera"}},m={args:{isLoading:!0,connectionStatus:"connecting",entityName:void 0}},p={args:{entityName:void 0,error:"Can’t reach the Okta tab — reload it to reconnect."},play:async({args:t,canvasElement:e})=>{const a=s(e),B=a.getByRole("button",{name:"Reconnect"});B.focus(),await n(B).toHaveFocus(),await R.keyboard("{Enter}"),await n(t.onReconnect).toHaveBeenCalled(),await n(a.getByText("Not connected to the Okta tab")).toBeInTheDocument()}},h={play:async({canvasElement:t})=>{const e=s(t);await n(e.getByRole("button",{name:"Refresh"})).toBeInTheDocument()}},u={args:{entityName:void 0,error:"Can’t reach the Okta tab — reload it to reconnect.",onReconnect:void 0},play:async({canvasElement:t})=>{const e=s(t);await n(e.getByText("Not connected to the Okta tab")).toBeInTheDocument(),await n(e.queryByRole("button",{name:"Reconnect"})).not.toBeInTheDocument()}},f={args:{handoff:{kind:"group",id:"00gFAKE0001",name:"Payments Team"},onAcceptHandoff:o(),onDismissHandoff:o()},play:async({args:t,canvasElement:e})=>{const a=s(e);await R.click(a.getByRole("button",{name:/Open Payments Team in Groups/})),await n(t.onAcceptHandoff).toHaveBeenCalled(),await n(a.getByRole("button",{name:"Refresh"})).toBeInTheDocument()}},y={args:{pageType:"user",handoff:{kind:"user",id:"00uFAKE0001",name:"user@example.com"},onAcceptHandoff:o(),onDismissHandoff:o()}},g={args:{pageType:"app",handoff:{kind:"app",id:"0oaFAKE0001",name:"Salesforce"},onAcceptHandoff:o(),onDismissHandoff:o()}},v={render:function(e){const[a,B]=D.useState({id:"00gFAKE0001",name:"Payments Team"}),[k,x]=D.useState(null);return E.jsxs("div",{children:[E.jsx(S,{...e,entityName:a.name,handoff:a.id===k?null:{kind:"group",id:a.id,name:a.name},onDismissHandoff:()=>x(a.id)}),E.jsx(A,{size:"sm",className:"m-2",onClick:()=>B({id:"00gFAKE0002",name:"Finance Team"}),children:"Move the live tab"})]})},args:{onAcceptHandoff:o(),onDismissHandoff:o()},play:async({canvasElement:t})=>{const e=s(t);await n(e.getByRole("button",{name:/Open Payments Team in Groups/})).toBeInTheDocument(),await R.click(e.getByRole("button",{name:"Dismiss Payments Team"})),await n(e.queryByRole("button",{name:/Open Payments Team in Groups/})).not.toBeInTheDocument(),await R.click(e.getByRole("button",{name:"Move the live tab"})),await n(e.getByRole("button",{name:/Open Finance Team in Groups/})).toBeInTheDocument()}},b={args:{pageType:"admin",entityName:void 0,handoff:null},play:async({canvasElement:t})=>{const e=s(t);await n(e.getByText("Okta Admin")).toBeInTheDocument(),await n(e.queryByRole("button",{name:/^Open /})).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/^Dismiss /})).not.toBeInTheDocument()}},w={args:{onOpenSelection:o()},beforeEach:()=>(r.clearAll(),r.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),r.toggle({kind:"user",id:"00uFAKE0002",name:"Rowan Example"}),r.toggle({kind:"group",id:"00gFAKE0001",name:"Payments Team"}),()=>r.clearAll()),play:async({canvasElement:t,args:e})=>{const a=s(t);await n(a.getByRole("button",{name:"2 users and 1 group selected"})).toBeInTheDocument(),await n(a.getByRole("button",{name:"Refresh"})).toBeInTheDocument(),await R.click(a.getByRole("button",{name:"2 users and 1 group selected"})),await n(e.onOpenSelection).toHaveBeenCalledTimes(1)}},T={args:{onOpenSelection:o()},beforeEach:()=>{r.clearAll()},play:async({canvasElement:t})=>{const e=s(t);await n(e.queryByRole("button",{name:/selected$/})).not.toBeInTheDocument(),await n(e.getByRole("button",{name:"Refresh"})).toBeInTheDocument()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source},description:{story:"A resolved group page.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    entityName: 'Engineering Team',
    refreshSubjectName: 'Payments Team'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const refresh = canvas.getByRole('button', {
      name: 'Refresh Payments Team'
    });
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveAttribute('title', 'Refresh Payments Team');

    // The subject is not visible anywhere in the band — only the live tab's
    // entity is, and the two are deliberately different here.
    await expect(canvasElement).toHaveTextContent('Engineering Team');
    await expect(canvasElement).not.toHaveTextContent('Payments Team');
  }
}`,...c.parameters?.docs?.source},description:{story:`The refresh control names its subject in its tooltip and accessible name only — the
band's visible readout stays about the live Okta tab, which may be a different entity.`,...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    refreshSubjectName: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Refresh'
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`With no rung claiming the control (a section that has registered no subject),
the name degrades to a bare *Refresh* rather than to a deictic guess.`,...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    pageType: 'user',
    entityName: 'Jordan Rivera'
  }
}`,...l.parameters?.docs?.source},description:{story:"A resolved user page (accent dot).",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true,
    connectionStatus: 'connecting',
    entityName: undefined
  }
}`,...m.parameters?.docs?.source},description:{story:"Context still resolving.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    entityName: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.'
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The recovery control is a real, named, keyboard-reachable button — the
    // status light it replaces was \`role="img"\` with nothing to press, and the
    // separate Reconnect button it replaces displaced Refresh when it appeared.
    const reconnect = canvas.getByRole('button', {
      name: 'Reconnect'
    });
    reconnect.focus();
    await expect(reconnect).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onReconnect).toHaveBeenCalled();

    // Hue is not the only carrier: the strip states it in words.
    await expect(canvas.getByText('Not connected to the Okta tab')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Connection/context error: the wire thickens into its labelled strip.",...p.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Present and named identically in the healthy state rendered here;
    // \`ErrorState\` renders the same control beside a Reconnect added in a
    // different band. Position itself is not assertable in this runner.
    await expect(canvas.getByRole('button', {
      name: 'Refresh'
    })).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:`Refresh keeps its place whether the connection is healthy or down: the recovery
control lives in the band above the row, and the identity region absorbs the
change.`,...h.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    entityName: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
    onReconnect: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not connected to the Okta tab')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Reconnect'
    })).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:`With no tab to reconnect to, the strip states the status and offers nothing — an
action known to be impossible is omitted, not shipped disabled.`,...u.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    handoff: {
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn()
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Open Payments Team in Groups/
    }));
    await expect(args.onAcceptHandoff).toHaveBeenCalled();

    // Refresh is still exactly the control it was.
    await expect(canvas.getByRole('button', {
      name: 'Refresh'
    })).toBeInTheDocument();
  }
}`,...f.parameters?.docs?.source},description:{story:`The handoff offer: the identity region morphs into a pressable version of the name
it already shows, and Refresh does not move.`,...f.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    pageType: 'user',
    handoff: {
      kind: 'user',
      id: '00uFAKE0001',
      name: 'user@example.com'
    },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn()
  }
}`,...y.parameters?.docs?.source},description:{story:"The user case.",...y.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    pageType: 'app',
    handoff: {
      kind: 'app',
      id: '0oaFAKE0001',
      name: 'Salesforce'
    },
    onAcceptHandoff: fn(),
    onDismissHandoff: fn()
  }
}`,...g.parameters?.docs?.source},description:{story:"An app, proving the affordance is not user-only.",...g.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  render: function HandoffLifecycle(args) {
    const [live, setLive] = useState({
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    const [dismissedId, setDismissedId] = useState<string | null>(null);
    return <div>
        <ContextBar {...args} entityName={live.name} handoff={live.id === dismissedId ? null : {
        kind: 'group',
        id: live.id,
        name: live.name
      }} onDismissHandoff={() => setDismissedId(live.id)} />
        {/* Stands in for the reader navigating the live Okta tab. */}
        <Button size="sm" className="m-2" onClick={() => setLive({
        id: '00gFAKE0002',
        name: 'Finance Team'
      })}>
          Move the live tab
        </Button>
      </div>;
  },
  args: {
    onAcceptHandoff: fn(),
    onDismissHandoff: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Open Payments Team in Groups/
    })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Dismiss Payments Team'
    }));
    await expect(canvas.queryByRole('button', {
      name: /Open Payments Team in Groups/
    })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Move the live tab'
    }));
    await expect(canvas.getByRole('button', {
      name: /Open Finance Team in Groups/
    })).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:`The offer's full life: it appears, declining hides it for that entity only, and
pointing the live Okta tab at a different one brings it back.`,...v.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    pageType: 'admin',
    entityName: undefined,
    handoff: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Okta Admin')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Open /
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Dismiss /
    })).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:`Nothing to hand over: an admin console page carries no entity, so the region falls
back to its plain readout rather than a control that would only refuse.`,...b.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenSelection: fn()
  },
  beforeEach: () => {
    selectionStore.clearAll();
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0002',
      name: 'Rowan Example'
    });
    selectionStore.toggle({
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    // The whole breakdown is in the accessible name at rest, so the hover
    // expansion reveals a convenience, never the only route to a fact.
    await expect(canvas.getByRole('button', {
      name: '2 users and 1 group selected'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Refresh'
    })).toBeInTheDocument();

    // Not proven here: the hover breakdown is drawn over this button, so a panel
    // that took pointer events would swallow the click. This runner loads no CSS,
    // so the click lands regardless; what code enforces is the panel's permanent
    // \`pointer-events-none\`.
    await userEvent.click(canvas.getByRole('button', {
      name: '2 users and 1 group selected'
    }));
    await expect(args.onOpenSelection).toHaveBeenCalledTimes(1);
  }
}`,...w.parameters?.docs?.source},description:{story:`Session chrome, both members (ADR-0005). The Selection count sits left of
Refresh and grows leftward out of flow, so a label that changes on every tick
never moves Refresh. Position is not assertable in this runner, so this story
pins what is: both controls present, and Refresh's name unchanged beside a count.`,...w.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenSelection: fn()
  },
  beforeEach: () => {
    selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /selected$/
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Refresh'
    })).toBeInTheDocument();
  }
}`,...T.parameters?.docs?.source},description:{story:"Nothing ticked: the count is **absent, not `(0)`** (`docs/claims.md`), and Refresh\nis alone in the trailing group.",...T.parameters?.docs?.description}}};const j=["Default","RefreshNamesItsSubject","RefreshUnclaimed","UserPage","Loading","ErrorState","ControlsDoNotMoveOnFailure","ErrorWithNoTabToReconnect","HandoffGroup","HandoffUser","HandoffApp","HandoffDismissAndReturn","HandoffAbsentOnAdminPage","SessionChrome","SessionChromeWithEmptyBasket"];export{h as ControlsDoNotMoveOnFailure,i as Default,p as ErrorState,u as ErrorWithNoTabToReconnect,b as HandoffAbsentOnAdminPage,g as HandoffApp,v as HandoffDismissAndReturn,f as HandoffGroup,y as HandoffUser,m as Loading,c as RefreshNamesItsSubject,d as RefreshUnclaimed,w as SessionChrome,T as SessionChromeWithEmptyBasket,l as UserPage,j as __namedExportsOrder,K as default};
