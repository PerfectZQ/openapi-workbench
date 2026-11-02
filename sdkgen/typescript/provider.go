package typescript

import (
	"fmt"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
)

// Provider generates the standalone TypeScript SDK from the shared contract.
type Provider struct {
	Target     artifact.Target
	ClientName string
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
