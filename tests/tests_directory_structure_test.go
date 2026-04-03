package tests

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTestsOnlyGoFiles(t *testing.T) {
	dir := filepath.Join(projectRoot(), "tests")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("tests/ 없음")
	}

	for _, e := range entries {
		if e.IsDir() {
			t.Errorf("tests/%s: 디렉토리 불허용", e.Name())
			continue
		}

		name := e.Name()
		if name == "go.mod" || name == "go.sum" {
			continue
		}
		if len(name) < 9 || name[len(name)-8:] != "_test.go" {
			t.Errorf("tests/%s: _test.go 파일만 허용", name)
		}
	}
}
