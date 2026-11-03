package cli

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

type Output struct {
	OK               bool            `json:"ok"`
	Result           any             `json:"result,omitempty"`
	HTTPStatus       int             `json:"http_status,omitempty"`
	ResponseMetadata json.RawMessage `json:"response_metadata,omitempty"`
	Error            *Failure        `json:"error,omitempty"`
}

type Failure struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Options struct {
	Protocol         string
	BaseURL          string
	PublicPathPrefix string
	HeadersFile      string
	AuthFile         string
	OutputFile       string
	Body             string
	Timeout          time.Duration
	Preview          bool
	NoLogin          bool
	Paths            Pairs
	Query            Pairs
	HeaderEnv        Pairs
}

type Pairs [][2]string

func (p *Pairs) String() string { return "" }
func (p *Pairs) Set(value string) error {
	key, val, ok := strings.Cut(value, "=")
	if !ok || key == "" {
		return errors.New("参数必须使用 name=value")
	}
	*p = append(*p, [2]string{key, val})
	return nil
}

// Run 向 stdout 输出单个 JSON 对象。退出码 0 为完成，1 为远端或传输失败，
// 2 为本地用法错误，3 为业务检查未通过；原子 API 的 ok 只描述请求成功。
func (a App) Run(ctx context.Context, args []string, stdin io.Reader, stdout io.Writer) int {
	result, code := a.Invoke(ctx, args, stdin)
	encoder := json.NewEncoder(stdout)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(result); err != nil {
		return 1
	}
	return code
}

func localError(err error) (Output, int) {
	return Output{Error: &Failure{Code: "INVALID_ARGUMENT", Message: err.Error()}}, 2
}

