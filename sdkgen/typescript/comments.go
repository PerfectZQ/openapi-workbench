package typescript

import (
	"encoding/json"
	"fmt"
	"strings"
)

func writeComment(b *strings.Builder, text, indent string) {
	text = strings.ReplaceAll(strings.Join(strings.Fields(text), " "), "*/", "* /")
	if text != "" {
		fmt.Fprintf(b, "%s/** %s */\n", indent, text)
	}
}

func quote(s string) string {
	data, _ := json.Marshal(s)
	return string(data)
}
