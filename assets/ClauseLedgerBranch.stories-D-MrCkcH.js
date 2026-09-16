import{j as t,a9 as l,Q as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{fn:p}=__STORYBOOK_MODULE_TEST__,C={title:"Shared/ClauseLedgerBranch",component:l,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"One `&&`/`||` connective group of a `ClauseLedger` tree: its label, its children indented under a rail, and — when the structured fields say a not-evaluated child could not change the answer — the one Kleene-shortcut sentence explaining why.\n\nThe note is read entirely off `verdict`, `undecidedChildCount` and `decidedByChildIndices`, never by re-parsing rendered text, and it never appears when `decidedByChildIndices` is empty."}}},decorators:[c=>t.jsx(u,{handlers:{group:p()},children:t.jsx(c,{})})],argTypes:{node:{description:"The connective group to render."},resolveGroupName:{description:"Names group ids inside descendant clauses."}}},a={node:"leaf",expressionText:'user.department == "Engineering"',resolvedValue:"Engineering",status:"pass",reads:[{path:"user.department",value:"Engineering"}]},o={node:"leaf",expressionText:'isMemberOfGroupNameRegex("(?=.*Ops).*")',resolvedValue:void 0,status:"not-evaluated",reasonCode:"regex-unsupported-syntax",reads:[]},e={args:{node:{node:"connective",kind:"or",children:[a,o],verdict:"pass",decidedByChildIndices:[0],undecidedChildCount:1,depth:0}}},r={...a,expressionText:'user.title == "Staff Engineer"',resolvedValue:"Intern",status:"fail",reads:[{path:"user.title",value:"Intern"}]},n={args:{node:{node:"connective",kind:"and",children:[r,o],verdict:"fail",decidedByChildIndices:[0],undecidedChildCount:1,depth:0}}},d={args:{node:{node:"connective",kind:"and",children:[a,r],verdict:"fail",decidedByChildIndices:[],undecidedChildCount:0,depth:0}}},i={args:{node:{node:"connective",kind:"and",children:[a,r],verdict:"fail",decidedByChildIndices:[1],undecidedChildCount:0,depth:0,truncation:"depth"}}},s={args:{node:{node:"connective",kind:"and",children:[a,r],verdict:"fail",decidedByChildIndices:[1],undecidedChildCount:0,depth:0,truncation:"clause-cap"}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    node: {
      node: 'connective',
      kind: 'or',
      children: [passingLeaf, undecidedLeaf],
      verdict: 'pass',
      decidedByChildIndices: [0],
      undecidedChildCount: 1,
      depth: 0
    } satisfies ConnectiveNode
  }
}`,...e.parameters?.docs?.source},description:{story:"An OR already decided by a passing alternative: the Kleene note fires.",...e.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [failingLeaf, undecidedLeaf],
      verdict: 'fail',
      decidedByChildIndices: [0],
      undecidedChildCount: 1,
      depth: 0
    } satisfies ConnectiveNode
  }
}`,...n.parameters?.docs?.source},description:{story:"An AND already decided by a failing child: the equivalent failing-side note.",...n.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [],
      undecidedChildCount: 0,
      depth: 0
    } satisfies ConnectiveNode
  }
}`,...d.parameters?.docs?.source},description:{story:"Every child evaluated on its own merits: no shortcut, so no note.",...d.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [1],
      undecidedChildCount: 0,
      depth: 0,
      truncation: 'depth'
    } satisfies ConnectiveNode
  }
}`,...i.parameters?.docs?.source},description:{story:"The depth cap folded up the nesting under one clause; every clause still shows its verdict.",...i.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [1],
      undecidedChildCount: 0,
      depth: 0,
      truncation: 'clause-cap'
    } satisfies ConnectiveNode
  }
}`,...s.parameters?.docs?.source},description:{story:"The clause cap dropped clauses outright, so the warning says they are missing from the list.",...s.parameters?.docs?.description}}};const f=["OrDecidedByPassingChild","AndDecidedByFailingChild","NoKleeneNoteWhenFullyEvaluated","TruncatedSubtree","TruncatedClauseCap"];export{n as AndDecidedByFailingChild,d as NoKleeneNoteWhenFullyEvaluated,e as OrDecidedByPassingChild,s as TruncatedClauseCap,i as TruncatedSubtree,f as __namedExportsOrder,C as default};
