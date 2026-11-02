package typescript

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) tsType(s contract.Schema) (string, error) {
	out, err := g.baseType(s)
	if err != nil {
		return "", err
	}
	if s.Nullable || s.XNullable {
		out = "(" + out + ") | null"
	}
	return out, nil
}

func (g *generator) baseType(s contract.Schema) (string, error) {
	if len(s.OneOf) > 0 || len(s.AnyOf) > 0 || len(s.Not) > 0 {
		return "", fmt.Errorf("unsupported schema composition")
	}
	var out string
	if s.Ref != "" {
		if !strings.HasPrefix(s.Ref, "#/definitions/") {
			return "", fmt.Errorf("unsupported ref %s", s.Ref)
		}
		name, ok := g.names[strings.TrimPrefix(s.Ref, "#/definitions/")]
		if !ok {
			return "", fmt.Errorf("unknown ref %s", s.Ref)
		}
		out = name
	} else if len(s.AllOf) > 0 {
		return g.intersectionType(s)
	} else if len(s.Enum) > 0 {
		return enumType(s)
	} else {
		return g.valueType(s)
	}
	return out, nil
}

func (g *generator) intersectionType(s contract.Schema) (string, error) {
	var parts []string
	for _, part := range s.AllOf {
		t, err := g.tsType(part)
		if err != nil {
			return "", err
		}
		parts = append(parts, "("+t+")")
	}
	if s.Type != "" || s.Properties != nil || len(s.AdditionalProperties) > 0 {
		s.AllOf = nil
		t, err := g.tsType(s)
		if err != nil {
			return "", err
		}
		parts = append(parts, "("+t+")")
	}
	return strings.Join(parts, " & "), nil
}

func enumType(s contract.Schema) (string, error) {
	values := make([]string, 0, len(s.Enum))
	for _, raw := range s.Enum {
		var value any
		if err := json.Unmarshal(raw, &value); err != nil {
			return "", err
		}
		switch value.(type) {
		case string, float64, bool, nil:
			values = append(values, string(raw))
		default:
			return "", fmt.Errorf("enum values must be scalar")
		}
	}
	return strings.Join(values, " | "), nil
}

func (g *generator) valueType(s contract.Schema) (string, error) {
	var out string
	switch s.Type {
	case "string":
		out = "string"
	case "integer":
		switch s.Format {
		case "int32":
			out = "number"
		case "", "int64":
			out = "number | bigint"
		default:
			return "", fmt.Errorf("unsupported integer format %q", s.Format)
		}
	case "number":
		out = "number"
	case "boolean":
		out = "boolean"
	case "array":
		if s.Items == nil {
			return "", fmt.Errorf("array has no items")
		}
		t, err := g.tsType(*s.Items)
		if err != nil {
			return "", err
		}
		out = "Array<" + t + ">"
	case "", "object":
		return g.objectType(s)
	case "file":
		out = "Response"
	default:
		return "", fmt.Errorf("unsupported schema type %q", s.Type)
	}
	return out, nil
}

func (g *generator) objectType(s contract.Schema) (string, error) {
	var object strings.Builder
	if len(s.Properties) > 0 {
		object.WriteString("{\n")
		for _, key := range contract.Keys(s.Properties) {
			property := s.Properties[key]
			t, err := g.tsType(property)
			if err != nil {
				return "", fmt.Errorf("property %s: %w", key, err)
			}
			optional := "?"
			for _, required := range s.Required {
				if required == key {
					optional = ""
				}
			}
			writeComment(&object, property.Description, "  ")
			fmt.Fprintf(&object, "  %s%s: %s;\n", quote(key), optional, t)
		}
		object.WriteString("}")
	}
	if len(s.AdditionalProperties) > 0 && string(s.AdditionalProperties) != "false" {
		t := "unknown"
		if string(s.AdditionalProperties) != "true" {
			var property contract.Schema
			if err := json.Unmarshal(s.AdditionalProperties, &property); err != nil {
				return "", err
			}
			var err error
			t, err = g.tsType(property)
			if err != nil {
				return "", err
			}
		}
		if object.Len() > 0 {
			object.WriteString(" & ")
		}
		object.WriteString("Record<string, " + t + ">")
	}
	out := object.String()
	if out == "" {
		out = "unknown"
	}
	return out, nil
}
