import{j as p,r as g}from"./iframe-tAvKsVeF.js";import{M as l}from"./GroupMembershipsListProof-DQATbCdY.js";import"./preload-helper-PPVm8Dsz.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";import"./provenance-C1K7H2p2.js";const{expect:n,fn:v,userEvent:w,within:d}=__STORYBOOK_MODULE_TEST__,u={group:{id:"00gFAKE00000000000001",type:"OKTA_GROUP",profile:{name:"Engineering Staff",description:"All engineering employees"}},membershipType:"DIRECT",attribution:"inferred",rules:[]},h={...u,provenance:{source:"okta",rules:[{id:"0prFAKErule00001",name:"Auto-add Engineers"}]}},b={...u,provenance:{source:"okta",rules:[]}},E={title:"Users/MembershipProofAction",component:l,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`One explicit request that converts a deduced membership line into Okta’s own answer. It is a button and never an effect: the read costs one call per membership, so it is offered inside a row a reader has already opened.

The three outcomes stay three. Okta naming rules and Okta naming none are both answers; Okta saying nothing — a failed request, an absent embed — renders as no answer at all and leaves the classifier’s deduced line standing, because collapsing the last two would manufacture “added directly” out of a failure.`}}},argTypes:{membership:{description:"The membership this row is about, as the classifier produced it."},outcome:{description:"Where this row has got to, or undefined before anyone asked."},onProve:{description:"Asks Okta about this membership."}},args:{membership:u,outcome:void 0,onProve:v()}},a={},s={args:{outcome:{status:"pending"}}},o={args:{outcome:{status:"proven",membership:h}},play:async({canvasElement:t})=>{const e=d(t);await n(e.getByText(/Okta confirms: added by rule/)).toBeInTheDocument(),await n(e.queryByRole("button",{name:"Ask Okta"})).toBeNull()}},r={args:{outcome:{status:"proven",membership:b}},play:async({canvasElement:t})=>{const e=d(t);await n(e.getByText("Okta confirms: added directly")).toBeInTheDocument()}},i={args:{outcome:{status:"unanswered"}},play:async({canvasElement:t})=>{const e=d(t);await n(e.getByText(/still stands as a deduction/)).toBeInTheDocument(),await n(e.getByRole("button",{name:"Ask Okta"})).toBeInTheDocument()}},c={render:t=>{const e=()=>{const[y,m]=g.useState(void 0);return p.jsx(l,{...t,outcome:y,onProve:()=>{m({status:"pending"}),setTimeout(()=>m({status:"proven",membership:h}),150)}})};return p.jsx(e,{})},play:async({canvasElement:t})=>{const e=d(t);await w.click(e.getByRole("button",{name:"Ask Okta"})),await n(await e.findByText(/Okta confirms: added by rule/)).toBeInTheDocument(),await n(e.queryByRole("button",{name:"Ask Okta"})).toBeNull()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Nobody has asked yet: the action alone, with its cost stated in the tooltip.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    outcome: {
      status: 'pending'
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"The request is in flight — the button carries its own spinner.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    outcome: {
      status: 'proven',
      membership: provenByRule
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Okta confirms: added by rule/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Ask Okta'
    })).toBeNull();
  }
}`,...o.parameters?.docs?.source},description:{story:"Okta named the rule that manages this membership, so the answer replaces the action.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    outcome: {
      status: 'proven',
      membership: provenManual
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Okta confirms: added directly')).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"Okta naming no rule is an answer too: an authoritative manual add.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    outcome: {
      status: 'unanswered'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/still stands as a deduction/)).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Ask Okta'
    })).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Okta said nothing: the action stays, and the deduced line above it still stands.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [outcome, setOutcome] = useState<MembershipProofOutcome | undefined>(undefined);
      return <MembershipProofAction {...args} outcome={outcome} onProve={() => {
        setOutcome({
          status: 'pending'
        });
        setTimeout(() => setOutcome({
          status: 'proven',
          membership: provenByRule
        }), 150);
      }} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Ask Okta'
    }));
    await expect(await canvas.findByText(/Okta confirms: added by rule/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Ask Okta'
    })).toBeNull();
  }
}`,...c.parameters?.docs?.source},description:{story:`The whole request wired to real state: pressing the button puts the row in
flight, and Okta's answer replaces the action when it lands.`,...c.parameters?.docs?.description}}};const R=["Unasked","Pending","ProvenByRule","ProvenManualAdd","Unanswered","AskingOkta"];export{c as AskingOkta,s as Pending,o as ProvenByRule,r as ProvenManualAdd,i as Unanswered,a as Unasked,R as __namedExportsOrder,E as default};
