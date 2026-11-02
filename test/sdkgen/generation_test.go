package sdkgen_test

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PerfectZQ/openapi-workbench/contract"
	"github.com/PerfectZQ/openapi-workbench/sdkgen"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/golang"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/typescript"
)

// A different API, output layout and public identity must work through the same
// providers, without consumer routes, naming rules or repository directories.
func TestProvidersGenerateIndependentAPI(t *testing.T) {
	root := t.TempDir()
	specPath := filepath.Join(root, "api.json")
	spec := `{"swagger":"2.0","definitions":{"Item":{"type":"object","properties":{"title":{"type":"string"}}}},"paths":{"/catalog/items":{"get":{"operationId":"List","responses":{"200":{"schema":{"$ref":"#/definitions/Item"}}}}}}}`
	if err := os.WriteFile(specPath, []byte(spec), 0644); err != nil {
		t.Fatal(err)
	}
	goTarget := artifact.Target{Directory: filepath.Join(root, "go-client"), ArchivePath: filepath.Join(root, "downloads/go.zip"), ArchiveRoot: "catalog-go"}
	tsTarget := artifact.Target{Directory: filepath.Join(root, "ts-client"), ArchivePath: filepath.Join(root, "downloads/ts.zip"), ArchiveRoot: "catalog-ts"}
	generator := sdkgen.Generator{
		Providers: []sdkgen.Provider{golang.Provider{Target: goTarget, Package: "catalog"}, typescript.Provider{Target: tsTarget, ClientName: "CatalogClient"}},
		NameMethod: func(method *contract.Method) error {
			method.Group, method.Name = "Catalog", method.Op.OperationID
			return nil
		},
	}
	if err := generator.Generate(specPath, generator.Languages()); err != nil {
		t.Fatal(err)
	}
	// Git consumers generate the same sources without creating a download archive.
	generator.Providers = []sdkgen.Provider{
		golang.Provider{Target: artifact.Target{Directory: goTarget.Directory}, Package: "catalog"},
		typescript.Provider{Target: artifact.Target{Directory: tsTarget.Directory}, ClientName: "CatalogClient"},
	}
	if err := generator.Generate(specPath, generator.Languages()); err != nil {
		t.Fatal(err)
	}

	for file, fragments := range map[string][]string{
		filepath.Join(goTarget.Directory, "api_catalog.gen.go"):  {"package catalog", "func (s *CatalogService) List", `"/catalog/items"`},
		filepath.Join(goTarget.Directory, "models.gen.go"):       {"type Item struct", "type CatalogListOutput struct"},
		filepath.Join(tsTarget.Directory, "src/services.gen.ts"): {"export class CatalogClient", "list(input:", `"path":"/catalog/items"`},
		filepath.Join(tsTarget.Directory, "src/models.gen.ts"):   {"export type Item =", "export type CatalogListOutput = Item;"},
	} {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for _, fragment := range fragments {
			if !strings.Contains(string(data), fragment) {
				t.Errorf("%s missing %q", file, fragment)
			}
		}
		if strings.Contains(string(data), "cloudlead") || strings.Contains(string(data), "CloudLead") {
			t.Errorf("%s contains project identity", file)
		}
	}
	for _, target := range []artifact.Target{goTarget, tsTarget} {
		archive, err := zip.OpenReader(target.ArchivePath)
		if err != nil {
			t.Fatal(err)
		}
		if len(archive.File) == 0 {
			t.Fatal("empty SDK archive")
		}
		for _, file := range archive.File {
			if !strings.HasPrefix(file.Name, target.ArchiveRoot+"/") {
				t.Errorf("unexpected archive path %s", file.Name)
			}
		}
		archive.Close()
	}
}
