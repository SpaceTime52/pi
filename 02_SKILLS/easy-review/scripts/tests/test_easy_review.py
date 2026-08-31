from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree.ElementTree import tostring


SCRIPT = Path(__file__).resolve().parents[1] / "easy_review.py"
SPEC = importlib.util.spec_from_file_location("easy_review", SCRIPT)
assert SPEC and SPEC.loader
easy_review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(easy_review)


def run(*arguments: str, cwd: Path | None = None, expected: int = 0) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != expected:
        raise AssertionError(
            f"returncode={completed.returncode}, expected={expected}\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    return completed


def simple_diff(path: str = "app.py") -> str:
    return f"""diff --git a/{path} b/{path}
index 1111111..2222222 100644
--- a/{path}
+++ b/{path}
@@ -1,5 +1,6 @@
 def choose(value):
-    score = normalize(value)
+    score = normalize(value, strict=True)
     if score < 0:
         return None
+    audit(score)
     return score
"""


def reviewed_file(
    file_id: str, note: str = "핵심 동작을 구현한다.", view: str = "detail"
) -> dict[str, object]:
    return {"file_id": file_id, "view": view, "note": note, "focus": [], "collapse": []}


class EasyReviewTests(unittest.TestCase):
    def test_worktree_capture_includes_untracked_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory) / "repo"
            repo.mkdir()
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
            (repo / "tracked.txt").write_text("before\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-qm", "initial"], cwd=repo, check=True)
            (repo / "tracked.txt").write_text("after\n", encoding="utf-8")
            (repo / "new file.txt").write_text("new\n", encoding="utf-8")

            bundle = Path(temporary_directory) / "bundle"
            run("capture", "--repo", str(repo), "--worktree", "--output", str(bundle), cwd=repo)
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))

            self.assertEqual(source["stats"]["files"], 2)
            self.assertIn("new file.txt", source["capture"]["untracked_files"])
            self.assertEqual({item["path"] for item in source["files"]}, {"tracked.txt", "new file.txt"})

    def test_large_hunk_uses_global_anchors_and_context_prefixes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            body = "".join(f"-old_value_{index} = {index}\n+new_value_{index} = {index + 1}\n" for index in range(320))
            diff = (
                "diff --git a/large.py b/large.py\n"
                "--- a/large.py\n"
                "+++ b/large.py\n"
                "@@ -1,320 +1,320 @@\n"
                + body
            )
            diff_path = root / "large.diff"
            diff_path.write_text(diff, encoding="utf-8")
            bundle = root / "bundle"
            run(
                "capture",
                "--diff-file",
                str(diff_path),
                "--output",
                str(bundle),
                "--chunk-bytes",
                "4096",
            )
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))

            self.assertGreater(len(source["chunks"]), 2)
            self.assertEqual(
                [line["id"] for line in source["lines"]],
                [f"D{index + 1:06d}" for index in range(len(source["lines"]))],
            )
            inside_hunk_chunks = [
                chunk
                for chunk in source["chunks"]
                if chunk["continuation"]
                and source["lines"][chunk["start_index"]]["kind"] != "hunk_header"
                and source["lines"][chunk["start_index"]]["hunk_id"]
            ]
            self.assertTrue(inside_hunk_chunks)
            self.assertTrue(
                all(
                    any(source["lines"][index]["kind"] == "hunk_header" for index in chunk["prefix_indices"])
                    for chunk in inside_hunk_chunks
                )
            )
            self.assertTrue(
                all(
                    any(source["lines"][index]["kind"] in easy_review.SOURCE_LINE_KINDS for index in chunk["prefix_indices"])
                    for chunk in inside_hunk_chunks
                )
            )

    def test_preview_and_compile_escape_html_and_preserve_exact_source(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            for chunk in source["chunks"]:
                run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])

            addition_anchors = [line["id"] for line in source["lines"] if line["kind"] == "addition"]
            deletion_anchor = next(line["id"] for line in source["lines"] if line["kind"] == "deletion")
            context_anchors = [line["id"] for line in source["lines"] if line["kind"] == "context"]
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "title": "<script>alert(1)</script>",
                    "summary": "strict normalization과 audit 호출을 추가한다.",
                    "overview": ["정규화가 엄격해지고 결과 기록이 추가된다."],
                    "attention": [],
                    "sections": [
                        {
                            "id": "input-flow",
                            "title": "입력 처리 강화",
                            "summary": "정규화를 strict 모드로 전환하고 결과를 기록한다.",
                            "default_open": True,
                            "evidence": [deletion_anchor, *addition_anchors],
                            "files": [
                                {
                                    "file_id": source["files"][0]["id"],
                                    "view": "detail",
                                    "note": "정규화 조건과 기록 시점을 구현한다.",
                                    "focus": [
                                        {
                                            "start": addition_anchors[0],
                                            "end": addition_anchors[0],
                                            "reason": "입력값을 더 엄격한 규칙으로 정규화합니다.",
                                        }
                                    ],
                                    "collapse": [
                                        {
                                            "start": context_anchors[1],
                                            "end": context_anchors[2],
                                            "reason": "기존 입력 방어 조건",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                    "unreviewed_file_ids": [],
                    "verification": [{"name": "local tests", "status": "not_run", "evidence": ""}],
                }
            )
            (bundle / "review-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            run("preview", "--bundle", str(bundle))
            run("compile", "--bundle", str(bundle), "--format", "both")

            html_output = (bundle / "review.html").read_text(encoding="utf-8")
            review = json.loads((bundle / "review.json").read_text(encoding="utf-8"))
            self.assertNotIn("<script>alert(1)</script>", html_output)
            self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html_output)
            self.assertEqual(html_output.count(f'id="{addition_anchors[0]}"'), 1)
            self.assertEqual(html_output.count(f'id="{context_anchors[1]}"'), 1)
            self.assertEqual(review["coverage"]["status"], "complete")
            self.assertIn("+    audit(score)", html_output)
            self.assertIn("한눈에 보기", html_output)
            self.assertIn(">EASY REVIEW<", html_output)
            self.assertNotIn("EASY REVIEW / READ-ONLY", html_output)
            self.assertIn("읽는 흐름", html_output)
            self.assertIn('class="minimap"', html_output)
            self.assertIn('class="language-python"', html_output)
            self.assertIn('class="inline-code-note"', html_output)
            self.assertIn('class="file-name"', html_output)
            self.assertIn("입력값을 더 엄격한 규칙으로 정규화합니다.", html_output)
            self.assertIn("파일 경로와 변경 정보", html_output)
            self.assertIn('class="fold-copy"', html_output)
            self.assertIn('data-action="toggle-minimap"', html_output)
            self.assertIn("data-minimap-progress", html_output)
            self.assertIn("0% 읽음", html_output)
            self.assertNotIn("위치 0%", html_output)
            self.assertIn(
                ".diff { display: grid; grid-template-columns: minmax(100%, max-content);",
                html_output,
            )
            self.assertIn(
                ".folded-lines { display: grid; grid-template-columns: minmax(100%, max-content);",
                html_output,
            )
            self.assertNotIn("{{BODY}}", html_output)
            self.assertNotIn("Findings", html_output)
            self.assertNotIn("Change map", html_output)
            self.assertTrue((bundle / "review.md").is_file())

    def test_internal_easy_review_verification_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            for chunk in source["chunks"]:
                run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])

            evidence = next(line["id"] for line in source["lines"] if line["kind"] == "addition")
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "title": "Change",
                    "summary": "Summary",
                    "overview": ["Overview"],
                    "sections": [
                        {
                            "id": "change",
                            "title": "Group",
                            "summary": "Summary",
                            "default_open": True,
                            "evidence": [evidence],
                            "files": [reviewed_file(source["files"][0]["id"])],
                        }
                    ],
                    "unreviewed_file_ids": [],
                    "verification": [
                        {
                            "name": "Easy Review 전체 diff 정적 검사",
                            "status": "passed",
                            "evidence": "모든 chunk를 읽음",
                        }
                    ],
                }
            )
            (bundle / "review-plan.json").write_text(
                json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )

            completed = run("preview", "--bundle", str(bundle), expected=1)
            self.assertIn("must describe target verification", completed.stdout)

    def test_html_compacts_paths_without_losing_full_link_context(self) -> None:
        source = {
            "lines": [
                {
                    "id": "D000001",
                    "file_id": "F001",
                    "new_line": 42,
                    "old_line": None,
                }
            ]
        }
        files_by_id = {"F001": {"path": "src/features/reviews/notification.service.ts"}}
        parent = easy_review.Element("div")

        easy_review.append_evidence_links(
            parent,
            source=source,
            files_by_id=files_by_id,
            evidence=["D000001"],
        )
        rendered = tostring(parent, encoding="unicode")

        self.assertIn(">notification.service.ts +42<", rendered)
        self.assertIn('title="src/features/reviews/notification.service.ts +42"', rendered)
        self.assertIn('aria-label="src/features/reviews/notification.service.ts +42"', rendered)

    def test_stale_plan_and_uninspected_claim_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            evidence = next(line["id"] for line in source["lines"] if line["kind"] == "addition")
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "source_sha256": "stale",
                    "title": "Change",
                    "summary": "Summary",
                    "overview": ["Overview"],
                    "sections": [
                        {
                            "id": "change",
                            "title": "Group",
                            "summary": "Summary",
                            "default_open": True,
                            "evidence": [evidence],
                            "files": [reviewed_file(source["files"][0]["id"])],
                        }
                    ],
                    "unreviewed_file_ids": [],
                }
            )
            (bundle / "review-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")

            completed = run("preview", "--bundle", str(bundle), expected=1)
            self.assertIn("source_sha256 is stale", completed.stdout)
            self.assertIn("was not fully inspected", completed.stdout)
            self.assertIn("belongs to uninspected chunk", completed.stdout)

    def test_non_string_plan_text_is_rejected_before_rendering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            for chunk in source["chunks"]:
                run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])

            evidence = next(line["id"] for line in source["lines"] if line["kind"] == "addition")
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "title": "Change",
                    "summary": "Summary",
                    "overview": ["Overview"],
                    "sections": [
                        {
                            "id": "change",
                            "title": ["not", "text"],
                            "summary": "Summary",
                            "default_open": True,
                            "evidence": [evidence],
                            "files": [
                                {
                                    "file_id": source["files"][0]["id"],
                                    "view": "detail",
                                    "note": {"not": "text"},
                                    "focus": [],
                                    "collapse": [],
                                }
                            ],
                        }
                    ],
                    "unreviewed_file_ids": [],
                }
            )
            (bundle / "review-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")

            completed = run("preview", "--bundle", str(bundle), expected=1)
            self.assertIn("sections[0] requires title and summary", completed.stdout)
            self.assertIn("sections[0].files[0].note is required", completed.stdout)

    def test_html_uses_reader_authored_section_order_and_collapsed_supporting_group(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff = simple_diff("tests/test_app.py") + simple_diff("app.py")
            diff_path = root / "change.diff"
            diff_path.write_text(diff, encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            for chunk in source["chunks"]:
                run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])

            files_by_path = {item["path"]: item for item in source["files"]}
            anchors_by_file: dict[str, str] = {}
            for line in source["lines"]:
                if line["kind"] == "addition" and line["file_id"] not in anchors_by_file:
                    anchors_by_file[line["file_id"]] = line["id"]
            core_file = files_by_path["app.py"]
            test_file = files_by_path["tests/test_app.py"]
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "title": "입력 처리 변경",
                    "summary": "핵심 동작을 먼저 설명하고 테스트 근거를 뒤에 둔다.",
                    "overview": ["입력 처리와 기록 동작이 함께 바뀐다."],
                    "attention": [],
                    "sections": [
                        {
                            "id": "core-flow",
                            "title": "입력이 처리되는 흐름",
                            "summary": "실제 실행 경로를 먼저 읽는다.",
                            "default_open": True,
                            "evidence": [anchors_by_file[core_file["id"]]],
                            "files": [reviewed_file(core_file["id"])],
                        },
                        {
                            "id": "tests",
                            "title": "테스트가 보증하는 결과",
                            "summary": "보조 검증은 별도 묶음으로 확인한다.",
                            "default_open": False,
                            "evidence": [anchors_by_file[test_file["id"]]],
                            "files": [reviewed_file(test_file["id"], "핵심 결과를 검증한다.")],
                        },
                    ],
                    "unreviewed_file_ids": [],
                    "verification": [],
                }
            )
            (bundle / "review-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            run("compile", "--bundle", str(bundle), "--format", "html")
            html_output = (bundle / "review.html").read_text(encoding="utf-8")

            self.assertLess(html_output.index('id="section-core-flow"'), html_output.index('id="section-tests"'))
            self.assertIn('<details id="section-core-flow" data-review-section="core-flow" class="review-section">', html_output)
            self.assertIn('<details id="section-tests" data-review-section="tests" class="review-section">', html_output)
            self.assertNotIn('open=""', html_output)
            self.assertLess(html_output.index("app.py"), html_output.index("tests/test_app.py", html_output.index('id="section-tests"')))
            self.assertNotIn("mechanical", html_output)
            self.assertNotIn("generated", html_output)
            self.assertNotIn("VERIFICATION", html_output)
            self.assertNotIn("확인한 내용", html_output)

    def test_html_can_summarize_or_omit_reviewed_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff = simple_diff("core.py") + simple_diff("docs.md") + simple_diff("lock.json")
            diff_path = root / "change.diff"
            diff_path.write_text(diff, encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
            for chunk in source["chunks"]:
                run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])

            files_by_path = {item["path"]: item for item in source["files"]}
            core_file = files_by_path["core.py"]
            docs_file = files_by_path["docs.md"]
            omitted_file = files_by_path["lock.json"]
            core_evidence = next(
                line["id"]
                for line in source["lines"]
                if line["file_id"] == core_file["id"] and line["kind"] == "addition"
            )
            plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
            plan.update(
                {
                    "title": "선택적 리뷰",
                    "summary": "핵심 코드는 보여주고 보조 파일은 요약하거나 생략한다.",
                    "overview": ["모든 파일을 같은 무게로 표시하지 않는다."],
                    "attention": [],
                    "sections": [
                        {
                            "id": "core",
                            "title": "핵심 동작",
                            "summary": "판단에 필요한 코드만 상세히 본다.",
                            "default_open": True,
                            "evidence": [core_evidence],
                            "files": [
                                reviewed_file(core_file["id"]),
                                reviewed_file(docs_file["id"], "문서 계약만 확인한다.", "summary"),
                            ],
                        }
                    ],
                    "omitted_files": [
                        {"file_id": omitted_file["id"], "reason": "원본 의존성에서 파생된 잠금 결과"}
                    ],
                    "unreviewed_file_ids": [],
                    "verification": [],
                }
            )
            (bundle / "review-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            run("compile", "--bundle", str(bundle), "--format", "both")
            html_output = (bundle / "review.html").read_text(encoding="utf-8")
            review = json.loads((bundle / "review.json").read_text(encoding="utf-8"))

            self.assertIn("core.py", html_output)
            self.assertIn("docs.md", html_output)
            self.assertIn("역할만 보기", html_output)
            self.assertIn('<details class="supporting-files">', html_output)
            self.assertLess(html_output.index("core.py"), html_output.index("docs.md"))
            self.assertNotIn("lock.json", html_output)
            self.assertEqual(review["coverage"]["detailed_files"], [core_file["id"]])
            self.assertEqual(review["coverage"]["summarized_files"], [docs_file["id"]])
            self.assertEqual(review["coverage"]["omitted_files"], [omitted_file["id"]])
            markdown_output = (bundle / "review.md").read_text(encoding="utf-8")
            self.assertNotIn("## 확인한 내용", markdown_output)
            self.assertNotIn("별도로 실행한 테스트나 빌드는 없습니다.", markdown_output)

    def test_combined_diff_is_rejected(self) -> None:
        with self.assertRaises(easy_review.EasyReviewError):
            easy_review.parse_diff("diff --cc app.py\n@@@ -1,1 -1,1 +1,1 @@@\n")

    def test_structured_renderer_rejects_closing_script_in_trusted_assets(self) -> None:
        with self.assertRaises(ValueError):
            easy_review.render_document(
                title="Review",
                main=easy_review.Element("main"),
                assets=easy_review.TrustedAssets(
                    stylesheet="body {}",
                    syntax_script="</script>",
                    behavior_script="",
                ),
            )

    def _minimal_valid_plan(self, bundle: Path) -> dict[str, object]:
        source = json.loads((bundle / "source.json").read_text(encoding="utf-8"))
        for chunk in source["chunks"]:
            run("inspect", "--bundle", str(bundle), "--chunk", chunk["id"])
        file_entry = source["files"][0]
        anchor = next(line["id"] for line in source["lines"] if line["kind"] == "addition")
        plan = json.loads((bundle / "review-plan.json").read_text(encoding="utf-8"))
        plan.update(
            {
                "title": "입력 처리 변경",
                "summary": "점수 계산이 엄격 모드로 바뀝니다.",
                "overview": ["점수 계산과 기록 동작이 바뀝니다."],
                "sections": [
                    {
                        "id": "core",
                        "title": "점수가 계산되는 흐름",
                        "summary": "실행 경로를 읽는다.",
                        "default_open": True,
                        "evidence": [anchor],
                        "files": [reviewed_file(file_entry["id"])],
                    }
                ],
                "unreviewed_file_ids": [],
            }
        )
        return plan

    def test_easy_context_renders_plain_intro_and_chat_dock(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            plan = self._minimal_valid_plan(bundle)
            plan["easy_context"] = {
                "what": "점수 계산이 더 까다로워집니다.",
                "why": "잘못된 입력이 점수로 인정되는 문제가 있었습니다.",
                "points": ["점수는 엄격 모드로 계산합니다."],
                "flow": [
                    {"label": "입력이 들어온다", "note": "사용자 요청"},
                    {"label": "점수를 계산한다"},
                    {"label": "기록을 남긴다", "note": "audit 호출"},
                ],
                "terms": [{"term": "strict", "meaning": "잘못된 입력을 거부하는 모드"}],
                "diagram": {
                    "kind": "sequence",
                    "actors": [{"id": "u", "label": "사용자"}, {"id": "s", "label": "서버"}],
                    "steps": [{"from": "u", "to": "s", "label": "점수 요청"}],
                },
            }
            (bundle / "review-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            run("compile", "--bundle", str(bundle), "--format", "both")
            html_output = (bundle / "review.html").read_text(encoding="utf-8")

            self.assertIn('class="easy-context report-section"', html_output)
            self.assertIn("아주 쉽게 보기", html_output)
            self.assertLess(html_output.index("아주 쉽게 보기"), html_output.index("한눈에 보기"))
            self.assertIn('class="easy-diagram"', html_output)
            self.assertIn("data-diagram=", html_output)
            self.assertNotIn('class="easy-step"', html_output)
            self.assertIn('data-chat-dock=""', html_output)
            self.assertIn("serve --bundle", html_output)
            self.assertIn('data-ask-path="app.py"', html_output)
            markdown_output = (bundle / "review.md").read_text(encoding="utf-8")
            self.assertIn("## 아주 쉽게 보기", markdown_output)
            self.assertIn("사용자 → 서버: 점수 요청", markdown_output)

    def test_invalid_easy_context_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            diff_path = root / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = root / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            plan = self._minimal_valid_plan(bundle)
            plan["easy_context"] = {
                "what": "설명",
                "points": ["a", "b", "c", "d", "e", "f", "g"],
                "flow": [{"note": "label 없음"}],
                "terms": [{"term": "x"}],
                "diagram": {"kind": "sequence", "actors": [{"id": "a", "label": "A"}], "steps": []},
            }
            (bundle / "review-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            completed = run("preview", "--bundle", str(bundle), expected=1)
            self.assertIn("easy_context.points", completed.stdout)
            self.assertIn("easy_context.flow[0]", completed.stdout)
            self.assertIn("easy_context.terms[0]", completed.stdout)
            self.assertIn("easy_context.diagram.actors", completed.stdout)

    def test_chat_server_repo_access_is_confined_and_read_only(self) -> None:
        chat_server_path = SCRIPT.parent / "chat_server.py"
        spec = importlib.util.spec_from_file_location("chat_server", chat_server_path)
        assert spec and spec.loader
        chat_server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(chat_server)

        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory).resolve() / "repo"
            (repo / ".git").mkdir(parents=True)
            (repo / ".git" / "config").write_text("secret\n", encoding="utf-8")
            (repo / "module.py").write_text("first\nsecond\nthird\n", encoding="utf-8")
            (Path(temporary_directory) / "outside.txt").write_text("outside\n", encoding="utf-8")

            with self.assertRaises(chat_server.ChatServerError):
                chat_server.safe_repo_path(repo, "../outside.txt")
            with self.assertRaises(chat_server.ChatServerError):
                chat_server.safe_repo_path(repo, ".git/config")
            self.assertEqual(chat_server.safe_repo_path(repo, "module.py"), repo / "module.py")

            listing = chat_server.tool_list_dir(repo, {})
            self.assertIn("module.py", listing)
            self.assertNotIn(".git", listing)

            body = chat_server.tool_read_file(repo, {"path": "module.py", "start_line": 2, "max_lines": 1})
            self.assertIn("2| second", body)
            self.assertIn("start_line=3", body)

            diff_path = Path(temporary_directory) / "change.diff"
            diff_path.write_text(simple_diff(), encoding="utf-8")
            bundle = Path(temporary_directory) / "bundle"
            run("capture", "--diff-file", str(diff_path), "--output", str(bundle))
            config = chat_server.ChatConfig(bundle, repo)
            listing = chat_server.tool_read_diff(config, {})
            self.assertIn("app.py (modified, +2/-1)", listing)
            diff_body = chat_server.tool_read_diff(config, {"path": "app.py"})
            self.assertIn("+    audit(score)", diff_body)
            with self.assertRaises(chat_server.ChatServerError):
                chat_server.tool_read_diff(config, {"path": "missing.py"})

            png_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
            pdf_data = "data:application/pdf;base64,JVBERi0xLjQK"
            clean = chat_server.validate_attachments(
                [
                    {"kind": "image", "name": "shot.png", "data": png_data},
                    {"kind": "text", "name": "log.txt", "text": "line1"},
                    {"kind": "pdf", "name": "spec.pdf", "data": pdf_data},
                ]
            )
            self.assertEqual([item["kind"] for item in clean], ["image", "text", "pdf"])
            for bad in (
                [{"kind": "image", "name": "x", "data": "data:text/html;base64,AA=="}],
                [{"kind": "exe", "name": "x"}],
                [{"kind": "text", "name": "x", "text": "y"}] * 5,
            ):
                with self.assertRaises(ValueError):
                    chat_server.validate_attachments(bad)

            message = chat_server.to_model_message(
                {"role": "user", "content": "이거 봐줘", "attachments": clean}
            )
            self.assertEqual(message["content"][0]["type"], "text")
            self.assertIn("[첨부 파일: log.txt]", message["content"][0]["text"])
            self.assertEqual(message["content"][1], {"type": "image_url", "image_url": {"url": png_data}})
            self.assertEqual(
                message["content"][2],
                {"type": "file", "file": {"filename": "spec.pdf", "file_data": pdf_data}},
            )
            self.assertTrue(chat_server.history_has_pdf([{"role": "user", "content": "x", "attachments": clean}]))
            self.assertFalse(chat_server.history_has_pdf([{"role": "user", "content": "x"}]))
            plain = chat_server.to_model_message({"role": "user", "content": "그냥 질문"})
            self.assertEqual(plain, {"role": "user", "content": "그냥 질문"})

            stored = chat_server.store_attachments(config, "att-test", clean)
            self.assertEqual(len(stored), 3)
            self.assertTrue(stored[2]["path"].endswith(".pdf"))
            stored_again = chat_server.store_attachments(config, "att-test", clean)
            self.assertNotEqual(stored[0]["path"], stored_again[0]["path"])

            import http.client
            import threading
            from http.server import ThreadingHTTPServer

            bound_handler = type("TestHandler", (chat_server.ChatRequestHandler,), {"config": config})
            server = ThreadingHTTPServer(("127.0.0.1", 0), bound_handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                port = server.server_address[1]

                def request(method: str, path: str, headers: dict[str, str], body: bytes = b"") -> int:
                    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                    connection.request(method, path, body=body, headers=headers)
                    status = connection.getresponse().status
                    connection.close()
                    return status

                self.assertEqual(request("GET", "/api/status", {"Host": "127.0.0.1"}), 200)
                self.assertEqual(request("GET", "/api/status", {"Host": "evil.example.com"}), 403)
                self.assertEqual(
                    request(
                        "POST",
                        "/api/chat",
                        {"Host": "127.0.0.1", "Origin": "https://evil.example.com", "Content-Type": "application/json"},
                        b"{}",
                    ),
                    403,
                )
                self.assertEqual(
                    request(
                        "POST",
                        "/api/chat",
                        {
                            "Host": "127.0.0.1",
                            "Content-Type": "application/json",
                            "Content-Length": str(chat_server.MAX_REQUEST_BYTES + 1),
                        },
                    ),
                    413,
                )
            finally:
                server.shutdown()
                server.server_close()
            for item in stored:
                self.assertTrue(Path(item["path"]).is_file())


if __name__ == "__main__":
    unittest.main()
