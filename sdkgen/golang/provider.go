package golang

import (
	"fmt"
	"os"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
)

// Provider generates the standalone Go SDK from the shared contract.
type Provider struct {
	Target  artifact.Target
	Package string
}

func (Provider) Language() string { return "go" }

type generator struct {
	spec        contract.Specification
	names       map[string]string
	models      map[string]contract.Schema
	output      string
	packageName string
}

func (p Provider) Generate(spec contract.Specification, groups map[string][]contract.Method) error {
	names, models, err := contract.Models(spec)
	if err != nil {
		return err
	}
	g := generator{spec: spec, names: names, models: models, output: p.Target.Directory, packageName: p.Package}
	if err := os.MkdirAll(g.output, 0755); err != nil {
		return err
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
	if err := g.removeObsoleteServices(groups); err != nil {
		return err
	}
	if err := p.archiveSDK(); err != nil {
		return err
	}
	total := 0
	for _, methods := range groups {
		total += len(methods)
	}
	fmt.Printf("Go SDK: %d operations, %d models\n", total, len(g.models))
	return nil
}
