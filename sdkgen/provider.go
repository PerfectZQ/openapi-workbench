package sdkgen

import "github.com/PerfectZQ/openapi-workbench/contract"

// Provider owns one language's source projection and downloadable package.
// Generate must treat the shared specification and methods as read-only.
type Provider interface {
	Language() string
	Generate(contract.Specification, map[string][]contract.Method) error
}

// Generator combines language providers with the caller's public naming policy.
// It has no dependency on project routes, business packages, or output locations.
type Generator struct {
	Providers  []Provider
	NameMethod func(*contract.Method) error
}

// Languages returns the registered names in the default generation order.
func (g Generator) Languages() []string {
	names := make([]string, 0, len(g.Providers))
	for _, provider := range g.Providers {
		names = append(names, provider.Language())
	}
	return names
}
