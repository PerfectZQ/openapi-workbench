package golang

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeMethod(b *strings.Builder, m contract.Method) error {
	if m.Op.BusinessID != "" {
		return g.writeBusinessMethod(b, m)
	}
	prefix := m.Group + m.Name
	input, err := g.methodInput(m.Op)
	if err != nil {
		return err
	}
	arg := ""
	if input.fields.Len() > 0 {
		fmt.Fprintf(b, "// %sInput contains the wire parameters for %s.\ntype %sInput struct {\n%s}\n", prefix, m.Name, prefix, input.fields.String())
		arg = ", input " + prefix + "Input"
	}
	response, err := m.Op.SuccessResponse()
	if err != nil {
		return fmt.Errorf("%s: %w", prefix, err)
	}
	file := response.Type == "file"
	returnType := "*" + prefix + "Output"
	if file {
		returnType = "*http.Response"
	} else {
		g.models[prefix+"Output"] = response
	}
	fmt.Fprintf(b, "%s\nfunc(s *%sService) %s(ctx context.Context%s) (%s,error) {\nvar params []parameter\n%s", methodComment(m.Op, m.Name), m.Group, m.Name, arg, returnType, input.values.String())
	op := fmt.Sprintf("operation{%q,%q,%q,%t,%t}", m.Verb, m.Path, m.Action, input.antiReplay, input.innerTOP)
	if file {
		fmt.Fprintf(b, "return s.client.request(ctx,%s,params,%s,nil)\n}\n", op, input.body)
	} else {
		fmt.Fprintf(b, "var result %sOutput\n_,err:=s.client.request(ctx,%s,params,%s,&result)\nif err!=nil{return nil,err};return &result,nil\n}\n", prefix, op, input.body)
	}
	return nil
}

func (g *generator) writeBusinessMethod(b *strings.Builder, m contract.Method) error {
	prefix := m.Group + m.Name
	g.models[prefix+"Input"], g.models[prefix+"Output"] = m.Op.Request, m.Op.Result
	actionBinding := ""
	if m.Op.Action.Path != "" {
		actionBinding = fmt.Sprintf("actionPath:%q,", m.Op.Action.Path)
	}
	version := m.Op.Action.Version
	if version == "" && m.Op.Action.Name != "" {
		version = g.spec.BusinessVersion
	}
	if version != "" {
		actionBinding += fmt.Sprintf("version:%q,", version)
	}
	fmt.Fprintf(b, "%s\nfunc(s *%sService) %s(ctx context.Context, input %sInput) (*%sOutput,error) {\nvar result %sOutput\nerr:=s.client.businessRequest(ctx,businessOperation{method:%q,path:%q,action:%q,%sparameters:[]businessParameter{", methodComment(m.Op, m.Name), m.Group, m.Name, prefix, prefix, prefix, m.Verb, m.Path, m.Op.Action.Name, actionBinding)
	for _, parameter := range m.Op.Parameters {
		if parameter.In == "query" || parameter.In == "path" {
			fmt.Fprintf(b, "{name:%q,in:%q},", parameter.Name, parameter.In)
		}
	}
	fmt.Fprintf(b, "},inputJSON:%#v,outputJSON:%#v,file:%t},input,&result)\nif err!=nil{return nil,err};return &result,nil\n}\n", m.Op.InputJSON, m.Op.OutputJSON, m.Op.File)
	return nil
}
