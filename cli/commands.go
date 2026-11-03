package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode"
)

func commandGroup(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' {
			return unicode.ToLower(r)
		}
		return -1
	}, value)
}

func kebab(value string) string {
	runes := []rune(value)
	var out []rune
	for i, r := range runes {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			if len(out) > 0 && out[len(out)-1] != '-' {
				out = append(out, '-')
			}
			continue
		}
		if unicode.IsUpper(r) && i > 0 && len(out) > 0 && out[len(out)-1] != '-' && (unicode.IsLower(runes[i-1]) || unicode.IsDigit(runes[i-1]) || (unicode.IsUpper(runes[i-1]) && i+1 < len(runes) && unicode.IsLower(runes[i+1]))) {
			out = append(out, '-')
		}
		out = append(out, unicode.ToLower(r))
	}
	return strings.Trim(string(out), "-")
}

func (s specification) namedOperations() ([]Command, error) {
	views, err := s.list("", "")
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, v := range views {
		key := v.Group + " " + v.Command
		if v.Group == "" || v.Group == "api" || v.Command == "" || seen[key] {
			return nil, fmt.Errorf("命令分组缺失、保留或重名: %s；请修正 Tag/x-cli-group/operationId", key)
		}
		seen[key] = true
	}
	sort.Slice(views, func(i, j int) bool { return views[i].Group+" "+views[i].Command < views[j].Group+" "+views[j].Command })
	return views, nil
}

type jsonSchema struct {
	Ref         string                     `json:"$ref"`
	Type        string                     `json:"type"`
	Description string                     `json:"description"`
	Properties  map[string]json.RawMessage `json:"properties"`
	Required    []string                   `json:"required"`
	AllOf       []json.RawMessage          `json:"allOf"`
	Enum        []json.RawMessage          `json:"enum"`
}

// 只展开命名参数所需的顶层属性；节点/图内部的业务结构仍由 API 校验。
func (s specification) topSchema(raw json.RawMessage, seen map[string]bool) (jsonSchema, error) {
	var schema jsonSchema
	if err := json.Unmarshal(raw, &schema); err != nil {
		return schema, err
	}
	if schema.Ref != "" {
		if seen[schema.Ref] {
			return schema, errors.New("顶层 Schema 循环引用")
		}
		seen[schema.Ref] = true
		defer delete(seen, schema.Ref)
		definition, ok := s.Definitions[strings.TrimPrefix(schema.Ref, "#/definitions/")]
		if !ok {
			return schema, errors.New("缺少参数 Schema")
		}
		return s.topSchema(definition, seen)
	}
	if schema.Properties == nil {
		schema.Properties = map[string]json.RawMessage{}
	}
	for _, part := range schema.AllOf {
		other, err := s.topSchema(part, seen)
		if err != nil {
			return schema, err
		}
		for name, prop := range other.Properties {
			schema.Properties[name] = prop
		}
		schema.Required = append(schema.Required, other.Required...)
	}
	if schema.Type == "" && len(schema.Properties) > 0 {
		schema.Type = "object"
	}
	return schema, nil
}

type namedParameter struct {
	Flag             string            `json:"flag"`
	Name             string            `json:"name"`
	In               string            `json:"in"`
	Type             string            `json:"type"`
	Required         bool              `json:"required"`
	Description      string            `json:"description"`
	Enum             []json.RawMessage `json:"enum,omitempty"`
	CollectionFormat string            `json:"-"`
}

func (s specification) namedParameters(op Operation) ([]namedParameter, error) {
	params := []namedParameter{}
	for _, p := range op.Parameters {
		if p.In == "body" {
			schema, err := s.topSchema(p.Schema, map[string]bool{})
			if err != nil {
				return nil, err
			}
			for name, raw := range schema.Properties {
				property, err := s.topSchema(raw, map[string]bool{})
				if err != nil {
					return nil, err
				}
				params = append(params, namedParameter{Name: name, In: "body", Type: property.Type, Required: contains(schema.Required, name), Description: property.Description, Enum: property.Enum})
			}
		} else if p.In == "path" || p.In == "query" && p.Name != "Action" {
			params = append(params, namedParameter{Name: p.Name, In: p.In, Type: p.Type, Required: p.Required, Description: p.Description, Enum: p.Enum, CollectionFormat: p.CollectionFormat})
		}
	}
	counts := map[string]int{}
	reserved := []string{"protocol", "base-url", "public-path-prefix", "auth-file", "headers-file", "header-env", "no-login", "output", "timeout", "body", "preview", "help", "h"}
	for _, p := range params {
		counts[kebab(p.Name)]++
	}
	seen := map[string]bool{}
	for i := range params {
		p := &params[i]
		p.Flag = kebab(p.Name)
		if counts[p.Flag] > 1 || contains(reserved, p.Flag) {
			p.Flag = p.In + "-" + p.Flag
		}
		if p.Flag == "" || seen[p.Flag] || contains(reserved, p.Flag) {
			return nil, errors.New("命名参数冲突；请使用 api call 的显式 path/query/body 参数")
		}
		seen[p.Flag] = true
	}
	sort.Slice(params, func(i, j int) bool { return params[i].Flag < params[j].Flag })
	return params, nil
}

