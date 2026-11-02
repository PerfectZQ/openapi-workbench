// Package explorer delivers API Explorer's ready-to-mount Swagger interface.
package explorer

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

//go:embed all:frontend/assets
var bundled embed.FS

// Handler serves the complete interface. Mount with http.StripPrefix at a
// trailing-slash path; specURL is the browser-visible Swagger JSON URL.
// Apply the host's authentication middleware to this handler and the contract.
func Handler(specURL string) http.Handler {
	assets, _ := fs.Sub(bundled, "frontend/assets")
	files := http.FileServerFS(assets)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api-explorer.json" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			_ = json.NewEncoder(w).Encode(struct {
				Spec string `json:"spec"`
			}{specURL})
			return
		}
		files.ServeHTTP(w, r)
	})
}

// Export writes the complete interface to a new directory for any static server.
// An existing destination is rejected so application files cannot be overwritten.
func Export(directory, specURL string) error {
	if specURL == "" {
		return fmt.Errorf("Swagger URL is required")
	}
	assets, _ := fs.Sub(bundled, "frontend/assets")
	parent := filepath.Dir(directory)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return err
	}
	if _, err := os.Lstat(directory); !os.IsNotExist(err) {
		return fmt.Errorf("output must be a new directory: %s", directory)
	}
	stage, err := os.MkdirTemp(parent, ".api-explorer-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := fs.WalkDir(assets, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		target := filepath.Join(stage, filepath.FromSlash(path))
		if entry.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		data, err := fs.ReadFile(assets, path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0644)
	}); err != nil {
		return err
	}
	config, _ := json.Marshal(struct {
		Spec string `json:"spec"`
	}{specURL})
	if err := os.WriteFile(filepath.Join(stage, "api-explorer.json"), config, 0644); err != nil {
		return err
	}
	return os.Rename(stage, directory)
}
