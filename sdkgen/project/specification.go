package project

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func specification(specPath string) ([]byte, error) {
	// Standard Swagger basePath is part of the wire path, not an extra client mount.
	data, err := os.ReadFile(specPath)
	if err != nil {
		return nil, err
	}
	var spec map[string]json.RawMessage
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, fmt.Errorf("read Swagger contract: %w", err)
	}
	var basePath string
	if raw, ok := spec["basePath"]; ok {
		if err := json.Unmarshal(raw, &basePath); err != nil {
			return nil, fmt.Errorf("Swagger basePath: %w", err)
		}
	}
	if basePath != "" && basePath != "/" {
		if !strings.HasPrefix(basePath, "/") || strings.ContainsAny(basePath, "?#") {
			return nil, fmt.Errorf("invalid Swagger basePath %q", basePath)
		}
		var paths map[string]json.RawMessage
		if err := json.Unmarshal(spec["paths"], &paths); err != nil {
			return nil, fmt.Errorf("Swagger paths: %w", err)
		}
		fullPaths := make(map[string]json.RawMessage, len(paths))
		for path, value := range paths {
			fullPaths[strings.TrimSuffix(basePath, "/")+path] = value
		}
		spec["paths"], _ = json.Marshal(fullPaths)
		delete(spec, "basePath")
		data, err = json.Marshal(spec)
		if err != nil {
			return nil, err
		}
	}
	return data, nil
}
