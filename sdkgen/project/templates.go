package project

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed templates
var templates embed.FS

func writeRuntimes(stage string, selected []string) error {
	for _, language := range selected {
		root := "templates/" + language
		if err := fs.WalkDir(templates, root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			target := filepath.Join(stage, language, strings.TrimPrefix(path, root))
			if entry.IsDir() {
				return os.MkdirAll(target, 0755)
			}
			data, err := templates.ReadFile(path)
			if err != nil {
				return err
			}
			return os.WriteFile(strings.TrimSuffix(target, ".tmpl"), data, 0644)
		}); err != nil {
			return err
		}
	}
	return nil
}
