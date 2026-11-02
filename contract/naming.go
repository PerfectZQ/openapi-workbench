package contract

import (
	"sort"
	"strings"
	"unicode"
)

func Identifier(s string) string {
	parts := strings.FieldsFunc(s, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	for i, p := range parts {
		switch strings.ToLower(p) {
		case "id", "api", "url", "uri", "http", "https", "json", "sql", "utm", "sdk", "qps":
			parts[i] = strings.ToUpper(p)
			continue
		case "ids":
			parts[i] = "IDs"
			continue
		}
		r := []rune(p)
		r[0] = unicode.ToUpper(r[0])
		parts[i] = string(r)
	}
	s = strings.Join(parts, "")
	if s == "" {
		return "Value"
	}
	if unicode.IsDigit([]rune(s)[0]) {
		s = "Value" + s
	}
	return s
}

func Keys[T any](m map[string]T) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func CamelCase(s string) string {
	r := []rune(Identifier(s))
	n := 0
	for n < len(r) && unicode.IsUpper(r[n]) {
		n++
	}
	if n > 1 && n < len(r) {
		n--
	}
	for i := 0; i < n; i++ {
		r[i] = unicode.ToLower(r[i])
	}
	return string(r)
}
