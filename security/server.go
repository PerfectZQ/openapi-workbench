package security

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
)

// Principal must be produced by a trusted verifier after checking token
// signatures, issuer, audience, expiry and revocation as required by its IdP.
type Principal struct {
	Subject string
	Scopes  []string
}

// Gate adapts existing identity and permission systems. Verify is mandatory for
// protected routes. Authorize adds host policy after the declared scope checks.
type Gate struct {
	Schemes   map[string]Scheme
	Verify    func(context.Context, string, Scheme, Credential) (Principal, error)
	Authorize func(context.Context, *http.Request, map[string]Principal) error
}

type principalsKey struct{}

// Principals returns verified identities for the selected security alternative.
func Principals(ctx context.Context) map[string]Principal {
	value, _ := ctx.Value(principalsKey{}).(map[string]Principal)
	copy := make(map[string]Principal, len(value))
	for name, principal := range value {
		principal.Scopes = slices.Clone(principal.Scopes)
		copy[name] = principal
	}
	return copy
}

// Protect validates policy at setup time and wraps a real API, spec or Explorer
// handler. Login/callback routes are mounted separately by the host.
func (g Gate) Protect(requirements Requirements, next http.Handler) (http.Handler, error) {
	for _, alternative := range requirements {
		for name, scopes := range alternative {
			scheme, ok := g.Schemes[name]
			if !ok {
				return nil, fmt.Errorf("undefined security scheme %q", name)
			}
			if err := scheme.validate(); err != nil {
				return nil, fmt.Errorf("security scheme %q: %w", name, err)
			}
			if g.Verify == nil {
				return nil, errors.New("identity verifier is required")
			}
			if scheme.Type != "oauth2" && len(scopes) > 0 {
				return nil, fmt.Errorf("scopes require an OAuth2 scheme: %s", name)
			}
			for _, scope := range scopes {
				if _, ok := scheme.Scopes[scope]; !ok {
					return nil, fmt.Errorf("undefined OAuth2 scope %q", scope)
				}
			}
		}
	}
	// Snapshot policy so callers cannot silently change a live route's protection.
	policy := make(Requirements, len(requirements))
	for i, alternative := range requirements {
		policy[i] = map[string][]string{}
		for name, scopes := range alternative {
			policy[i][name] = slices.Clone(scopes)
		}
	}
	schemes := make(map[string]Scheme, len(g.Schemes))
	for name, scheme := range g.Schemes {
		scheme.Scopes = maps.Clone(scheme.Scopes)
		schemes[name] = scheme
	}
	g.Schemes = schemes
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identities, err := g.check(r, policy)
		if err == nil {
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), principalsKey{}, identities)))
			return
		}
		status, code := http.StatusServiceUnavailable, "AUTH_UNAVAILABLE"
		if errors.Is(err, ErrCredentials) {
			status, code = http.StatusUnauthorized, "UNAUTHENTICATED"
		}
		if errors.Is(err, ErrForbidden) {
			status, code = http.StatusForbidden, "FORBIDDEN"
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if status == http.StatusUnauthorized {
			for _, alternative := range policy {
				for name := range alternative {
					switch g.Schemes[name].Type {
					case "basic":
						w.Header().Add("WWW-Authenticate", `Basic realm="api"`)
					case "oauth2":
						w.Header().Add("WWW-Authenticate", `Bearer realm="api"`)
					}
				}
			}
		}
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"code": code})
	}), nil
}

func (g Gate) check(req *http.Request, requirements Requirements) (map[string]Principal, error) {
	if len(requirements) == 0 {
		requirements = Requirements{{}}
	}
	denied := false
	for _, alternative := range requirements {
		identities := map[string]Principal{}
		authenticated, allowed := true, true
		names := make([]string, 0, len(alternative))
		for name := range alternative {
			names = append(names, name)
		}
		slices.Sort(names)
		for _, name := range names {
			scheme := g.Schemes[name]
			credential, ok := scheme.read(req)
			if !ok {
				authenticated = false
				break
			}
			principal, err := g.Verify(req.Context(), name, scheme, credential)
			if err != nil && !errors.Is(err, ErrCredentials) {
				return nil, err
			}
			if err != nil || principal.Subject == "" {
				authenticated = false
				break
			}
			identities[name] = principal
			for _, scope := range alternative[name] {
				if !slices.Contains(principal.Scopes, scope) {
					allowed = false
				}
			}
		}
		if !authenticated {
			continue
		}
		if !allowed {
			denied = true
			continue
		}
		if g.Authorize != nil {
			if err := g.Authorize(req.Context(), req, identities); err != nil {
				if !errors.Is(err, ErrForbidden) {
					return nil, err
				}
				denied = true
				continue
			}
		}
		return identities, nil
	}
	if denied {
		return nil, ErrForbidden
	}
	return nil, ErrCredentials
}
