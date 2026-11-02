package typescript

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeModels() error {
	var models strings.Builder
	models.WriteString(generatedHeader)
	for _, name := range contract.Keys(g.models) {
		model := g.models[name]
		t, err := g.tsType(model)
		if err != nil {
			return fmt.Errorf("model %s: %w", name, err)
		}
		writeComment(&models, model.Description, "")
		fmt.Fprintf(&models, "export type %s = %s;\n\n", name, t)
	}
	return g.writeTypeScript("models.gen.ts", models.String())
}
