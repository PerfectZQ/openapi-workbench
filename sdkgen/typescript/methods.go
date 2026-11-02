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
	return nil
}
