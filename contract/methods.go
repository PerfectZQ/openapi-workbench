package contract

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Method struct {
	Group, Name, Path, Action, Verb string
	Op                              Operation
}

func Methods(spec Specification, nameMethod func(*Method) error) (map[string][]Method, error) {
	groups := map[string][]Method{}
	for _, p := range Keys(spec.Paths) {
		for _, verb := range Keys(spec.Paths[p]) {
			if !isMethod(verb) {
				return nil, fmt.Errorf("%s: unsupported path entry %q", p, verb)
			}
			m, err := parseMethod(p, verb, spec.Paths[p][verb])
			if err != nil {
				return nil, err
			}
			if err := nameMethod(&m); err != nil {
				return nil, err
			}
			for _, old := range groups[m.Group] {
				if old.Name == m.Name {
					return nil, fmt.Errorf("duplicate SDK method %s.%s", m.Group, m.Name)
				}
			}
			groups[m.Group] = append(groups[m.Group], m)
		}
	}
	return groups, nil
}

func isMethod(s string) bool {
	switch s {
	case "get", "post", "put", "patch", "delete", "head", "options":
		return true
	}
	return false
}

// SuccessResponse prefers 200, then the first declared successful status.
func (op Operation) SuccessResponse() (Schema, error) {
	if response, ok := op.Responses["200"]; ok {
		return response.Schema, nil
	}
	for _, status := range Keys(op.Responses) {
		if strings.HasPrefix(status, "2") {
			return op.Responses[status].Schema, nil
		}
	}
	return Schema{}, fmt.Errorf("missing success response")
}

func parseMethod(p, verb string, op Operation) (Method, error) {
	m := Method{Verb: strings.ToUpper(verb), Path: p, Op: op}
	for _, param := range op.Parameters {
		if param.In != "query" || param.Name != "Action" {
			continue
		}
		if len(param.Enum) != 1 {
			return Method{}, fmt.Errorf("%s: Action needs exactly one enum", p)
		}
		if err := json.Unmarshal(param.Enum[0], &m.Action); err != nil {
			return Method{}, fmt.Errorf("%s: Action enum must be a string: %w", p, err)
		}
		if !strings.HasSuffix(p, "/"+m.Action) {
			return Method{}, fmt.Errorf("%s: Action path mismatch", p)
		}
		m.Path = strings.TrimSuffix(p, "/"+m.Action)
	}
	return m, nil
}
