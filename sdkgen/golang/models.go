package golang

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeModels() error {
	output := g.output
	var models strings.Builder
	for _, name := range contract.Keys(g.models) {
		s, err := g.flatten(g.models[name], map[string]bool{})
		if err != nil {
			return fmt.Errorf("model %s: %w", name, err)
		}
		t, err := g.goType(s, true)
		if err != nil {
			return fmt.Errorf("model %s: %w", name, err)
		}
		fmt.Fprintf(&models, "// %s %s\ntype %s %s\n\n", name, comment(s.Documentation()), name, t)
	}
	imports := ""
	if strings.Contains(models.String(), "json.RawMessage") {
		imports = "\"encoding/json\""
	}
	if err := g.writeGo(filepath.Join(output, "models.gen.go"), imports, models.String()); err != nil {
		return err
	}
	return nil
}
