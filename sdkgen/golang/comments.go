package golang

import (
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func methodComment(op contract.Operation, name string) string {
	doc := "// " + name + " " + comment(op.Summary)
	if description := strings.TrimSpace(op.Description); description != "" && description != strings.TrimSpace(op.Summary) {
		doc += "\n//\n// " + comment(description)
	}
	return doc + deprecationComment(op)
}

func deprecationComment(op contract.Operation) string {
	var message string
	if op.Lifecycle.Stage == "sunset" {
		message = "此接口即将下线，不推荐新接入，存量调用请安排迁移。"
	} else if op.Deprecated {
		message = "此接口不再推荐使用，请迁移至现行接口。"
	} else {
		return ""
	}
	if description := strings.Join(strings.Fields(op.Lifecycle.Description), " "); description != "" {
		message += " " + description
	}
	return "\n//\n// Deprecated: " + message
}

func comment(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(strings.ReplaceAll(s, "\r\n", "\n")), "\n", "\n// ")
}
