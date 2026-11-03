package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"math/big"
	"reflect"
	"strings"
)

func decodeJSON(raw []byte, target any) error {
	if !json.Valid(raw) {
		return errors.New("需要单个有效 JSON 值")
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	return d.Decode(target)
}

func isInteger(n json.Number) bool {
	// 传给 Go 整数字段的 JSON 必须为整数字面量，不能接受 1.0/1e3 后让服务端拒绝。
	return !strings.ContainsAny(string(n), ".eE")
}

func equalJSON(a, b []byte) bool {
	var av, bv any
	return decodeJSON(a, &av) == nil && decodeJSON(b, &bv) == nil && equalValue(av, bv)
}

func equalValue(a, b any) bool {
	if n, ok := a.(json.Number); ok {
		m, ok := b.(json.Number)
		if !ok {
			return false
		}
		x, xok := new(big.Rat).SetString(string(n))
		y, yok := new(big.Rat).SetString(string(m))
		return xok && yok && x.Cmp(y) == 0
	}
	switch x := a.(type) {
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for k, v := range x {
			w, exists := y[k]
			if !exists || !equalValue(v, w) {
				return false
			}
		}
		return true
	case []any:
		y, ok := b.([]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for i, v := range x {
			if !equalValue(v, y[i]) {
				return false
			}
		}
		return true
	default:
		return reflect.DeepEqual(a, b)
	}
}
