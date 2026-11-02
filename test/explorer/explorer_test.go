package explorer_test

import (
	"encoding/json"
	explorer "github.com/PerfectZQ/openapi-workbench"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMountCompleteProduct(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("/tools/api/", http.StripPrefix("/tools/api", explorer.Handler("/swagger/doc.json")))
	for path, fragment := range map[string]string{"/tools/api/": "<title>API Explorer</title>", "/tools/api/api-explorer.json": "/swagger/doc.json", "/tools/api/JetBrainsMono-OFL.txt": "SIL"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), fragment) {
			t.Fatalf("%s: HTTP %d %s", path, w.Code, w.Body.String())
		}
	}
}

func TestExportContainsAllBrowserAssets(t *testing.T) {
	destination := filepath.Join(t.TempDir(), "public", "explorer")
	if err := explorer.Export(destination, "/swagger/doc.json"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(destination, "api-explorer.json"))
	if err != nil {
		t.Fatal(err)
	}
	var config struct{ Spec string }
	if err := json.Unmarshal(data, &config); err != nil || config.Spec != "/swagger/doc.json" {
		t.Fatalf("config: %s %v", data, err)
	}
	files := map[string]bool{}
	if err := filepath.WalkDir(destination, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			files[filepath.Ext(path)] = true
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	for _, extension := range []string{".html", ".js", ".css", ".woff2", ".txt"} {
		if !files[extension] {
			t.Errorf("missing %s resources", extension)
		}
	}
	if err := explorer.Export(destination, "/changed.json"); err == nil {
		t.Fatal("overwrote an existing destination")
	}
}
