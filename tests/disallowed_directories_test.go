package tests

import (
	"os"
	"path/filepath"
	"testing"
)

func TestThemesDirectoryNotAllowed(t *testing.T) {
	dir := filepath.Join(projectRoot(), "themes")
	if _, err := os.Stat(dir); err == nil {
		t.Error("themes/ 디렉토리 불허용")
	}
}

func TestPromptsDirectoryNotAllowed(t *testing.T) {
	dir := filepath.Join(projectRoot(), "prompts")
	if _, err := os.Stat(dir); err == nil {
		t.Error("prompts/ 디렉토리 불허용")
	}
}
