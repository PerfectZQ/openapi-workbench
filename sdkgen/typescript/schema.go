package typescript

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) resolve(s contract.Schema, seen map[string]bool) (contract.Schema, error) {
	if s.Ref == "" {
		return s, nil
	}
	key := strings.TrimPrefix(s.Ref, "#/definitions/")
	if !strings.HasPrefix(s.Ref, "#/definitions/") || seen[key] {
		return contract.Schema{}, fmt.Errorf("invalid or cyclic alias %s", s.Ref)
	}
	definition, ok := g.spec.Definitions[key]
	if !ok {
		return contract.Schema{}, fmt.Errorf("unknown ref %s", s.Ref)
	}
	seen[key] = true
	return g.resolve(definition, seen)
}
