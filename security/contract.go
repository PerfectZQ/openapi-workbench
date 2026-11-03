package security

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Policy is the security projection of a Swagger document. Bind each real
// handler to its document path; deployment prefixes remain owned by the host.
type Policy struct {
	Schemes  map[string]Scheme
	security Requirements
	paths    map[string]map[string]json.RawMessage
}

// Parse reads policy directly from goswag output, avoiding a second scheme or
// permission registry. Gate.Protect validates the selected requirement at mount.
func Parse(data []byte) (Policy, error) {
	var document struct {
		Swagger  string                                `json:"swagger"`
		Schemes  map[string]Scheme                     `json:"securityDefinitions"`
		Security Requirements                          `json:"security"`
		Paths    map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(data, &document); err != nil {
		return Policy{}, fmt.Errorf("read Swagger security: %w", err)
	}
	if document.Swagger != "2.0" {
		return Policy{}, fmt.Errorf("security policy requires Swagger 2.0")
	}
	return Policy{Schemes: document.Schemes, security: document.Security, paths: document.Paths}, nil
}

// Requirements resolves operation overrides, including an explicitly empty
// security list. Missing operations are errors and never become anonymous.
func (p Policy) Requirements(method, path string) (Requirements, error) {
	method = strings.ToLower(method)
	switch method {
	case "get", "post", "put", "patch", "delete", "head", "options":
	default:
		return nil, fmt.Errorf("invalid HTTP method")
	}
	raw, ok := p.paths[path][method]
	if !ok {
		return nil, fmt.Errorf("security operation not found: %s %s", method, path)
	}
	var op struct {
		Security Requirements `json:"security"`
	}
	if err := json.Unmarshal(raw, &op); err != nil {
		return nil, err
	}
	if op.Security != nil {
		return op.Security, nil
	}
	return p.security, nil
}
