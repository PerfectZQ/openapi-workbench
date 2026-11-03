package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// buildBusinessActionRequest 保留同一命令的业务参数，只转换位置、动态字段与外壳。
func (a App) buildBusinessActionRequest(ctx context.Context, v Command, op Operation, opts Options, stdin io.Reader) (*http.Request, error) {
	if op.BusinessID == "" || op.actionOperation == nil {
		return nil, errors.New("该操作没有新版 Action 绑定")
	}
	data, err := ReadBody(opts.Body, stdin)
	if err != nil {
		return nil, err
	}
	request := map[string]any{}
	if len(data) > 0 {
		decoder := json.NewDecoder(bytes.NewReader(data))
		decoder.UseNumber()
		if err := decoder.Decode(&request); err != nil || request == nil {
			return nil, errors.New("业务正文必须是 JSON 对象")
		}
		var extra any
		if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
			return nil, errors.New("业务正文只能包含一个 JSON 对象")
		}
	}
	for _, position := range []struct {
		name   string
		values Pairs
	}{{"path", opts.Paths}, {"query", opts.Query}} {
		for _, pair := range position.values {
			var Parameter *Parameter
			for index := range op.Parameters {
				if op.Parameters[index].Name == pair[0] && op.Parameters[index].In == position.name {
					Parameter = &op.Parameters[index]
					break
				}
			}
			if Parameter == nil {
				return nil, fmt.Errorf("契约中不存在 %s 参数 %s", position.name, pair[0])
			}
			if _, exists := request[pair[0]]; exists {
				return nil, fmt.Errorf("参数 %s 重复", pair[0])
			}
			var value any = pair[1]
			switch Parameter.Type {
			case "integer":
				if _, err := strconv.ParseInt(pair[1], 10, 64); err != nil {
					return nil, err
				}
				value = json.Number(pair[1])
			case "boolean":
				value, err = strconv.ParseBool(pair[1])
				if err != nil {
					return nil, err
				}
			case "array":
				decoder := json.NewDecoder(strings.NewReader(pair[1]))
				decoder.UseNumber()
				var list []any
				if err := decoder.Decode(&list); err != nil {
					return nil, err
				}
				value = list
			}
			request[pair[0]] = value
		}
	}
	for _, path := range op.InputJSON {
		if err := encodeActionJSON(request, strings.Split(path, ".")); err != nil {
			return nil, err
		}
	}
	body, err := json.Marshal(map[string]any{"Request": request})
	if err != nil {
		return nil, err
	}
	if op.actionPath == "" || !isMethod(op.actionMethod) {
		return nil, errors.New("Action 投影缺少 path/method")
	}
	v.Method, v.RuntimePath, v.Action = op.actionMethod, op.actionPath, op.BusinessAction.Name
	opts.Protocol, opts.Body = "rest", "-"
	opts.Paths = nil
	opts.Query = Pairs{{"Version", op.actionVersion}}
	return a.buildRequest(ctx, v, *op.actionOperation, opts, bytes.NewReader(body))
}

func encodeActionJSON(value any, path []string) error {
	if value == nil || len(path) == 0 {
		return nil
	}
	if path[0] == "*" {
		items, ok := value.([]any)
		if !ok {
			return errors.New("动态 JSON 路径要求数组")
		}
		for _, item := range items {
			if err := encodeActionJSON(item, path[1:]); err != nil {
				return err
			}
		}
		return nil
	}
	object, ok := value.(map[string]any)
	if !ok {
		return errors.New("动态 JSON 路径要求对象")
	}
	child, exists := object[path[0]]
	if !exists {
		return nil
	}
	if len(path) > 1 {
		return encodeActionJSON(child, path[1:])
	}
	data, err := json.Marshal(child)
	if err != nil {
		return err
	}
	object[path[0]] = string(data)
	return nil
}
