import{R as S}from"./ReportsCard-CVKHGrTS.js";import{c as T,R}from"./homeReports-5OcK7tHC.js";import{C as I,A as D}from"./ruleOrphans-DKT5VstI.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./EntityChooser-DY08NxvZ.js";import"./FigureNumber-CF_a3j6L.js";import"./MfaCoverageLauncher-OS434kER.js";import"./ReportRow-DXUM0Iey.js";import"./orgFigures-Cf-XQIgx.js";import"./types-aoYpQiYS.js";const{expect:t,fn:E,userEvent:r,within:s}=__STORYBOOK_MODULE_TEST__,F=Date.now(),n=(a={})=>({isReading:!1,complete:!0,lastFullWalkAt:F-1200*1e3,count:214,error:null,...a}),C=[{id:"00gFAKE01",name:"AWS Sandbox 2019",detail:"0 members"},{id:"00gFAKE11",name:"Salesforce Users",detail:"412 members"},{id:"00gFAKE21",name:"Engineering – All",detail:"1,204 members"}],k=[{id:"00gFAKE01",name:"AWS Sandbox 2019",detail:"No members · no rule fills it · no app assigned"},{id:"00gFAKE02",name:"Contractors – Q3 pilot",detail:"No members · no rule fills it · no app assigned"},{id:"00gFAKE03",name:"Marketing Interns",detail:"No members · no rule fills it · no app assigned"}],f=[{id:"00gFAKE11",name:"Salesforce Users",detail:"412 members · Salesforce"},{id:"00gFAKE12",name:"Engineering Tools",detail:"88 members · Slack, GitHub"}],c=(a,e,o,A,w={cleanup:k,access:f})=>{const v={source:a,noun:"groups"},B={source:e,noun:"group rules"},x={source:o,noun:"applications"},b={source:A,noun:"app group assignments"};return[T({key:"group-cleanup",label:"Empty groups nothing fills",counted:v,gates:[B,b],findings:w.cleanup,caveat:I}),T({key:"unmaintained-app-access",label:"App access no rule maintains",counted:v,floors:[b,x],gates:[B],findings:w.access,caveat:D})]},P={title:"Home/ReportsCard",component:S,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`The questions on Home whose answer is a list of names rather than a number. A report opens in place — the groups it names are the whole answer — and both reports are joins over rows the org snapshot already holds, so opening one costs nothing.

A report that cannot state a number names nobody, because its join ran over rows known to be incomplete; a report with zero findings is the opposite, and reads as a real answer. The caveat sits inside every opened row, above the names.`}}},argTypes:{reports:{description:"The report rows, in display order."},onOpenGroup:{description:"Open one of the named groups on the Groups tab."},groupChoices:{description:"The MFA launcher's chooser rows, from the org snapshot."},groupChoicesStatus:{description:"Read state of the collection behind those choices."},onScanGroupMfa:{description:"Open a group's Insights pane with the scan armed, un-run."}},args:{onOpenGroup:E(),groupChoices:C,groupChoicesStatus:"ok",onScanGroupMfa:E(),reports:c(n(),n({count:61}),n({count:38}),n({count:90}))}},i={play:async({canvasElement:a})=>{const e=s(a);await t(e.getByRole("button",{expanded:!1,name:/Empty groups/})).toBeInTheDocument(),await t(e.queryByText(/not a delete list/)).not.toBeInTheDocument(),await t(e.queryByText("AWS Sandbox 2019")).not.toBeInTheDocument()}},p={play:async({canvasElement:a,args:e})=>{const o=s(a);await r.click(o.getByRole("button",{name:/Empty groups/})),await t(o.getByText(/not a delete list/)).toBeInTheDocument(),await r.click(o.getByRole("button",{description:"AWS Sandbox 2019"})),await t(e.onOpenGroup).toHaveBeenCalledWith("00gFAKE01")}},l={args:{reports:c(n(),n({count:61}),n({count:38}),n({count:90}),{cleanup:Array.from({length:R+112},(a,e)=>({id:`00gFAKE${e}`,name:`Retired project ${e}`,detail:"No members · no rule fills it · no app assigned"})),access:f})},play:async({canvasElement:a})=>{const e=s(a);await r.click(e.getByRole("button",{name:/Empty groups/})),await t(e.getByText(/Showing the first 25 of 137\./)).toBeInTheDocument()}},u={args:{reports:c(n(),n({count:61}),n({count:38}),n({count:90}),{cleanup:[],access:[]})},play:async({canvasElement:a})=>{const e=s(a);await t(e.queryByRole("button",{name:/Empty groups/})).not.toBeInTheDocument(),await t(e.queryByRole("button",{name:/App access/})).not.toBeInTheDocument(),await t(e.getAllByText("0")).toHaveLength(2)}},d={args:{reports:c(n({isReading:!0}),n(),n(),n())}},m={args:{reports:c(n(),n({complete:!1,lastFullWalkAt:null,count:0}),n({count:38}),n({count:90}))},play:async({canvasElement:a})=>{const e=s(a);await t(e.queryByRole("button",{name:/Empty groups/})).not.toBeInTheDocument(),await t(e.queryByRole("button",{name:/App access/})).not.toBeInTheDocument(),await t(e.queryByText("AWS Sandbox 2019")).not.toBeInTheDocument(),await t(e.getAllByText("Needs group rules, which have not been read.")).toHaveLength(2)}},g={args:{reports:c(n(),n({count:61}),n({count:38}),n({count:12,complete:!1}))},play:async({canvasElement:a})=>{const e=s(a);await t(e.getByText("At least — the last read of app group assignments did not finish.")).toBeInTheDocument(),await r.click(e.getByRole("button",{name:/App access/})),await t(e.getByText("Salesforce Users")).toBeInTheDocument()}},h={play:async({canvasElement:a,args:e})=>{const o=s(a);await r.click(o.getByRole("button",{name:/MFA coverage/})),await t(o.getByText(/not free/)).toBeInTheDocument(),await r.type(o.getByRole("searchbox",{name:"Filter groups"}),"sales"),await t(o.queryByText("AWS Sandbox 2019")).not.toBeInTheDocument(),await r.click(o.getByRole("button",{description:"Salesforce Users"})),await t(e.onScanGroupMfa).toHaveBeenCalledWith("00gFAKE11")}},y={args:{groupChoices:[],groupChoicesStatus:"unavailable"},play:async({canvasElement:a})=>{const e=s(a);await t(e.queryByRole("button",{name:/MFA coverage/})).not.toBeInTheDocument(),await t(e.getByText(/Groups have not been read yet/)).toBeInTheDocument()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      expanded: false,
      name: /Empty groups/
    })).toBeInTheDocument();
    // Closed means closed: the caveat and the names are not merely hidden.
    await expect(canvas.queryByText(/not a delete list/)).not.toBeInTheDocument();
    await expect(canvas.queryByText('AWS Sandbox 2019')).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"A warm org, both reports closed. Nothing here has cost a request.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Empty groups/
    }));
    await expect(canvas.getByText(/not a delete list/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      description: 'AWS Sandbox 2019'
    }));
    await expect(args.onOpenGroup).toHaveBeenCalledWith('00gFAKE01');
  }
}`,...p.parameters?.docs?.source},description:{story:"Opened: the caveat first, then the names, each one a way into that group.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    reports: reports(read(), read({
      count: 61
    }), read({
      count: 38
    }), read({
      count: 90
    }), {
      cleanup: Array.from({
        length: REPORT_PREVIEW_LIMIT + 112
      }, (_, i) => ({
        id: \`00gFAKE\${i}\`,
        name: \`Retired project \${i}\`,
        detail: 'No members · no rule fills it · no app assigned'
      })),
      access: ACCESS
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Empty groups/
    }));
    await expect(canvas.getByText(/Showing the first 25 of 137\\./)).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"A capped preview: the row says how many it is showing, not just the first page.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    reports: reports(read(), read({
      count: 61
    }), read({
      count: 38
    }), read({
      count: 90
    }), {
      cleanup: [],
      access: []
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Scoped to the two report rows by name: the MFA launcher below them is a
    // third row that legitimately still opens — it scopes a question rather than
    // reporting an answer, so having found nothing does not apply to it.
    await expect(canvas.queryByRole('button', {
      name: /Empty groups/
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /App access/
    })).not.toBeInTheDocument();
    await expect(canvas.getAllByText('0')).toHaveLength(2);
  }
}`,...u.parameters?.docs?.source},description:{story:"Nothing found — a real answer, so a plain row rather than a control that opens on emptiness.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    reports: reports(read({
      isReading: true
    }), read(), read(), read())
  }
}`,...d.parameters?.docs?.source},description:{story:"The first read is still in flight: a skeleton per row, never a zero.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    reports: reports(read(), read({
      complete: false,
      lastFullWalkAt: null,
      count: 0
    }), read({
      count: 38
    }), read({
      count: 90
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Absence is the assertion, and it is one of the few things a Tailwind-less
    // headless story genuinely proves.
    await expect(canvas.queryByRole('button', {
      name: /Empty groups/
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /App access/
    })).not.toBeInTheDocument();
    await expect(canvas.queryByText('AWS Sandbox 2019')).not.toBeInTheDocument();
    await expect(canvas.getAllByText('Needs group rules, which have not been read.')).toHaveLength(2);
  }
}`,...m.parameters?.docs?.source},description:{story:"Rules were never walked: both reports refuse a number, and neither lists a single name.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    reports: reports(read(), read({
      count: 61
    }), read({
      count: 38
    }), read({
      count: 12,
      complete: false
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('At least — the last read of app group assignments did not finish.')).toBeInTheDocument();
    // Still a control, because a floor is still an answer.
    await userEvent.click(canvas.getByRole('button', {
      name: /App access/
    }));
    await expect(canvas.getByText('Salesforce Users')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:'The assignment walk was interrupted: the row says "at least" and still names what it found.',...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /MFA coverage/
    }));
    await expect(canvas.getByText(/not free/)).toBeInTheDocument();
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Filter groups'
    }), 'sales');
    // Filtering is local and exact: the two groups that do not match are gone.
    await expect(canvas.queryByText('AWS Sandbox 2019')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      description: 'Salesforce Users'
    }));
    await expect(args.onScanGroupMfa).toHaveBeenCalledWith('00gFAKE11');
  }
}`,...h.parameters?.docs?.source},description:{story:"The one row that is not free: pick a group, and the scan is armed on that group's page.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    groupChoices: [],
    groupChoicesStatus: 'unavailable' as const
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: /MFA coverage/
    })).not.toBeInTheDocument();
    await expect(canvas.getByText(/Groups have not been read yet/)).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"Groups were never read: the launcher is inert rather than a chooser over zero rows.",...y.parameters?.docs?.description}}};const j=["Warm","Opened","Capped","NothingFound","Reading","GateNeverRead","FloorFellShort","MfaLauncherOpened","MfaLauncherUnavailable"];export{l as Capped,g as FloorFellShort,m as GateNeverRead,h as MfaLauncherOpened,y as MfaLauncherUnavailable,u as NothingFound,p as Opened,d as Reading,i as Warm,j as __namedExportsOrder,P as default};
