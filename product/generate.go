// Package product generates a complete Swagger-powered API Explorer project.
package product

import (
	"bytes"
	"embed"
	"fmt"
	"go/format"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	explorer "github.com/PerfectZQ/openapi-workbench"
	sdkproject "github.com/PerfectZQ/openapi-workbench/sdkgen/project"
	"github.com/PerfectZQ/openapi-workbench/skillgen"
)

//go:embed templates/main.go.tmpl
var templates embed.FS

// Generate creates a static Explorer, an embedded-contract CLI project and an
// agent skill in a new directory. The destination is published only on success.
func Generate(specPath, directory, name string) error {
	data, err := os.ReadFile(specPath)
	if err != nil {
		return err
	}
	envPrefix := strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
	skill, err := skillgen.Generate(data, skillgen.Options{Name: name + "-api", Command: name, EnvPrefix: envPrefix})
	if err != nil {
		return err
	}
	if _, err := os.Lstat(directory); !os.IsNotExist(err) {
		return fmt.Errorf("output must be a new directory: %s", directory)
	}
	parent := filepath.Dir(directory)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, ".api-explorer-project-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := explorer.Export(filepath.Join(stage, "explorer"), "./swagger.json"); err != nil {
		return err
	}
	tmpl, err := template.ParseFS(templates, "templates/main.go.tmpl")
	if err != nil {
		return err
	}
	var main bytes.Buffer
	if err := tmpl.Execute(&main, struct{ Name, EnvPrefix string }{name, envPrefix}); err != nil {
		return err
	}
	source, err := format.Source(main.Bytes())
	if err != nil {
		return err
	}
	files := map[string][]byte{
		"explorer/swagger.json": data,
		"cli/swagger.json":      data,
		"cli/main.go":           source,
		"cli/go.mod":            []byte(fmt.Sprintf("module generated.local/%s\n\ngo 1.26.0\n\ntoolchain go1.26.4\n\nrequire github.com/PerfectZQ/openapi-workbench %s\n", name, Version)),
		filepath.Join("skills", name+"-api", "SKILL.md"): skill,
		"README.md": []byte(fmt.Sprintf("# %s API tools\n\nGenerated from Swagger 2.0 with API Explorer %s.\n\n- Mount `explorer/` on your API origin, using your existing same-origin gateway and access policy.\n- Build the CLI: `cd cli && go mod tidy && go build -o ../bin/%s .`. Put `bin/` on PATH and set `%s_BASE_URL` to your service origin.\n- Go and TypeScript SDK projects are in `sdk/go/` and `sdk/typescript/`; see their READMEs for build and use.\n- Install `skills/%s-api/` in your agent's skill directory (for Codex, `~/.codex/skills/` or your project's `.agents/skills/`). The skill uses the installed CLI.\n- Update your goswag contract and rerun generation into a new directory to refresh all artifacts. Do not edit the generated contract.\n", name, Version, name, envPrefix, name)),
	}
	for path, content := range files {
		target := filepath.Join(stage, path)
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(target, content, 0644); err != nil {
			return err
		}
	}
	if err := sdkproject.Generate(filepath.Join(stage, "cli", "swagger.json"), filepath.Join(stage, "sdk"), []string{"go", "typescript"}); err != nil {
		return err
	}
	return os.Rename(stage, directory)
}
