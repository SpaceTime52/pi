package tests

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

var packageJSONAllowedKeys = map[string]bool{
	"pi":      true,
	"scripts": true,
}

func TestPackageJSON_AllowedKeysOnly(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		t.Fatalf("package.json 읽기 실패: %v", err)
	}
	var pkg map[string]json.RawMessage
	if err := json.Unmarshal(data, &pkg); err != nil {
		t.Fatalf("package.json 파싱 실패: %v", err)
	}
	for key := range pkg {
		if !packageJSONAllowedKeys[key] {
			t.Errorf("허용되지 않은 키: %s", key)
		}
	}
}
