import{ad as p}from"./iframe-tAvKsVeF.js";import{r as u}from"./redact-D38qASmd.js";import{s as c}from"./shapeInference-CxaCm6QT.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,userEvent:o,within:l}=__STORYBOOK_MODULE_TEST__,m="https://example.okta.com",r={id:"0oaFAKEAPP0000000001",status:"ACTIVE",label:"Expense Reports",_links:{self:{href:"https://example.okta.com/api/v1/apps/0oaFAKEAPP0000000001"}},_embedded:{users:[{id:"00uFAKEUSER000000001",status:"ACTIVE",profile:{email:"jane.doe@example.com",firstName:"Jane",lastName:"Doe",mobilePhone:"555-123-4567"}},{id:"00uFAKEUSER000000002",status:"ACTIVE",profile:{email:"john.smith@example.com",firstName:"John",lastName:"Smith"}}]}},{data:h,redactedCount:w}=u(r,m),y=c(r),v={title:"Shared/JsonViewer",component:p,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Response viewer for the API Explorer. Opens on the values-free Shape view rather than Redacted or Raw, so no redaction gap can leak into the first render. Raw carries an explicit warning strip since it is fully unredacted."}}},argTypes:{raw:{description:"Untouched response data."},redacted:{description:"`raw` with PII and Okta ids swapped for placeholders."},redactedCount:{description:"How many substitutions produced `redacted`."},shape:{description:"Pre-rendered, values-free type outline of `raw`."}},args:{raw:r,redacted:h,redactedCount:w,shape:y}},a={},n={args:{raw:{status:"ACTIVE",count:3},redacted:{status:"ACTIVE",count:3},redactedCount:0,shape:c({status:"ACTIVE",count:3})}},s={play:async({canvasElement:i})=>{const e=l(i),d=e.getByRole("tab",{name:/shape/i});await t(d).toHaveAttribute("aria-selected","true"),await t(e.queryByText(/fully unredacted/i)).not.toBeInTheDocument(),await o.click(e.getByRole("tab",{name:/redacted/i})),await t(e.getByRole("tab",{name:/redacted/i})).toHaveAttribute("aria-selected","true"),await t(e.queryByText(/fully unredacted/i)).not.toBeInTheDocument(),await o.click(e.getByRole("tab",{name:/raw/i})),await t(e.getByText(/fully unredacted/i)).toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Opens on the Shape view.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    raw: {
      status: 'ACTIVE',
      count: 3
    },
    redacted: {
      status: 'ACTIVE',
      count: 3
    },
    redactedCount: 0,
    shape: shapeOutline({
      status: 'ACTIVE',
      count: 3
    })
  }
}`,...n.parameters?.docs?.source},description:{story:"A response with nothing to redact — the Redacted tab shows no count badge.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const shapeTab = canvas.getByRole('tab', {
      name: /shape/i
    });
    await expect(shapeTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.queryByText(/fully unredacted/i)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', {
      name: /redacted/i
    }));
    await expect(canvas.getByRole('tab', {
      name: /redacted/i
    })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.queryByText(/fully unredacted/i)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', {
      name: /raw/i
    }));
    await expect(canvas.getByText(/fully unredacted/i)).toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"Walks Shape → Redacted → Raw, showing the warning strip that only Raw carries.",...s.parameters?.docs?.description}}};const R=["Default","NothingToRedact","SwitchingViews"];export{a as Default,n as NothingToRedact,s as SwitchingViews,R as __namedExportsOrder,v as default};
