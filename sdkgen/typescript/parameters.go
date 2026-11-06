package typescript

import (
	"fmt"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

type methodInput struct {
	schema   contract.Schema
	required bool
}

func legacyInput(m contract.Method, descriptor map[string]any) (methodInput, error) {
	input := methodInput{schema: contract.Schema{Type: "object", Properties: map[string]contract.Schema{}}}
	for _, security := range m.Op.Security {
		if _, ok := security["InnerTOPToken"]; ok {
			descriptor["innerTOP"] = true
		}
	}
	if m.Action != "" {
		descriptor["action"] = m.Action
	}
	var params []map[string]any
	for _, p := range m.Op.Parameters {
		if p.Name == "Action" && p.In == "query" {
			continue
		}
		if p.In == "header" {
			if p.Name == "X-Date" {
				descriptor["antiReplay"] = true
			}
			switch p.Name {
			case "X-Date", "X-Expires", "X-Jwt-Token", "X-Top-Token", "X-Authorization-Token", "Authorization":
				continue
			}
		}
		name, property, err := inputProperty(p)
		if err != nil {
			return methodInput{}, err
		}
		if _, exists := input.schema.Properties[name]; exists {
			return methodInput{}, fmt.Errorf("duplicate input field %q", name)
		}
		input.schema.Properties[name] = property
		required := p.Required && p.In != "header"
		if required {
			input.schema.Required = append(input.schema.Required, name)
			input.required = true
		}
		params = append(params, map[string]any{"name": name, "in": p.In, "required": required})
	}
	if params != nil {
		descriptor["parameters"] = params
	}
	return input, nil
}

func inputProperty(p contract.Parameter) (string, contract.Schema, error) {
	switch p.In {
	case "body":
		property := p.Schema
		property.Description = p.Description
		return "body", property, nil
	case "path", "query", "header":
		return p.Name, contract.Schema{Type: p.Type, Format: p.Format, Enum: p.Enum, Items: p.Items, Description: p.Description}, nil
	default:
		return "", contract.Schema{}, fmt.Errorf("unsupported parameter location %q", p.In)
	}
}
