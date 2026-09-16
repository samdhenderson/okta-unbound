import{P as S}from"./ProfileSaveModal-DPRDDHF5.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./BlastRadiusReport-CB4UeF5q.js";import"./BlastRadiusGroupRow-CIRbFLni.js";import"./BlastRadiusCascade-CI6z_iR3.js";import"./membershipVerdict-79Na81vF.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";import"./BlastRadiusRuleRow-BGBdlvGL.js";import"./ruleUtils-Vt2BA8lQ.js";const{expect:a,fn:B,userEvent:w,within:t}=__STORYBOOK_MODULE_TEST__,b="0prFAKErule00001",v="0prFAKErule00002",s=(n={})=>({name:"department",label:"Department",beforeDisplay:"Engineering",afterDisplay:"Sales",afterRaw:"Sales",changesSignIn:!1,...n}),x=[s()],T=[s(),s({name:"title",label:"Title",beforeDisplay:"Staff Engineer, Platform Infrastructure",afterDisplay:"Sales Engineer, Enterprise",afterRaw:"Sales Engineer, Enterprise"}),s({name:"costCenter",label:"Cost center",beforeDisplay:"",afterDisplay:"CC-2140",afterRaw:"CC-2140"}),s({name:"managerId",label:"Manager ID",beforeDisplay:"00uFAKE0000000000001",afterDisplay:"",afterRaw:""})],E=[s({name:"login",label:"Login",beforeDisplay:"ada@example.com",afterDisplay:"a.lovelace@example.com",afterRaw:"a.lovelace@example.com",changesSignIn:!0}),s()],I=[{groupId:"00gFAKE00000000000001",groupName:"Sales-All",kind:"added",ruleId:b,ruleName:"Sales auto-add",contributingRuleIds:[b],currentlyHeld:!1},{groupId:"00gFAKE00000000000002",groupName:"Engineering-All",kind:"removed",ruleId:v,ruleName:"Eng auto-add",contributingRuleIds:[v],currentlyHeld:!0,currentBucket:"rule"},{groupId:"00gFAKE00000000000003",groupName:"Contractors",kind:"not-predicted",contributingRuleIds:[v],withheldReason:"membership-not-credited-to-rule",currentlyHeld:!0,currentBucket:"direct"}],D=[{ruleId:b,ruleName:"Sales auto-add",expression:'user.department == "Sales"',transition:"starts-matching",targetGroupIds:["00gFAKE00000000000001"],targetGroupNames:["Sales-All"],touchedAttributes:["department"],active:!0},{ruleId:v,ruleName:"Eng auto-add",expression:'user.department == "Engineering"',transition:"stops-matching",targetGroupIds:["00gFAKE00000000000002"],targetGroupNames:["Engineering-All"],touchedAttributes:["department"],active:!0},{ruleId:"0prFAKErule00003",ruleName:"Everyone",expression:'user.status == "ACTIVE"',transition:"unchanged-match",targetGroupIds:["00gFAKE00000000000005"],targetGroupNames:["Everyone"],touchedAttributes:[],active:!0}],A=n=>({status:n,groups:[],rules:[],counts:{added:0,removed:0,notPredicted:0,starts:0,stops:0,undetermined:0},cascades:[]}),f={status:"computed",groups:I,rules:D,counts:{added:1,removed:1,notPredicted:1,starts:1,stops:1,undetermined:0},cascades:[]},M={title:"Users/ProfileSaveModal",component:S,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The last thing between an admin’s profile edits and a live write to Okta. It restates rather than summarises: every changed attribute is listed with both sides, and the two states a form cannot show get words instead of blanks — an unset prior value reads `— not set`, an emptied new value reads `— cleared`. A `login` change raises its own `danger` alert in addition to the overwrite warning, because that consequence lands on someone who is not in the room.\n\nThe blast-radius analysis is opt-in and offered once: the draft cannot change while the modal is open, so the button is replaced by its answer rather than becoming a re-run. This component is presentational — `report`, `onAnalyze` and `isAnalyzing` all arrive as props."}}},args:{changes:x,userName:"Ada Lovelace",onCancel:B(),onConfirm:B(),isSaving:!1,report:A("not-computed"),onAnalyze:B(),isAnalyzing:!1},argTypes:{changes:{description:"The changes awaiting confirmation; non-null opens the modal."},userName:{description:"Whose profile this is, for the warning sentence. **PII.**"},onCancel:{description:"Dismiss without writing. Also fires on Escape and overlay click."},onConfirm:{description:"Perform the write."},isSaving:{description:"Loads the confirm button and locks Cancel while the write is in flight."},report:{description:"The blast-radius report; `not-computed` renders nothing at all."},onAnalyze:{description:"Run the analysis. Pure, synchronous, and costs no API calls."},isAnalyzing:{description:"Loads the Analyze button while the engine runs."},error:{description:"A previous failed attempt, kept on screen so the admin can retry."}}},o={play:async({canvasElement:n})=>{const e=t(n);await a(e.getByRole("dialog",{name:"Save profile changes?"})).toBeInTheDocument(),await a(e.getByText(/1 attribute on Ada Lovelace will be overwritten/i)).toBeInTheDocument(),await a(e.getByText("Engineering")).toBeInTheDocument(),await a(e.getByText("Sales")).toBeInTheDocument(),await a(e.getByRole("button",{name:"Analyze blast radius"})).toBeEnabled(),await a(e.queryByRole("button",{name:/^Groups/})).toBeNull()}},r={args:{changes:T},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByText(/4 attributes on Ada Lovelace will be overwritten/i)).toBeInTheDocument(),await a(e.getByText("— not set")).toBeInTheDocument(),await a(e.getByText("— cleared")).toBeInTheDocument(),await a(e.getByText("Staff Engineer, Platform Infrastructure")).toBeInTheDocument()}},i={args:{changes:E},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByText(/This changes how Ada Lovelace signs in/i)).toBeInTheDocument(),await a(e.getByText("Sign-in")).toBeInTheDocument(),await a(e.getByText(/2 attributes on Ada Lovelace will be overwritten/i)).toBeInTheDocument()}},c={args:{isAnalyzing:!0},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByRole("button",{name:"Analyze blast radius"})).toBeDisabled()}},l={play:async({canvasElement:n,args:e})=>{const y=t(n);await w.click(y.getByRole("button",{name:"Analyze blast radius"})),await a(e.onAnalyze).toHaveBeenCalledTimes(1),await w.click(y.getByRole("button",{name:"Save changes"})),await a(e.onConfirm).toHaveBeenCalledTimes(1),await a(e.onCancel).not.toHaveBeenCalled()}},d={play:async({canvasElement:n,args:e})=>{const y=t(n);await w.click(y.getByRole("button",{name:"Cancel"})),await a(e.onCancel).toHaveBeenCalledTimes(1),await a(e.onConfirm).not.toHaveBeenCalled()}},u={args:{changes:T,report:f},play:async({canvasElement:n})=>{const e=t(n);await a(e.queryByRole("button",{name:"Analyze blast radius"})).toBeNull(),await a(e.getByRole("heading",{name:"Added"})).toBeInTheDocument(),await a(e.getByRole("heading",{name:"Removed"})).toBeInTheDocument(),await a(e.getByText("Sales-All")).toBeInTheDocument(),await w.click(e.getByRole("button",{name:"Rules 2"})),await a(e.getByRole("heading",{name:"Starts matching"})).toBeInTheDocument()}},p={args:{report:A("unavailable")},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByText(/not the same as predicting no change/i)).toBeInTheDocument(),await a(e.getByRole("button",{name:"Save changes"})).toBeEnabled()}},m={args:{changes:E,error:"Okta rejected the update: that login is already in use."},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByText(/that login is already in use/i)).toBeInTheDocument(),await a(e.getByRole("button",{name:"Save changes"})).toBeEnabled()}},g={args:{isSaving:!0},play:async({canvasElement:n})=>{const e=t(n);await a(e.getByRole("button",{name:"Save changes"})).toBeDisabled(),await a(e.getByRole("button",{name:"Cancel"})).toBeDisabled()}},h={args:{changes:T,report:f},parameters:{viewport:{value:"sidepanelCompact"}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', {
      name: 'Save profile changes?'
    })).toBeInTheDocument();
    await expect(canvas.getByText(/1 attribute on Ada Lovelace will be overwritten/i)).toBeInTheDocument();
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.getByText('Sales')).toBeInTheDocument();

    // Nothing is claimed before anybody asks.
    await expect(canvas.getByRole('button', {
      name: 'Analyze blast radius'
    })).toBeEnabled();
    await expect(canvas.queryByRole('button', {
      name: /^Groups/
    })).toBeNull();
  }
}`,...o.parameters?.docs?.source},description:{story:"One attribute moving, with the analysis not yet asked for.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    changes: SEVERAL_CHANGES
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/4 attributes on Ada Lovelace will be overwritten/i)).toBeInTheDocument();
    await expect(canvas.getByText('— not set')).toBeInTheDocument();
    await expect(canvas.getByText('— cleared')).toBeInTheDocument();
    // The long title wraps rather than truncating; both sides stay readable.
    await expect(canvas.getByText('Staff Engineer, Platform Infrastructure')).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"A four-attribute edit, including an attribute with no prior value and one being emptied.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    changes: LOGIN_CHANGE
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/This changes how Ada Lovelace signs in/i)).toBeInTheDocument();
    await expect(canvas.getByText('Sign-in')).toBeInTheDocument();
    // Additional to, never instead of, the ordinary overwrite warning.
    await expect(canvas.getByText(/2 attributes on Ada Lovelace will be overwritten/i)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"The login is changing: a second, louder warning, and the row itself is marked.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    isAnalyzing: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Analyze blast radius'
    })).toBeDisabled();
  }
}`,...c.parameters?.docs?.source},description:{story:"The engine is running. The button holds its place rather than vanishing mid-answer.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Analyze blast radius'
    }));
    await expect(args.onAnalyze).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Save changes'
    }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onCancel).not.toHaveBeenCalled();
  }
}`,...l.parameters?.docs?.source},description:{story:"Asking for the analysis, and confirming the write, each reach their handler once.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  }
}`,...d.parameters?.docs?.source},description:{story:"Cancel dismisses without writing.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    changes: SEVERAL_CHANGES,
    report: COMPUTED
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Analyze blast radius'
    })).toBeNull();
    await expect(canvas.getByRole('heading', {
      name: 'Added'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', {
      name: 'Removed'
    })).toBeInTheDocument();
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();

    // The cause is one pill away, and nothing recomputes on the switch.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Rules 2'
    }));
    await expect(canvas.getByRole('heading', {
      name: 'Starts matching'
    })).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"The answer arrived, and the Analyze button is gone: the draft is frozen while this is open.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    report: EMPTY('unavailable')
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/not the same as predicting no change/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Save changes'
    })).toBeEnabled();
  }
}`,...p.parameters?.docs?.source},description:{story:'No prediction is possible: a finding, not a quiet "no changes", and the save still stands.',...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    changes: LOGIN_CHANGE,
    error: 'Okta rejected the update: that login is already in use.'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/that login is already in use/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Save changes'
    })).toBeEnabled();
  }
}`,...m.parameters?.docs?.source},description:{story:"The write failed. The dialog stays open with its changes intact so the admin can retry.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    isSaving: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Save changes'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Cancel'
    })).toBeDisabled();
  }
}`,...g.parameters?.docs?.source},description:{story:"The write is in flight. Both footer controls lock, so the request cannot be doubled.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    changes: SEVERAL_CHANGES,
    report: COMPUTED
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"The 360px floor: the `before → after` line wraps instead of truncating.",...h.parameters?.docs?.description}}};const U=["Default","SeveralChanges","SignInChange","Analyzing","AnalyzeThenSave","CancelMakesNoWrite","Analyzed","AnalysisUnavailable","SaveError","Saving","Compact"];export{p as AnalysisUnavailable,l as AnalyzeThenSave,u as Analyzed,c as Analyzing,d as CancelMakesNoWrite,h as Compact,o as Default,m as SaveError,g as Saving,r as SeveralChanges,i as SignInChange,U as __namedExportsOrder,M as default};
