package typescript

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/internal/routes"
)

func (g *generator) writeMethod(b *strings.Builder, m contract.Method) error {
	prefix := m.Group + m.Name
	var descriptor []byte
	var input methodInput
	var err error
	output := "Models." + prefix + "Output"
	call := "request"
	if m.Op.BusinessID != "" {
		var resolved contract.Schema
		resolved, err = g.resolve(m.Op.Request, map[string]bool{})
		if err != nil {
			return err
		}
		input = methodInput{schema: m.Op.Request, required: len(resolved.Required) > 0}
		descriptor, err = json.MarshalIndent(routes.FromMethod(m, g.spec.BusinessVersion), "    ", "  ")
		g.models[prefix+"Output"] = m.Op.Result
		call = "call"
	} else {
		wire := map[string]any{"method": m.Verb, "path": m.Path}
		input, err = legacyInput(m, wire)
		if err != nil {
			return err
		}
		var response contract.Schema
		response, err = m.Op.SuccessResponse()
		if err != nil {
			return err
		}
		if response.Type == "file" {
			wire["file"], output = true, "Response"
		} else {
			g.models[prefix+"Output"] = response
		}
		descriptor, err = json.Marshal(wire)
	}
	if err != nil {
		return err
	}
	g.models[prefix+"Input"] = input.schema
	argument := "input: Models." + prefix + "Input"
	if !input.required {
		argument += " = {}"
	}
	writeComment(b, m.Op.Summary, "  ")
	fmt.Fprintf(b, "  %s(%s, options: RequestOptions = {}): Promise<%s> {\n", contract.CamelCase(m.Name), argument, output)
	fmt.Fprintf(b, "    return this.client.%s<%s>(%s, input, options);\n  }\n\n", call, output, descriptor)
	if field := m.Op.ResultField; field != "" {
		if m.Op.BusinessID != "" || output == "Response" {
			return fmt.Errorf("x-api-result-field requires a JSON response envelope")
		}
		if !g.hasProperty(g.models[prefix+"Output"], field, map[string]bool{}) {
			return fmt.Errorf("success response has no declared field %q", field)
		}
		name := contract.CamelCase(m.Name)
		fmt.Fprintf(b, "  %sResult(%s, options: RequestOptions = {}) {\n", name, argument)
		fmt.Fprintf(b, "    return this.client.result(this.%s(input, options), %s);\n  }\n\n", name, quote(field))
	}
	return nil
}

func (g *generator) hasProperty(s contract.Schema, field string, seen map[string]bool) bool {
	if s.Ref != "" {
		if seen[s.Ref] {
			return false
		}
		seen[s.Ref] = true
		return g.hasProperty(g.spec.Definitions[strings.TrimPrefix(s.Ref, "#/definitions/")], field, seen)
	}
	if _, ok := s.Properties[field]; ok {
		return true
	}
	for _, part := range s.AllOf {
		if g.hasProperty(part, field, seen) {
			return true
		}
	}
	return false
}
