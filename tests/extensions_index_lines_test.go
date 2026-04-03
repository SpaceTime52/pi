package tests

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestExtensionsIndexMaxLines(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	const maxLines = 80

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}

		index := filepath.Join(dir, e.Name(), "index.ts")
		data, err := os.ReadFile(index)
		if err != nil {
			continue
		}

		lines := bytes.Count(data, []byte("\n"))
		if lines > maxLines {
			t.Errorf("extensions/%s/index.ts: %d줄 (최대 %d줄)", e.Name(), lines, maxLines)
		}
	}
}
