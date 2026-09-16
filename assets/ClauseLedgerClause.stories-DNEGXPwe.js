import{j as h,a1 as E,Q as S}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{fn:x}=__STORYBOOK_MODULE_TEST__,A=r=>({"00gFAKECLAUSE1":"Engineering — Platform"})[r],L={title:"Shared/ClauseLedgerClause",component:E,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'One leaf of a `ClauseLedger` tree: the clause stated in words, its outcome chip, the group references it named, and the profile evidence that drove it. A clause carrying a `predicate` reads as a sentence rather than as the expression it came from; one the explainer could not describe exactly keeps its verbatim text.\n\nAn attribute read is one of three states: a present value, an explicit `null`, or an absent attribute rendered as the words "not set" — never a dash, never `0`.'}}},decorators:[r=>h.jsx(S,{handlers:{group:x()},children:h.jsx(r,{})})],argTypes:{leaf:{description:"The leaf clause to render."},resolveGroupName:{description:"Names group ids inside the clause text and its group references."}},args:{resolveGroupName:A}},v={node:"leaf",expressionText:'user.department == "Engineering"',resolvedValue:"Engineering",status:"pass",reads:[{path:"user.department",value:"Engineering"}],predicate:{form:"compare",subject:{path:"user.department",transforms:[]},operator:"eq",operand:"Engineering"}},a={args:{leaf:v}},s={args:{leaf:{...v,expressionText:'user.title == "Staff Engineer"',resolvedValue:"Intern",status:"fail",reads:[{path:"user.title",value:"Intern"}],predicate:{form:"compare",subject:{path:"user.title",transforms:[]},operator:"eq",operand:"Staff Engineer"}}}},t={args:{leaf:{node:"leaf",expressionText:'isMemberOfGroup("00gFAKECLAUSE9")',resolvedValue:void 0,status:"not-evaluated",reasonCode:"group-membership-fn",reads:[]}}},o={args:{leaf:{node:"leaf",expressionText:'isMemberOfAnyGroup("00gFAKECLAUSE1")',resolvedValue:void 0,status:"pass",groupRequirement:"member",groupReferences:[{match:"id",value:"00gFAKECLAUSE1",satisfied:!0,matchedGroupName:"Engineering — Platform"}],reads:[]}}},n={args:{leaf:{node:"leaf",expressionText:'!isMemberOfAnyGroup("00gFAKECLAUSE1")',resolvedValue:void 0,status:"fail",groupRequirement:"non-member",groupReferences:[{match:"id",value:"00gFAKECLAUSE1",satisfied:!0,matchedGroupName:"Engineering — Platform"}],reads:[]}}},i={args:{leaf:{node:"leaf",expressionText:'isMemberOfAnyGroupName("Engineering-Platform-Infrastructure", "Engineering-Developer-Experience")',resolvedValue:!0,status:"pass",groupRequirement:"member",groupReferences:[{match:"name",value:"Engineering-Platform-Infrastructure",satisfied:!0,matchedGroupName:"Engineering-Platform-Infrastructure"},{match:"name",value:"Engineering-Developer-Experience",satisfied:!1}],reads:[]}},parameters:{viewport:{value:"sidepanelCompact"}}},p={args:{leaf:{node:"leaf",expressionText:'user.projectCode == "Platform" && user.costCenter == "CC-9"',resolvedValue:!1,status:"fail",reads:[{path:"user.projectCode",value:null},{path:"user.costCenter",value:""}]}}},e=(r,b,C)=>({node:"leaf",expressionText:r,resolvedValue:void 0,status:"pass",reads:C,predicate:b}),u={args:{leaf:e('String.toLowerCase(user.department) == "sales"',{form:"compare",subject:{path:"user.department",transforms:["toLowerCase"]},operator:"eq",operand:"sales"},[{path:"user.department",value:"Sales"}])}},c={args:{leaf:e('String.toLowerCase(String.removeSpaces(user["cost center"])) == "cc-9"',{form:"compare",subject:{path:'user["cost center"]',transforms:["removeSpaces","toLowerCase"]},operator:"eq",operand:"cc-9"},[{path:'user["cost center"]',value:"CC 9"}])}},d={args:{leaf:e('!String.stringContains(user.login, "_vendor")',{form:"contains",subject:{path:"user.login",transforms:[]},operand:"_vendor",negated:!0},[{path:"user.login",value:"ada_vendor@example.com"}])}},l={args:{leaf:e("String.len(user.employeeNumber) >= 6",{form:"compare",subject:{path:"user.employeeNumber",transforms:["len"]},operator:"gte",operand:6},[{path:"user.employeeNumber",value:"00421"}])}},m={args:{leaf:e("Arrays.size(user.certifications) > 1",{form:"compare",subject:{path:"user.certifications",transforms:["size"]},operator:"gt",operand:1},[{path:"user.certifications",value:["CISSP","AWS-SA"]}])}},f={args:{leaf:e("!user.isContractor",{form:"boolean-attribute",subject:{path:"user.isContractor",transforms:[]},negated:!0},[{path:"user.isContractor",value:!0}])}},g={args:{leaf:{node:"leaf",expressionText:'String.substring(user.department, 0, 3) == "Eng"',resolvedValue:"Engineering",status:"pass",reads:[{path:"user.department",value:"Engineering"}]}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: passLeaf
  }
}`,...a.parameters?.docs?.source},description:{story:"A clause that resolved to true, with the profile value that drove it.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      ...passLeaf,
      expressionText: 'user.title == "Staff Engineer"',
      resolvedValue: 'Intern',
      status: 'fail',
      reads: [{
        path: 'user.title',
        value: 'Intern'
      }],
      predicate: {
        form: 'compare',
        subject: {
          path: 'user.title',
          transforms: []
        },
        operator: 'eq',
        operand: 'Staff Engineer'
      }
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"A clause that genuinely resolved to false — the only outcome shown as a failure.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'isMemberOfGroup("00gFAKECLAUSE9")',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'group-membership-fn',
      reads: []
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"A clause the evaluator could not resolve — neutral, never `danger`, with its reason stated.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'isMemberOfAnyGroup("00gFAKECLAUSE1")',
      resolvedValue: undefined,
      status: 'pass',
      groupRequirement: 'member',
      groupReferences: [{
        match: 'id',
        value: '00gFAKECLAUSE1',
        satisfied: true,
        matchedGroupName: 'Engineering — Platform'
      }],
      reads: []
    }
  }
}`,...o.parameters?.docs?.source},description:{story:'A group-membership clause: the plain-language "Member of" label, with its chip row.',...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: '!isMemberOfAnyGroup("00gFAKECLAUSE1")',
      resolvedValue: undefined,
      status: 'fail',
      groupRequirement: 'non-member',
      groupReferences: [{
        match: 'id',
        value: '00gFAKECLAUSE1',
        satisfied: true,
        matchedGroupName: 'Engineering — Platform'
      }],
      reads: []
    }
  }
}`,...n.parameters?.docs?.source},description:{story:'The negated polarity: "Not a member of", stated in words rather than inferred.',...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'isMemberOfAnyGroupName("Engineering-Platform-Infrastructure", "Engineering-Developer-Experience")',
      resolvedValue: true,
      status: 'pass',
      groupRequirement: 'member',
      groupReferences: [{
        match: 'name',
        value: 'Engineering-Platform-Infrastructure',
        satisfied: true,
        matchedGroupName: 'Engineering-Platform-Infrastructure'
      }, {
        match: 'name',
        value: 'Engineering-Developer-Experience',
        satisfied: false
      }],
      reads: []
    }
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"A long clause with wrapping chips and evidence at the panel's narrowest width.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'user.projectCode == "Platform" && user.costCenter == "CC-9"',
      resolvedValue: false,
      status: 'fail',
      reads: [{
        path: 'user.projectCode',
        value: null
      }, {
        path: 'user.costCenter',
        value: ''
      }]
    }
  }
}`,...p.parameters?.docs?.source},description:{story:'An attribute the user holds no value for reads "not set" (ADR-0004); the blank\nstring beside it is a different fact and prints as `""`.',...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('String.toLowerCase(user.department) == "sales"', {
      form: 'compare',
      subject: {
        path: 'user.department',
        transforms: ['toLowerCase']
      },
      operator: 'eq',
      operand: 'sales'
    }, [{
      path: 'user.department',
      value: 'Sales'
    }])
  }
}`,...u.parameters?.docs?.source},description:{story:"A value-transforming comparison: the transform is a parenthetical, not a function call.",...u.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('String.toLowerCase(String.removeSpaces(user["cost center"])) == "cc-9"', {
      form: 'compare',
      subject: {
        path: 'user["cost center"]',
        transforms: ['removeSpaces', 'toLowerCase']
      },
      operator: 'eq',
      operand: 'cc-9'
    }, [{
      path: 'user["cost center"]',
      value: 'CC 9'
    }])
  }
}`,...c.parameters?.docs?.source},description:{story:"Nested transforms read innermost-first, in the order they are applied.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('!String.stringContains(user.login, "_vendor")', {
      form: 'contains',
      subject: {
        path: 'user.login',
        transforms: []
      },
      operand: '_vendor',
      negated: true
    }, [{
      path: 'user.login',
      value: 'ada_vendor@example.com'
    }])
  }
}`,...d.parameters?.docs?.source},description:{story:"A negated substring test: the `!` is in the verb, never left for the reader to spot.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('String.len(user.employeeNumber) >= 6', {
      form: 'compare',
      subject: {
        path: 'user.employeeNumber',
        transforms: ['len']
      },
      operator: 'gte',
      operand: 6
    }, [{
      path: 'user.employeeNumber',
      value: '00421'
    }])
  }
}`,...l.parameters?.docs?.source},description:{story:"`String.len` and `Arrays.size` change what the sentence is about, so they lead it.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('Arrays.size(user.certifications) > 1', {
      form: 'compare',
      subject: {
        path: 'user.certifications',
        transforms: ['size']
      },
      operator: 'gt',
      operand: 1
    }, [{
      path: 'user.certifications',
      value: ['CISSP', 'AWS-SA']
    }])
  }
}`,...m.parameters?.docs?.source},description:{story:"The count form, over a multi-valued attribute.",...m.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: described('!user.isContractor', {
      form: 'boolean-attribute',
      subject: {
        path: 'user.isContractor',
        transforms: []
      },
      negated: true
    }, [{
      path: 'user.isContractor',
      value: true
    }])
  }
}`,...f.parameters?.docs?.source},description:{story:'A bare boolean attribute, negated: "is false", stated rather than implied.',...f.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'String.substring(user.department, 0, 3) == "Eng"',
      resolvedValue: 'Engineering',
      status: 'pass',
      reads: [{
        path: 'user.department',
        value: 'Engineering'
      }]
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"No predicate: a clause the explainer could not state exactly keeps its verbatim text.",...g.parameters?.docs?.description}}};const T=["Pass","Fail","NotEvaluated","GroupMembershipClause","NonMemberPolarity","CompactPanel","AttributeWithNoValue","TransformedComparison","NestedTransforms","NegatedContains","LengthAndCountForms","CountForm","BooleanAttribute","UndescribedClauseKeepsItsText"];export{p as AttributeWithNoValue,f as BooleanAttribute,i as CompactPanel,m as CountForm,s as Fail,o as GroupMembershipClause,l as LengthAndCountForms,d as NegatedContains,c as NestedTransforms,n as NonMemberPolarity,t as NotEvaluated,a as Pass,u as TransformedComparison,g as UndescribedClauseKeepsItsText,T as __namedExportsOrder,L as default};
