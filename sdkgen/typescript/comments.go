package typescript

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func writeMethodComment(b *strings.Builder, op contract.Operation) {
	text := strings.TrimSpace(op.Summary)
	if description := strings.TrimSpace(op.Description); description != "" && description != text {
		text += "\n\n" + description
	}
	var notice string
	if op.Lifecycle.Stage == "sunset" {
		notice = "此接口即将下线，不推荐新接入，存量调用请安排迁移。"
	} else if op.Deprecated {
		notice = "此接口不再推荐使用，请迁移至现行接口。"
	}
	if notice != "" {
		if description := strings.TrimSpace(op.Lifecycle.Description); description != "" {
			notice += " " + description
		}
		text += "\n\n@deprecated " + notice
	}
	writeComment(b, text, "  ")
}

func writeComment(b *strings.Builder, text, indent string) {
	text = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "*/", "* /"))
	if text == "" {
		return
	}
	if !strings.Contains(text, "\n") {
		fmt.Fprintf(b, "%s/** %s */\n", indent, text)
		return
	}
	fmt.Fprintf(b, "%s/**\n", indent)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			fmt.Fprintf(b, "%s *\n", indent)
		} else {
			fmt.Fprintf(b, "%s * %s\n", indent, line)
		}
	}
	fmt.Fprintf(b, "%s */\n", indent)
}

func quote(s string) string {
	data, _ := json.Marshal(s)
	return string(data)
}
