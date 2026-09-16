import{M as g}from"./MemberList-DciIOLLY.js";import{m as r}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./MemberRow-Dl-pQSx-.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";import"./userDisplay-xpx41Abi.js";import"./memberAnalytics-BqndU7JT.js";const{expect:d,fn:u,userEvent:w,within:b}=__STORYBOOK_MODULE_TEST__,f=new Map(r.slice(0,50).map((s,e)=>[s.id,{userId:s.id,factors:[],enrolled:e%3!==0,factorCount:e%3===0?0:e%3+1,factorLabels:e%3===0?[]:["Okta Verify (Fastpass)"].concat(e%3===2?["SMS"]:[])}])),I={title:"Members/MemberList",component:g,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Windowed, auto-paging scrollable list of member rows. Only the first `visibleCount` rows mount; the list grows via a "Load more" footer plus an IntersectionObserver sentinel, which caps DOM size for very large groups.\n\nWhile `loading`, the rows are replaced by `Skeleton variant="row"` placeholders rather than a spinner, because the shape of what is coming is already known.'}}},argTypes:{members:{description:"Members to display, already filtered and sorted by the caller."},loading:{description:"True while the member set is being re-fetched; swaps the rows for skeleton placeholders."},mfaResults:{description:"Per-member MFA scan results, or null before a scan has run."},mfaScanned:{description:'True once a scan completed, so rows render "No MFA" for 0-factor users.'},visibleCount:{description:"How many rows are currently mounted."},onLoadMore:{description:"Reveal the next page of rows."},oktaOrigin:{description:"Okta org origin for per-member Admin Console links (null when unknown)."},selectedIds:{description:"Which members are in the selection basket. May hold ids for people ticked elsewhere."},onToggleSelect:{description:"Tick or untick one member. Absent ⇒ no row renders a checkbox."}},args:{members:r.slice(0,20),loading:!1,mfaResults:null,mfaScanned:!1,visibleCount:20,onLoadMore:u(),oktaOrigin:null}},o={},t={args:{members:r,visibleCount:50},play:async({args:s,canvas:e,userEvent:m})=>{await m.click(e.getByRole("button",{name:/^Load more/})),await d(s.onLoadMore).toHaveBeenCalled()}},a={args:{members:r.slice(0,50),mfaResults:f,mfaScanned:!0,visibleCount:50}},n={args:{oktaOrigin:"https://example.okta.com"}},i={args:{members:[],visibleCount:20}},c={args:{loading:!0}},l={args:{onToggleSelect:u(),selectedIds:new Set([r[0].id,r[2].id])},play:async({args:s,canvasElement:e})=>{const p=b(e).getAllByRole("checkbox").filter(h=>h.checked);await d(p).toHaveLength(2),await w.click(p[0]),await d(s.onToggleSelect).toHaveBeenCalledWith(r[0].id)}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"A short list that fits entirely within the visible window.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    members: mockUsers,
    visibleCount: 50
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: /^Load more/
    }));
    await expect(args.onLoadMore).toHaveBeenCalled();
  }
}`,...t.parameters?.docs?.source},description:{story:'A large group with more rows than the current visible window: "Load more" shown.',...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    members: mockUsers.slice(0, 50),
    mfaResults,
    mfaScanned: true,
    visibleCount: 50
  }
}`,...a.parameters?.docs?.source},description:{story:'MFA scan complete: factor tags or "No MFA" badges render per row.',...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com'
  }
}`,...n.parameters?.docs?.source},description:{story:"Rows link out to the Okta Admin Console when an org origin is known.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    members: [],
    visibleCount: 20
  }
}`,...i.parameters?.docs?.source},description:{story:"No members match the current search and filters.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...c.parameters?.docs?.source},description:{story:"Reloading after a membership change: the stale rows are replaced by skeletons, not left showing figures about to change.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn(),
    selectedIds: new Set([mockUsers[0].id, mockUsers[2].id])
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const checked = canvas.getAllByRole('checkbox').filter(box => (box as HTMLInputElement).checked);
    await expect(checked).toHaveLength(2);
    await userEvent.click(checked[0]);
    await expect(args.onToggleSelect).toHaveBeenCalledWith(mockUsers[0].id);
  }
}`,...l.parameters?.docs?.source},description:{story:`Selection passes straight through this list; it owns none of it. \`selectedIds\`
comes from the panel-wide basket, which resolves ids against the group's full
roster rather than the filtered slice handed here — so the set may name people
whose rows are not currently mounted, and a row only ever asks it about itself.`,...l.parameters?.docs?.description}}};const U=["Default","WithLoadMore","WithMfaResults","WithOktaOrigin","Empty","Reloading","WithSelection"];export{o as Default,i as Empty,c as Reloading,t as WithLoadMore,a as WithMfaResults,n as WithOktaOrigin,l as WithSelection,U as __namedExportsOrder,I as default};
