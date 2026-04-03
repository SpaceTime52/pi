package main

import (
	"fmt"
	"os"
	"path/filepath"
)

var errors []string

func errorf(format string, args ...any) {
	errors = append(errors, fmt.Sprintf(format, args...))
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}

	validateExtensions(root)

	if len(errors) == 0 {
		fmt.Println("OK")
		return
	}

	for _, e := range errors {
		fmt.Fprintf(os.Stderr, "  FAIL  %s\n", e)
	}
	os.Exit(1)
}

func validateExtensions(root string) {
	dir := filepath.Join(root, "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, e := range entries {
		name := e.Name()
		if name == ".gitkeep" {
			continue
		}

		if !e.IsDir() {
			errorf("extensions/%s: 파일 불허용, 폴더만 허용", name)
			continue
		}

		path := filepath.Join(dir, name)

		if _, err := os.Stat(filepath.Join(path, "index.ts")); err != nil {
			errorf("extensions/%s/: index.ts 없음", name)
		}

		if _, err := os.Stat(filepath.Join(path, "package.json")); err != nil {
			errorf("extensions/%s/: package.json 없음", name)
		}
	}
}
