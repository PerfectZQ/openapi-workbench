package contract

import (
	"fmt"
	"strings"
)

// Models assigns stable public names and creates a private model set for each provider.
func Models(spec Specification) (map[string]string, map[string]Schema, error) {
	names, models := map[string]string{}, map[string]Schema{}
	counts := map[string]int{}
	for key := range spec.Definitions {
		counts[Identifier(key[strings.LastIndex(key, ".")+1:])]++
	}
	for _, key := range Keys(spec.Definitions) {
		name := Identifier(key[strings.LastIndex(key, ".")+1:])
		if counts[name] > 1 {
			name = Identifier(key)
		}
		if _, exists := models[name]; exists {
			return nil, nil, fmt.Errorf("duplicate model %s", name)
		}
		names[key], models[name] = name, spec.Definitions[key]
	}
	return names, models, nil
}
