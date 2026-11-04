// Package cli runs Swagger-driven API commands without business dependencies.
package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/security"
)

type specification struct {
	BasePath            string                                `json:"basePath"`
	Security            []map[string][]string                 `json:"security"`
	Swagger             string                                `json:"swagger"`
	Paths               map[string]map[string]json.RawMessage `json:"paths"`
	Definitions         map[string]json.RawMessage            `json:"definitions"`
	SecurityDefinitions map[string]security.Scheme            `json:"securityDefinitions"`
	Actions             []struct {
		Path      string          `json:"path"`
		Method    string          `json:"method"`
		Action    string          `json:"action"`
		Version   string          `json:"version"`
		Operation json.RawMessage `json:"operation"`
	} `json:"x-api-actions"`
}

type Parameter struct {
	Name             string            `json:"name"`
	In               string            `json:"in"`
	Required         bool              `json:"required"`
	Default          json.RawMessage   `json:"default"`
	Type             string            `json:"type"`
	Description      string            `json:"description"`
	Schema           json.RawMessage   `json:"schema"`
	Enum             []json.RawMessage `json:"enum"`
	CollectionFormat string            `json:"collectionFormat"`
}

type Operation struct {
	securityDefinitions map[string]security.Scheme
	Security            []map[string][]string `json:"security"`
	OperationID         string                `json:"operationId"`
	Group               string                `json:"x-cli-group"`
	Summary             string                `json:"summary"`
	Description         string                `json:"description"`
	Deprecated          bool                  `json:"deprecated"`
	Lifecycle           json.RawMessage       `json:"x-api-lifecycle"`
	Tags                []string              `json:"tags"`
	Parameters          []Parameter           `json:"parameters"`
	BusinessID          string                `json:"x-api-operation"`
	BusinessFile        bool                  `json:"x-api-file"`
	BusinessAction      struct {
		Name    string `json:"name"`
		Path    string `json:"path"`
		Version string `json:"version"`
	} `json:"x-api-action"`
	InputJSON       []string `json:"x-api-input-json"`
	actionOperation *Operation
	actionVersion   string
	actionPath      string
	actionMethod    string
	Responses       map[string]struct {
		Schema json.RawMessage `json:"schema"`
	} `json:"responses"`
}

type Command struct {
	Group       string          `json:"group"`
	Command     string          `json:"command"`
	Method      string          `json:"method"`
	Path        string          `json:"path"`
	RuntimePath string          `json:"runtime_path"`
	Action      string          `json:"action,omitempty"`
	Summary     string          `json:"summary"`
	Tags        []string        `json:"tags"`
	Deprecated  bool            `json:"deprecated,omitempty"`
	Lifecycle   json.RawMessage `json:"lifecycle,omitempty"`
}

func (a App) loadSpec() (specification, error) {
	var spec specification
	data := a.Specification
	if filename := os.Getenv(a.EnvPrefix + "_SPEC"); a.EnvPrefix != "" && filename != "" {
		var err error
		data, err = ReadBody("@"+filename, nil)
		if err != nil {
			return spec, fmt.Errorf("无法加载 Swagger: %w", err)
		}
	}
	if err := json.Unmarshal(data, &spec); err != nil {
		return spec, fmt.Errorf("Swagger JSON 无效")
	}
	if spec.Swagger != "2.0" {
		return spec, fmt.Errorf("目前仅支持 Swagger 2.0 契约")
	}
	return spec, nil
}

