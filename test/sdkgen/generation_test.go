package sdkgen_test

import (
	"archive/zip"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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
	spec := `{"swagger":"2.0","definitions":{"Item":{"type":"object","properties":{"title":{"type":"string"}}}},"paths":{"/catalog/lookup":{"post":{"operationId":"Lookup","x-api-operation":"catalog.lookup","x-api-action":{"name":"Find","path":"/catalog/actions","version":"2023-01-01"},"x-api-request":{"$ref":"#/definitions/Item"},"x-api-result":{"$ref":"#/definitions/Item"},"responses":{"200":{"schema":{"$ref":"#/definitions/Item"}}}}},"/catalog/items":{"get":{"operationId":"List","x-api-result-field":"title","responses":{"200":{"schema":{"$ref":"#/definitions/Item"}}}}}}}`
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
		filepath.Join(goTarget.Directory, "config.gen.go"):       {"package catalog", "type Config struct", "BasePath string"},
		filepath.Join(tsTarget.Directory, "src/config.gen.ts"):   {"export interface ClientConfig", "basePath?: string"},
		filepath.Join(goTarget.Directory, "api_catalog.gen.go"):  {"package catalog", "func (s *CatalogService) List", `"/catalog/items"`, `actionPath: "/catalog/actions"`, `action: "Find"`},
		filepath.Join(goTarget.Directory, "models.gen.go"):       {"type Item struct", "type CatalogListOutput struct"},
		filepath.Join(tsTarget.Directory, "src/services.gen.ts"): {"export class CatalogClient", "listResult(input:", "list(input:", `"path":"/catalog/items"`, `"actionPath":"/catalog/actions"`, `"action":"Find"`},
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

	// Execute the generated transport configuration in both languages. The fixture
	// has no consumer runtime, so base-path behavior must come from the provider.
	goProbe := `package catalog
import (
    "context"
    "net/http"
    "net/url"
    "testing"
)
func TestGeneratedConfig(t *testing.T) {
    for _, base := range []string{"", "/gateway", "/tenant/catalog"} {
        state, err := newClientState(Config{Endpoint: "https://example.test/", BasePath: base})
        if err != nil { t.Fatal(err) }
        got := state.requestURL("/catalog/items/a%2Fb", url.Values{"q": {"x/y", "z"}})
        want := "https://example.test" + base + "/catalog/items/a%2Fb?q=x%2Fy&q=z"
        if got != want { t.Fatalf("got %s, want %s", got, want) }
        if got := state.requestURL("/", nil); got != "https://example.test" + base + "/" { t.Fatal(got) }
    }
    for _, base := range []string{"/", "relative", "//host", "/gateway/", "/x/../y", "/x?q=1", "/x#fragment", "/x%2Fy", "/x\\y"} {
        if _, err := newClientState(Config{Endpoint: "https://example.test", BasePath: base}); err == nil { t.Fatalf("accepted %q", base) }
    }
    if _, err := newClientState(Config{Endpoint: "https://example.test", BasePath: "/gateway", InnerTOPVersion: "2023-01-01", Authenticate: func(context.Context, *http.Request) error { return nil }}); err == nil { t.Fatal("gateway accepted base path") }
}
`
	goProbePath := filepath.Join(goTarget.Directory, "config_test.go")
	if err := os.WriteFile(goProbePath, []byte(goProbe), 0644); err != nil {
		t.Fatal(err)
	}
	goCommand := exec.Command(filepath.Join(runtime.GOROOT(), "bin", "go"), "test", filepath.Join(goTarget.Directory, "config.gen.go"), goProbePath)
	if output, err := goCommand.CombinedOutput(); err != nil {
		t.Fatalf("generated Go configuration: %v\n%s", err, output)
	}
	tsProbe := `import assert from 'node:assert/strict';
import { configureClient, requestURL } from './config.gen.ts';
for (const basePath of [undefined, '', '/gateway', '/tenant/catalog']) {
  const config = configureClient({ endpoint: 'https://example.test/', basePath });
  assert.ok(Object.isFrozen(config));
  assert.equal(requestURL(config, '/catalog/items/a%2Fb', new URLSearchParams('q=x%2Fy&q=z')), 'https://example.test' + (basePath ?? '') + '/catalog/items/a%2Fb?q=x%2Fy&q=z');
  assert.equal(requestURL(config, '/', new URLSearchParams()), 'https://example.test' + (basePath ?? '') + '/');
}
for (const basePath of ['/', 'relative', '//host', '/gateway/', '/x/../y', '/x?q=1', '/x#fragment', '/x%2Fy', '/x\\y']) {
  assert.throws(() => configureClient({ endpoint: 'https://example.test', basePath }), /base path/);
}
assert.throws(() => configureClient({ endpoint: 'https://example.test', basePath: '/gateway', innerTOPVersion: '2023-01-01', authenticate() {} }), /base path/);
`
	tsProbePath := filepath.Join(tsTarget.Directory, "src/config.test.mjs")
	if err := os.WriteFile(tsProbePath, []byte(tsProbe), 0644); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("node", "--experimental-strip-types", tsProbePath).CombinedOutput(); err != nil {
		t.Fatalf("generated TypeScript configuration: %v\n%s", err, output)
	}
}
