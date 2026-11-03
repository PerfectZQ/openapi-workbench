package security_test

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/PerfectZQ/openapi-workbench/security"
)

// Exercises the actual client and middleware against HTTP. The verifier checks
// opaque fixture credentials at the identity-provider boundary; no API business
// logic is replaced. OR/AND, scope and host policy failures must never reach it.
func TestAuthenticationAndAuthorization(t *testing.T) {
	schemes := map[string]security.Scheme{
		"Key":   {Type: "apiKey", In: "header", Name: "X-API-Key"},
		"OAuth": {Type: "oauth2", Scopes: map[string]string{"read": "Read inventory", "write": "Change inventory"}},
		"Basic": {Type: "basic"},
	}
	policyJSON, _ := json.Marshal(map[string]any{"swagger": "2.0", "securityDefinitions": schemes, "security": security.Requirements{{"Key": {}}}, "paths": map[string]any{"/inherited": map[string]any{"get": map[string]any{}}, "/public": map[string]any{"get": map[string]any{"security": security.Requirements{}}}}})
	policy, err := security.Parse(policyJSON)
	if err != nil {
		t.Fatal(err)
	}
	inherited, err := policy.Requirements("GET", "/inherited")
	if err != nil || !reflect.DeepEqual(inherited, security.Requirements{{"Key": {}}}) {
		t.Fatal(inherited, err)
	}
	public, err := policy.Requirements("GET", "/public")
	if err != nil || len(public) != 0 {
		t.Fatal(public, err)
	}
	if _, err := policy.Requirements("GET", "/missing"); err == nil {
		t.Fatal("unknown operation became public")
	}
	schemes = policy.Schemes
	gate := security.Gate{Schemes: schemes, Verify: func(ctx context.Context, name string, scheme security.Scheme, c security.Credential) (security.Principal, error) {
		secret := c.Value
		expected := "key-secret"
		scopes := []string{}
		if name == "OAuth" {
			expected = "oauth-secret"
			scopes = []string{"read"}
		}
		if name == "Basic" {
			expected = "user:basic-secret"
			secret = c.Username + ":" + c.Password
		}
		if subtle.ConstantTimeCompare([]byte(secret), []byte(expected)) != 1 {
			return security.Principal{}, security.ErrCredentials
		}
		return security.Principal{Subject: "test-user", Scopes: scopes}, nil
	}, Authorize: func(ctx context.Context, r *http.Request, ids map[string]security.Principal) error {
		if r.URL.Query().Get("unavailable") == "true" {
			return errors.New("identity provider unavailable")
		}
		if r.URL.Query().Get("deny") == "true" {
			return security.ErrForbidden
		}
		return nil
	}}
	mux := http.NewServeMux()
	business := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identities := security.Principals(r.Context())
		_ = json.NewEncoder(w).Encode(map[string]any{"identities": len(identities)})
	})
	for path, requirements := range map[string]security.Requirements{
		"/and": {{"Key": {}, "OAuth": {"read"}}}, "/or": {{"Key": {}}, {"Basic": {}}},
		"/write": {{"OAuth": {"write"}}}, "/public": {{}},
	} {
		handler, err := gate.Protect(requirements, business)
		if err != nil {
			t.Fatal(err)
		}
		mux.Handle(path, handler)
	}
	server := httptest.NewServer(mux)
	defer server.Close()
	for _, tc := range []struct {
		path         string
		requirements security.Requirements
		credentials  map[string]security.Credential
		status       int
		count        int
	}{
		{"/and", security.Requirements{{"Key": {}, "OAuth": {"read"}}}, map[string]security.Credential{"Key": {Value: "key-secret"}, "OAuth": {Value: "oauth-secret"}}, 200, 2},
		{"/or", security.Requirements{{"Key": {}}, {"Basic": {}}}, map[string]security.Credential{"Basic": {Username: "user", Password: "basic-secret"}}, 200, 1},
		{"/write", security.Requirements{{"OAuth": {"write"}}}, map[string]security.Credential{"OAuth": {Value: "oauth-secret"}}, 403, 0},
		{"/or?deny=true", security.Requirements{{"Key": {}}}, map[string]security.Credential{"Key": {Value: "key-secret"}}, 403, 0},
		{"/or?unavailable=true", security.Requirements{{"Key": {}}}, map[string]security.Credential{"Key": {Value: "key-secret"}}, 503, 0},
		{"/and", nil, nil, 401, 0}, {"/or", security.Requirements{{"Key": {}}}, map[string]security.Credential{"Key": {Value: "invalid"}}, 401, 0},
		{"/public", security.Requirements{{}}, map[string]security.Credential{"Key": {Value: "unused"}}, 200, 0},
	} {
		t.Run(tc.path, func(t *testing.T) {
			req, _ := http.NewRequest("GET", server.URL+tc.path, nil)
			if err := security.Apply(req, schemes, tc.requirements, tc.credentials); err != nil {
				t.Fatal(err)
			}
			response, err := server.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			if response.StatusCode != tc.status {
				t.Fatalf("status=%d want=%d", response.StatusCode, tc.status)
			}
			var data map[string]any
			if err := json.NewDecoder(response.Body).Decode(&data); err != nil {
				t.Fatal(err)
			}
			if tc.status == 200 && !reflect.DeepEqual(data, map[string]any{"identities": float64(tc.count)}) {
				t.Fatal(data)
			}
		})
	}
	if _, err := gate.Protect(security.Requirements{{"Missing": {}}}, business); err == nil {
		t.Fatal("undefined scheme accepted")
	}
	if _, err := (security.Gate{Schemes: schemes}).Protect(security.Requirements{{"Key": {}}}, business); err == nil {
		t.Fatal("missing verifier accepted")
	}
	request, _ := http.NewRequest("GET", server.URL+"/and", nil)
	if err := security.Apply(request, schemes, security.Requirements{{"Key": {}, "OAuth": {}}}, map[string]security.Credential{"Key": {Value: "must-not-leak"}}); err == nil || request.Header.Get("X-API-Key") != "" {
		t.Fatal("partial AND alternative applied")
	}
	insecure, _ := http.NewRequest("GET", "http://example.invalid/", nil)
	if err := security.Apply(insecure, schemes, security.Requirements{{"Key": {}}}, map[string]security.Credential{"Key": {Value: "secret"}}); err == nil {
		t.Fatal("insecure credential transport accepted")
	}
}
