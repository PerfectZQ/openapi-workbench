package golang

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) flatten(s contract.Schema, seen map[string]bool) (contract.Schema, error) {
	if s.Ref != "" {
		return g.flattenReference(s, seen)
	}
	if len(s.AllOf) == 0 {
		return s, nil
	}
	var out contract.Schema
	for _, part := range s.AllOf {
		part, err := g.flatten(part, seen)
		if err != nil {
			return contract.Schema{}, err
		}
		if part.Type != "" {
			out.Type = part.Type
		}
		if part.Description != "" {
			if out.Description != "" {
				out.Description += "\n\n"
			}
			out.Description += part.Description
		}
		if len(part.Enum) > 0 {
			out.Enum, out.EnumDescriptions = part.Enum, part.EnumDescriptions
		}
		if part.Properties != nil {
			if out.Properties == nil {
				out.Properties = map[string]contract.Schema{}
			}
			for k, v := range part.Properties {
				out.Properties[k] = v
			}
		}
		out.Required = append(out.Required, part.Required...)
		if len(part.AdditionalProperties) > 0 {
			out.AdditionalProperties = part.AdditionalProperties
		}
	}
	for k, v := range s.Properties {
		if out.Properties == nil {
			out.Properties = map[string]contract.Schema{}
		}
		out.Properties[k] = v
	}
	out.Required = append(out.Required, s.Required...)
	if s.Description != "" {
		out.Description = s.Description
	}
	if len(s.Enum) > 0 {
		out.Enum, out.EnumDescriptions = s.Enum, s.EnumDescriptions
	}
	return out, nil
}

func (g *generator) flattenReference(s contract.Schema, seen map[string]bool) (contract.Schema, error) {
	key := strings.TrimPrefix(s.Ref, "#/definitions/")
	if seen[key] {
		return contract.Schema{}, fmt.Errorf("cyclic allOf %s", key)
	}
	definition, ok := g.spec.Definitions[key]
	if !ok {
		return contract.Schema{}, fmt.Errorf("unknown ref %s", s.Ref)
	}
	seen[key] = true
	out, err := g.flatten(definition, seen)
	delete(seen, key)
	if s.Description != "" {
		out.Description = s.Description
	}
	return out, err
}
