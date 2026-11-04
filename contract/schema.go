package contract

import (
	"encoding/json"
	"strings"
)

type Schema struct {
	Ref                  string            `json:"$ref"`
	Format               string            `json:"format"`
	Nullable             bool              `json:"nullable"`
	XNullable            bool              `json:"x-nullable"`
	OneOf                json.RawMessage   `json:"oneOf"`
	AnyOf                json.RawMessage   `json:"anyOf"`
	Not                  json.RawMessage   `json:"not"`
	Type                 string            `json:"type"`
	Description          string            `json:"description"`
	Enum                 []json.RawMessage `json:"enum"`
	EnumDescriptions     enumDescriptions  `json:"x-enum-descriptions"`
	Properties           map[string]Schema `json:"properties"`
	Required             []string          `json:"required"`
	Items                *Schema           `json:"items"`
	AdditionalProperties json.RawMessage   `json:"additionalProperties"`
	AllOf                []Schema          `json:"allOf"`
}

// goswag 的类型枚举输出数组，字段 extensions 标签输出以竖线分隔的字符串。
type enumDescriptions []string

func (d *enumDescriptions) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var text string
		if err := json.Unmarshal(data, &text); err != nil {
			return err
		}
		*d = strings.Split(text, "|")
		return nil
	}
	return json.Unmarshal(data, (*[]string)(d))
}

type Parameter struct {
	Name, In, Type, Format, Description string
	Items                               *Schema
	Required                            bool
	Default                             json.RawMessage
	Enum                                []json.RawMessage
	Schema                              Schema
}
type Operation struct {
	OperationID string `json:"operationId"`
	Summary     string
	Description string
	Deprecated  bool
	Lifecycle   struct {
		Stage       string `json:"stage"`
		Description string `json:"description"`
	} `json:"x-api-lifecycle"`
	Parameters  []Parameter
	Responses   map[string]struct{ Schema Schema }
	Security    []map[string][]string
	ResultField string `json:"x-api-result-field"`
	BusinessID  string `json:"x-api-operation"`
	Action      struct {
		Path    string `json:"path"`
		Version string `json:"version"`
		Name    string `json:"name"`
	} `json:"x-api-action"`
	Request    Schema   `json:"x-api-request"`
	Result     Schema   `json:"x-api-result"`
	InputJSON  []string `json:"x-api-input-json"`
	OutputJSON []string `json:"x-api-output-json"`
	File       bool     `json:"x-api-file"`
}
type Specification struct {
	Swagger         string
	Definitions     map[string]Schema
	Paths           map[string]map[string]Operation
	BusinessVersion string `json:"x-api-version"`
}

// Documentation 保留字段说明和枚举含义。
func (s Schema) Documentation() string {
	doc := strings.TrimSpace(s.Description)
	if len(s.Enum) > 0 {
		if doc != "" {
			doc += "\n\n"
		}
		doc += "可选值："
		for i, value := range s.Enum {
			doc += "\n  - " + string(value)
			if i < len(s.EnumDescriptions) && s.EnumDescriptions[i] != "" {
				doc += "：" + s.EnumDescriptions[i]
			}
		}
	}
	return doc
}
