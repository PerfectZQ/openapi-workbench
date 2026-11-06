package golang

import "path/filepath"

func (g *generator) writeConfig() error {
	return g.writeGo(filepath.Join(g.output, "config.gen.go"), "\"context\"\n\"errors\"\n\"net/http\"\n\"net/url\"\n\"strings\"\n\"time\"", `
// Config selects the endpoint, transport and request identity.
// A Client is safe for concurrent use; credential functions and transports must be too.
type Config struct {
	// Endpoint is an HTTP(S) origin, without an API path, query or fragment.
	Endpoint string
	// BasePath is prepended to the complete contract path at request time.
	// Empty preserves the contract path. For example, /gateway + /v1/items
	// sends /gateway/v1/items. Supply a leading slash and no trailing slash.
	BasePath string
	// Protocol selects "rest" (default) or "action" for operations that declare protocol routes.
	Protocol string
	HTTPClient *http.Client
	Authenticate func(context.Context, *http.Request) error
	// InnerTOPVersion selects signed gateway mode; BasePath must be empty.
	InnerTOPVersion string
}
// clientState is immutable after construction.
type clientState struct{ config Config }

func newClientState(config Config) (clientState, error) {
	if config.Protocol != "" && config.Protocol != "rest" && config.Protocol != "action" {
		return clientState{}, errors.New("sdk: protocol must be rest or action")
	}
	u, err := url.Parse(config.Endpoint)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return clientState{}, errors.New("sdk: endpoint must be an HTTP(S) origin")
	}
	config.Endpoint = strings.TrimSuffix(config.Endpoint, "/")
	prefix := config.BasePath
	if prefix != "" && (prefix == "/" || !strings.HasPrefix(prefix, "/") || strings.HasSuffix(prefix, "/") || strings.ContainsAny(prefix, "?#%\\") || strings.Contains(prefix, "//") || strings.Contains(prefix, "/.")) {
		return clientState{}, errors.New("sdk: invalid base path")
	}
	if config.InnerTOPVersion != "" && (config.Authenticate == nil || prefix != "") {
		return clientState{}, errors.New("sdk: InnerTOP requires signing and cannot use a base path")
	}
	client := http.Client{Timeout: 30 * time.Second}
	if config.HTTPClient != nil {
		client = *config.HTTPClient
	}
	// Do not replay writes or disclose custom credentials through redirects.
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	config.HTTPClient = &client
	return clientState{config: config}, nil
}

// requestURL composes the origin, caller-supplied mount path and encoded operation path.
func (c clientState) requestURL(path string, query url.Values) string {
    endpoint := c.config.Endpoint + c.config.BasePath + path
    if len(query) > 0 {
        endpoint += "?" + query.Encode()
    }
    return endpoint
}
`)
}
