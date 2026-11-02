package sdkgen

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

// Generate validates all requested languages before reading the contract or
// writing files. Each selected provider runs once, in the requested order.
func (g Generator) Generate(specPath string, languages []string) error {
	selected, err := g.selectProviders(languages)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(specPath)
	if err != nil {
		return err
	}
	var spec contract.Specification
	if err := json.Unmarshal(data, &spec); err != nil {
		return fmt.Errorf("read Swagger contract: %w", err)
	}
	if spec.Swagger != "2.0" {
		return fmt.Errorf("SDK generation requires Swagger 2.0")
	}
	groups, err := contract.Methods(spec, g.NameMethod)
	if err != nil {
		return err
	}
	for _, provider := range selected {
		if err := provider.Generate(spec, groups); err != nil {
			return fmt.Errorf("%s SDK: %w", provider.Language(), err)
		}
	}
	return nil
}

func (g Generator) selectProviders(languages []string) ([]Provider, error) {
	if len(languages) == 0 {
		return nil, fmt.Errorf("at least one SDK language is required")
	}
	selected := make([]Provider, 0, len(languages))
	seen := map[string]bool{}
	for _, language := range languages {
		language = strings.TrimSpace(language)
		var found Provider
		for _, provider := range g.Providers {
			if provider.Language() == language {
				found = provider
				break
			}
		}
		if found == nil {
			return nil, fmt.Errorf("unsupported SDK language %q (supported: %s)", language, strings.Join(g.Languages(), ","))
		}
		if !seen[language] {
			selected = append(selected, found)
			seen[language] = true
		}
	}
	return selected, nil
}
