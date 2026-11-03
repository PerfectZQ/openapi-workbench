package cli

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/security"
)

func (op Operation) authenticationHeader(name string) bool {
	for _, alternative := range op.Security {
		for key := range alternative {
			scheme := op.securityDefinitions[key]
			if (scheme.Type == "basic" || scheme.Type == "oauth2") && strings.EqualFold(name, "Authorization") {
				return true
			}
			if scheme.Type == "apiKey" && scheme.In == "header" && strings.EqualFold(name, scheme.Name) {
				return true
			}
		}
	}
	return false
}

func (a App) authenticate(req *http.Request, op Operation, opts Options) *Output {
	if opts.AuthFile != "" || a.Authenticate == nil {
		var credentials map[string]security.Credential
		if opts.AuthFile != "" {
			data, err := ReadBody("@"+opts.AuthFile, nil)
			if err != nil || json.Unmarshal(data, &credentials) != nil || credentials == nil {
				return &Output{Result: map[string]any{"sent": false}, Error: &Failure{Code: "AUTH_CONFIGURATION", Message: "auth-file 必须是以 Swagger scheme 名称为键的凭据 JSON 对象"}}
			}
		}
		if err := security.Apply(req, op.securityDefinitions, op.Security, credentials); err != nil {
			return &Output{Result: map[string]any{"sent": false}, Error: &Failure{Code: "AUTH_REQUIRED", Message: "认证配置不满足接口声明；请检查 auth-file、显式 Header 和安全传输地址"}}
		}
	}
	if a.Authenticate != nil && !opts.NoLogin {
		return a.Authenticate(req, op, opts)
	}
	return nil
}
