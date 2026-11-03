package security

import (
	"fmt"
	"net"
	"net/http"
	"slices"
)

// Apply selects one satisfiable security alternative and applies only its
// credentials. It preserves explicit values and never partially commits an AND
// alternative. Token refresh and interactive login belong to the host provider.
func Apply(req *http.Request, schemes map[string]Scheme, requirements Requirements, credentials map[string]Credential) error {
	if len(requirements) == 0 {
		return nil
	}
	for _, alternative := range requirements {
		if len(alternative) == 0 {
			return nil
		}
	}
	host := req.URL.Hostname()
	if req.URL.Scheme != "https" && host != "localhost" && !net.ParseIP(host).IsLoopback() {
		return fmt.Errorf("credentials require HTTPS or a loopback origin")
	}
	for _, alternative := range requirements {
		candidate := req.Clone(req.Context())
		complete := true
		names := make([]string, 0, len(alternative))
		for name := range alternative {
			names = append(names, name)
		}
		slices.Sort(names)
		for _, name := range names {
			scheme, ok := schemes[name]
			if !ok {
				return fmt.Errorf("undefined security scheme %q", name)
			}
			if err := scheme.validate(); err != nil {
				return fmt.Errorf("security scheme %q: %w", name, err)
			}
			if !scheme.write(candidate, credentials[name]) {
				complete = false
				break
			}
		}
		if complete {
			req.Header = candidate.Header
			req.URL = candidate.URL
			return nil
		}
	}
	return ErrCredentials
}
