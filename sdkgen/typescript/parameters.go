package typescript

import (
	"fmt"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

type methodInput struct {
	schema   contract.Schema
	required bool
}

func (g *generator) businessInput(op contract.Operation, descriptor map[string]any) (methodInput, error) {
	version := op.Action.Version
	if version == "" {
		version = g.spec.BusinessVersion
	}
	descriptor["action"], descriptor["version"], descriptor["file"] = op.Action.Name, version, op.File
	if len(op.InputJSON) > 0 {
		descriptor["inputJSON"] = op.InputJSON
	}
	if len(op.OutputJSON) > 0 {
		descriptor["outputJSON"] = op.OutputJSON
	}
	var params []map[string]any
	for _, p := range op.Parameters {
		if p.In == "path" || p.In == "query" {
			params = append(params, map[string]any{"name": p.Name, "in": p.In})
		}
	}
	if params != nil {
		descriptor["parameters"] = params
	}
	resolved, err := g.resolve(op.Request, map[string]bool{})
	if err != nil {
		return methodInput{}, err
	}
	return methodInput{schema: op.Request, required: len(resolved.Required) > 0}, nil
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
