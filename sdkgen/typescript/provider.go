package typescript

import (
	_ "embed"
	"fmt"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
)

//go:embed runtime.ts.tmpl
var runtimeSource string

// Provider generates the standalone TypeScript SDK from the shared contract.
type Provider struct {
	Target     artifact.Target
	ClientName string
	// SharedRuntime writes runtime.gen.ts for a host client.ts to re-export or extend.
	SharedRuntime bool
}

func (Provider) Language() string { return "typescript" }

type generator struct {
	spec       contract.Specification
	names      map[string]string
	models     map[string]contract.Schema
	output     string
	clientName string
}

func (p Provider) Generate(spec contract.Specification, groups map[string][]contract.Method) error {
	if err := validateNames(groups); err != nil {
		return err
	}
	names, models, err := contract.Models(spec)
	if err != nil {
		return err
	}
	g := generator{spec: spec, names: names, models: models, output: p.Target.Directory, clientName: p.ClientName}
	if p.SharedRuntime {
		if err := g.writeTypeScript("runtime.gen.ts", generatedHeader+runtimeSource); err != nil {
			return err
		}
	}
	if err := g.writeConfig(); err != nil {
		return err
	}
	if err := g.writeServices(groups); err != nil {
		return err
	}
	if err := g.writeModels(); err != nil {
		return err
	}
	if err := p.archiveSDK(); err != nil {
		return err
	}
	total := 0
	for _, methods := range groups {
		total += len(methods)
	}
	fmt.Printf("TypeScript SDK: %d operations, %d models\n", total, len(g.models))
	return nil
}