func (s specification) lookup(method, path string) (Command, Operation, error) {
	var op Operation
	raw := s.Paths[path][strings.ToLower(method)]
	if len(raw) == 0 {
		return Command{}, op, fmt.Errorf("契约中不存在该操作；请使用 api list 查找 method/path")
	}
	if err := json.Unmarshal(raw, &op); err != nil {
		return Command{}, op, err
	}
	op.securityDefinitions = s.SecurityDefinitions
	if op.Security == nil {
		op.Security = s.Security
	}
	v := Command{Method: strings.ToUpper(method), Path: path, RuntimePath: strings.TrimSuffix(s.BasePath, "/") + path, Summary: op.Summary, Tags: op.Tags, Deprecated: op.Deprecated, Lifecycle: op.Lifecycle}
	for _, p := range op.Parameters {
		if p.In == "query" && p.Name == "Action" {
			if err := json.Unmarshal(p.Default, &v.Action); err != nil || v.Action == "" || !strings.HasSuffix(path, "/"+v.Action) {
				return v, op, fmt.Errorf("%s %s: Action %q 与文档路径不一致", v.Method, path, v.Action)
			}
			v.RuntimePath = strings.TrimSuffix(v.RuntimePath, "/"+v.Action)
		}
	}
	v.Group = commandGroup(op.Group)
	if v.Group == "" && strings.Contains(op.OperationID, ".") {
		v.Group = commandGroup(strings.SplitN(op.OperationID, ".", 2)[0])
	}
	if v.Group == "" && len(op.Tags) > 0 {
		v.Group = commandGroup(op.Tags[0])
	}
	if v.Group == "" {
		v.Group = "api-operations"
	}
	name := op.OperationID
	if op.BusinessID != "" {
		name = op.BusinessAction.Name
		sameName := 0
		for _, action := range s.Actions {
			if action.Action != op.BusinessAction.Name {
				continue
			}
			sameName++
			if op.BusinessAction.Path != "" && action.Path != op.BusinessAction.Path ||
				op.BusinessAction.Version != "" && action.Version != op.BusinessAction.Version {
				continue
			}
			if op.actionOperation != nil {
				return v, op, fmt.Errorf("业务操作 %s 的 Action 投影不唯一", op.BusinessID)
			}
			var projected Operation
			if err := json.Unmarshal(action.Operation, &projected); err != nil {
				return v, op, err
			}
			projected.securityDefinitions = s.SecurityDefinitions
			if projected.Security == nil {
				projected.Security = s.Security
			}
			op.actionOperation, op.actionVersion = &projected, action.Version
			op.actionPath, op.actionMethod = strings.TrimSuffix(s.BasePath, "/")+action.Path, strings.ToUpper(action.Method)
		}
		if sameName > 1 {
			name = kebab(op.BusinessID)
		}
		if op.actionOperation == nil {
			return v, op, fmt.Errorf("业务操作 %s 缺少 Action 投影", op.BusinessID)
		}
	}
	if at := strings.LastIndex(name, "."); at >= 0 {
		name = name[at+1:]
	}
	if name == "" {
		name = v.Action
	}
	if name == "" {
		name = method + "-" + strings.Trim(path, "/")
	}
	v.Command = kebab(name)
	return v, op, nil
}

func (s specification) list(search, tag string) ([]Command, error) {
	result := []Command{}
	for path, methods := range s.Paths {
		for method := range methods {
			if !isMethod(method) {
				continue
			}
			v, op, err := s.lookup(method, path)
			if err != nil {
				return nil, err
			}
			if tag != "" && !contains(op.Tags, tag) {
				continue
			}
			haystack := strings.ToLower(path + " " + v.Method + " " + v.Group + " " + v.Command + " " + op.Summary + " " + op.Description + " " + strings.Join(op.Tags, " "))
			if !strings.Contains(haystack, strings.ToLower(search)) {
				continue
			}
			result = append(result, v)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Path == result[j].Path {
			return result[i].Method < result[j].Method
		}
		return result[i].Path < result[j].Path
	})
	return result, nil
}

func (s specification) describe(v Command) (any, error) {
	raw := s.Paths[v.Path][strings.ToLower(v.Method)]
	definitions := map[string]json.RawMessage{}
	// 只带当前操作可达的 Schema；递归引用保留 $ref，避免展开循环及整份契约输出。
	var visit func(json.RawMessage) error
	visit = func(data json.RawMessage) error {
		var value any
		if err := json.Unmarshal(data, &value); err != nil {
			return err
		}
		var walk func(any) error
		walk = func(value any) error {
			switch node := value.(type) {
			case map[string]any:
				if ref, ok := node["$ref"].(string); ok {
					const prefix = "#/definitions/"
					if !strings.HasPrefix(ref, prefix) {
						return fmt.Errorf("不支持的 Schema 引用")
					}
					name := strings.TrimPrefix(ref, prefix)
					if _, seen := definitions[name]; !seen {
						definition, exists := s.Definitions[name]
						if !exists {
							return fmt.Errorf("缺少 Schema: %s", name)
						}
						definitions[name] = definition
						if err := visit(definition); err != nil {
							return err
						}
					}
				}
				for _, child := range node {
					if err := walk(child); err != nil {
						return err
					}
				}
			case []any:
				for _, child := range node {
					if err := walk(child); err != nil {
						return err
					}
				}
			}
			return nil
		}
		return walk(value)
	}
	if err := visit(raw); err != nil {
		return nil, err
	}
	return struct {
		Command
		Contract            json.RawMessage            `json:"contract"`
		Definitions         map[string]json.RawMessage `json:"definitions"`
		SecurityDefinitions map[string]security.Scheme `json:"security_definitions"`
	}{v, raw, definitions, s.SecurityDefinitions}, nil
}

func isMethod(method string) bool {
	return contains([]string{"get", "post", "put", "patch", "delete", "head", "options"}, strings.ToLower(method))
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
