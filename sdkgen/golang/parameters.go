package golang

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

type methodInput struct {
	fields, values       strings.Builder
	body                 string
	antiReplay, innerTOP bool
}

func (g *generator) methodInput(op contract.Operation) (*methodInput, error) {
	input := &methodInput{body: "nil"}
	for _, s := range op.Security {
		if _, ok := s["InnerTOPToken"]; ok {
			input.innerTOP = true
		}
	}
	for _, p := range op.Parameters {
		if p.Name == "Action" && p.In == "query" {
			continue
		}
		if p.In == "header" {
			if p.Name == "X-Date" {
				input.antiReplay = true
			}
			switch p.Name {
			case "X-Date", "X-Expires", "X-Jwt-Token", "X-Top-Token", "X-Authorization-Token", "Authorization":
				continue
			}
		}
		name := contract.Identifier(p.Name)
		if p.In == "body" {
			t, err := g.goType(p.Schema, false)
			if err != nil {
				return nil, err
			}
			fmt.Fprintf(&input.fields, "// Body %s\nBody %s\n", comment(p.Description), t)
			input.body = "input.Body"
			continue
		}
		t, err := g.goType(contract.Schema{Type: p.Type}, false)
		if err != nil {
			return nil, err
		}
		required := p.Required && p.In != "header"
		if !required {
			t = "*" + t
		}
		fmt.Fprintf(&input.fields, "// %s %s\n%s %s\n", name, comment(p.Description), name, t)
		if !required {
			fmt.Fprintf(&input.values, "if input.%s != nil { params=append(params, parameter{%q,%q,fmt.Sprint(*input.%s),false}) }\n", name, p.Name, p.In, name)
		} else {
			fmt.Fprintf(&input.values, "params=append(params,parameter{%q,%q,fmt.Sprint(input.%s),true})\n", p.Name, p.In, name)
		}
	}
	return input, nil
}
