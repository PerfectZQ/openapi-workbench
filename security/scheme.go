// Package security implements Swagger authentication transport and a fail-closed
// HTTP authorization boundary. Identity verification stays with the host's IdP.
package security

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type Scheme struct {
	Type             string            `json:"type"`
	Name             string            `json:"name,omitempty"`
	In               string            `json:"in,omitempty"`
	Description      string            `json:"description,omitempty"`
	Flow             string            `json:"flow,omitempty"`
	AuthorizationURL string            `json:"authorizationUrl,omitempty"`
	TokenURL         string            `json:"tokenUrl,omitempty"`
	Scopes           map[string]string `json:"scopes,omitempty"`
}

// Requirements has Swagger's OR-of-AND semantics. An empty list or an empty
// alternative permits anonymous access. Operation declarations override global ones.
type Requirements = []map[string][]string

type Credential struct {
	Value    string `json:"value,omitempty"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

var ErrCredentials = errors.New("required authentication is missing or invalid")
var ErrForbidden = errors.New("permission denied")

func (s Scheme) validate() error {
	switch s.Type {
	case "basic", "oauth2":
		return nil
	case "apiKey":
		if (s.In == "header" || s.In == "query") && s.Name != "" {
			return nil
		}
	}
	return fmt.Errorf("unsupported or invalid security scheme")
}

func (s Scheme) read(req *http.Request) (Credential, bool) {
	switch s.Type {
	case "basic":
		username, password, ok := req.BasicAuth()
		return Credential{Username: username, Password: password}, ok
	case "oauth2":
		kind, value, ok := strings.Cut(req.Header.Get("Authorization"), " ")
		return Credential{Value: value}, ok && strings.EqualFold(kind, "Bearer") && value != ""
	case "apiKey":
		value := req.Header.Get(s.Name)
		if s.In == "query" {
			value = req.URL.Query().Get(s.Name)
		}
		return Credential{Value: value}, value != ""
	}
	return Credential{}, false
}

func (s Scheme) write(req *http.Request, credential Credential) bool {
	if _, present := s.read(req); present {
		return true
	}
	switch s.Type {
	case "basic":
		if credential.Username == "" || strings.Contains(credential.Username, ":") || req.Header.Get("Authorization") != "" {
			return false
		}
		req.SetBasicAuth(credential.Username, credential.Password)
	case "oauth2":
		if credential.Value == "" || req.Header.Get("Authorization") != "" {
			return false
		}
		req.Header.Set("Authorization", "Bearer "+credential.Value)
	case "apiKey":
		if credential.Value == "" {
			return false
		}
		if s.In == "header" {
			req.Header.Set(s.Name, credential.Value)
		} else {
			query := req.URL.Query()
			query.Set(s.Name, credential.Value)
			req.URL.RawQuery = query.Encode()
		}
	default:
		return false
	}
	return true
}
