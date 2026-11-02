package artifact

import (
	"archive/zip"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
)

// Target describes the source directory and optional archive chosen by the caller.
type Target struct {
	Directory   string
	ArchivePath string
	ArchiveRoot string
}

// Archive writes deterministic SDK sources; include controls each provider's package layout.
// Directory predicates may return filepath.SkipDir to exclude dependencies and build output.
func (target Target) Archive(include func(string, os.DirEntry) (bool, error)) error {
	if target.ArchivePath == "" && target.ArchiveRoot == "" {
		return nil
	}
	if target.ArchivePath == "" || target.ArchiveRoot == "" {
		return fmt.Errorf("SDK archive requires both path and root")
	}
	var data bytes.Buffer
	writer := zip.NewWriter(&data)
	err := filepath.WalkDir(target.Directory, func(name string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(target.Directory, name)
		if err != nil {
			return err
		}
		relative = filepath.ToSlash(relative)
		keep, err := include(relative, entry)
		if err != nil {
			return err
		}
		if entry.IsDir() || !keep {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("SDK archive must not include symlink %s", name)
		}
		content, err := os.ReadFile(name)
		if err != nil {
			return err
		}
		file, err := writer.Create(target.ArchiveRoot + "/" + relative)
		if err != nil {
			return err
		}
		_, err = file.Write(content)
		return err
	})
	if err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target.ArchivePath), 0755); err != nil {
		return err
	}
	return os.WriteFile(target.ArchivePath, data.Bytes(), 0644)
}
