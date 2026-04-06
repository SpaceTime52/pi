package tests

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

var typeAssertionRe = regexp.MustCompile(`\bas\s+(any|unknown|never)\b`)

func TestAllFiles_NoTypeAssertions(t *testing.T) {
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		dir := filepath.Base(filepath.Dir(path))
		if info.IsDir() {
			if filepath.Base(path) == ".git" || dir == "node_modules" || dir == "coverage" || dir == "dist" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".ts") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		for i, line := range strings.Split(string(data), "\n") {
			if typeAssertionRe.MatchString(line) {
				t.Errorf("%s:%d 타입 단언 금지: %s", rel, i+1, strings.TrimSpace(line))
			}
		}
		return nil
	})
}
