package tests

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// "    name ···· description" 형식 검증
func TestReadmeSectionFormat(t *testing.T) {
	root := projectRoot()
	data, err := os.ReadFile(filepath.Join(root, "README"))
	if err != nil {
		t.Fatal("README 없음")
	}

	sections := []string{"EXTENSIONS", "SKILLS"}
	for _, section := range sections {
		items := readmeSection(string(data), section)
		for _, item := range items {
			if !strings.Contains(item, "····") {
				t.Errorf("README %s: \"%s\" 형식 오류, \"이름 ···· 설명\" 형식 필수", section, item)
				continue
			}

			parts := strings.SplitN(item, "····", 2)
			name := strings.TrimSpace(parts[0])
			desc := strings.TrimSpace(parts[1])

			if name == "" {
				t.Errorf("README %s: 이름이 비어있음", section)
			}
			if desc == "" {
				t.Errorf("README %s: \"%s\" 설명이 비어있음", section, name)
			}
		}
	}
}
