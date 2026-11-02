package typescript

import (
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeServices(groups map[string][]contract.Method) error {
	var services strings.Builder
	services.WriteString(generatedHeader)
	services.WriteString("import { ClientRuntime } from './client.js';\nimport type { RequestOptions } from './client.js';\nimport type { ClientConfig } from './config.gen.js';\nimport type * as Models from './models.gen.js';\n\n")
	fmt.Fprintf(&services, "export const businessVersion = %s;\n\n", quote(g.spec.BusinessVersion))
	fmt.Fprintf(&services, "export class %s extends ClientRuntime {\n", g.clientName)
	for _, group := range contract.Keys(groups) {
		fmt.Fprintf(&services, "  readonly %s: %sService;\n", contract.CamelCase(group), group)
	}
	services.WriteString("\n  constructor(config: ClientConfig) {\n    super(config);\n")
	for _, group := range contract.Keys(groups) {
		fmt.Fprintf(&services, "    this.%s = new %sService(this);\n", contract.CamelCase(group), group)
	}
	services.WriteString("  }\n}\n\n")
	for _, group := range contract.Keys(groups) {
		fmt.Fprintf(&services, "export class %sService {\n  constructor(private readonly client: ClientRuntime) {}\n\n", group)
		for _, m := range groups[group] {
			if err := g.writeMethod(&services, m); err != nil {
				return fmt.Errorf("%s.%s: %w", group, m.Name, err)
			}
		}
		services.WriteString("}\n\n")
	}
	return g.writeTypeScript("services.gen.ts", services.String())
}

func validateNames(groups map[string][]contract.Method) error {
	publicGroups := map[string]string{}
	for _, group := range contract.Keys(groups) {
		public := contract.CamelCase(group)
		if old, exists := publicGroups[public]; exists {
			return fmt.Errorf("service name collision %s / %s", old, group)
		}
		publicGroups[public] = group
		names := map[string]bool{}
		for _, method := range groups[group] {
			name := contract.CamelCase(method.Name)
			if names[name] {
				return fmt.Errorf("duplicate SDK method %s.%s", group, method.Name)
			}
			names[name] = true
		}
	}
	return nil
}
