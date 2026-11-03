// Package skillgen produces a discoverable agent skill from the CLI contract.
package skillgen

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/cli"
)

// Options describes the installed command and optional host-owned guidance.
// Instructions are maintained by the host, never inferred from API write paths.
type Options struct {
	Name         string
	Command      string
	EnvPrefix    string
	Description  string
	Instructions string
}

// Generate returns a SKILL.md that discovers live parameters from the CLI. It
// does not copy hundreds of schemas into instructions or infer business policy.
func Generate(specification []byte, opts Options) ([]byte, error) {
	validName := regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	if !validName.MatchString(opts.Name) || len(opts.Name) > 64 || !validName.MatchString(opts.Command) {
		return nil, fmt.Errorf("skill name and command must use lowercase letters, digits and hyphens; skill name is at most 64 characters")
	}
	if !regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`).MatchString(opts.EnvPrefix) {
		return nil, fmt.Errorf("invalid environment prefix")
	}
	app := cli.App{Specification: specification}
	commands, err := app.Commands()
	if err != nil {
		return nil, err
	}
	groups := map[string]bool{}
	for _, command := range commands {
		groups[command.Group] = true
	}
	names := make([]string, 0, len(groups))
	for name := range groups {
		names = append(names, name)
	}
	sort.Strings(names)
	description := opts.Description
	if description == "" {
		description = "通过 " + opts.Command + " 的契约 CLI 发现和调用接口，用于查询或操作该服务。"
	}
	var out strings.Builder
	fmt.Fprintf(&out, "---\nname: %s\ndescription: %s\n---\n\n# %s API\n\n", strconv.Quote(opts.Name), strconv.Quote(description), opts.Command)
	fmt.Fprintf(&out, "使用已安装的 `%s` 命令。先读取与目标部署匹配的契约，再选择操作。\n\n", opts.Command)
	fmt.Fprintf(&out, "```bash\n%s --help\n%s api list --search keyword\n%s <group> <operation> --help\n```\n\n", opts.Command, opts.Command, opts.Command)
	fmt.Fprintf(&out, "可用分组：%s。分组和操作来自 Swagger，不杜撰命令或参数。\n\n", strings.Join(names, ", "))
	fmt.Fprintf(&out, "用 `%s_BASE_URL` 指定服务 origin（协议、主机和可选端口）。`%s_AUTH_FILE` 指向受保护的凭据 JSON，以 Swagger scheme 名称为键，API Key / OAuth2 使用 `value`，Basic 使用 `username`/`password`。也可用 `%s_HEADERS_FILE` 或 `--header-env Header=ENV_NAME` 提供已有凭据。`%s_SPEC` 可指定匹配部署的本地 Swagger JSON。\n\n", opts.EnvPrefix, opts.EnvPrefix, opts.EnvPrefix, opts.EnvPrefix)
	out.WriteString("Path、Query 和 Body 顶层字段自动形成命名参数；名称和类型以 `--help` 为准。复杂值用 JSON 或 `@file`，完整请求用 `--body @file` 或 `--body -`（stdin），不与命名 Body 字段混用。文件响应需要 `--output` 指向新文件。\n\n")
	out.WriteString("用 `--preview` 校验请求，不取票、不发送网络请求。每次输出一个 JSON 对象，包含 `ok`、`result`、`http_status`，失败时包含 `error`。退出码 0 为请求成功、1 为远端或传输失败、2 为本地参数错误。API 成功不代表业务流程通过。写操作遵循用户当前授权；网络结果未知时先查询终态，再决定是否重试。\n")
	if opts.Instructions != "" {
		out.WriteString("\n## 业务接入说明\n\n" + strings.TrimSpace(opts.Instructions) + "\n")
	}
	return []byte(out.String()), nil
}
