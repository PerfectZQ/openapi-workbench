package golang

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/PerfectZQ/openapi-workbench/contract"
)

func (g *generator) writeServices(groups map[string][]contract.Method) error {
	output := g.output
	var client strings.Builder
	fmt.Fprintf(&client, "// ActionVersion is the default Action protocol version; operations may declare their own version.\nconst ActionVersion = %q\n", g.spec.BusinessVersion)
	client.WriteString("type Client struct { clientState\n")
	for _, group := range contract.Keys(groups) {
		fmt.Fprintf(&client, "%s *%sService\n", group, group)
	}
	client.WriteString("}\n\n// NewClient creates a reusable typed client without initializing server dependencies.\nfunc NewClient(config Config) (*Client, error) { state, err := newClientState(config); if err != nil { return nil, err }; c := &Client{clientState: state}\n")
	for _, group := range contract.Keys(groups) {
		fmt.Fprintf(&client, "c.%s = &%sService{client:c}\n", group, group)
	}
	client.WriteString("return c,nil\n}\n")
	if err := g.writeGo(filepath.Join(output, "services.gen.go"), "", client.String()); err != nil {
		return err
	}
	for _, group := range contract.Keys(groups) {
		var b strings.Builder
		fmt.Fprintf(&b, "type %sService struct { client *Client }\n", group)
		for _, m := range groups[group] {
			if err := g.writeMethod(&b, m); err != nil {
				return err
			}
		}
		imports := "\"context\"\n\"fmt\"\n\"net/http\"\n"
		if strings.Contains(b.String(), "json.RawMessage") {
			imports += "\"encoding/json\"\n"
		}
		// Sentinels are avoided: only import packages used in this group's output.
		if !strings.Contains(b.String(), "fmt.") {
			imports = strings.ReplaceAll(imports, "\"fmt\"\n", "")
		}
		if !strings.Contains(b.String(), "http.") {
			imports = strings.ReplaceAll(imports, "\"net/http\"\n", "")
		}
		if err := g.writeGo(filepath.Join(output, "api_"+strings.ToLower(group)+".gen.go"), imports, b.String()); err != nil {
			return err
		}
	}
	return nil
}
