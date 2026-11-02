package golang

import (
	"os"
	"strings"
)

func (p Provider) archiveSDK() error {
	return p.Target.Archive(func(name string, entry os.DirEntry) (bool, error) {
		return strings.HasSuffix(name, ".go") || strings.HasSuffix(name, ".md") || entry.Name() == "go.mod" || entry.Name() == "go.sum", nil
	})
}
