// Package routes projects a method's protocol bindings for both SDK providers.
package routes

import "github.com/PerfectZQ/openapi-workbench/contract"

type Routes struct {
	REST   *REST   `json:"rest,omitempty"`
	Action *Action `json:"action,omitempty"`
}

type REST struct {
	Method     string      `json:"method"`
	Path       string      `json:"path"`
	Parameters []Parameter `json:"parameters,omitempty"`
	File       bool        `json:"file,omitempty"`
}

type Parameter struct {
	Name string `json:"name"`
	In   string `json:"in"`
}

type Action struct {
	Path       string   `json:"path,omitempty"`
	Name       string   `json:"name"`
	Version    string   `json:"version"`
	InputJSON  []string `json:"inputJSON,omitempty"`
	OutputJSON []string `json:"outputJSON,omitempty"`
}

func FromMethod(m contract.Method, defaultVersion string) Routes {
	var result Routes
	// A Swagger path ending in a query-declared Action is only a discovery entry.
	if m.Path != "" && m.Action == "" {
		rest := &REST{Method: m.Verb, Path: m.Path, File: m.Op.File}
		for _, p := range m.Op.Parameters {
			if p.In == "path" || p.In == "query" {
				rest.Parameters = append(rest.Parameters, Parameter{Name: p.Name, In: p.In})
			}
		}
		result.REST = rest
	}
	if action := m.Op.Action; action.Name != "" {
		version := action.Version
		if version == "" {
			version = defaultVersion
		}
		result.Action = &Action{Path: action.Path, Name: action.Name, Version: version, InputJSON: m.Op.InputJSON, OutputJSON: m.Op.OutputJSON}
	}
	return result
}
