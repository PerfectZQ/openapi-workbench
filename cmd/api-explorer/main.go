package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	explorer "github.com/PerfectZQ/openapi-workbench"
	"github.com/PerfectZQ/openapi-workbench/sdkgen/project"
)

func main() {
	if err := run(os.Args[1:], os.Stderr); err != nil && !errors.Is(err, flag.ErrHelp) {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, output io.Writer) error {
	if len(args) == 0 || args[0] == "help" || args[0] == "--help" {
		fmt.Fprintln(output, "API Explorer — Swagger 扩展产品\n\n  api-explorer assets --spec /swagger/doc.json --out ./public/api-explorer\n  api-explorer sdk --spec ./swagger.json --out ./sdk [--lang go,typescript]\n\n安装包已内置完整前端资源，无需 Node.js 或前端构建。")
		return nil
	}
	flags := flag.NewFlagSet(args[0], flag.ContinueOnError)
	flags.SetOutput(output)
	spec := flags.String("spec", "", "Swagger JSON 文件（sdk）或浏览器访问地址（assets）")
	out := flags.String("out", "", "输出目录")
	switch args[0] {
	case "assets":
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if *spec == "" || *out == "" || flags.NArg() != 0 {
			return fmt.Errorf("用法：api-explorer assets --spec /swagger/doc.json --out ./public/api-explorer")
		}
		return explorer.Export(*out, *spec)
	case "sdk":
		languages := flags.String("lang", "go,typescript", "SDK 语言，用逗号分隔")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if *spec == "" || *out == "" || flags.NArg() != 0 {
			return fmt.Errorf("用法：api-explorer sdk --spec ./swagger.json --out ./sdk [--lang go,typescript]")
		}
		return project.Generate(*spec, *out, strings.Split(*languages, ","))
	default:
		return fmt.Errorf("未知命令 %q；运行 api-explorer --help", args[0])
	}
}
