import{G as b}from"./GroupMfaCoverageSection-DrD-hGWG.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./MfaScanButton-B10gRaS5.js";import"./chartPalette-Byit8206.js";import"./memberAnalytics-BqndU7JT.js";import"./useMemberMfaScan-BWVC8bU_.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";const{expect:n,fn:d,userEvent:f,within:u}=__STORYBOOK_MODULE_TEST__,g=Array.from({length:12},(t,e)=>({id:`user${e+1}`,status:"ACTIVE",profile:{login:`user${e+1}@example.com`,email:`user${e+1}@example.com`,firstName:`First${e+1}`,lastName:`Last${e+1}`}})),h=(t,e)=>({userId:t,factors:[],enrolled:e.length>0,factorCount:e.length,factorLabels:e}),y=new Map(g.map((t,e)=>[t.id,h(t.id,e%4===0?[]:e%4===1?["Okta Verify"]:e%4===2?["SMS"]:["Okta Verify","SMS"])])),S=new Map(g.slice(0,5).map((t,e)=>[t.id,h(t.id,e===0?[]:["Okta Verify"])])),v=new Map(g.map(t=>[t.id,h(t.id,[])])),F={title:"Groups/GroupMfaCoverageSection",component:b,tags:["autodocs"],parameters:{docs:{description:{component:"The gated, opt-in MFA-coverage scan for the group's Insights tab. It never auto-runs: it costs one API call per member, and above `MFA_AUTO_THRESHOLD` (500) members a confirmation `Modal` stands between the trigger and the scan.\n\nEvery figure is over the members the scan actually reached, not the roster — a partial scan says so on the card rather than reporting an unreached member as uncovered."}}},argTypes:{members:{description:"The group roster — the scan reads exactly these members."},mfaResults:{description:"Per-member MFA scan results, or `null` before a scan has run."},scanStatus:{description:"Current MFA scan lifecycle status."},onFilterMembers:{description:"Applies one bucket or factor type as a member filter and moves to the Members tab. Omit and the rows render inert rather than promising a destination."}},args:{members:g,mfaResults:null,scanStatus:"idle",onRunScan:d(),onRequestConfirm:d(),onCancelConfirm:d(),onFilterMembers:d()}},a={},r={args:{scanStatus:"confirming"}},s={args:{scanStatus:"scanning"}},o={args:{scanStatus:"complete",mfaResults:y}},c={args:{scanStatus:"complete",mfaResults:S},play:async({canvasElement:t})=>{const e=u(t);n(e.getByText("Scanned 5 of 12 members.")).toBeInTheDocument(),n(e.getByText("5 of 12 scanned")).toBeInTheDocument()}},i={args:{scanStatus:"complete",mfaResults:v},play:async({canvasElement:t})=>{const e=u(t);n(e.getByText("12 with no factor")).toBeInTheDocument(),n(e.getByText(/No scanned member holds an active factor/)).toBeInTheDocument()}},m={args:{scanStatus:"error"}},l={args:{scanStatus:"complete",mfaResults:y},play:async({canvasElement:t})=>{const e=u(t);await f.click(e.getByRole("button",{name:"Show the bucket breakdown for MFA enrollment"})),n(e.getByRole("button",{name:/Open Members filtered by No factors enrolled/})).toBeInTheDocument(),n(e.getByRole("button",{name:/Open Members filtered by One factor/})).toBeInTheDocument()}},p={args:{scanStatus:"complete",mfaResults:y,onFilterMembers:void 0},play:async({canvasElement:t})=>{const e=u(t);await f.click(e.getByRole("button",{name:"Show the bucket breakdown for MFA enrollment"})),n(e.getByText("No factors enrolled")).toBeInTheDocument(),n(e.queryByRole("button",{name:/Open Members filtered by/})).toBeNull()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Before any scan — the primary trigger, and no cards claiming a coverage of zero.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'confirming'
  }
}`,...r.parameters?.docs?.source},description:{story:"A large-group scan gated behind confirmation.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'scanning'
  }
}`,...s.parameters?.docs?.source},description:{story:"A scan in progress. Cards wait for it to finish rather than restating partial figures.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'complete',
    mfaResults
  }
}`,...o.parameters?.docs?.source},description:{story:"Scan complete — the enrollment partition and the factor tally, both collapsed.",...o.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'complete',
    mfaResults: partialResults
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Scanned 5 of 12 members.')).toBeInTheDocument();
    expect(canvas.getByText('5 of 12 scanned')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"The scan reached 5 of 12 members, and the badge says so rather than leaving it to be inferred.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'complete',
    mfaResults: noFactorResults
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('12 with no factor')).toBeInTheDocument();
    expect(canvas.getByText(/No scanned member holds an active factor/)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Everybody was scanned and nobody holds a factor — an empty tally stated as a finding.",...i.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'error'
  }
}`,...m.parameters?.docs?.source},description:{story:"The scan failed — an alert plus a retry via the same trigger.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'complete',
    mfaResults
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show the bucket breakdown for MFA enrollment'
    }));
    expect(canvas.getByRole('button', {
      name: /Open Members filtered by No factors enrolled/
    })).toBeInTheDocument();
    expect(canvas.getByRole('button', {
      name: /Open Members filtered by One factor/
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Opening the enrollment card names all three buckets, empty ones included.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'complete',
    mfaResults,
    onFilterMembers: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show the bucket breakdown for MFA enrollment'
    }));
    expect(canvas.getByText('No factors enrolled')).toBeInTheDocument();
    expect(canvas.queryByRole('button', {
      name: /Open Members filtered by/
    })).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"With nothing wired to honour a jump, the rows render as text rather than controls.",...p.parameters?.docs?.description}}};const D=["Idle","Confirming","Scanning","Complete","PartialScan","NoFactorTypes","ErrorState","EnrollmentExpanded","RowsInertWhenUnwired"];export{o as Complete,r as Confirming,l as EnrollmentExpanded,m as ErrorState,a as Idle,i as NoFactorTypes,c as PartialScan,p as RowsInertWhenUnwired,s as Scanning,D as __namedExportsOrder,F as default};
