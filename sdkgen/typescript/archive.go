package typescript

import (
	"os"
	"path/filepath"
	"strings"
)

func (p Provider) archiveSDK() error {
	return p.Target.Archive(func(name string, entry os.DirEntry) (bool, error) {
		if entry.IsDir() {
			if name != "." && name != "src" && name != "test" && name != "script" {
				return false, filepath.SkipDir
			}
			return false, nil
		}
		include := name == "package.json" || name == "package-lock.json" || name == "tsconfig.json" || name == "README.md" || name == ".gitignore" ||
			(strings.HasPrefix(name, "src/") && strings.HasSuffix(name, ".ts")) ||
			(strings.HasPrefix(name, "script/") && strings.HasSuffix(name, ".mjs")) ||
			(strings.HasPrefix(name, "test/") && strings.HasSuffix(name, ".test.mjs"))
		return include, nil
	})
}
