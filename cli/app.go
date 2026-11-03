package cli

import (
	"context"
	"errors"
	"io"
	"net/http"
)

// App binds a Swagger document to commands. Host hooks own authentication,
// deployment paths and response envelopes; none are required for ordinary REST.
type App struct {
	Name           string
	EnvPrefix      string
	Specification  []byte
	MapPath        func(path, publicPrefix string) (string, error)
	PrepareRequest func(*http.Request, Operation) error
	Authenticate   func(*http.Request, Operation, Options) *Output
	DecodeResponse func(*http.Response, []byte, Operation, Options) (Output, bool)
}

// Commands returns the deterministic command catalog shared by CLI discovery
// and skill generation. Invalid or ambiguous names fail before any output.
func (a App) Commands() ([]Command, error) {
	spec, err := a.loadSpec()
	if err != nil {
		return nil, err
	}
	return spec.namedOperations()
}

// Call executes the same contract/request pipeline used by named commands.
// Business workflows use this entry point instead of implementing HTTP again.
func (a App) Call(ctx context.Context, method, path string, opts Options, stdin io.Reader) (Output, int) {
	spec, err := a.loadSpec()
	if err != nil {
		return localError(err)
	}
	v, op, err := spec.lookup(method, path)
	if err != nil {
		return localError(err)
	}
	return a.callOperation(ctx, v, op, opts, stdin)
}

func (a App) callOperation(ctx context.Context, v Command, op Operation, opts Options, stdin io.Reader) (Output, int) {
	if opts.Timeout <= 0 {
		return localError(errors.New("timeout 必须大于 0"))
	}
	req, err := a.buildRequest(ctx, v, op, opts, stdin)
	if err != nil {
		return localError(err)
	}
	if opts.Preview {
		return Output{OK: true, Result: preview(req)}, 0
	}
	if opts.Protocol == "action" && op.actionOperation != nil {
		op = *op.actionOperation
	}
	return a.execute(req, opts, op)
}
