package golang

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/internal/routes"
)

func (g *generator) writeMethod(b *strings.Builder, m contract.Method) error {
	if m.Op.BusinessID != "" {
		g.writeOperation(b, m)
		return nil
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

func (g *generator) writeOperation(b *strings.Builder, m contract.Method) {
	prefix := m.Group + m.Name
	g.models[prefix+"Input"], g.models[prefix+"Output"] = m.Op.Request, m.Op.Result
	fmt.Fprintf(b, "%s\nfunc(s *%sService) %s(ctx context.Context, input %sInput) (*%sOutput,error) {\nvar result %sOutput\n", methodComment(m.Op, m.Name), m.Group, m.Name, prefix, prefix, prefix)
	b.WriteString("err := s.client.call(ctx, operationRoutes{\n")
	bindings := routes.FromMethod(m, g.spec.BusinessVersion)
	if rest := bindings.REST; rest != nil {
		fmt.Fprintf(b, "rest:restRoute{method:%q,path:%q,", rest.Method, rest.Path)
		if len(rest.Parameters) > 0 {
			b.WriteString("parameters:[]restParameter{")
			for _, p := range rest.Parameters {
				fmt.Fprintf(b, "{name:%q,in:%q},", p.Name, p.In)
			}
			b.WriteString("},")
		}
		if rest.File {
			b.WriteString("file:true,")
		}
		b.WriteString("},\n")
	}
	if action := bindings.Action; action != nil {
		fmt.Fprintf(b, "action:actionRoute{path:%q,name:%q,version:%q,", action.Path, action.Name, action.Version)
		if len(action.InputJSON) > 0 {
			fmt.Fprintf(b, "inputJSON:%#v,", action.InputJSON)
		}
		if len(action.OutputJSON) > 0 {
			fmt.Fprintf(b, "outputJSON:%#v,", action.OutputJSON)
		}
		b.WriteString("},\n")
	}
	b.WriteString("},input,&result)\nif err!=nil{return nil,err};return &result,nil\n}\n")
}
