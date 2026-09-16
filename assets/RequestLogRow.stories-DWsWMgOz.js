import{j as h,R as f}from"./iframe-tAvKsVeF.js";import{R as v}from"./RequestLogRow-Cwb1Pb6K.js";import"./preload-helper-PPVm8Dsz.js";import"./undoManager-UZfuKMLz.js";const{expect:a,fn:T,userEvent:x,within:s}=__STORYBOOK_MODULE_TEST__,q=Date.now()-300*1e3,g=(t={})=>({id:"req_log_1",timestamp:q,reason:"Load group members",requestCount:1,endpoints:[{method:"GET",endpoint:"/api/v1/groups/00gFAKE0000000000001/users"}],endpointsTruncated:!1,durationMs:120,outcome:"all",...t}),b=g(),y=g({id:"req_log_batch",reason:"Populate Groups page",requestCount:42,endpoints:[{method:"GET",endpoint:"/api/v1/groups?limit=200"},{method:"GET",endpoint:"/api/v1/groups?limit=200&after=00gFAKE0000000000042"},{method:"GET",endpoint:"/api/v1/groups/00gFAKE0000000000001/stats"}],endpointsTruncated:!1,durationMs:3400}),B=g({id:"req_log_truncated",reason:"Org inventory sync: Users",requestCount:200,endpoints:Array.from({length:20},(t,e)=>({method:"GET",endpoint:`/api/v1/users?limit=200&after=00uFAKE${String(e).padStart(13,"0")}`})),endpointsTruncated:!0,durationMs:45e3}),R=g({id:"req_log_failed",reason:"Load app assignments",requestCount:3,endpoints:[{method:"GET",endpoint:"/api/v1/apps/0oaFAKE0000000000001/users"}],outcome:"none"}),V=g({id:"req_log_partial",reason:"Bulk remove user from group",requestCount:5,endpoints:[{method:"DELETE",endpoint:"/api/v1/groups/00gFAKE0000000000001/users/<USER_ID>"}],outcome:"partial"}),C={title:"Sidepanel/RequestLogRow",component:v,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"One batch of Okta API requests that shared a `reason` — the row the History tab's **Verbose** mode adds beside the undo-action rows. A batch of one renders its endpoint inline; a larger batch collapses to `N requests — reason` behind the same `aria-expanded` disclosure `AuditLogRow` uses.\n\nEndpoints are redacted by `shared/utils/redact` before storage — this row redacts nothing itself."}}},decorators:[t=>h.jsx("div",{className:"bg-canvas p-4",children:h.jsx(t,{})})],args:{entry:b,isExpanded:!1,onToggle:T()},argTypes:{entry:{description:"The request-log entry this row is about."},isExpanded:{description:"Whether the disclosure is open. Owned by the list, so a refresh cannot close a row."},onToggle:{description:"Toggles this row's disclosure, by entry id."}}},o={args:{entry:b},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("Load group members")).toBeVisible(),await a(e.queryByRole("button")).toBeNull()}},r={args:{entry:y,isExpanded:!1},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("42 requests — Populate Groups page")).toBeVisible(),await a(e.getByRole("button",{expanded:!1})).toBeVisible()}},i={args:{entry:y,isExpanded:!0},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("/api/v1/groups?limit=200")).toBeVisible(),await a(e.getByText("/api/v1/groups?limit=200&after=00gFAKE0000000000042")).toBeVisible(),await a(e.getByText("/api/v1/groups/00gFAKE0000000000001/stats")).toBeVisible()}},c={args:{entry:B,isExpanded:!0},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("Showing 20 of 200 requests.")).toBeVisible()}},p={args:{entry:R,isExpanded:!1},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("Failed")).toBeVisible()}},d={args:{entry:V,isExpanded:!1},play:async({canvasElement:t})=>{const e=s(t);await a(e.getByText("Some failed")).toBeVisible()}},l={args:{entry:y},render:function(e){const[n,m]=f.useState(!1);return h.jsx(v,{...e,isExpanded:n,onToggle:w=>{e.onToggle(w),m(E=>!E)}})},play:async({args:t,canvasElement:e})=>{const n=s(e),m=n.getByRole("button",{name:"Show the 42 requests for Populate Groups page"});await a(m).toHaveAttribute("aria-expanded","false"),await x.click(m),await a(t.onToggle).toHaveBeenCalledWith("req_log_batch"),await a(n.getByRole("button",{expanded:!0})).toBeVisible(),await a(n.getByText("/api/v1/groups?limit=200")).toBeVisible(),await x.click(n.getByRole("button",{expanded:!0})),await a(n.getByRole("button",{expanded:!1})).toBeVisible()}},u={args:{entry:B},parameters:{viewport:{value:"sidepanelCompact"}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    entry: single
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Load group members')).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  }
}`,...o.parameters?.docs?.source},description:{story:"A single request: reason, its one endpoint as a badge, and no chevron.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    entry: batch,
    isExpanded: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('42 requests — Populate Groups page')).toBeVisible();
    await expect(canvas.getByRole('button', {
      expanded: false
    })).toBeVisible();
  }
}`,...r.parameters?.docs?.source},description:{story:"A collapsed batch — the count and reason on one line, closed by default.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    entry: batch,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    /*
      Exact strings, not \`/groups\\?limit=200/\`: the batch's second endpoint is the
      *next page* of the first (\`…&after=…\`), so a substring regex matches both
      spans and \`getByText\` throws on the ambiguity. Naming each one is also the
      better assertion — what an expanded batch owes the reader is its distinct
      endpoints, and a paginated pair is exactly the case where "distinct" earns
      its keep.
    */
    await expect(canvas.getByText('/api/v1/groups?limit=200')).toBeVisible();
    await expect(canvas.getByText('/api/v1/groups?limit=200&after=00gFAKE0000000000042')).toBeVisible();
    await expect(canvas.getByText('/api/v1/groups/00gFAKE0000000000001/stats')).toBeVisible();
  }
}`,...i.parameters?.docs?.source},description:{story:"An expanded batch: every distinct endpoint listed underneath.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    entry: truncatedBatch,
    isExpanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Showing 20 of 200 requests.')).toBeVisible();
  }
}`,...c.parameters?.docs?.source},description:{story:"A batch bigger than the endpoint sample the log keeps — the truncation note shows.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    entry: failedBatch,
    isExpanded: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Failed')).toBeVisible();
  }
}`,...p.parameters?.docs?.source},description:{story:"Every request in the batch failed — the `Failed` mark, not a silent success line.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    entry: partialBatch,
    isExpanded: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Some failed')).toBeVisible();
  }
}`,...d.parameters?.docs?.source},description:{story:"A mixed outcome — some of the batch's requests failed, some succeeded.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    entry: batch
  },
  render: function Disclosure(args) {
    const [expanded, setExpanded] = React.useState(false);
    return <RequestLogRow {...args} isExpanded={expanded} onToggle={id => {
      args.onToggle(id);
      setExpanded(open => !open);
    }} />;
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show the 42 requests for Populate Groups page'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith('req_log_batch');
    await expect(canvas.getByRole('button', {
      expanded: true
    })).toBeVisible();
    await expect(canvas.getByText('/api/v1/groups?limit=200')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      expanded: true
    }));
    await expect(canvas.getByRole('button', {
      expanded: false
    })).toBeVisible();
  }
}`,...l.parameters?.docs?.source},description:{story:"The disclosure driven from the chevron, against real expansion state.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    entry: truncatedBatch
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...u.parameters?.docs?.source},description:{story:"The 360px floor: the reason line truncates rather than pushing the chevron off.",...u.parameters?.docs?.description}}};const G=["SingleRequest","CollapsedBatch","ExpandedBatch","TruncatedEndpoints","AllFailed","PartiallyFailed","OpeningTheDisclosure","Compact"];export{p as AllFailed,r as CollapsedBatch,u as Compact,i as ExpandedBatch,l as OpeningTheDisclosure,d as PartiallyFailed,o as SingleRequest,c as TruncatedEndpoints,G as __namedExportsOrder,C as default};