func parseNamedValue(p namedParameter, text string, stdin io.Reader) (json.RawMessage, error) {
	var raw json.RawMessage
	if p.Type == "string" {
		raw, _ = json.Marshal(text)
	} else {
		if strings.HasPrefix(text, "@") || text == "-" {
			data, err := ReadBody(text, stdin)
			if err != nil {
				return nil, err
			}
			raw = data
		} else {
			raw = json.RawMessage(text)
		}
		var value any
		if err := decodeJSON(raw, &value); err != nil {
			return nil, fmt.Errorf("--%s 需要 %s", p.Flag, p.Type)
		}
		valid := true
		switch p.Type {
		case "integer":
			n, ok := value.(json.Number)
			valid = ok && isInteger(n)
		case "number":
			_, valid = value.(json.Number)
		case "boolean":
			_, valid = value.(bool)
		case "object":
			_, valid = value.(map[string]any)
		case "array":
			_, valid = value.([]any)
		}
		if !valid {
			return nil, fmt.Errorf("--%s 需要 %s", p.Flag, p.Type)
		}
	}
	if len(p.Enum) > 0 {
		found := false
		for _, enum := range p.Enum {
			if equalJSON(raw, enum) {
				found = true
			}
		}
		if !found {
			return nil, fmt.Errorf("--%s 不在枚举范围内", p.Flag)
		}
	}
	return raw, nil
}

func (a App) runNamed(ctx context.Context, args []string, stdin io.Reader) (Output, int) {
	spec, err := a.loadSpec()
	if err != nil {
		return localError(err)
	}
	views, err := spec.namedOperations()
	if err != nil {
		return localError(err)
	}
	group := []Command{}
	for _, v := range views {
		if v.Group == args[0] {
			group = append(group, v)
		}
	}
	if len(group) == 0 {
		return localError(errors.New("未知命令分组；请使用 --help 查找"))
	}
	if len(args) == 1 || args[1] == "--help" || args[1] == "-h" {
		return Output{OK: true, Result: group}, 0
	}
	var selected *Command
	for i := range group {
		if group[i].Command == args[1] {
			selected = &group[i]
			break
		}
	}
	if selected == nil {
		return localError(errors.New("未知操作；请使用分组 --help 查找"))
	}
	v, op, err := spec.lookup(selected.Method, selected.Path)
	if err != nil {
		return localError(err)
	}
	params, err := spec.namedParameters(op)
	if err != nil {
		return localError(err)
	}
	if contains(args[2:], "--help") || contains(args[2:], "-h") {
		description, err := spec.describe(v)
		if err != nil {
			return localError(err)
		}
		return Output{OK: true, Result: map[string]any{"operation": description, "flags": params, "transport_flags": []string{"protocol", "base-url", "public-path-prefix", "auth-file", "headers-file", "header-env", "no-login", "timeout", "body", "preview", "output"}}}, 0
	}
	flags := flag.NewFlagSet(args[1], flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	var opts Options
	a.BindTransportFlags(flags, &opts)
	flags.StringVar(&opts.Body, "body", "", "完整请求")
	flags.BoolVar(&opts.Preview, "preview", false, "不发请求")
	values := map[string]json.RawMessage{}
	for _, p := range params {
		flags.Func(p.Flag, p.Description, func(text string) error {
			if _, ok := values[p.Flag]; ok {
				return fmt.Errorf("--%s 重复", p.Flag)
			}
			value, err := parseNamedValue(p, text, stdin)
			if err != nil {
				return err
			}
			values[p.Flag] = value
			return nil
		})
	}
	// flag 的原始错误可能回显参数值；只返回不含用户输入的用法错误。
	if flags.Parse(args[2:]) != nil || flags.NArg() != 0 {
		return localError(errors.New("参数名称、值类型或枚举无效；请查看该命令 --help"))
	}
	if opts.Timeout <= 0 {
		return localError(errors.New("timeout 必须大于 0"))
	}
	body := map[string]json.RawMessage{}
	for _, p := range params {
		raw, exists := values[p.Flag]
		if p.Required && !exists && !(p.In == "body" && opts.Body != "") {
			return localError(fmt.Errorf("缺少 --%s", p.Flag))
		}
		if !exists {
			continue
		}
		if p.In == "body" {
			body[p.Name] = raw
			continue
		}
		var value any
		_ = decodeJSON(raw, &value)
		toText := func(value any) string {
			if s, ok := value.(string); ok {
				return s
			}
			return fmt.Sprint(value)
		}
		texts := []string{toText(value)}
		if array, ok := value.([]any); ok {
			texts = []string{}
			for _, v := range array {
				texts = append(texts, toText(v))
			}
			if p.CollectionFormat != "multi" {
				sep := ","
				switch p.CollectionFormat {
				case "ssv":
					sep = " "
				case "tsv":
					sep = "\t"
				case "pipes":
					sep = "|"
				}
				texts = []string{strings.Join(texts, sep)}
			}
		}
		for _, text := range texts {
			if p.In == "path" {
				opts.Paths = append(opts.Paths, [2]string{p.Name, text})
			} else {
				opts.Query = append(opts.Query, [2]string{p.Name, text})
			}
		}
	}
	if len(body) > 0 {
		if opts.Body != "" {
			return localError(errors.New("不能混用 --body 与命名 body 字段"))
		}
		data, _ := json.Marshal(body)
		stdin = bytes.NewReader(data)
		opts.Body = "-"
	}
	return a.callOperation(ctx, v, op, opts, stdin)
}
