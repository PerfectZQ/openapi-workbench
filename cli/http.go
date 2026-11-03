package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

const maxPayload = 32 << 20

func (a App) buildRequest(ctx context.Context, v Command, op Operation, opts Options, stdin io.Reader) (*http.Request, error) {
	if opts.Protocol != "" && opts.Protocol != "rest" && opts.Protocol != "action" {
		return nil, errors.New("protocol 只能是 rest 或 action")
	}
	if opts.Protocol == "action" {
		return a.buildBusinessActionRequest(ctx, v, op, opts, stdin)
	}
	fileResponse := op.BusinessFile
	for status, response := range op.Responses {
		if strings.HasPrefix(status, "2") && schemaType(response.Schema) == "file" {
			fileResponse = true
		}
	}
	if fileResponse && opts.OutputFile == "" {
		return nil, errors.New("文件响应需要 --output 指定新文件")
	}
	if !fileResponse && opts.OutputFile != "" {
		return nil, errors.New("只有文件响应支持 --output；JSON 输出请使用 shell 重定向")
	}
	if opts.OutputFile != "" {
		if _, err := os.Lstat(opts.OutputFile); !os.IsNotExist(err) {
			return nil, errors.New("output 路径已存在或无法访问")
		}
	}
	base, err := url.Parse(opts.BaseURL)
	if err != nil || base == nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" || (base.Path != "" && base.Path != "/") {
		return nil, errors.New("base-url 必须是 http(s)://host[:port]，不含凭据、路径、Query 或 Fragment")
	}
	path := v.RuntimePath
	if a.MapPath != nil {
		path, err = a.MapPath(path, opts.PublicPathPrefix)
		if err != nil {
			return nil, err
		}
	} else if opts.PublicPathPrefix != "" {
		return nil, errors.New("public-path-prefix requires a host path adapter")
	}
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.ContainsAny(path, "?#\\") || (path != "/" && pathpkg.Clean(path) != strings.TrimSuffix(path, "/")) {
		return nil, errors.New("契约运行路径必须是规范绝对路径")
	}
	used := map[string]bool{}
	for _, pair := range opts.Paths {
		key, value := pair[0], pair[1]
		placeholder := "{" + key + "}"
		if used[key] || !strings.Contains(path, placeholder) || value == "" || value == "." || value == ".." {
			return nil, errors.New("path 参数重复、不存在或值无效")
		}
		used[key] = true
		path = strings.ReplaceAll(path, placeholder, url.PathEscape(value))
	}
	if strings.ContainsAny(path, "{}") {
		return nil, errors.New("缺少 path 参数；使用 --path name=value")
	}
	query := url.Values{}
	for _, pair := range opts.Query {
		found := false
		for _, p := range op.Parameters {
			if p.In == "query" && p.Name == pair[0] {
				found = true
				break
			}
		}
		if !found {
			return nil, errors.New("query 参数不在操作契约中")
		}
		if pair[0] == "Action" && pair[1] != v.Action {
			return nil, errors.New("不能通过 Action 改变已选择的操作")
		}
		query.Add(pair[0], pair[1])
	}
	if v.Action != "" {
		query.Set("Action", v.Action)
	}
	for _, p := range op.Parameters {
		if p.In == "query" && p.Required && query.Get(p.Name) == "" {
			return nil, fmt.Errorf("缺少 query 参数: %s", p.Name)
		}
	}
	body, err := ReadBody(opts.Body, stdin)
	if err != nil {
		return nil, err
	}
	acceptsBody := false
	for _, p := range op.Parameters {
		if p.In == "body" {
			acceptsBody = true
			if p.Required && (len(body) == 0 || bytes.Equal(bytes.TrimSpace(body), []byte("null"))) {
				return nil, errors.New("该操作需要 JSON body")
			}
		}
	}
	if len(body) > 0 && !acceptsBody {
		return nil, errors.New("该操作未声明请求 body")
	}
	endpoint := base.Scheme + "://" + base.Host + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, v.Method, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, errors.New("无法构造 HTTP 请求")
	}
	req.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	if opts.HeadersFile != "" {
		data, err := os.ReadFile(opts.HeadersFile)
		if err != nil {
			return nil, errors.New("无法读取 headers-file")
		}
		var headers map[string]string
		if json.Unmarshal(data, &headers) != nil || headers == nil {
			return nil, errors.New("headers-file 必须是 JSON Header 字符串对象")
		}
		for key, value := range headers {
			req.Header.Set(key, value)
		}
	}
	if a.PrepareRequest != nil {
		if err := a.PrepareRequest(req, op); err != nil {
			return nil, err
		}
	}
	for _, pair := range opts.HeaderEnv {
		value := os.Getenv(pair[1])
		if value == "" {
			return nil, errors.New("header-env 引用的环境变量为空")
		}
		req.Header.Set(pair[0], value)
	}
	for _, p := range op.Parameters {
		if p.In == "header" && p.Required && req.Header.Get(p.Name) == "" && !op.authenticationHeader(p.Name) {
			return nil, fmt.Errorf("缺少 Header: %s", p.Name)
		}
	}
	return req, nil
}

