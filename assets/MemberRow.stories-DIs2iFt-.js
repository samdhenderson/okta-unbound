import{M as B}from"./MemberRow-Dl-pQSx-.js";import{m as w}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";import"./userDisplay-xpx41Abi.js";import"./memberAnalytics-BqndU7JT.js";const{expect:t,fn:y,userEvent:k,within:R}=__STORYBOOK_MODULE_TEST__,r=w.find(e=>e.status==="ACTIVE"),M=w.find(e=>e.status==="SUSPENDED"),A=w.find(e=>e.status==="DEPROVISIONED"),C={...r,profile:{...r.profile,login:"jdoe"}},x={userId:r.id,factors:[],enrolled:!0,factorCount:2,factorLabels:["Okta Verify (Fastpass)","SMS"]},W={userId:r.id,factors:[],enrolled:!1,factorCount:0,factorLabels:[]},T={id:"00gFAKE1",type:"OKTA_GROUP",profile:{name:"Engineering"}},E={id:"0prFAKE1",name:"Engineering department",status:"ACTIVE",conditionExpression:'user.department == "Engineering"'},D={group:T,membershipType:"RULE_BASED",rules:[E],attribution:"exact",provenance:{source:"okta",rules:[{id:"0prFAKE1",name:"Engineering department"}]}},O={group:T,membershipType:"RULE_BASED",rules:[E],attribution:"inferred"},Y={title:"Members/MemberRow",component:B,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Single member card: name, email, the login only when it differs from the email, a status badge, MFA factor tags once a scan has completed, and a disclosure carrying the member's profile attributes and an Okta deep link. The row is never itself a link — a chevron inside an anchor is `nested-interactive` — and `expanded` is owned by the list, so filtering a row out and back in does not close it.\n\nPass a `membership` and the row also explains **why** this person is in the group: a verdict badge and one source line collapsed, the full caveat plus one evidence card per attributed rule expanded. This surface holds one group's roster and no `groupContext`, so `isMemberOf*` clauses read \"Cannot be determined\", which is true.\n\n**The row carries a selection checkbox**, revealed on hover or keyboard focus and drawn unconditionally while ticked, so a pick cannot fade out as the reader scrolls past it. Its name says who (`Select Ada Lovelace`); omitting `onToggleSelect` renders no checkbox."}}},argTypes:{user:{description:"The member to render."},mfa:{description:"This member's MFA scan result, if available."},mfaScanned:{description:'True once an MFA scan has completed, so "No MFA" can show for 0-factor users.'},oktaOrigin:{description:"Okta org origin; when set, the disclosure offers a link to the member's Admin Console profile."},expanded:{description:"Whether this row's disclosure is open. Owned by the list."},onToggle:{description:"Called with the member's id when the disclosure control is pressed."},membership:{description:"Why this member is in the group. Absent ⇒ the row says nothing about source."},onRemove:{description:"Request removal. Omitted ⇒ no control renders — never a disabled one."},selected:{description:"Whether this member is in the selection basket; a ticked row paints ListRow's selected state."},onToggleSelect:{description:"Tick or untick this member. Omitted ⇒ no checkbox renders at all."}},args:{user:r,mfaScanned:!1,oktaOrigin:null,expanded:!1,onToggle:y()}},s={},n={args:{user:M}},i={args:{user:A}},c={args:{user:C},play:async({canvas:e})=>{await t(e.getByText("jdoe")).toBeInTheDocument()}},d={args:{mfaScanned:!0,mfa:x}},l={args:{mfaScanned:!0,mfa:W}},p={args:{oktaOrigin:"https://example.okta.com",mfaScanned:!0,mfa:x}},m={args:{expanded:!0,oktaOrigin:"https://example.okta.com",mfaScanned:!0,mfa:x}},u={args:{oktaOrigin:"https://example.okta.com"},play:async({args:e,canvasElement:a})=>{const o=R(a);await t(a.querySelector("a button")).toBeNull(),await t(a.querySelector('a [role="button"]')).toBeNull();const S=o.getByRole("button",{name:/Show details for/});await t(S).toHaveAttribute("aria-expanded","false"),await k.click(S),await t(e.onToggle).toHaveBeenCalledWith(r.id)}},h={args:{membership:D,expanded:!0,oktaOrigin:"https://example.okta.com"}},g={args:{membership:O,expanded:!0,proofEnabled:!0,onProve:y(),oktaOrigin:"https://example.okta.com"},play:async({args:e,canvas:a})=>{await k.click(a.getByRole("button",{name:"Ask Okta"})),await t(e.onProve).toHaveBeenCalledWith(O,r.id)}},f={args:{onRemove:y()},play:async({args:e,canvas:a})=>{const o=a.getByRole("button",{name:/^Remove .* from this group$/});await k.click(o),await t(e.onRemove).toHaveBeenCalledWith(r)}},b={args:{onToggleSelect:y()},play:async({args:e,canvas:a})=>{const o=a.getByRole("checkbox",{name:/^Select /});await t(o).not.toBeChecked(),await k.click(o),await t(e.onToggleSelect).toHaveBeenCalledWith(r.id)}},v={args:{onToggleSelect:y(),selected:!0},play:async({canvas:e})=>{await t(e.getByRole("checkbox",{name:/^Select /})).toBeChecked()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Active member, no MFA scan run yet — status badge only.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    user: suspendedUser
  }
}`,...n.parameters?.docs?.source},description:{story:"Suspended member — warning-colored status badge.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    user: deprovisionedUser
  }
}`,...i.parameters?.docs?.source},description:{story:"Deprovisioned member — danger-colored status badge.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    user: userWithDistinctLogin
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('jdoe')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:`The header states the login only when it disagrees with the email above it — every
other story uses the fixture where the two match, so this is where that line renders.`,...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    mfaScanned: true,
    mfa: enrolledMfa
  }
}`,...d.parameters?.docs?.source},description:{story:"MFA scan complete and this member has enrolled factors — factor tags render.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    mfaScanned: true,
    mfa: noFactorsMfa
  }
}`,...l.parameters?.docs?.source},description:{story:'MFA scan complete but this member has zero factors — "No MFA" badge renders.',...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com',
    mfaScanned: true,
    mfa: enrolledMfa
  }
}`,...p.parameters?.docs?.source},description:{story:"With an org origin, the disclosure offers an Admin Console deep link.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true,
    oktaOrigin: 'https://example.okta.com',
    mfaScanned: true,
    mfa: enrolledMfa
  }
}`,...m.parameters?.docs?.source},description:{story:"The disclosure open: the member's browseable profile attributes, over the Okta deep link.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com'
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The violation this row used to have, stated structurally: an interactive
    // control inside an anchor. Asserting "no link anywhere" would be wrong —
    // the disclosure legitimately holds one — and asserting on the closed
    // panel's accessibility would test \`inert\`'s implementation rather than
    // this row's shape.
    await expect(canvasElement.querySelector('a button')).toBeNull();
    await expect(canvasElement.querySelector('a [role="button"]')).toBeNull();
    const toggle = canvas.getByRole('button', {
      name: /Show details for/
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(args.onToggle).toHaveBeenCalledWith(activeUser.id);
  }
}`,...u.parameters?.docs?.source},description:{story:"The one interactive control in the header is the disclosure toggle. The structural\ncheck is not redundant with axe: the addon did not catch a `<button>` inside an `<a>`\nhere when the old whole-row anchor was restored to test it.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    membership: provenMembership,
    expanded: true,
    oktaOrigin: 'https://example.okta.com'
  }
}`,...h.parameters?.docs?.source},description:{story:`Okta's own attribution, carried for free by the roster read's \`expand=group-rules\` —
so the row states the rule as a fact and never offers "Ask Okta".`,...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    membership: deducedMembership,
    expanded: true,
    proofEnabled: true,
    onProve: fn(),
    oktaOrigin: 'https://example.okta.com'
  },
  play: async ({
    args,
    canvas
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Ask Okta'
    }));
    await expect(args.onProve).toHaveBeenCalledWith(deducedMembership, activeUser.id);
  }
}`,...g.parameters?.docs?.source},description:{story:`No embed came back for this member, so the classification is a deduction and the
disclosure offers the one call that settles it.`,...g.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    onRemove: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    const remove = canvas.getByRole('button', {
      name: /^Remove .* from this group$/
    });
    await userEvent.click(remove);
    await expect(args.onRemove).toHaveBeenCalledWith(activeUser);
  }
}`,...f.parameters?.docs?.source},description:{story:"The remove control sits in the header beside the chevron, not inside the disclosure.\nOmitting `onRemove` renders no control at all rather than a permanently disabled one.",...f.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    const box = canvas.getByRole('checkbox', {
      name: /^Select /
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(args.onToggleSelect).toHaveBeenCalledWith(activeUser.id);
  }
}`,...b.parameters?.docs?.source},description:{story:`The checkbox the bulk editor's cohort is assembled with. It reports the
member by name, and unticked it reveals on hover or keyboard focus rather than
sitting in a dense list at rest.`,...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn(),
    selected: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('checkbox', {
      name: /^Select /
    })).toBeChecked();
  }
}`,...v.parameters?.docs?.source},description:{story:"Ticked. The checkbox is now drawn unconditionally — `REVEAL_ON_HOVER` exempts\nan active control, or a selection would vanish while scrolling — and the card\ntakes `ListRow`'s `selected` state.",...v.parameters?.docs?.description}}};const J=["Default","Suspended","Deprovisioned","LoginDiffersFromEmail","WithMfaFactors","NoMfaEnrolled","WithOktaOrigin","Expanded","TogglesFromTheChevronOnly","ExplainedByOkta","DeducedWithProofOnOffer","WithRemove","Selectable","Selected"];export{g as DeducedWithProofOnOffer,s as Default,i as Deprovisioned,m as Expanded,h as ExplainedByOkta,c as LoginDiffersFromEmail,l as NoMfaEnrolled,b as Selectable,v as Selected,n as Suspended,u as TogglesFromTheChevronOnly,d as WithMfaFactors,p as WithOktaOrigin,f as WithRemove,J as __namedExportsOrder,Y as default};
