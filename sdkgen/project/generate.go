// Package project creates complete SDK projects through the product CLI.
package project

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/golang"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/typescript"
)

// Generate creates ready-to-build SDKs in a new directory. Existing projects are
// never overwritten; custom runtimes continue to use sdkgen.Generator directly.
func Generate(specPath, directory string, languages []string) error {
	selected := []string{}
	seen := map[string]bool{}
	for _, language := range languages {
		language = strings.TrimSpace(language)
		if language != "go" && language != "typescript" {
			return fmt.Errorf("unsupported SDK language %q", language)
		}
		if !seen[language] {
			selected = append(selected, language)
			seen[language] = true
		}
	}
	if len(selected) == 0 {
		return fmt.Errorf("at least one SDK language is required")
	}
	if _, err := os.Lstat(directory); !os.IsNotExist(err) {
		return fmt.Errorf("output must be a new directory: %s", directory)
	}
	parent := filepath.Dir(directory)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, ".api-explorer-sdk-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := writeRuntimes(stage, selected); err != nil {
		return err
	}
	generator := sdkgen.Generator{
		Providers: []sdkgen.Provider{
			golang.Provider{Target: artifact.Target{Directory: filepath.Join(stage, "go")}, Package: "sdk"},
			typescript.Provider{Target: artifact.Target{Directory: filepath.Join(stage, "typescript")}, ClientName: "Client", SharedRuntime: true},
		},
		NameMethod: func(method *contract.Method) error {
			method.Group = "API"
			method.Name = contract.Identifier(method.Op.OperationID)
			if method.Op.OperationID == "" {
				method.Name = contract.Identifier(method.Verb + " " + method.Path)
			}
			return nil
		},
	}
	data, err := specification(specPath)
	if err != nil {
		return err
	}
	normalized := filepath.Join(stage, "swagger.json")
	if err := os.WriteFile(normalized, data, 0644); err != nil {
		return err
	}
	if err := generator.Generate(normalized, selected); err != nil {
		return err
	}
	if err := os.Remove(normalized); err != nil {
		return err
	}
	return os.Rename(stage, directory)
}
