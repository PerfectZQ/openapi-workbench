package cli_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/PerfectZQ/openapi-workbench/cli"
)

const specification = `{"swagger":"2.0","basePath":"/inventory","securityDefinitions":{"Key":{"type":"apiKey","in":"header","name":"X-API-Key"}},"security":[{"Key":[]}],"paths":{
"/items/{id}":{"post":{"operationId":"items.ChangeItem","parameters":[{"in":"path","name":"id","required":true,"type":"integer"},{"in":"body","name":"body","required":true,"schema":{"type":"object","required":["id"],"properties":{"id":{"type":"integer"},"enabled":{"type":"boolean"},"protocol":{"type":"string"}}}}],"responses":{"200":{"schema":{"type":"object"}}}}},
"/public":{"get":{"security":[],"responses":{"204":{}}}},
"/download":{"get":{"operationId":"items.Download","responses":{"200":{"schema":{"type":"file"}}}}}
}}`

func invoke(t *testing.T, app cli.App, args ...string) (int, map[string]any, string) {
	t.Helper()
	var output bytes.Buffer
	code := app.Run(context.Background(), args, strings.NewReader(""), &output)
	var value map[string]any
	if err := json.Unmarshal(output.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	return code, value, output.String()
}

// Real HTTP verifies generated named flags, large integers, standard auth,
// Swagger basePath, public overrides, downloads and non-replayed failures.
func TestContractCommandsAndTransport(t *testing.T) {
	var calls atomic.Int32
	var status atomic.Int32
	status.Store(200)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/inventory/public" {
			if r.Header.Get("X-API-Key") != "" {
				t.Error("credentials leaked to public operation")
			}
			w.WriteHeader(204)
			return
		}
		if r.Header.Get("X-API-Key") != "private-key" {
			t.Error("missing scheme credential")
		}
		if r.URL.Path == "/inventory/download" {
			w.Header().Set("Content-Type", "application/octet-stream")
			_, _ = w.Write([]byte{0, 1, 2, 3})
			return
		}
		if r.URL.Path != "/inventory/items/9007199254740993" {
			t.Errorf("path=%s", r.URL.Path)
		}
		data, _ := io.ReadAll(r.Body)
		if string(data) != `{"enabled":false,"id":9007199254740993,"protocol":"business"}` {
			t.Errorf("body=%s", data)
		}
		w.Header().Set("Location", "/should-not-follow")
		w.WriteHeader(int(status.Load()))
		_, _ = io.WriteString(w, `{"Result":"ordinary property, not an envelope","ResponseMetadata":{},"id":9007199254740993}`)
	}))
	defer server.Close()
	auth := filepath.Join(t.TempDir(), "auth.json")
	if err := os.WriteFile(auth, []byte(`{"Key":{"value":"private-key"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("INVENTORY_BASE_URL", server.URL)
	t.Setenv("INVENTORY_AUTH_FILE", auth)
	app := cli.App{Name: "inventory", EnvPrefix: "INVENTORY", Specification: []byte(specification)}
	commands, err := app.Commands()
	if err != nil || len(commands) != 3 {
		t.Fatalf("%v %v", commands, err)
	}
	args := []string{"items", "change-item", "--path-id", "9007199254740993", "--body-id", "9007199254740993", "--enabled", "false", "--body-protocol", "business"}
	code, result, raw := invoke(t, app, args...)
	if code != 0 || !strings.Contains(raw, `"id":9007199254740993`) || result["result"].(map[string]any)["Result"] == nil {
		t.Fatal(raw)
	}
	before := calls.Load()
	code, _, raw = invoke(t, app, append(args, "--preview")...)
	if code != 0 || calls.Load() != before || strings.Contains(raw, "private-key") {
		t.Fatal(raw)
	}
	for _, invalid := range [][]string{{"items", "change-item", "--path-id", "x"}, {"items", "change-item", "--help"}} {
		code, _, _ = invoke(t, app, invalid...)
		if invalid[len(invalid)-1] == "--help" && code != 0 {
			t.Fatal("help failed")
		}
		if invalid[len(invalid)-1] != "--help" && code != 2 {
			t.Fatal("invalid input accepted")
		}
	}
	code, _, raw = invoke(t, app, "api", "call", "GET", "/public")
	if code != 0 {
		t.Fatal(raw)
	}
	file := filepath.Join(t.TempDir(), "items.bin")
	code, _, raw = invoke(t, app, "items", "download", "--output", file)
	if code != 0 {
		t.Fatal(raw)
	}
	data, _ := os.ReadFile(file)
	if !bytes.Equal(data, []byte{0, 1, 2, 3}) {
		t.Fatal("download corrupted")
	}
	if code, _, _ = invoke(t, app, "items", "download", "--output", file); code != 2 {
		t.Fatal("overwrote download")
	}
	status.Store(302)
	before = calls.Load()
	code, _, _ = invoke(t, app, args...)
	if code != 1 || calls.Load() != before+1 {
		t.Fatal("redirect/retry changed request count")
	}
	t.Setenv("INVENTORY_AUTH_FILE", "")
	before = calls.Load()
	code, _, raw = invoke(t, app, args...)
	if code != 1 || calls.Load() != before || !strings.Contains(raw, "AUTH_REQUIRED") {
		t.Fatal(raw)
	}
}
