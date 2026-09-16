import y from"./ApiExplorerTab-CMlF6KRM.js";import{u as i,m as p}from"./useOktaApi.mock-bZSfZMMp.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./redact-D38qASmd.js";import"./shapeInference-CxaCm6QT.js";const{expect:u,fn:d,userEvent:o,waitFor:m,within:l}=__STORYBOOK_MODULE_TEST__,b={title:"ApiExplorer/ApiExplorerTab",component:y,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"A dev-tool surface for discovering what an Okta endpoint's response actually contains. It is GET-only and goes through the same scheduler path as every other feature, so it adds no write surface. The response viewer defaults to the values-free Shape view; Redacted and Raw are one click away."}}},argTypes:{targetTabId:{description:"Chrome tab id of the connected Okta tab; sending is disabled when null."},oktaOrigin:{description:"Okta org origin, used to redact it out of embedded response URLs."}},args:{targetTabId:1,oktaOrigin:"https://example.okta.com"},beforeEach:()=>{i.mockReturnValue(p())}},t={},a={beforeEach:()=>{i.mockReturnValue(p({makeApiRequest:d(async()=>({success:!0,status:200,data:{id:"00uFAKE000000000001",status:"ACTIVE",profile:{login:"ada@example.com"}}}))}))},play:async({canvasElement:r})=>{const e=l(r),c=e.getByRole("textbox",{name:"API path"});await o.type(c,"/api/v1/users/00uFAKE000000000001"),await o.click(e.getByRole("button",{name:"Send"})),await m(()=>u(e.getByText("200")).toBeInTheDocument())}},n={beforeEach:()=>{i.mockReturnValue(p({makeApiRequest:d(async()=>({success:!1,error:"Endpoint not found"}))}))},play:async({canvasElement:r})=>{const e=l(r),c=e.getByRole("textbox",{name:"API path"});await o.type(c,"/api/v1/nope"),await o.click(e.getByRole("button",{name:"Send"})),await m(()=>u(e.getByText("Endpoint not found")).toBeInTheDocument())}},s={args:{targetTabId:null}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"No request sent yet — the empty state names the affordance.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      makeApiRequest: fn(async () => ({
        success: true,
        status: 200,
        data: {
          id: '00uFAKE000000000001',
          status: 'ACTIVE',
          profile: {
            login: 'ada@example.com'
          }
        }
      }))
    }));
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', {
      name: 'API path'
    });
    await userEvent.type(input, '/api/v1/users/00uFAKE000000000001');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Send'
    }));
    await waitFor(() => expect(canvas.getByText('200')).toBeInTheDocument());
  }
}`,...a.parameters?.docs?.source},description:{story:"A GET fired and answered — the Shape view over a populated response.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      makeApiRequest: fn(async () => ({
        success: false,
        error: 'Endpoint not found'
      }))
    }));
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', {
      name: 'API path'
    });
    await userEvent.type(input, '/api/v1/nope');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Send'
    }));
    await waitFor(() => expect(canvas.getByText('Endpoint not found')).toBeInTheDocument());
  }
}`,...n.parameters?.docs?.source},description:{story:"The request failed — a dismissible `danger` banner above the untouched empty state.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  }
}`,...s.parameters?.docs?.source},description:{story:"No Okta tab connected — Send stays disabled regardless of path.",...s.parameters?.docs?.description}}};const w=["Default","Sent","ErrorState","Disconnected"];export{t as Default,s as Disconnected,n as ErrorState,a as Sent,w as __namedExportsOrder,b as default};
