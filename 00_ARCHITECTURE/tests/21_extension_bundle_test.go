package tests

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExtension_NoDependencies(t *testing.T) {
	dir := filepath.Join(root, "01_EXTENSIONS")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("01_EXTENSIONS 읽기 실패: %v", err)
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		t.Run(e.Name(), func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join(dir, e.Name(), "package.json"))
			if err != nil {
				t.Fatalf("package.json 읽기 실패: %v", err)
			}
			var pkg map[string]json.RawMessage
			if err := json.Unmarshal(data, &pkg); err != nil {
				t.Fatalf("package.json 파싱 실패: %v", err)
			}
			if _, ok := pkg["dependencies"]; ok {
				t.Errorf("dependencies 금지: devDependencies만 허용 (esbuild 번들링 필수)")
			}
		})
	}
}

func TestExtension_EsbuildBundle(t *testing.T) {
	dir := filepath.Join(root, "01_EXTENSIONS")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("01_EXTENSIONS 읽기 실패: %v", err)
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		t.Run(e.Name(), func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join(dir, e.Name(), "package.json"))
			if err != nil {
				t.Fatalf("package.json 읽기 실패: %v", err)
			}
			var pkg struct {
				Scripts map[string]string `json:"scripts"`
			}
			if err := json.Unmarshal(data, &pkg); err != nil {
				t.Fatalf("package.json 파싱 실패: %v", err)
			}
			build := pkg.Scripts["build"]
			if !strings.Contains(build, "esbuild") || !strings.Contains(build, "--bundle") {
				t.Errorf("build 스크립트에 esbuild --bundle 필수, 실제: %s", build)
			}
		})
	}
}

func TestExtension_DistSingleFile(t *testing.T) {
	dir := filepath.Join(root, "01_EXTENSIONS")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("01_EXTENSIONS 읽기 실패: %v", err)
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		t.Run(e.Name(), func(t *testing.T) {
			distDir := filepath.Join(dir, e.Name(), "dist")
			files, err := os.ReadDir(distDir)
			if err != nil {
				t.Fatalf("dist/ 읽기 실패: %v", err)
			}
			for _, f := range files {
				if f.Name() != "index.js" {
					t.Errorf("dist/에 index.js 외 파일 금지: %s", f.Name())
				}
			}
		})
	}
}