func preview(req *http.Request) any {
	names := make([]string, 0, len(req.Header))
	for name := range req.Header {
		names = append(names, name)
	}
	sort.Strings(names)
	// Query 可能含查询数据；仅 Action/Version 明文展示，其他值只展示参数名。
	endpoint := *req.URL
	query := endpoint.Query()
	for name := range query {
		if name != "Action" && name != "Version" {
			query.Set(name, "<redacted>")
		}
	}
	endpoint.RawQuery = query.Encode()
	return map[string]any{"method": req.Method, "url": endpoint.String(), "header_names": names, "body_bytes": req.ContentLength, "sent": false}
}

func (a App) execute(req *http.Request, opts Options, op Operation) (Output, int) {
	if result := a.authenticate(req, op, opts); result != nil {
		return *result, 1
	}
	for _, p := range op.Parameters {
		if p.In == "header" && p.Required && req.Header.Get(p.Name) == "" {
			return localError(fmt.Errorf("缺少 Header: %s", p.Name))
		}
	}
	// 不跟随认证跳转，也不重放写请求；请求失败可能已经在服务端完成，交由调用者查询终态。
	client := http.Client{Timeout: opts.Timeout, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return Output{Error: &Failure{Code: "TRANSPORT_ERROR", Message: "请求未获得完整响应，结果未知；写操作请先查询服务端状态，勿直接重试"}}, 1
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, maxPayload+1))
	result := Output{HTTPStatus: response.StatusCode}
	if err != nil || len(data) > maxPayload {
		result.Error = &Failure{Code: "RESPONSE_ERROR", Message: "响应不完整或超过大小限制；写操作结果未知，请先查询状态"}
		return result, 1
	}
	if a.DecodeResponse != nil {
		if decoded, handled := a.DecodeResponse(response, data, op, opts); handled {
			if decoded.OK {
				return decoded, 0
			}
			return decoded, 1
		}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		result.Error = &Failure{Code: "HTTP_ERROR", Message: fmt.Sprintf("HTTP %d", response.StatusCode)}
		return result, 1
	}
	schema, declared := op.Responses[strconv.Itoa(response.StatusCode)]
	if !declared {
		schema, declared = op.Responses["default"]
	}
	isHTML := strings.Contains(strings.ToLower(response.Header.Get("Content-Type")), "text/html")
	if declared && schemaType(schema.Schema) == "file" && !isHTML {
		path, err := WriteDownload(opts.OutputFile, data)
		if err != nil {
			result.Error = &Failure{Code: "OUTPUT_ERROR", Message: err.Error()}
			return result, 1
		}
		result.OK, result.Result = true, map[string]any{"file": path, "bytes": len(data)}
		return result, 0
	}
	if (response.StatusCode == http.StatusNoContent || req.Method == http.MethodHead) && len(data) == 0 {
		result.OK = true
		return result, 0
	}
	if json.Valid(data) && !isHTML {
		result.OK, result.Result = true, json.RawMessage(data)
		return result, 0
	}
	if declared && schemaType(schema.Schema) == "string" && utf8.Valid(data) && !isHTML {
		result.OK, result.Result = true, string(data)
		return result, 0
	}
	result.Error = &Failure{Code: "INVALID_RESPONSE", Message: "响应与契约不符；请检查地址、认证和 HTTP 状态；写操作结果未知"}
	return result, 1
}

func schemaType(raw json.RawMessage) string {
	var schema struct {
		Type string `json:"type"`
	}
	_ = json.Unmarshal(raw, &schema)
	return schema.Type
}

func WriteDownload(name string, data []byte) (string, error) {
	path, err := filepath.Abs(name)
	if err != nil {
		return "", errors.New("无法解析 output 路径")
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", errors.New("无法创建 output 文件；不覆盖已有文件")
	}
	_, writeErr := file.Write(data)
	closeErr := file.Close()
	if writeErr != nil || closeErr != nil {
		_ = os.Remove(path)
		return "", errors.New("写入 output 文件失败")
	}
	return path, nil
}
