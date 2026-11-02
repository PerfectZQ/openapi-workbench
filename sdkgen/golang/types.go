package golang

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) goType(s contract.Schema, expand bool) (string, error) {
	if s.Ref != "" && !expand {
		name, ok := g.names[strings.TrimPrefix(s.Ref, "#/definitions/")]
		if !ok {
			return "", fmt.Errorf("unknown ref %s", s.Ref)
		}
		return name, nil
	}
	if len(s.AllOf) == 1 && s.AllOf[0].Ref != "" && len(s.Properties) == 0 && !expand {
		return g.goType(s.AllOf[0], false)
	}
	var err error
	s, err = g.flatten(s, map[string]bool{})
	if err != nil {
		return "", err
	}
	switch s.Type {
	case "string":
		return "string", nil
	case "integer":
		return "int64", nil
	case "number":
		return "float64", nil
	case "boolean":
		return "bool", nil
	case "array":
		if s.Items == nil {
			return "", fmt.Errorf("array has no items")
		}
		t, e := g.goType(*s.Items, false)
		return "[]" + t, e
	case "", "object":
		return g.objectType(s)
	default:
		return "", fmt.Errorf("unsupported schema type %q", s.Type)
	}
}

func (g *generator) objectType(s contract.Schema) (string, error) {
	if len(s.Properties) > 0 {
		return g.structType(s)
	}
	if len(s.AdditionalProperties) > 0 && string(s.AdditionalProperties) != "false" {
		if string(s.AdditionalProperties) == "true" {
			return "map[string]json.RawMessage", nil
		}
		var value contract.Schema
		if err := json.Unmarshal(s.AdditionalProperties, &value); err != nil {
			return "", err
		}
		t, e := g.goType(value, false)
		return "map[string]" + t, e
	}
	return "json.RawMessage", nil
}

func (g *generator) structType(s contract.Schema) (string, error) {
	var b strings.Builder
	b.WriteString("struct {\n")
	used := map[string]bool{}
	for _, key := range contract.Keys(s.Properties) {
		property := s.Properties[key]
		name := contract.Identifier(key)
		if used[name] {
			return "", fmt.Errorf("field name collision %s", key)
		}
		used[name] = true
		t, e := g.goType(property, false)
		if e != nil {
			return "", e
		}
		required := false
		for _, r := range s.Required {
			if r == key {
				required = true
			}
		}
		tag := key
		if !required {
			tag += ",omitempty"
			if t != "json.RawMessage" {
				t = "*" + t
			}
		}
		documented, err := g.flatten(property, map[string]bool{})
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&b, "// %s %s\n%s %s `json:%q`\n", name, comment(documented.Documentation()), name, t, tag)
	}
	b.WriteString("}")
	return b.String(), nil
}
