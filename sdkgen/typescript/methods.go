package typescript

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeMethod(b *strings.Builder, m contract.Method) error {
	prefix := m.Group + m.Name
	descriptor := map[string]any{"method": m.Verb, "path": m.Path}
	var input methodInput
	var err error
	output := "Models." + prefix + "Output"
	call := "request"
	if m.Op.BusinessID != "" {
		input, err = g.businessInput(m.Op, descriptor)
		g.models[prefix+"Output"] = m.Op.Result
		call = "businessRequest"
	} else {
		input, err = legacyInput(m, descriptor)
		if err == nil {
			response, responseErr := m.Op.SuccessResponse()
			if responseErr != nil {
				return responseErr
			}
			if response.Type == "file" {
				descriptor["file"], output = true, "Response"
			} else {
				g.models[prefix+"Output"] = response
			}
		}
	}
	if err != nil {
		return err
	}
	g.models[prefix+"Input"] = input.schema
	desc, err := json.Marshal(descriptor)
	if err != nil {
		return err
	}
	argument := "input: Models." + prefix + "Input"
	if !input.required {
		argument += " = {}"
	}
	writeComment(b, m.Op.Summary, "  ")
	fmt.Fprintf(b, "  %s(%s, options: RequestOptions = {}): Promise<%s> {\n", contract.CamelCase(m.Name), argument, output)
	fmt.Fprintf(b, "    return this.client.%s<%s>(%s, input, options);\n  }\n\n", call, output, desc)
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