func (a App) Invoke(ctx context.Context, args []string, stdin io.Reader) (Output, int) {
	if len(args) > 0 && args[0] != "api" && args[0] != "--help" && args[0] != "-h" && args[0] != "help" {
		return a.runNamed(ctx, args, stdin)
	}
	if len(args) == 0 || contains(args, "--help") || contains(args, "-h") || args[0] == "help" {
		spec, err := a.loadSpec()
		if err != nil {
			return localError(err)
		}
		operations, err := spec.namedOperations()
		if err != nil {
			return localError(err)
		}
		groups := []string{}
		for _, op := range operations {
			if !contains(groups, op.Group) {
				groups = append(groups, op.Group)
			}
		}
		return Output{OK: true, Result: map[string]any{
			"groups":       groups,
			"commands":     []string{a.Name + " <group> <operation> [flags]", a.Name + " api list [--search text] [--tag tag]", a.Name + " api describe METHOD PATH", a.Name + " api call METHOD PATH [flags]"},
			"call_options": []string{"--base-url origin", "--public-path-prefix path", "--auth-file file", "--headers-file file", "--header-env Header=ENV_NAME", "--output file", "--timeout 60s", "--no-login", "--preview"},
			"contract":     "Swagger 2.0 JSON; " + a.EnvPrefix + "_SPEC overrides the bundled contract",
			"output":       "One JSON object; exit 0 success, 1 remote failure, 2 invalid arguments",
			"preview":      "Validate without authentication or network; omit credentials and body",
		}}, 0
	}
	if len(args) < 2 || args[0] != "api" {
		return localError(errors.New("请使用 api list、api describe 或 api call；用 --help 查看用法"))
	}
	spec, err := a.loadSpec()
	if err != nil {
		return localError(err)
	}
	flags := flag.NewFlagSet(args[1], flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	if args[1] == "list" {
		search := flags.String("search", "", "搜索")
		tag := flags.String("tag", "", "分组")
		if err := flags.Parse(args[2:]); err != nil {
			return localError(errors.New("list 参数无效；用 --help 查看用法"))
		}
		if flags.NArg() != 0 {
			return localError(errors.New("list 不接受位置参数"))
		}
		result, err := spec.list(*search, *tag)
		if err != nil {
			return localError(err)
		}
		return Output{OK: true, Result: result}, 0
	}
	if len(args) < 4 || !isMethod(args[2]) {
		return localError(errors.New("需要 METHOD 和文档 PATH；参数放在 PATH 之后"))
	}
	v, op, err := spec.lookup(args[2], args[3])
	if err != nil {
		return localError(err)
	}
	if args[1] == "describe" {
		if len(args) != 4 {
			return localError(errors.New("describe 只接受 METHOD PATH"))
		}
		result, err := spec.describe(v)
		if err != nil {
			return localError(err)
		}
		return Output{OK: true, Result: result}, 0
	}
	if args[1] != "call" {
		return localError(errors.New("未知命令；用 --help 查看用法"))
	}
	var opts Options
	a.BindTransportFlags(flags, &opts)
	flags.StringVar(&opts.Body, "body", "", "@文件或 -")
	flags.BoolVar(&opts.Preview, "preview", false, "预览")
	flags.Var(&opts.Paths, "path", "路径参数")
	flags.Var(&opts.Query, "query", "查询参数")
	if err := flags.Parse(args[4:]); err != nil {
		return localError(errors.New("call 参数无效；用 --help 查看用法"))
	}
	if flags.NArg() != 0 {
		return localError(errors.New("存在多余参数；参数值含空格时请加引号"))
	}
	if opts.Timeout <= 0 {
		return localError(errors.New("timeout 必须大于 0"))
	}
	return a.callOperation(ctx, v, op, opts, stdin)
}

func (a App) BindTransportFlags(flags *flag.FlagSet, opts *Options) {
	flags.StringVar(&opts.Protocol, "protocol", "rest", "新业务操作的 rest 或 action 协议")
	flags.StringVar(&opts.BaseURL, "base-url", os.Getenv(a.EnvPrefix+"_BASE_URL"), "API origin")
	flags.StringVar(&opts.PublicPathPrefix, "public-path-prefix", os.Getenv(a.EnvPrefix+"_PUBLIC_PATH_PREFIX"), "公开网关路径前缀")
	flags.StringVar(&opts.AuthFile, "auth-file", os.Getenv(a.EnvPrefix+"_AUTH_FILE"), "按 Swagger scheme 名称配置凭据的 JSON 文件")
	flags.StringVar(&opts.HeadersFile, "headers-file", os.Getenv(a.EnvPrefix+"_HEADERS_FILE"), "Header 文件")
	flags.StringVar(&opts.OutputFile, "output", "", "文件响应路径")
	flags.DurationVar(&opts.Timeout, "timeout", 60*time.Second, "超时")
	flags.Var(&opts.HeaderEnv, "header-env", "Header 对应环境变量名")
	flags.BoolVar(&opts.NoLogin, "no-login", os.Getenv(a.EnvPrefix+"_NO_LOGIN") == "true", "禁用自动 SSO")
}

func ReadBody(source string, stdin io.Reader) ([]byte, error) {
	if source == "" {
		return nil, nil
	}
	var reader io.Reader
	if source == "-" {
		reader = stdin
	} else if strings.HasPrefix(source, "@") {
		file, err := os.Open(strings.TrimPrefix(source, "@"))
		if err != nil {
			return nil, errors.New("无法读取 body 文件")
		}
		defer file.Close()
		reader = file
	} else {
		return nil, errors.New("body 必须使用 @文件或 -（stdin），不要把业务数据直接放进参数")
	}
	data, err := io.ReadAll(io.LimitReader(reader, maxPayload+1))
	if err != nil {
		return nil, errors.New("读取 body 失败")
	}
	if len(data) > maxPayload {
		return nil, fmt.Errorf("body 超过 %d 字节", maxPayload)
	}
	if !json.Valid(data) {
		return nil, errors.New("body 必须是单个有效 JSON 值")
	}
	return data, nil
}
