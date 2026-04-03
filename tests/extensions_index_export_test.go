package tests

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

func parseTS(t *testing.T, data []byte) *sitter.Node {
	parser := sitter.NewParser()
	parser.SetLanguage(typescript.GetLanguage())
	tree, err := parser.ParseCtx(context.Background(), nil, data)
	if err != nil {
		t.Fatalf("TypeScript 파싱 실패: %v", err)
	}
	return tree.RootNode()
}

func TestExtensionsIndexAST(t *testing.T) {
	dir := filepath.Join(projectRoot(), "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Skip("extensions/ 없음")
	}

	for _, e := range entries {
		if !e.IsDir() || e.Name() == ".gitkeep" {
			continue
		}

		index := filepath.Join(dir, e.Name(), "index.ts")
		data, err := os.ReadFile(index)
		if err != nil {
			continue
		}

		root := parseTS(t, data)
		name := e.Name()

		hasExportDefault := false
		for i := 0; i < int(root.ChildCount()); i++ {
			child := root.Child(i)

			switch child.Type() {
			case "import_statement", "comment":
				// 허용
			case "export_statement":
				if hasExportDefault {
					t.Errorf("extensions/%s/index.ts: export 중복", name)
				}
				hasExportDefault = true
				validateExportDefault(t, child, data, name)
			default:
				t.Errorf("extensions/%s/index.ts: 허용되지 않은 top-level 구문: %s", name, child.Type())
			}
		}

		if !hasExportDefault {
			t.Errorf("extensions/%s/index.ts: export default function (pi: ExtensionAPI) 없음", name)
		}
	}
}

func validateExportDefault(t *testing.T, node *sitter.Node, data []byte, name string) {
	// export + default 키워드 확인
	hasDefault := false
	var fn *sitter.Node
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		switch child.Type() {
		case "default":
			hasDefault = true
		case "function_expression":
			fn = child
		}
	}

	if !hasDefault {
		t.Errorf("extensions/%s/index.ts: export default여야 함", name)
		return
	}
	if fn == nil {
		t.Errorf("extensions/%s/index.ts: export default는 function이어야 함", name)
		return
	}

	// 파라미터 검증: (pi: ExtensionAPI) 하나만
	params := findChild(fn, "formal_parameters")
	if params == nil {
		t.Errorf("extensions/%s/index.ts: function에 파라미터 없음", name)
		return
	}

	paramCount := 0
	for i := 0; i < int(params.ChildCount()); i++ {
		p := params.Child(i)
		if p.Type() != "required_parameter" {
			continue
		}
		paramCount++

		id := findChild(p, "identifier")
		if id == nil || id.Content(data) != "pi" {
			t.Errorf("extensions/%s/index.ts: 파라미터 이름은 pi여야 함", name)
		}

		ann := findChild(p, "type_annotation")
		if ann == nil || !containsText(ann, data, "ExtensionAPI") {
			t.Errorf("extensions/%s/index.ts: 파라미터 타입은 ExtensionAPI여야 함", name)
		}
	}

	if paramCount != 1 {
		t.Errorf("extensions/%s/index.ts: 파라미터는 pi 하나만 허용", name)
	}
}

func findChild(node *sitter.Node, nodeType string) *sitter.Node {
	for i := 0; i < int(node.ChildCount()); i++ {
		if node.Child(i).Type() == nodeType {
			return node.Child(i)
		}
	}
	return nil
}

func containsText(node *sitter.Node, data []byte, text string) bool {
	content := node.Content(data)
	for i := 0; i <= len(content)-len(text); i++ {
		if content[i:i+len(text)] == text {
			return true
		}
	}
	return false
}
