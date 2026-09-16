import{aa as m}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const f={title:"Shared/ClausePhrase",component:m,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'One rule clause stated as a sentence, composed from the `LeafPredicate` the explainer derived for it — `String.toLowerCase(user.department) == "sales"` reads as **department** (lowercased) equals `"sales"`.\n\nThe wording lives here; the decision lives in the type. Every form, operator and transform comes from a closed set read off the clause AST, so nothing branches on a display string and an unreadable clause carries no predicate at all.'}}},argTypes:{predicate:{description:"The structured description to state in words."},className:{description:"Layout classes only — the type treatment is the component’s."}}},e={args:{predicate:{form:"compare",subject:{path:"user.department",transforms:[]},operator:"eq",operand:"Engineering"}}},r={args:{predicate:{form:"compare",subject:{path:"user.department",transforms:["toLowerCase"]},operator:"eq",operand:"sales"}}},s={args:{predicate:{form:"compare",subject:{path:'user["cost center"]',transforms:["removeSpaces","toLowerCase"]},operator:"ne",operand:"cc-9"}}},a={args:{predicate:{form:"compare",subject:{path:"user.employeeNumber",transforms:["len"]},operator:"gte",operand:6}}},t={args:{predicate:{form:"compare",subject:{path:"user.certifications",transforms:["size"]},operator:"gt",operand:1}}},o={args:{predicate:{form:"contains",subject:{path:"user.login",transforms:[]},operand:"_vendor",negated:!0}}},n={args:{predicate:{form:"array-contains",subject:{path:"user.certifications",transforms:[]},operand:"CISSP",negated:!1}}},c={args:{predicate:{form:"empty",subject:{path:"user.certifications",transforms:[]},negated:!0}}},p={args:{predicate:{form:"boolean-attribute",subject:{path:"user.isContractor",transforms:[]},negated:!0}}},i={args:{predicate:{form:"compare-subjects",left:{path:"user.department",transforms:[]},operator:"eq",right:{path:"user.division",transforms:[]}}}},d={args:{predicate:{form:"compare",subject:{path:"user.projectCode",transforms:[]},operator:"eq",operand:null}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user.department',
        transforms: []
      },
      operator: 'eq',
      operand: 'Engineering'
    }
  }
}`,...e.parameters?.docs?.source},description:{story:"The plain comparison: attribute, verb, operand.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user.department',
        transforms: ['toLowerCase']
      },
      operator: 'eq',
      operand: 'sales'
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"A value transform reads as a parenthetical, never as the function call it came from.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user["cost center"]',
        transforms: ['removeSpaces', 'toLowerCase']
      },
      operator: 'ne',
      operand: 'cc-9'
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"Nested transforms read innermost-first — the order they are applied in.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user.employeeNumber',
        transforms: ['len']
      },
      operator: 'gte',
      operand: 6
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"`String.len` changes what the sentence is about, so it leads the sentence.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user.certifications',
        transforms: ['size']
      },
      operator: 'gt',
      operand: 1
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"`Arrays.size`, likewise: the count is the subject.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'contains',
      subject: {
        path: 'user.login',
        transforms: []
      },
      operand: '_vendor',
      negated: true
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"A substring test, negated: the `!` is in the verb, not left for the reader to spot.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'array-contains',
      subject: {
        path: 'user.certifications',
        transforms: []
      },
      operand: 'CISSP',
      negated: false
    }
  }
}`,...n.parameters?.docs?.source},description:{story:'`Arrays.contains` reads as "includes", which is what a multi-valued attribute does.',...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'empty',
      subject: {
        path: 'user.certifications',
        transforms: []
      },
      negated: true
    }
  }
}`,...c.parameters?.docs?.source},description:{story:"Emptiness, stated either way round.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'boolean-attribute',
      subject: {
        path: 'user.isContractor',
        transforms: []
      },
      negated: true
    }
  }
}`,...p.parameters?.docs?.source},description:{story:'A bare boolean attribute: "is false", asserted rather than implied by a missing `!`.',...p.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare-subjects',
      left: {
        path: 'user.department',
        transforms: []
      },
      operator: 'eq',
      right: {
        path: 'user.division',
        transforms: []
      }
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"Two attributes compared with each other — both are subjects, neither is an operand.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    predicate: {
      form: 'compare',
      subject: {
        path: 'user.projectCode',
        transforms: []
      },
      operator: 'eq',
      operand: null
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"`null` is a value the rule really compares against, and prints as the word.",...d.parameters?.docs?.description}}};const h=["Comparison","TransformedSubject","NestedTransforms","LengthForm","CountForm","NegatedContains","ArrayContains","NotEmpty","BooleanAttribute","TwoSubjects","NullOperand"];export{n as ArrayContains,p as BooleanAttribute,e as Comparison,t as CountForm,a as LengthForm,o as NegatedContains,s as NestedTransforms,c as NotEmpty,d as NullOperand,r as TransformedSubject,i as TwoSubjects,h as __namedExportsOrder,f as default};
