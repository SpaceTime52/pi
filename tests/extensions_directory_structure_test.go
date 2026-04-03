package tests

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func projectRoot() string {
	wd, _ := os.Getwd()
	return filepath.Dir(wd)
}

func TestExtensionsMustBeDirectories(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	for _, e := range entries {
		if e.Name() == ".gitkeep" {
			continue
		}
		if !e.IsDir() {
			t.Errorf("extensions/%s: 파일 불허용, 폴더만 허용", e.Name())
		}
	}
}

func TestExtensionsNoPackageJson(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		pkg := filepath.Join(dir, e.Name(), "package.json")
		if _, err := os.Stat(pkg); err == nil {
			t.Errorf("extensions/%s/: package.json은 루트에만 허용", e.Name())
		}
	}
}

func TestExtensionsHaveReadme(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	for _, e := range entries {
		if e.Name() == ".gitkeep" || !e.IsDir() {
			continue
		}

		path := filepath.Join(dir, e.Name())

		// README 필수, .md 불허용
		if _, err := os.Stat(filepath.Join(path, "README.md")); err == nil {
			t.Errorf("extensions/%s/: README.md 불허용, README만 허용", e.Name())
			continue
		}

		readme := filepath.Join(path, "README")
		data, err := os.ReadFile(readme)
		if err != nil {
			t.Errorf("extensions/%s/: README 없음", e.Name())
			continue
		}

		if len(strings.TrimSpace(string(data))) == 0 {
			t.Errorf("extensions/%s/: README가 비어있음", e.Name())
		}
	}
}

func TestExtensionsHaveIndexTs(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	for _, e := range entries {
		if e.Name() == ".gitkeep" || !e.IsDir() {
			continue
		}
		index := filepath.Join(dir, e.Name(), "index.ts")
		if _, err := os.Stat(index); err != nil {
			t.Errorf("extensions/%s/: index.ts 없음", e.Name())
		}
	}
}
