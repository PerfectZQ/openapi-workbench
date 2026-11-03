package product_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/PerfectZQ/openapi-workbench/product"
)

// Builds and runs the delivered CLI, fetches the exported Explorer and checks
// atomic generation. The temporary workspace supplies the source under test;
// the delivered go.mod must still pin the published product version.
func TestGenerateBuildAndCall(t *testing.T) {
	temp, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	spec := filepath.Join(temp, "swagger.json")
	contract := []byte(`{"swagger":"2.0","info":{"title":"Inventory","version":"1"},"basePath":"/v1","paths":{"/items":{"get":{"operationId":"inventory.ListItems","responses":{"200":{"schema":{"type":"array","items":{"type":"object"}}}}}}}}`)
	if err := os.WriteFile(spec, contract, 0600); err != nil {
		t.Fatal(err)
	}
	directory := filepath.Join(temp, "tools")
	if err := product.Generate(spec, directory, "inventory"); err != nil {
		t.Fatal(err)
	}
	manifest, err := os.ReadFile(filepath.Join(directory, "cli", "go.mod"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(manifest), product.Version) || strings.Contains(string(manifest), "replace") {
		t.Fatal("generated module is not pinned")
	}
	for _, path := range []string{"explorer/swagger.json", "cli/swagger.json"} {
		data, err := os.ReadFile(filepath.Join(directory, path))
		if err != nil || string(data) != string(contract) {
			t.Fatalf("contract changed: %s %v", path, err)
		}
	}
	for _, path := range []string{"sdk/go/go.mod", "sdk/typescript/package.json"} {
		if _, err := os.Stat(filepath.Join(directory, path)); err != nil {
			t.Fatal(err)
		}
	}
	skill, err := os.ReadFile(filepath.Join(directory, "skills/inventory-api/SKILL.md"))
	if err != nil || !strings.Contains(string(skill), "inventory api list") || strings.Contains(string(skill), "CLOUD_LEAD") {
		t.Fatalf("skill=%s %v", skill, err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/items" {
			t.Errorf("path=%s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`[{"id":9007199254740993}]`))
	}))
	defer server.Close()
	_, file, _, _ := runtime.Caller(0)
	root := filepath.Clean(filepath.Join(filepath.Dir(file), "../.."))
	workspace := filepath.Join(temp, "go.work")
	content := "go 1.26.0\nuse (\n" + strconv.Quote(root) + "\n" + strconv.Quote(filepath.Join(directory, "cli")) + "\n)\n"
	if err := os.WriteFile(workspace, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	goBin := filepath.Join(runtime.GOROOT(), "bin", "go")
	binary := filepath.Join(temp, "inventory")
	command := exec.Command(goBin, "build", "-o", binary, ".")
	command.Dir = filepath.Join(directory, "cli")
	command.Env = append(os.Environ(), "GOWORK="+workspace)
	if out, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build: %v %s", err, out)
	}
	command = exec.Command(binary, "inventory", "list-items", "--base-url", server.URL)
	data, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("run: %v %s", err, data)
	}
	var output map[string]json.RawMessage
	if json.Unmarshal(data, &output) != nil || string(output["ok"]) != "true" || string(output["result"]) != `[{"id":9007199254740993}]` {
		t.Fatalf("result=%s", data)
	}
	ui := httptest.NewServer(http.FileServer(http.Dir(filepath.Join(directory, "explorer"))))
	defer ui.Close()
	for _, path := range []string{"/", "/api-explorer.json", "/swagger.json"} {
		response, err := ui.Client().Get(ui.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 200 {
			t.Fatalf("UI %s: %d", path, response.StatusCode)
		}
	}
	if err := product.Generate(spec, directory, "inventory"); err == nil {
		t.Fatal("existing project overwritten")
	}
	invalid := filepath.Join(temp, "invalid")
	if err := product.Generate(spec, invalid, "../unsafe"); err == nil {
		t.Fatal("unsafe command accepted")
	}
	if _, err := os.Stat(invalid); !os.IsNotExist(err) {
		t.Fatal("failed generation left output")
	}
}
