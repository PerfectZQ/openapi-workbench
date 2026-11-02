package sdkgen_test

import (
	"github.com/PerfectZQ/openapi-workbench/sdkgen/project"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestCompleteSDKProject(t *testing.T) {
	root := t.TempDir()
	spec := filepath.Join(root, "swagger.json")
	destination := filepath.Join(root, "sdk")
	if err := os.WriteFile(spec, []byte(`{"swagger":"2.0","basePath":"/v1","paths":{"/items/{id}":{"get":{"operationId":"GetItem","parameters":[{"name":"id","in":"path","type":"string","required":true},{"name":"q","in":"query","type":"string"}],"responses":{"200":{"schema":{"type":"object","properties":{"name":{"type":"string"}}}}}}},"/preview":{"post":{"operationId":"Preview","parameters":[{"name":"body","in":"body","required":true,"schema":{"type":"object","additionalProperties":{"type":"string"}}}],"responses":{"200":{"schema":{"type":"object","additionalProperties":{"type":"string"}}}}}},"/empty":{"get":{"operationId":"Empty","responses":{"204":{"description":"No content"}}}}}}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := project.Generate(spec, destination, []string{"go", "typescript"}); err != nil {
		t.Fatal(err)
	}
	if err := project.Generate(spec, destination, []string{"go"}); err == nil {
		t.Fatal("overwrote existing project")
	}
	probe := `package sdk
import("context";"net/http";"net/http/httptest";"testing")
func TestHTTP(t *testing.T){
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.EscapedPath()!="/v1/items/a%2Fb"||r.URL.Query().Get("q")!="x/y"||r.Header.Get("Authorization")!="Bearer test"{t.Errorf("unexpected request: %s %v",r.URL,r.Header)}
  w.Header().Set("Content-Type","application/json");w.Write([]byte("{\"name\":\"Notebook\"}"))
 }));defer server.Close()
 client,err:=NewClient(Config{Endpoint:server.URL,Authenticate:func(_ context.Context,r *http.Request)error{r.Header.Set("Authorization","Bearer test");return nil}});if err!=nil{t.Fatal(err)}
 item,err:=client.API.GetItem(context.Background(),APIGetItemInput{ID:"a/b",Q:Ptr("x/y")});if err!=nil{t.Fatal(err)}
 if item.Name==nil||*item.Name!="Notebook"{t.Fatalf("unexpected result: %#v",item)}
}
`
	if err := os.WriteFile(filepath.Join(destination, "go", "client_test.go"), []byte(probe), 0644); err != nil {
		t.Fatal(err)
	}
	command := exec.Command(filepath.Join(runtime.GOROOT(), "bin", "go"), "test", "./...")
	command.Dir = filepath.Join(destination, "go")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("generated SDK: %v\n%s", err, output)
	}
	for _, file := range []string{"typescript/package.json", "typescript/tsconfig.json", "typescript/src/client.ts", "typescript/src/index.ts"} {
		if _, err := os.Stat(filepath.Join(destination, file)); err != nil {
			t.Fatal(err)
		}
	}
}
