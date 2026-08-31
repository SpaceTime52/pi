#!/usr/bin/env python3
"""Capture, inspect, validate, and render read-only diff review bundles."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from html_renderer import Element, TrustedAssets, append_text, child, render_document


SCHEMA_VERSION = 3
DEFAULT_CHUNK_BYTES = 48 * 1024
MAX_DIFF_BYTES = 8 * 1024 * 1024
MAX_CHUNKS = 128
CONTEXT_PREFIX_ROWS = 3
ANCHOR_RE = re.compile(r"^D(\d{6})$")
HUNK_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$")
ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
ATTENTION_VALUES = {"fix", "caution", "confirm"}
FILE_VIEW_VALUES = {"detail", "summary"}
VERIFICATION_VALUES = {"passed", "failed", "not_run", "unknown"}
DIAGRAM_KINDS = {"flow", "sequence", "er"}
FLOW_SHAPES = {"start", "end", "step", "decision"}
ER_KEYS = {"pk", "fk"}
INTERNAL_VERIFICATION_NAME_RE = re.compile(r"(?:easy[\s-]?review|이지\s*리뷰)", re.IGNORECASE)
SOURCE_LINE_KINDS = {"addition", "deletion", "context", "no_newline"}
STRUCTURAL_LINE_KINDS = {"file_header", "old_file", "new_file", "hunk_header"}


class EasyReviewError(RuntimeError):
    pass


def run_command(
    command: list[str],
    *,
    cwd: Path,
    allowed_codes: Iterable[int] = (0,),
) -> bytes:
    completed = subprocess.run(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if completed.returncode not in set(allowed_codes):
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise EasyReviewError(f"command failed ({completed.returncode}): {' '.join(command)}\n{detail}")
    return completed.stdout


def decode_diff(raw: bytes) -> tuple[str, bool]:
    decoded = raw.decode("utf-8", errors="replace")
    return ANSI_RE.sub("", decoded), "\ufffd" in decoded


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EasyReviewError(f"cannot read JSON {path}: {error}") from error


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def write_text_atomic(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            handle.write(value)
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def git_root(repo: Path) -> Path:
    output = run_command(["git", "rev-parse", "--show-toplevel"], cwd=repo)
    return Path(output.decode().strip()).resolve()


def untracked_diff(repo: Path) -> tuple[bytes, list[str]]:
    raw_paths = run_command(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=repo)
    paths = [path.decode("utf-8", errors="replace") for path in raw_paths.split(b"\0") if path]
    parts: list[bytes] = []
    for relative_path in paths:
        absolute_path = repo / relative_path
        if not absolute_path.is_file():
            continue
        part = run_command(
            ["git", "diff", "--no-index", "--no-color", "--no-ext-diff", "--no-textconv", "--", "/dev/null", relative_path],
            cwd=repo,
            allowed_codes=(0, 1),
        )
        if part:
            parts.append(part)
    return b"".join(parts), paths


def capture_input(args: argparse.Namespace, repo: Path) -> tuple[bytes, dict[str, Any]]:
    common = ["--no-color", "--no-ext-diff", "--no-textconv", "--find-renames", "--find-copies"]
    metadata: dict[str, Any] = {"repo_root": str(repo)}

    if args.worktree:
        tracked = run_command(["git", "diff", *common, "HEAD", "--"], cwd=repo)
        untracked, paths = untracked_diff(repo)
        metadata.update({"kind": "worktree", "untracked_files": paths})
        return tracked + untracked, metadata
    if args.unstaged:
        metadata["kind"] = "unstaged"
        return run_command(["git", "diff", *common, "--"], cwd=repo), metadata
    if args.staged:
        metadata["kind"] = "staged"
        return run_command(["git", "diff", *common, "--staged", "--"], cwd=repo), metadata
    if args.revision:
        resolved = run_command(["git", "rev-parse", args.revision], cwd=repo).decode().strip()
        metadata.update({"kind": "revision", "revision": args.revision, "head_sha": resolved})
        return run_command(
            ["git", "show", "--format=fuller", "--no-color", "--no-ext-diff", "--no-textconv", "-m", "--first-parent", args.revision],
            cwd=repo,
        ), metadata
    if args.range_value:
        metadata.update({"kind": "range", "range": args.range_value})
        return run_command(["git", "diff", *common, args.range_value, "--"], cwd=repo), metadata
    if args.pr:
        pr_fields = "number,title,url,baseRefName,baseRefOid,headRefName,headRefOid,state,isDraft,mergeable"
        pr_raw = run_command(["gh", "pr", "view", args.pr, "--json", pr_fields], cwd=repo)
        pr_metadata = json.loads(pr_raw.decode("utf-8"))
        metadata.update({"kind": "github_pr", "pr": pr_metadata})
        return run_command(["gh", "pr", "diff", args.pr, "--color", "never"], cwd=repo), metadata
    if args.diff_file:
        diff_path = Path(args.diff_file).expanduser().resolve()
        metadata.update({"kind": "diff_file", "path": str(diff_path)})
        try:
            return diff_path.read_bytes(), metadata
        except OSError as error:
            raise EasyReviewError(f"cannot read diff file {diff_path}: {error}") from error
    raise EasyReviewError("one capture mode is required")


def strip_git_prefix(path: str) -> str:
    if path == "/dev/null":
        return path
    if path.startswith("a/") or path.startswith("b/"):
        return path[2:]
    return path


def decode_quoted_path(value: str) -> str:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value[1:-1]
    return value


def parse_header_path(text: str) -> str:
    value = text[4:].split("\t", 1)[0]
    return strip_git_prefix(decode_quoted_path(value))


def paths_from_diff_header(text: str) -> tuple[str | None, str | None]:
    payload = text[len("diff --git ") :]
    try:
        fields = shlex.split(payload)
    except ValueError:
        fields = []
    if len(fields) == 2:
        return strip_git_prefix(fields[0]), strip_git_prefix(fields[1])
    return None, None


def split_physical_lines(text: str) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for raw_line in text.splitlines(keepends=True):
        if raw_line.endswith("\r\n"):
            result.append((raw_line[:-2], "\r\n"))
        elif raw_line.endswith("\n") or raw_line.endswith("\r"):
            result.append((raw_line[:-1], raw_line[-1:]))
        else:
            result.append((raw_line, ""))
    return result


def parse_diff(text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if "\ndiff --cc " in "\n" + text or "\n@@@ " in "\n" + text:
        raise EasyReviewError("combined diffs are not supported; use a first-parent or two-ref diff")

    lines: list[dict[str, Any]] = []
    files: list[dict[str, Any]] = []
    current_file: dict[str, Any] | None = None
    current_hunk: dict[str, Any] | None = None
    old_line = new_line = 0
    old_remaining = new_remaining = 0

    def start_file(old_path: str | None, new_path: str | None) -> dict[str, Any]:
        file_entry = {
            "id": f"F{len(files) + 1:03d}",
            "old_path": old_path,
            "new_path": new_path,
            "path": new_path or old_path or f"unknown-{len(files) + 1}",
            "status": "modified",
            "binary": False,
            "line_indices": [],
            "hunks": [],
            "additions": 0,
            "deletions": 0,
        }
        files.append(file_entry)
        return file_entry

    for physical_index, (line_text, eol) in enumerate(split_physical_lines(text)):
        if line_text.startswith("diff --git "):
            current_hunk = None
            old_path, new_path = paths_from_diff_header(line_text)
            current_file = start_file(old_path, new_path)

        if current_file is None and line_text.startswith("--- "):
            current_file = start_file(parse_header_path(line_text), None)

        kind = "preamble" if current_file is None else "metadata"
        line_old: int | None = None
        line_new: int | None = None

        if current_hunk is not None and old_remaining == 0 and new_remaining == 0 and not line_text.startswith("\\ No newline"):
            current_hunk = None

        if current_file is not None:
            if line_text.startswith("diff --git "):
                kind = "file_header"
            elif line_text.startswith("--- ") and current_hunk is None:
                kind = "old_file"
                current_file["old_path"] = parse_header_path(line_text)
                if current_file["new_path"] in (None, "/dev/null"):
                    current_file["path"] = current_file["old_path"]
            elif line_text.startswith("+++ ") and current_hunk is None:
                kind = "new_file"
                current_file["new_path"] = parse_header_path(line_text)
                if current_file["new_path"] != "/dev/null":
                    current_file["path"] = current_file["new_path"]
            elif line_text.startswith("@@ "):
                match = HUNK_RE.match(line_text)
                if not match:
                    raise EasyReviewError(f"unsupported hunk header at physical line {physical_index + 1}: {line_text}")
                old_line = int(match.group(1))
                old_remaining = int(match.group(2) or "1")
                new_line = int(match.group(3))
                new_remaining = int(match.group(4) or "1")
                current_hunk = {
                    "id": f"H{sum(len(file['hunks']) for file in files) + 1:04d}",
                    "header_index": physical_index,
                    "line_indices": [],
                    "heading": match.group(5).strip(),
                }
                current_file["hunks"].append(current_hunk)
                kind = "hunk_header"
            elif current_hunk is not None and line_text.startswith("\\ No newline"):
                kind = "no_newline"
            elif current_hunk is not None:
                marker = line_text[:1]
                if marker == "+":
                    kind = "addition"
                    line_new = new_line
                    new_line += 1
                    new_remaining = max(0, new_remaining - 1)
                    current_file["additions"] += 1
                elif marker == "-":
                    kind = "deletion"
                    line_old = old_line
                    old_line += 1
                    old_remaining = max(0, old_remaining - 1)
                    current_file["deletions"] += 1
                elif marker == " ":
                    kind = "context"
                    line_old = old_line
                    line_new = new_line
                    old_line += 1
                    new_line += 1
                    old_remaining = max(0, old_remaining - 1)
                    new_remaining = max(0, new_remaining - 1)
                else:
                    current_hunk = None
                    kind = "metadata"

            if line_text.startswith("new file mode "):
                current_file["status"] = "added"
            elif line_text.startswith("deleted file mode "):
                current_file["status"] = "deleted"
            elif line_text.startswith("rename from "):
                current_file["status"] = "renamed"
                current_file["old_path"] = decode_quoted_path(line_text[len("rename from ") :])
            elif line_text.startswith("rename to "):
                current_file["status"] = "renamed"
                current_file["new_path"] = decode_quoted_path(line_text[len("rename to ") :])
                current_file["path"] = current_file["new_path"]
            elif line_text.startswith("old mode ") or line_text.startswith("new mode "):
                current_file["mode_changed"] = True
            elif line_text.startswith("Binary files ") or line_text == "GIT binary patch":
                current_file["binary"] = True

        line_entry = {
            "id": f"D{physical_index + 1:06d}",
            "index": physical_index,
            "text": line_text,
            "eol": eol,
            "kind": kind,
            "file_id": current_file["id"] if current_file else None,
            "hunk_id": current_hunk["id"] if current_hunk else None,
            "old_line": line_old,
            "new_line": line_new,
        }
        lines.append(line_entry)
        if current_file is not None:
            current_file["line_indices"].append(physical_index)
        if current_hunk is not None:
            current_hunk["line_indices"].append(physical_index)

    for file_entry in files:
        if file_entry["old_path"] == "/dev/null":
            file_entry["status"] = "added"
        elif file_entry["new_path"] == "/dev/null":
            file_entry["status"] = "deleted"
            file_entry["path"] = file_entry["old_path"]
    if not files:
        raise EasyReviewError("no unified-diff file sections found")
    return lines, files


def normalized_changed_body(line: dict[str, Any]) -> str:
    body = line["text"][1:] if line["text"][:1] in {"+", "-", " "} else line["text"]
    return re.sub(r"\s+", " ", body.strip())


def whole_diff_hints(lines: list[dict[str, Any]], files: list[dict[str, Any]]) -> dict[str, Any]:
    by_index = {line["index"]: line for line in lines}
    duplicate_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    move_runs: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: {"addition": [], "deletion": []})
    generated_candidates: list[dict[str, Any]] = []
    special_changes: list[dict[str, Any]] = []

    for file_entry in files:
        path = file_entry["path"] or ""
        file_lines = [by_index[index] for index in file_entry["line_indices"]]
        marker_anchors = [
            line["id"]
            for line in file_lines
            if re.search(r"(?i)(code generated|do not edit|@generated|generated by)", line["text"])
        ]
        path_candidate = bool(
            re.search(r"(?i)(^|/)(generated|gen)(/|_)|\.generated\.|\.pb\.go$|_pb2\.py$|(^|/)dist/", path)
        )
        if marker_anchors or path_candidate:
            generated_candidates.append(
                {
                    "file_id": file_entry["id"],
                    "path": path,
                    "reasons": (["generated marker"] if marker_anchors else [])
                    + (["generated-looking path"] if path_candidate else []),
                    "evidence": marker_anchors[:6],
                }
            )
        if file_entry["binary"] or file_entry["status"] == "renamed" or file_entry.get("mode_changed"):
            special_changes.append(
                {
                    "file_id": file_entry["id"],
                    "path": path,
                    "binary": file_entry["binary"],
                    "status": file_entry["status"],
                    "mode_changed": bool(file_entry.get("mode_changed")),
                }
            )

        for hunk in file_entry["hunks"]:
            changed = [by_index[index] for index in hunk["line_indices"] if by_index[index]["kind"] in {"addition", "deletion"}]
            if len(changed) >= 2:
                signature_text = "\n".join(f"{line['kind'][0]}:{normalized_changed_body(line)}" for line in changed)
                if len(re.sub(r"\s", "", signature_text)) >= 24:
                    signature = hashlib.sha256(signature_text.encode()).hexdigest()[:16]
                    duplicate_groups[signature].append(
                        {
                            "file_id": file_entry["id"],
                            "hunk_id": hunk["id"],
                            "anchors": [line["id"] for line in changed[:8]],
                            "changed_rows": len(changed),
                        }
                    )

            run: list[dict[str, Any]] = []
            run_kind: str | None = None
            for index in hunk["line_indices"] + [-1]:
                line = by_index.get(index)
                kind = line["kind"] if line else None
                if kind in {"addition", "deletion"} and (run_kind is None or kind == run_kind):
                    run.append(line)
                    run_kind = kind
                    continue
                if run:
                    normalized = "\n".join(normalized_changed_body(item) for item in run)
                    substantive_rows = sum(bool(re.search(r"[A-Za-z0-9_]", row)) for row in normalized.splitlines())
                    if substantive_rows >= 3 and len(re.sub(r"\s", "", normalized)) >= 48:
                        fingerprint = hashlib.sha256(normalized.encode()).hexdigest()
                        move_runs[fingerprint][run_kind].append(
                            {
                                "file_id": file_entry["id"],
                                "hunk_id": hunk["id"],
                                "start": run[0]["id"],
                                "end": run[-1]["id"],
                            }
                        )
                    run = []
                    run_kind = None
                if kind in {"addition", "deletion"}:
                    run = [line]
                    run_kind = kind

    duplicates = [
        {"signature": signature, "occurrences": occurrences}
        for signature, occurrences in duplicate_groups.items()
        if len(occurrences) > 1
    ]
    moves = []
    for fingerprint, sides in move_runs.items():
        if len(sides["deletion"]) == 1 and len(sides["addition"]) == 1:
            deletion = sides["deletion"][0]
            addition = sides["addition"][0]
            if deletion["hunk_id"] != addition["hunk_id"]:
                moves.append({"signature": fingerprint[:16], "from": deletion, "to": addition})
    return {
        "duplicate_hunks": duplicates,
        "exact_moves": moves,
        "generated_candidates": generated_candidates,
        "special_changes": special_changes,
    }


def line_size(line: dict[str, Any]) -> int:
    return len(line["text"].encode("utf-8")) + len(line["eol"].encode("utf-8")) + 18


def build_chunks(lines: list[dict[str, Any]], files: list[dict[str, Any]], target_bytes: int) -> list[dict[str, Any]]:
    if target_bytes < 4096:
        raise EasyReviewError("chunk size must be at least 4096 bytes")
    boundaries = {0, len(lines)}
    for line in lines:
        if line["kind"] in {"file_header", "hunk_header"}:
            boundaries.add(line["index"])
    sorted_boundaries = sorted(boundaries)
    file_map = {file_entry["id"]: file_entry for file_entry in files}
    hunk_headers: dict[str, int] = {}
    for file_entry in files:
        for hunk in file_entry["hunks"]:
            hunk_headers[hunk["id"]] = hunk["header_index"]

    chunks: list[dict[str, Any]] = []
    start = 0
    while start < len(lines):
        size = 0
        tentative_end = start
        while tentative_end < len(lines):
            next_size = line_size(lines[tentative_end])
            if tentative_end > start and size + next_size > target_bytes:
                break
            size += next_size
            tentative_end += 1
        if tentative_end == start:
            tentative_end = start + 1
        if tentative_end < len(lines):
            preferred = [boundary for boundary in sorted_boundaries if start < boundary <= tentative_end]
            if preferred:
                tentative_end = preferred[-1]
        while tentative_end < len(lines) and lines[tentative_end]["kind"] == "no_newline":
            tentative_end += 1

        range_indices = list(range(start, tentative_end))
        prefix_indices: list[int] = []
        first = lines[start]
        if start > 0 and first["file_id"]:
            file_entry = file_map[first["file_id"]]
            for index in file_entry["line_indices"]:
                if index >= start or lines[index]["kind"] == "hunk_header":
                    break
                if lines[index]["kind"] in {"file_header", "metadata", "old_file", "new_file"}:
                    prefix_indices.append(index)
            if first["hunk_id"]:
                header_index = hunk_headers[first["hunk_id"]]
                if header_index < start:
                    prefix_indices.append(header_index)
                preceding_source = [
                    index
                    for index in file_entry["line_indices"]
                    if header_index < index < start
                    and lines[index]["hunk_id"] == first["hunk_id"]
                    and lines[index]["kind"] in SOURCE_LINE_KINDS
                ]
                prefix_indices.extend(preceding_source[-CONTEXT_PREFIX_ROWS:])
        prefix_indices = sorted(set(prefix_indices) - set(range_indices))
        file_ids = sorted({lines[index]["file_id"] for index in range_indices if lines[index]["file_id"]})
        changed_file_ids = sorted(
            {
                lines[index]["file_id"]
                for index in range_indices
                if lines[index]["file_id"] and lines[index]["kind"] in {"addition", "deletion"}
            }
        )
        hunk_ids = sorted({lines[index]["hunk_id"] for index in range_indices if lines[index]["hunk_id"]})
        chunks.append(
            {
                "id": f"C{len(chunks) + 1:03d}",
                "start": lines[start]["id"],
                "end": lines[tentative_end - 1]["id"],
                "start_index": start,
                "end_index": tentative_end - 1,
                "prefix_indices": prefix_indices,
                "file_ids": file_ids,
                "changed_file_ids": changed_file_ids,
                "hunk_ids": hunk_ids,
                "changed_rows": sum(lines[index]["kind"] in {"addition", "deletion"} for index in range_indices),
                "bytes": sum(line_size(lines[index]) for index in range_indices),
                "continuation": bool(prefix_indices),
            }
        )
        if len(chunks) > MAX_CHUNKS:
            raise EasyReviewError(f"diff needs more than {MAX_CHUNKS} inspection chunks; review a narrower range")
        start = tentative_end
    return chunks


def default_output_dir(repo: Path, source_hash: str) -> Path:
    try:
        git_path_raw = run_command(["git", "rev-parse", "--git-path", "codex/reviews"], cwd=repo).decode().strip()
        git_path = Path(git_path_raw)
        if not git_path.is_absolute():
            git_path = repo / git_path
    except EasyReviewError:
        git_path = Path(tempfile.gettempdir()) / "easy-review"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return (git_path / f"{timestamp}-{source_hash[:8]}").resolve()


def plan_template(source: dict[str, Any]) -> dict[str, Any]:
    title = ""
    if source["capture"].get("kind") == "github_pr":
        title = source["capture"].get("pr", {}).get("title", "")
    return {
        "schema_version": SCHEMA_VERSION,
        "source_sha256": source["source_sha256"],
        "title": title,
        "summary": "",
        "easy_context": {"what": "", "why": "", "points": [], "flow": [], "terms": []},
        "overview": [],
        "attention": [],
        "sections": [],
        "omitted_files": [],
        "unreviewed_file_ids": [file_entry["id"] for file_entry in source["files"]],
        "verification": [],
    }


def command_capture(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    if not args.diff_file:
        repo = git_root(repo)
    raw, capture_metadata = capture_input(args, repo)
    if not raw.strip():
        raise EasyReviewError("captured diff is empty")
    if len(raw) > MAX_DIFF_BYTES:
        raise EasyReviewError(
            f"diff is {len(raw) / (1024 * 1024):.1f} MiB, above the {MAX_DIFF_BYTES // (1024 * 1024)} MiB limit; review narrower file or commit groups"
        )
    text, encoding_loss = decode_diff(raw)
    normalized_raw = text.encode("utf-8")
    source_hash = sha256_bytes(normalized_raw)
    lines, files = parse_diff(text)
    chunks = build_chunks(lines, files, args.chunk_bytes)
    hints = whole_diff_hints(lines, files)
    source = {
        "schema_version": SCHEMA_VERSION,
        "source_sha256": source_hash,
        "capture": capture_metadata,
        "encoding_loss": encoding_loss,
        "stats": {
            "files": len(files),
            "hunks": sum(len(file_entry["hunks"]) for file_entry in files),
            "additions": sum(file_entry["additions"] for file_entry in files),
            "deletions": sum(file_entry["deletions"] for file_entry in files),
            "changed_rows": sum(file_entry["additions"] + file_entry["deletions"] for file_entry in files),
            "physical_lines": len(lines),
            "bytes": len(normalized_raw),
            "chunks": len(chunks),
        },
        "lines": lines,
        "files": files,
        "chunks": chunks,
        "hints": hints,
    }
    output_dir = Path(args.output).expanduser().resolve() if args.output else default_output_dir(repo, source_hash)
    try:
        output_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError as error:
        raise EasyReviewError(f"output directory already exists: {output_dir}") from error
    write_text_atomic(output_dir / "source.diff", text)
    write_json_atomic(output_dir / "source.json", source)
    write_json_atomic(
        output_dir / "inspection.json",
        {"schema_version": SCHEMA_VERSION, "source_sha256": source_hash, "inspected_chunks": []},
    )
    write_json_atomic(output_dir / "review-plan.json", plan_template(source))
    print(output_dir)
    return 0


def load_bundle(bundle: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    source = read_json(bundle / "source.json")
    plan = read_json(bundle / "review-plan.json")
    inspection = read_json(bundle / "inspection.json")
    diff_raw = (bundle / "source.diff").read_bytes()
    if sha256_bytes(diff_raw) != source.get("source_sha256"):
        raise EasyReviewError("source.diff no longer matches source.json")
    return source, plan, inspection


def format_line(line: dict[str, Any], *, prefix: bool = False) -> str:
    old_value = "" if line["old_line"] is None else str(line["old_line"])
    new_value = "" if line["new_line"] is None else str(line["new_line"])
    context = "*" if prefix else " "
    return f"{context}{line['id']}|{old_value:>6}|{new_value:>6}|{line['text']}"


def summary_text(source: dict[str, Any], inspection: dict[str, Any]) -> str:
    stats = source["stats"]
    inspected = set(inspection.get("inspected_chunks", []))
    output = [
        f"source: {source['capture'].get('kind')} sha256={source['source_sha256'][:12]}",
        f"size: {stats['files']} files, {stats['hunks']} hunks, {stats['changed_rows']} changed rows (+{stats['additions']}/-{stats['deletions']}), {stats['chunks']} chunks",
        f"inspection: {len(inspected)}/{stats['chunks']} chunks",
        "",
        "files:",
    ]
    for file_entry in source["files"]:
        flags = []
        if file_entry["binary"]:
            flags.append("binary")
        if file_entry.get("mode_changed"):
            flags.append("mode")
        flag_text = f" [{' '.join(flags)}]" if flags else ""
        output.append(
            f"  {file_entry['id']} {file_entry['status']} +{file_entry['additions']}/-{file_entry['deletions']} {file_entry['path']}{flag_text}"
        )
    output.extend(["", "chunks:"])
    for chunk in source["chunks"]:
        mark = "inspected" if chunk["id"] in inspected else "pending"
        output.append(
            f"  {chunk['id']} {chunk['start']}..{chunk['end']} {chunk['bytes']}B {chunk['changed_rows']} changed [{mark}] files={','.join(chunk['file_ids']) or '-'}"
        )
    hints = source["hints"]
    output.extend(
        [
            "",
            "whole-diff hints (candidates, not conclusions):",
            f"  duplicate hunk groups: {len(hints['duplicate_hunks'])}",
            f"  exact move candidates: {len(hints['exact_moves'])}",
            f"  generated-file candidates: {len(hints['generated_candidates'])}",
            f"  binary/rename/mode changes: {len(hints['special_changes'])}",
        ]
    )
    if hints["duplicate_hunks"]:
        for group in hints["duplicate_hunks"][:12]:
            refs = ", ".join(f"{item['file_id']}:{item['hunk_id']}" for item in group["occurrences"])
            output.append(f"    duplicate {group['signature']}: {refs}")
    if hints["exact_moves"]:
        for move in hints["exact_moves"][:12]:
            output.append(f"    move {move['from']['start']}..{move['from']['end']} -> {move['to']['start']}..{move['to']['end']}")
    if hints["generated_candidates"]:
        for candidate in hints["generated_candidates"][:20]:
            output.append(f"    generated? {candidate['file_id']} {candidate['path']}: {', '.join(candidate['reasons'])}")
    return "\n".join(output) + "\n"


def command_inspect(args: argparse.Namespace) -> int:
    bundle = Path(args.bundle).expanduser().resolve()
    source, _, inspection = load_bundle(bundle)
    if not args.chunk:
        print(summary_text(source, inspection), end="")
        return 0
    chunk = next((item for item in source["chunks"] if item["id"] == args.chunk), None)
    if chunk is None:
        raise EasyReviewError(f"unknown chunk: {args.chunk}")
    print(
        f"# {chunk['id']} {chunk['start']}..{chunk['end']} files={','.join(chunk['file_ids']) or '-'} changed={chunk['changed_rows']} continuation={str(chunk['continuation']).lower()}"
    )
    for index in chunk["prefix_indices"]:
        print(format_line(source["lines"][index], prefix=True))
    for index in range(chunk["start_index"], chunk["end_index"] + 1):
        print(format_line(source["lines"][index]))
    inspected = set(inspection.get("inspected_chunks", []))
    inspected.add(chunk["id"])
    inspection["inspected_chunks"] = sorted(inspected)
    write_json_atomic(bundle / "inspection.json", inspection)
    return 0


def anchor_index(anchor: str, line_count: int) -> int | None:
    match = ANCHOR_RE.match(anchor) if isinstance(anchor, str) else None
    if not match:
        return None
    index = int(match.group(1)) - 1
    return index if 0 <= index < line_count else None


def validate_plan(
    source: dict[str, Any], plan: dict[str, Any], inspection: dict[str, Any]
) -> tuple[list[str], list[str], dict[str, Any]]:
    errors: list[str] = []
    warnings: list[str] = []
    lines = source["lines"]
    file_map = {file_entry["id"]: file_entry for file_entry in source["files"]}
    chunk_map = {chunk["id"]: chunk for chunk in source["chunks"]}
    inspected = set(inspection.get("inspected_chunks", []))
    chunks_by_line: dict[int, str] = {}
    for chunk in source["chunks"]:
        for line_index in range(chunk["start_index"], chunk["end_index"] + 1):
            chunks_by_line[line_index] = chunk["id"]

    def has_text(value: Any) -> bool:
        return isinstance(value, str) and bool(value.strip())

    def check_readability(value: Any, label: str) -> None:
        if not isinstance(value, str):
            return
        for sentence in re.split(r"(?<=[.!?])\s+", value.strip()):
            if len(sentence) > 90:
                warnings.append(f"{label} has a sentence over 90 characters; split it into shorter sentences")
                return

    if plan.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    if plan.get("source_sha256") != source.get("source_sha256"):
        errors.append("source_sha256 is stale or incorrect")
    if not has_text(plan.get("title")):
        errors.append("title is required")
    if not has_text(plan.get("summary")):
        errors.append("summary is required")
    check_readability(plan.get("summary"), "summary")

    def validate_evidence(value: Any, location: str, *, required: bool = True) -> list[int]:
        if not isinstance(value, list):
            errors.append(f"{location}.evidence must be an array")
            return []
        if required and not value:
            errors.append(f"{location}.evidence must not be empty")
        indices = []
        for evidence_index, anchor in enumerate(value):
            index = anchor_index(anchor, len(lines))
            if index is None:
                errors.append(f"{location}.evidence[{evidence_index}] is not a source anchor: {anchor!r}")
            else:
                indices.append(index)
                chunk_id = chunks_by_line.get(index)
                if chunk_id not in inspected:
                    errors.append(f"{location}.evidence[{evidence_index}] belongs to uninspected chunk {chunk_id}")
        return indices

    easy_context = plan.get("easy_context")
    if easy_context is None:
        warnings.append("easy_context is missing; the plain-language intro will be omitted")
    elif not isinstance(easy_context, dict):
        errors.append("easy_context must be an object")
    else:
        if not has_text(easy_context.get("what")):
            warnings.append("easy_context.what is empty; the plain-language intro will be omitted")
        if easy_context.get("why") not in (None, "") and not has_text(easy_context["why"]):
            errors.append("easy_context.why must be text when present")
        points = easy_context.get("points", [])
        if not isinstance(points, list) or len(points) > 6:
            errors.append("easy_context.points must be an array of at most 6 items")
        else:
            for index, item in enumerate(points):
                if not has_text(item):
                    errors.append(f"easy_context.points[{index}] must be text")
        flow = easy_context.get("flow", [])
        if not isinstance(flow, list) or len(flow) > 12:
            errors.append("easy_context.flow must be an array of at most 12 steps")
        else:
            for index, step in enumerate(flow):
                if not isinstance(step, dict) or not has_text(step.get("label")):
                    errors.append(f"easy_context.flow[{index}] requires a text label")
                elif step.get("note") is not None and not has_text(step["note"]):
                    errors.append(f"easy_context.flow[{index}].note must be text when present")
        diagram = easy_context.get("diagram")
        if diagram is not None:
            validate_easy_diagram(diagram, errors)
        terms = easy_context.get("terms", [])
        if not isinstance(terms, list) or len(terms) > 12:
            errors.append("easy_context.terms must be an array of at most 12 items")
        else:
            for index, term in enumerate(terms):
                if not isinstance(term, dict) or not has_text(term.get("term")) or not has_text(term.get("meaning")):
                    errors.append(f"easy_context.terms[{index}] requires term and meaning")

    overview = plan.get("overview")
    if not isinstance(overview, list):
        errors.append("overview must be an array")
        overview = []
    if not 1 <= len(overview) <= 5:
        errors.append("overview must contain 1 to 5 reader-facing points")
    for index, item in enumerate(overview):
        if not has_text(item):
            errors.append(f"overview[{index}] must be text")
        else:
            check_readability(item, f"overview[{index}]")

    sections = plan.get("sections")
    if not isinstance(sections, list):
        errors.append("sections must be an array")
        sections = []
    if source["stats"]["changed_rows"] > 0 and not sections:
        errors.append("at least one reading section is required for a text diff")

    seen_section_ids: set[str] = set()
    reviewed_file_ids: set[str] = set()
    file_view_by_id: dict[str, str] = {}
    for section_index, section in enumerate(sections):
        location = f"sections[{section_index}]"
        if not isinstance(section, dict):
            errors.append(f"{location} must be an object")
            continue
        section_id = section.get("id")
        if not isinstance(section_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", section_id):
            errors.append(f"{location}.id must use lowercase letters, digits, and hyphens")
        elif section_id in seen_section_ids:
            errors.append(f"duplicate section id: {section_id}")
        else:
            seen_section_ids.add(section_id)
        if not has_text(section.get("title")) or not has_text(section.get("summary")):
            errors.append(f"{location} requires title and summary")
        check_readability(section.get("summary"), f"{location}.summary")
        if not isinstance(section.get("default_open"), bool):
            errors.append(f"{location}.default_open must be a boolean")

        section_evidence = validate_evidence(section.get("evidence"), location)
        section_files = section.get("files")
        if not isinstance(section_files, list) or not section_files:
            errors.append(f"{location}.files must be a non-empty array")
            section_files = []
        section_file_ids: set[str] = set()
        detailed_section_file_ids: set[str] = set()

        for file_index, file_plan in enumerate(section_files):
            file_location = f"{location}.files[{file_index}]"
            if not isinstance(file_plan, dict):
                errors.append(f"{file_location} must be an object")
                continue
            file_id = file_plan.get("file_id")
            if file_id not in file_map:
                errors.append(f"{file_location}.file_id is unknown: {file_id!r}")
                continue
            if file_id in reviewed_file_ids:
                errors.append(f"file {file_id} appears in more than one reading section")
                continue
            reviewed_file_ids.add(file_id)
            section_file_ids.add(file_id)
            view = file_plan.get("view")
            if view not in FILE_VIEW_VALUES:
                errors.append(f"{file_location}.view must be detail or summary")
            else:
                file_view_by_id[file_id] = view
                if view == "detail":
                    detailed_section_file_ids.add(file_id)
            if not has_text(file_plan.get("note")):
                errors.append(f"{file_location}.note is required")
            required_file_chunks = {chunk["id"] for chunk in source["chunks"] if file_id in chunk["file_ids"]}
            missing_chunks = sorted(required_file_chunks - inspected)
            if missing_chunks:
                errors.append(f"{file_location} was not fully inspected: {', '.join(missing_chunks)}")

            ranges_by_kind: dict[str, list[tuple[int, int]]] = {"focus": [], "collapse": []}
            for range_kind in ("focus", "collapse"):
                ranges = file_plan.get(range_kind)
                if not isinstance(ranges, list):
                    errors.append(f"{file_location}.{range_kind} must be an array")
                    continue
                if view == "summary" and ranges:
                    errors.append(f"{file_location}.{range_kind} must be empty when view is summary")
                for range_index, source_range in enumerate(ranges):
                    range_location = f"{file_location}.{range_kind}[{range_index}]"
                    if not isinstance(source_range, dict):
                        errors.append(f"{range_location} must be an object")
                        continue
                    start = anchor_index(source_range.get("start"), len(lines))
                    end = anchor_index(source_range.get("end"), len(lines))
                    if start is None or end is None or start > end:
                        errors.append(f"{range_location} has an invalid start/end")
                        continue
                    if any(lines[line_index]["file_id"] != file_id for line_index in range(start, end + 1)):
                        errors.append(f"{range_location} crosses a file boundary")
                        continue
                    if not has_text(source_range.get("reason")):
                        errors.append(f"{range_location}.reason is required")
                    if range_kind == "collapse":
                        if start == end:
                            errors.append(f"{range_location} must contain at least two lines")
                        hunk_ids = {lines[line_index]["hunk_id"] for line_index in range(start, end + 1)}
                        if None in hunk_ids or len(hunk_ids) != 1:
                            errors.append(f"{range_location} must stay inside one diff hunk")
                        if any(lines[line_index]["kind"] not in SOURCE_LINE_KINDS for line_index in range(start, end + 1)):
                            errors.append(f"{range_location} cannot hide file or hunk metadata")
                    ranges_by_kind[range_kind].append((start, end))

            all_ranges = [(kind, start, end) for kind, values in ranges_by_kind.items() for start, end in values]
            all_ranges.sort(key=lambda item: (item[1], item[2]))
            for previous, current in zip(all_ranges, all_ranges[1:]):
                if current[1] <= previous[2]:
                    errors.append(
                        f"{file_location} has overlapping {previous[0]} {lines[previous[1]]['id']}..{lines[previous[2]]['id']} and {current[0]} {lines[current[1]]['id']}..{lines[current[2]]['id']}"
                    )

            if file_map[file_id]["binary"]:
                warnings.append(f"{file_id} is binary; describe only the metadata that was actually inspected")

        for evidence_index in section_evidence:
            evidence_file_id = lines[evidence_index].get("file_id")
            if evidence_file_id not in section_file_ids:
                errors.append(f"{location}.evidence must point to a file inside the same section")
            elif evidence_file_id not in detailed_section_file_ids:
                errors.append(f"{location}.evidence must point to a detail file so its target is visible")

    omitted_files = plan.get("omitted_files")
    if not isinstance(omitted_files, list):
        errors.append("omitted_files must be an array")
        omitted_files = []
    omitted_file_ids: set[str] = set()
    for index, item in enumerate(omitted_files):
        location = f"omitted_files[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{location} must be an object")
            continue
        file_id = item.get("file_id")
        if file_id not in file_map:
            errors.append(f"{location}.file_id is unknown: {file_id!r}")
            continue
        if file_id in reviewed_file_ids:
            errors.append(f"file {file_id} appears more than once across sections and omitted_files")
            continue
        if file_id in omitted_file_ids:
            errors.append(f"duplicate omitted file: {file_id}")
            continue
        omitted_file_ids.add(file_id)
        reviewed_file_ids.add(file_id)
        file_view_by_id[file_id] = "omit"
        if not has_text(item.get("reason")):
            errors.append(f"{location}.reason is required")
        required_file_chunks = {chunk["id"] for chunk in source["chunks"] if file_id in chunk["file_ids"]}
        missing_chunks = sorted(required_file_chunks - inspected)
        if missing_chunks:
            errors.append(f"{location} was not fully inspected: {', '.join(missing_chunks)}")

    unreviewed_file_ids = plan.get("unreviewed_file_ids")
    if not isinstance(unreviewed_file_ids, list):
        errors.append("unreviewed_file_ids must be an array")
        unreviewed_file_ids = []
    unreviewed_set: set[str] = set()
    for index, file_id in enumerate(unreviewed_file_ids):
        if file_id not in file_map:
            errors.append(f"unreviewed_file_ids[{index}] is unknown: {file_id!r}")
        elif file_id in unreviewed_set:
            errors.append(f"duplicate unreviewed file: {file_id}")
        else:
            unreviewed_set.add(file_id)
    overlap = sorted(reviewed_file_ids & unreviewed_set)
    if overlap:
        errors.append(f"files cannot be both reviewed and unreviewed: {', '.join(overlap)}")
    missing_files = sorted(set(file_map) - reviewed_file_ids - unreviewed_set)
    if missing_files:
        errors.append(f"files missing from reading sections and unreviewed_file_ids: {', '.join(missing_files)}")

    attention = plan.get("attention")
    if not isinstance(attention, list):
        errors.append("attention must be an array")
        attention = []
    for index, item in enumerate(attention):
        location = f"attention[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{location} must be an object")
            continue
        if item.get("type") not in ATTENTION_VALUES:
            errors.append(f"{location}.type must be fix, caution, or confirm")
        if not has_text(item.get("title")) or not has_text(item.get("body")):
            errors.append(f"{location} requires title and body")
        check_readability(item.get("body"), f"{location}.body")
        evidence_indices = validate_evidence(item.get("evidence"), location)
        for evidence_index in evidence_indices:
            evidence_file_id = lines[evidence_index].get("file_id")
            if file_view_by_id.get(evidence_file_id) != "detail":
                errors.append(f"{location}.evidence must point to a detail file so its target is visible")

    verification = plan.get("verification")
    if not isinstance(verification, list):
        errors.append("verification must be an array")
        verification = []
    for index, item in enumerate(verification):
        location = f"verification[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{location} must be an object")
            continue
        verification_name = item.get("name")
        if not has_text(verification_name):
            errors.append(f"{location}.name is required")
        elif INTERNAL_VERIFICATION_NAME_RE.search(verification_name):
            errors.append(f"{location}.name must describe target verification, not Easy Review internal validation")
        if item.get("status") not in VERIFICATION_VALUES:
            errors.append(f"{location}.status is invalid")
        if not isinstance(item.get("evidence", ""), str):
            errors.append(f"{location}.evidence must be a string")

    required_chunks = set(chunk_map)
    coverage = {
        "status": "complete" if len(reviewed_file_ids) == len(file_map) and required_chunks <= inspected else "partial",
        "reviewed_files": len(reviewed_file_ids),
        "total_files": len(file_map),
        "inspected_chunks": len(required_chunks & inspected),
        "total_chunks": len(required_chunks),
        "unreviewed_files": sorted(unreviewed_set),
        "detailed_files": sorted(file_id for file_id, view in file_view_by_id.items() if view == "detail"),
        "summarized_files": sorted(file_id for file_id, view in file_view_by_id.items() if view == "summary"),
        "omitted_files": sorted(omitted_file_ids),
    }
    if source.get("encoding_loss"):
        warnings.append("the captured diff contained non-UTF-8 bytes replaced during decoding")
    return errors, warnings, coverage


def command_preview(args: argparse.Namespace) -> int:
    bundle = Path(args.bundle).expanduser().resolve()
    source, plan, inspection = load_bundle(bundle)
    errors, warnings, coverage = validate_plan(source, plan, inspection)
    if errors:
        print("INVALID")
        for error in errors:
            print(f"- error: {error}")
    else:
        print("VALID")
    for warning in warnings:
        print(f"- warning: {warning}")
    print(
        f"coverage: {coverage['status']} files={coverage['reviewed_files']}/{coverage['total_files']} chunks={coverage['inspected_chunks']}/{coverage['total_chunks']}"
    )
    return 1 if errors else 0


def anchor_label(
    source: dict[str, Any],
    files_by_id: dict[str, dict[str, Any]],
    anchor: str,
    *,
    compact: bool = False,
) -> str:
    index = anchor_index(anchor, len(source["lines"]))
    if index is None:
        return anchor
    line = source["lines"][index]
    file_entry = files_by_id.get(line.get("file_id"), {})
    path = file_entry.get("path", line.get("file_id") or "diff")
    if line.get("new_line") is not None:
        position = f"+{line['new_line']}"
    elif line.get("old_line") is not None:
        position = f"-{line['old_line']}"
    else:
        position = "변경 위치"
    display_path = Path(path).name if compact else path
    return f"{display_path} {position}"


def evidence_text(
    source: dict[str, Any], files_by_id: dict[str, dict[str, Any]], evidence: list[str]
) -> str:
    return ", ".join(f"`{anchor_label(source, files_by_id, anchor)}`" for anchor in evidence)


def validate_easy_diagram(diagram: Any, errors: list[str]) -> None:
    location = "easy_context.diagram"

    def has_text(value: Any) -> bool:
        return isinstance(value, str) and bool(value.strip())

    if not isinstance(diagram, dict):
        errors.append(f"{location} must be an object")
        return
    kind = diagram.get("kind")
    if kind not in DIAGRAM_KINDS:
        errors.append(f"{location}.kind must be one of flow, sequence, er")
        return
    if kind == "flow":
        nodes = diagram.get("nodes")
        if not isinstance(nodes, list) or not 2 <= len(nodes) <= 16:
            errors.append(f"{location}.nodes must contain 2 to 16 nodes")
            return
        node_ids: set[str] = set()
        for index, node in enumerate(nodes):
            if not isinstance(node, dict) or not has_text(node.get("id")) or not has_text(node.get("label")):
                errors.append(f"{location}.nodes[{index}] requires id and label")
                continue
            if node["id"] in node_ids:
                errors.append(f"{location}.nodes[{index}].id is duplicated: {node['id']}")
            node_ids.add(node["id"])
            if node.get("shape") is not None and node["shape"] not in FLOW_SHAPES:
                errors.append(f"{location}.nodes[{index}].shape must be start, end, step, or decision")
        edges = diagram.get("edges")
        if not isinstance(edges, list) or not 1 <= len(edges) <= 24:
            errors.append(f"{location}.edges must contain 1 to 24 edges")
            return
        for index, edge in enumerate(edges):
            if not isinstance(edge, dict) or edge.get("from") not in node_ids or edge.get("to") not in node_ids:
                errors.append(f"{location}.edges[{index}] must connect known node ids")
    elif kind == "sequence":
        actors = diagram.get("actors")
        if not isinstance(actors, list) or not 2 <= len(actors) <= 6:
            errors.append(f"{location}.actors must contain 2 to 6 actors")
            return
        actor_ids: set[str] = set()
        for index, actor in enumerate(actors):
            if not isinstance(actor, dict) or not has_text(actor.get("id")) or not has_text(actor.get("label")):
                errors.append(f"{location}.actors[{index}] requires id and label")
                continue
            if actor["id"] in actor_ids:
                errors.append(f"{location}.actors[{index}].id is duplicated: {actor['id']}")
            actor_ids.add(actor["id"])
        steps = diagram.get("steps")
        if not isinstance(steps, list) or not 1 <= len(steps) <= 16:
            errors.append(f"{location}.steps must contain 1 to 16 steps")
            return
        for index, step in enumerate(steps):
            if (
                not isinstance(step, dict)
                or step.get("from") not in actor_ids
                or step.get("to") not in actor_ids
                or not has_text(step.get("label"))
            ):
                errors.append(f"{location}.steps[{index}] requires known from/to actors and a label")
    elif kind == "er":
        entities = diagram.get("entities")
        if not isinstance(entities, list) or not 1 <= len(entities) <= 8:
            errors.append(f"{location}.entities must contain 1 to 8 entities")
            return
        entity_names: set[str] = set()
        for index, entity in enumerate(entities):
            if not isinstance(entity, dict) or not has_text(entity.get("name")):
                errors.append(f"{location}.entities[{index}] requires name")
                continue
            entity_names.add(entity["name"])
            fields = entity.get("fields", [])
            if not isinstance(fields, list) or len(fields) > 12:
                errors.append(f"{location}.entities[{index}].fields must be an array of at most 12 items")
                continue
            for field_index, field in enumerate(fields):
                if not isinstance(field, dict) or not has_text(field.get("name")):
                    errors.append(f"{location}.entities[{index}].fields[{field_index}] requires name")
                elif field.get("key") is not None and field["key"] not in ER_KEYS:
                    errors.append(f"{location}.entities[{index}].fields[{field_index}].key must be pk or fk")
        relations = diagram.get("relations", [])
        if not isinstance(relations, list) or len(relations) > 12:
            errors.append(f"{location}.relations must be an array of at most 12 items")
            return
        for index, relation in enumerate(relations):
            if (
                not isinstance(relation, dict)
                or relation.get("from") not in entity_names
                or relation.get("to") not in entity_names
            ):
                errors.append(f"{location}.relations[{index}] must connect known entity names")


def active_easy_context(plan: dict[str, Any]) -> dict[str, Any] | None:
    easy_context = plan.get("easy_context")
    if isinstance(easy_context, dict) and isinstance(easy_context.get("what"), str) and easy_context["what"].strip():
        return easy_context
    return None


def render_markdown(review: dict[str, Any]) -> str:
    plan = review["plan"]
    coverage = review["coverage"]
    source = review["source"]
    files_by_id = {file_entry["id"]: file_entry for file_entry in review["files"]}
    output = [f"# {plan['title']}", "", plan["summary"], ""]
    easy_context = active_easy_context(plan)
    if easy_context:
        output.extend(["## 아주 쉽게 보기", "", f"**무엇이 달라지나** — {easy_context['what']}"])
        if isinstance(easy_context.get("why"), str) and easy_context["why"].strip():
            output.append(f"**왜 하나** — {easy_context['why']}")
        for item in easy_context.get("points", []):
            output.append(f"- {item}")
        diagram = easy_context.get("diagram")
        if isinstance(diagram, dict) and diagram.get("kind") == "sequence":
            actor_labels = {actor["id"]: actor["label"] for actor in diagram.get("actors", [])}
            output.append("")
            for step in diagram.get("steps", []):
                output.append(
                    f"- {actor_labels.get(step['from'], step['from'])} → {actor_labels.get(step['to'], step['to'])}: {step['label']}"
                )
        elif isinstance(diagram, dict) and diagram.get("kind") == "flow":
            node_labels = {node["id"]: node["label"] for node in diagram.get("nodes", [])}
            output.append("")
            for edge in diagram.get("edges", []):
                arrow = f" ({edge['label']})" if edge.get("label") else ""
                output.append(f"- {node_labels.get(edge['from'])} → {node_labels.get(edge['to'])}{arrow}")
        elif isinstance(diagram, dict) and diagram.get("kind") == "er":
            output.append("")
            for entity in diagram.get("entities", []):
                fields = ", ".join(field["name"] for field in entity.get("fields", []))
                output.append(f"- `{entity['name']}`: {fields}")
        else:
            flow = easy_context.get("flow", [])
            if flow:
                output.extend(["", "흐름: " + " → ".join(step["label"] for step in flow)])
        for term in easy_context.get("terms", []):
            output.append(f"- `{term['term']}`: {term['meaning']}")
        output.append("")
    output.extend(["## 한눈에 보기", ""])
    for item in plan["overview"]:
        output.append(f"- {item}")

    output.extend(["", "## 읽는 순서", ""])
    for index, section in enumerate(plan["sections"], start=1):
        output.append(f"{index}. **{section['title']}** — {section['summary']}")

    if plan["attention"]:
        labels = {"fix": "수정 필요", "caution": "주의해서 볼 점", "confirm": "확인 필요"}
        output.extend(["", "## 먼저 볼 점", ""])
        for item in plan["attention"]:
            evidence = evidence_text(source, files_by_id, item["evidence"])
            output.append(f"- **[{labels[item['type']]}] {item['title']}** — {item['body']} ({evidence})")

    for index, section in enumerate(plan["sections"], start=1):
        output.extend(["", f"## {index}. {section['title']}", "", section["summary"], ""])
        for file_plan in section["files"]:
            source_file = files_by_id[file_plan["file_id"]]
            view_label = "코드 표시" if file_plan["view"] == "detail" else "요약만"
            output.append(f"- **{view_label}** `{source_file['path']}` — {file_plan['note']}")
    if plan["verification"]:
        labels = {"passed": "통과", "failed": "실패", "not_run": "실행 안 함", "unknown": "결과 미확인"}
        output.extend(["", "## 확인한 내용", ""])
        for item in plan["verification"]:
            detail = f" — {item['evidence']}" if item.get("evidence") else ""
            output.append(f"- **{labels[item['status']]}** `{item['name']}`{detail}")
    capture = source["capture"]
    coverage_label = "전체 검토" if coverage["status"] == "complete" else "일부 검토"
    output.extend(
        [
            "",
            "## 검토 범위",
            "",
            f"{coverage_label} · 파일 {coverage['reviewed_files']}/{coverage['total_files']} · 변경 묶음 {coverage['inspected_chunks']}/{coverage['total_chunks']} · 원본 `{capture.get('kind')}` `{source['source_sha256'][:12]}`",
            f"HTML 선택: 코드 {len(coverage['detailed_files'])}개 · 요약 {len(coverage['summarized_files'])}개 · 생략 {len(coverage['omitted_files'])}개",
            "",
        ]
    )
    return "\n".join(output)


def syntax_language(path: str) -> str | None:
    name = Path(path).name.lower()
    suffix = Path(path).suffix.lower()
    if name in {"dockerfile", "containerfile"}:
        return "docker"
    if name in {"podfile", "gemfile", "rakefile"}:
        return "ruby"
    if name in {"makefile"}:
        return None
    return {
        ".bash": "bash",
        ".c": "c",
        ".cc": "cpp",
        ".cpp": "cpp",
        ".cs": "csharp",
        ".css": "css",
        ".gql": "graphql",
        ".go": "go",
        ".gradle": "groovy",
        ".graphql": "graphql",
        ".groovy": "groovy",
        ".h": "c",
        ".hpp": "cpp",
        ".htm": "markup",
        ".html": "markup",
        ".java": "java",
        ".js": "javascript",
        ".json": "json",
        ".jsx": "jsx",
        ".kt": "kotlin",
        ".kts": "kotlin",
        ".less": "less",
        ".md": "markdown",
        ".mjs": "javascript",
        ".mm": "objectivec",
        ".m": "objectivec",
        ".py": "python",
        ".rb": "ruby",
        ".rs": "rust",
        ".scss": "scss",
        ".sh": "bash",
        ".sql": "sql",
        ".swift": "swift",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".xml": "markup",
        ".yaml": "yaml",
        ".yml": "yaml",
    }.get(suffix)


def html_line(line: dict[str, Any], *, language: str | None = None, focus: bool = False) -> Element:
    classes = ["line", line["kind"]]
    if focus:
        classes.append("focus")
    old_value = "" if line["old_line"] is None else str(line["old_line"])
    new_value = "" if line["new_line"] is None else str(line["new_line"])
    row = Element("div", {"id": line["id"], "class": " ".join(classes)})
    child(row, "span", line["id"], {"class": "line-id"})
    child(row, "span", old_value, {"class": "line-no"})
    child(row, "span", new_value, {"class": "line-no"})
    code_cell = child(row, "span", attributes={"class": "code"})
    code_attributes = {}
    if language and line["kind"] in SOURCE_LINE_KINDS:
        code_attributes["class"] = f"language-{language}"
    child(code_cell, "code", line["text"], code_attributes)
    return row


def append_fold_summary(details: Element, *, reason: str, count: int) -> Element:
    summary = child(details, "summary")
    child(summary, "span", attributes={"class": "fold-anchor"})
    child(summary, "span", attributes={"class": "fold-line-no", "aria-hidden": "true"})
    child(summary, "span", "···", {"class": "fold-line-no", "aria-hidden": "true"})
    copy = child(summary, "span", attributes={"class": "fold-copy"})
    child(copy, "span", reason, {"class": "fold-reason"})
    child(copy, "span", attributes={"class": "fold-count", "data-count": str(count)})
    return summary


def render_file_diff(
    source: dict[str, Any], file_entry: dict[str, Any], file_plan: dict[str, Any]
) -> Element:
    lines = source["lines"]
    focus_indices: set[int] = set()
    focus_notes: dict[int, str] = {}
    collapses: dict[int, tuple[int, str]] = {}
    for source_range in file_plan["focus"]:
        start = anchor_index(source_range["start"], len(lines))
        end = anchor_index(source_range["end"], len(lines))
        if start is not None and end is not None:
            focus_indices.update(range(start, end + 1))
            focus_notes[start] = source_range["reason"]
    for source_range in file_plan["collapse"]:
        start = anchor_index(source_range["start"], len(lines))
        end = anchor_index(source_range["end"], len(lines))
        if start is not None and end is not None:
            collapses[start] = (end, source_range["reason"])

    file_indices = file_entry["line_indices"]
    language = syntax_language(file_entry["path"])
    diff = Element("div", {"class": "diff"})
    index_position = 0
    while index_position < len(file_indices):
        line_index = file_indices[index_position]
        if index_position == 0:
            structural_indices = []
            while (
                index_position + len(structural_indices) < len(file_indices)
                and lines[file_indices[index_position + len(structural_indices)]]["kind"]
                in {"file_header", "metadata", "old_file", "new_file"}
            ):
                structural_indices.append(file_indices[index_position + len(structural_indices)])
            if structural_indices:
                details = child(diff, "details", attributes={"class": "inline-fold structural"})
                append_fold_summary(details, reason="파일 경로와 변경 정보", count=len(structural_indices))
                folded_lines = child(details, "div", attributes={"class": "folded-lines"})
                for structural_index in structural_indices:
                    folded_lines.append(html_line(lines[structural_index]))
                index_position += len(structural_indices)
                continue
        if line_index in focus_notes:
            note = child(diff, "aside", attributes={"class": "inline-code-note"})
            child(note, "span", "해설")
            child(note, "p", focus_notes[line_index])
        if line_index in collapses:
            end, reason = collapses[line_index]
            collapsed_indices = [item for item in file_indices[index_position:] if item <= end]
            details = child(diff, "details", attributes={"class": "inline-fold"})
            append_fold_summary(details, reason=reason, count=len(collapsed_indices))
            folded_lines = child(details, "div", attributes={"class": "folded-lines"})
            for collapsed_index in collapsed_indices:
                folded_lines.append(
                    html_line(lines[collapsed_index], language=language, focus=collapsed_index in focus_indices)
                )
            index_position += len(collapsed_indices)
            continue
        diff.append(html_line(lines[line_index], language=language, focus=line_index in focus_indices))
        index_position += 1
    return diff


def append_evidence_links(
    parent: Element,
    *,
    source: dict[str, Any],
    files_by_id: dict[str, dict[str, Any]],
    evidence: list[str],
    label: str | None = None,
) -> Element:
    links = child(parent, "p", attributes={"class": "evidence-links"})
    if label:
        child(links, "span", label)
    for anchor in evidence:
        full_label = anchor_label(source, files_by_id, anchor)
        link = child(
            links,
            "a",
            anchor_label(source, files_by_id, anchor, compact=True),
            {"href": f"#{anchor}", "title": full_label, "aria-label": full_label},
        )
        link.tail = " "
    return links


def append_file_identity(parent: Element, path: str) -> Element:
    heading = child(parent, "h3")
    path_value = Path(path)
    child(heading, "span", path_value.name, {"class": "file-name"})
    parent_path = str(path_value.parent)
    if parent_path != ".":
        child(heading, "span", parent_path + "/", {"class": "file-path"})
    return heading


def append_easy_context(main: Element, plan: dict[str, Any]) -> None:
    easy_context = active_easy_context(plan)
    if easy_context is None:
        return
    section = child(main, "section", attributes={"class": "easy-context report-section"})
    child(section, "p", "PLAIN CONTEXT", {"class": "section-label"})
    child(section, "h2", "아주 쉽게 보기")
    lead = child(section, "div", attributes={"class": "easy-lead"})
    what = child(lead, "div", attributes={"class": "easy-card"})
    child(what, "p", "무엇이 달라지나", {"class": "easy-kicker"})
    child(what, "p", easy_context["what"])
    why_text = easy_context.get("why")
    if isinstance(why_text, str) and why_text.strip():
        why = child(lead, "div", attributes={"class": "easy-card"})
        child(why, "p", "왜 하나", {"class": "easy-kicker"})
        child(why, "p", why_text)
    points = [item for item in easy_context.get("points", []) if isinstance(item, str) and item.strip()]
    if points:
        points_list = child(section, "ul", attributes={"class": "easy-points"})
        for item in points:
            child(points_list, "li", item)
    diagram = easy_context.get("diagram")
    if isinstance(diagram, dict) and diagram.get("kind") in DIAGRAM_KINDS:
        titles = {"flow": "흐름 한눈에 보기", "sequence": "호출 순서 한눈에 보기", "er": "데이터 구조 한눈에 보기"}
        child(section, "p", titles[diagram["kind"]], {"class": "easy-kicker easy-flow-title"})
        child(
            section,
            "div",
            attributes={"class": "easy-diagram", "data-diagram": json.dumps(diagram, ensure_ascii=False)},
        )
    flow = [step for step in easy_context.get("flow", []) if isinstance(step, dict) and step.get("label")]
    if flow and not isinstance(diagram, dict):
        child(section, "p", "흐름 한눈에 보기", {"class": "easy-kicker easy-flow-title"})
        flow_list = child(section, "ol", attributes={"class": "easy-flow"})
        for step in flow:
            step_item = child(flow_list, "li", attributes={"class": "easy-step"})
            child(step_item, "strong", step["label"])
            note = step.get("note")
            if isinstance(note, str) and note.strip():
                child(step_item, "span", note)
    terms = [
        term
        for term in easy_context.get("terms", [])
        if isinstance(term, dict) and term.get("term") and term.get("meaning")
    ]
    if terms:
        terms_list = child(section, "dl", attributes={"class": "easy-terms"})
        for term in terms:
            term_row = child(terms_list, "div")
            child(term_row, "dt", term["term"])
            child(term_row, "dd", term["meaning"])


def append_chat_dock(main: Element, serve_hint: str) -> None:
    dock = child(main, "aside", attributes={"class": "chat-dock", "data-chat-dock": ""})
    toggle = child(
        dock,
        "button",
        attributes={
            "type": "button",
            "class": "chat-toggle",
            "data-action": "toggle-chat",
            "aria-expanded": "false",
            "aria-label": "AI 리뷰 도우미 열기",
        },
    )
    toggle_icon = child(toggle, "svg", attributes={"viewBox": "0 0 24 24", "class": "chat-toggle-icon", "aria-hidden": "true"})
    child(
        toggle_icon,
        "path",
        attributes={
            "d": "M12 3C6.8 3 2.5 6.5 2.5 10.8c0 2.4 1.3 4.6 3.4 6-.2 1.1-.8 2.4-1.7 3.5 2-.3 3.6-1 4.7-1.8 1 .3 2 .4 3.1.4 5.2 0 9.5-3.5 9.5-7.9S17.2 3 12 3z",
            "fill": "currentColor",
        },
    )
    child(toggle, "span", "✕", {"class": "chat-toggle-x", "aria-hidden": "true"})
    panel = child(dock, "section", attributes={"class": "chat-panel", "hidden": "", "aria-label": "AI 리뷰 도우미"})
    panel_header = child(panel, "header", attributes={"class": "chat-header"})
    child(panel_header, "div", "AI", {"class": "chat-avatar", "aria-hidden": "true"})
    panel_title = child(panel_header, "div", attributes={"class": "chat-title"})
    child(panel_title, "strong", "리뷰 도우미")
    subtitle = child(panel_title, "div", attributes={"class": "chat-subtitle"})
    child(subtitle, "span", "오프라인", {"class": "chat-status", "data-chat-status": ""})
    child(subtitle, "span", "", {"class": "chat-branch", "data-chat-branch": ""})
    actions = child(panel_header, "div", attributes={"class": "chat-actions"})
    child(
        actions,
        "select",
        attributes={
            "class": "chat-model-select",
            "data-chat-model-select": "",
            "aria-label": "모델 선택",
            "hidden": "",
        },
    )
    child(
        actions,
        "button",
        "↺",
        {"type": "button", "class": "chat-icon-button", "data-action": "new-chat", "aria-label": "새 대화", "title": "새 대화"},
    )
    child(
        actions,
        "button",
        "✕",
        {"type": "button", "class": "chat-icon-button", "data-action": "close-chat", "aria-label": "채팅창 닫기", "title": "닫기"},
    )
    offline = child(panel, "div", attributes={"class": "chat-offline", "data-chat-offline": ""})
    child(offline, "p", "챗봇은 로컬 서버로 열었을 때만 동작합니다. 터미널에서 아래 명령을 실행하고 출력된 주소로 다시 열어 주세요.")
    child(offline, "code", serve_hint)
    child(offline, "p", "서버는 이 컬플릿터 저장소를 읽기 전용으로만 보며, 대화는 번들의 chat/ 폴더에 JSONL로 저장됩니다.")
    child(panel, "div", attributes={"class": "chat-body", "data-chat-body": ""})


def render_html(review: dict[str, Any], assets_dir: Path, serve_hint: str) -> str:
    plan = review["plan"]
    coverage = review["coverage"]
    source = review["source"]
    files_by_id = {file_entry["id"]: file_entry for file_entry in review["files"]}
    main = Element("main", {"class": "shell"})
    header = child(main, "header", attributes={"class": "report-header"})
    child(header, "p", "EASY REVIEW", {"class": "report-kicker"})
    child(header, "h1", plan["title"])
    child(header, "p", plan["summary"], {"class": "summary"})
    stats = child(header, "dl", attributes={"class": "report-stats"})
    coverage_label = "전체 검토" if coverage["status"] == "complete" else "일부 검토"
    stat_values = (
        ("범위", coverage_label),
        ("검토", f'{coverage["reviewed_files"]}/{coverage["total_files"]} files'),
        ("선택", f'{len(coverage["detailed_files"])} code · {len(coverage["summarized_files"])} notes'),
        ("변경", f'+{source["stats"]["additions"]} −{source["stats"]["deletions"]}'),
    )
    for label, value in stat_values:
        stat = child(stats, "div", attributes={"class": "report-stat"})
        child(stat, "dt", label)
        child(stat, "dd", value)

    append_easy_context(main, plan)

    overview = child(main, "section", attributes={"class": "overview report-section"})
    child(overview, "p", "OVERVIEW", {"class": "section-label"})
    child(overview, "h2", "한눈에 보기")
    overview_list = child(overview, "ul")
    for item in plan["overview"]:
        child(overview_list, "li", item)
    legend = child(overview, "p", attributes={"class": "legend"})
    child(legend, "span")
    append_text(legend, "파란 선과 해설은 설명에 직접 연결되는 코드입니다. 줄 번호는 원본 파일 기준입니다.")

    toolbar = child(main, "div", attributes={"class": "toolbar", "aria-label": "보기 설정"})
    child(toolbar, "button", "전체 펼치기", {"type": "button", "data-action": "expand-all"})
    child(toolbar, "button", "근거 ID 보기", {"type": "button", "data-action": "toggle-anchors"})

    layout = child(main, "div", attributes={"class": "review-layout"})
    review_content = child(layout, "div", attributes={"class": "review-content"})

    if plan["attention"]:
        labels = {"fix": "수정 필요", "caution": "주의해서 볼 점", "confirm": "확인 필요"}
        attention = child(review_content, "section", attributes={"class": "attention report-section"})
        child(attention, "p", "ATTENTION", {"class": "section-label"})
        child(attention, "h2", "먼저 볼 점")
        for item in plan["attention"]:
            article = child(
                attention,
                "article",
                attributes={"class": f'attention-item {item["type"]}'},
            )
            child(article, "p", labels[item["type"]], {"class": "attention-label"})
            child(article, "h3", item["title"])
            child(article, "p", item["body"])
            append_evidence_links(
                article,
                source=source,
                files_by_id=files_by_id,
                evidence=item["evidence"],
            )

    for section_index, section in enumerate(plan["sections"], start=1):
        detail_count = sum(file_plan["view"] == "detail" for file_plan in section["files"])
        summary_count = len(section["files"]) - detail_count
        section_attributes = {
            "id": f'section-{section["id"]}',
            "data-review-section": section["id"],
            "class": "review-section",
        }
        section_node = child(review_content, "details", attributes=section_attributes)
        section_summary = child(section_node, "summary")
        child(section_summary, "span", f"{section_index:02d}", {"class": "section-number"})
        child(section_summary, "span", section["title"], {"class": "section-heading"})
        child(section_summary, "span", section["summary"], {"class": "section-summary"})
        child(
            section_summary,
            "span",
            f"{detail_count} code / {summary_count} notes",
            {"class": "section-count"},
        )
        section_body = child(section_node, "div", attributes={"class": "section-body"})
        append_evidence_links(
            section_body,
            source=source,
            files_by_id=files_by_id,
            evidence=section["evidence"],
            label="관련 코드",
        )
        detail_files = [file_plan for file_plan in section["files"] if file_plan["view"] == "detail"]
        summary_files = [file_plan for file_plan in section["files"] if file_plan["view"] == "summary"]
        for file_plan in detail_files:
            file_entry = files_by_id[file_plan["file_id"]]
            file_node = child(
                section_body,
                "article",
                attributes={"id": f'file-{file_entry["id"]}', "class": "file"},
            )
            file_header = child(file_node, "header", attributes={"class": "file-header"})
            append_file_identity(file_header, file_entry["path"])
            file_description = child(file_header, "p", file_plan["note"] + " ")
            child(
                file_description,
                "span",
                f'+{file_entry["additions"]} −{file_entry["deletions"]}',
            )
            child(
                file_header,
                "button",
                "AI에게 묻기",
                {"type": "button", "class": "ask-ai", "data-ask-path": file_entry["path"], "hidden": ""},
            )
            file_node.append(render_file_diff(source, file_entry, file_plan))
        if summary_files:
            supporting = child(section_body, "details", attributes={"class": "supporting-files"})
            supporting_summary = child(supporting, "summary")
            child(supporting_summary, "span", f"보조 변경 {len(summary_files)}개")
            child(supporting_summary, "small", "역할만 보기")
            supporting_body = child(supporting, "div", attributes={"class": "supporting-files-body"})
            for file_plan in summary_files:
                file_entry = files_by_id[file_plan["file_id"]]
                summary_file = child(supporting_body, "article", attributes={"class": "file-summary"})
                summary_copy = child(summary_file, "div")
                append_file_identity(summary_copy, file_entry["path"])
                child(summary_copy, "p", file_plan["note"])
                child(
                    summary_file,
                    "span",
                    f'+{file_entry["additions"]} −{file_entry["deletions"]}',
                )

    if coverage["unreviewed_files"]:
        unreviewed = child(review_content, "details", attributes={"class": "review-section unreviewed"})
        unreviewed_summary = child(unreviewed, "summary")
        child(unreviewed_summary, "span", "아직 읽지 못한 파일", {"class": "section-heading"})
        unreviewed_body = child(unreviewed, "div", attributes={"class": "section-body"})
        unreviewed_list = child(unreviewed_body, "ul")
        for file_id in coverage["unreviewed_files"]:
            child(unreviewed_list, "li", files_by_id[file_id]["path"])

    if plan["verification"]:
        labels = {"passed": "통과", "failed": "실패", "not_run": "실행 안 함", "unknown": "결과 미확인"}
        verification = child(review_content, "section", attributes={"class": "verification report-section"})
        child(verification, "p", "VERIFICATION", {"class": "section-label"})
        child(verification, "h2", "확인한 내용")
        verification_list = child(verification, "ul")
        for item in plan["verification"]:
            verification_item = child(verification_list, "li")
            child(
                verification_item,
                "strong",
                labels[item["status"]],
                {"class": f'status {item["status"]}'},
            )
            append_text(verification_item, "  " + item["name"])
            if item.get("evidence"):
                append_text(verification_item, " — " + item["evidence"])

    technical = child(review_content, "details", attributes={"class": "technical report-section"})
    child(technical, "summary", "검토 범위와 기술 정보")
    technical_copy = child(technical, "p")
    append_text(
        technical_copy,
        f'{coverage_label} · 파일 {coverage["reviewed_files"]}/{coverage["total_files"]} · '
        f'변경 묶음 {coverage["inspected_chunks"]}/{coverage["total_chunks"]}',
    )
    child(technical_copy, "br")
    append_text(
        technical_copy,
        f'코드 {len(coverage["detailed_files"])}개와 요약 {len(coverage["summarized_files"])}개를 남기고 '
        f'우선순위가 낮은 파일 {len(coverage["omitted_files"])}개는 읽기 화면에서 생략함.',
    )
    child(technical_copy, "br")
    append_text(
        technical_copy,
        f'원본 {source["capture"].get("kind", "unknown")} · {source["source_sha256"][:12]} · '
        "로컬 생성 · 원격 변경 없음 · ",
    )
    child(technical_copy, "a", "원본 diff 열기", {"href": "source.diff"})

    first_section = plan["sections"][0]
    minimap = child(layout, "aside", attributes={"class": "minimap", "aria-label": "리뷰 진행 상황"})
    minimap_compact = child(
        minimap,
        "button",
        attributes={
            "type": "button",
            "class": "minimap-compact",
            "data-action": "toggle-minimap",
            "aria-expanded": "false",
        },
    )
    child(minimap_compact, "span", "현재 흐름", {"class": "minimap-compact-kicker"})
    child(
        minimap_compact,
        "strong",
        f'01/{len(plan["sections"]):02d} · {first_section["title"]}',
        {"data-minimap-current": ""},
    )
    child(minimap_compact, "span", "0% 읽음", {"data-minimap-percent": ""})
    compact_progress = child(minimap_compact, "span", attributes={"class": "minimap-progress"})
    child(compact_progress, "i", attributes={"data-minimap-progress": ""})

    minimap_navigation = child(minimap, "nav")
    minimap_heading = child(minimap_navigation, "div", attributes={"class": "minimap-heading"})
    child(minimap_heading, "p", "읽는 흐름", {"class": "minimap-title"})
    child(minimap_heading, "span", "0% 읽음", {"data-minimap-percent": ""})
    navigation_progress = child(minimap_navigation, "span", attributes={"class": "minimap-progress"})
    child(navigation_progress, "i", attributes={"data-minimap-progress": ""})
    minimap_list = child(minimap_navigation, "ol")
    for section_index, section in enumerate(plan["sections"], start=1):
        secondary_class = " secondary" if not section["default_open"] else ""
        minimap_item = child(minimap_list, "li")
        link_attributes = {
            "data-minimap-link": section["id"],
            "data-section-index": str(section_index),
            "data-section-title": section["title"],
            "href": f'#section-{section["id"]}',
        }
        if secondary_class:
            link_attributes["class"] = secondary_class.strip()
        minimap_link = child(minimap_item, "a", attributes=link_attributes)
        child(minimap_link, "span", f"{section_index:02d}")
        append_text(minimap_link, section["title"])
    child(
        minimap_navigation,
        "p",
        f'{len(coverage["detailed_files"])} code · {len(coverage["summarized_files"])} notes · '
        f'{len(coverage["omitted_files"])} omitted',
        {"class": "minimap-meta"},
    )

    append_chat_dock(main, serve_hint)

    style = (assets_dir / "review.css").read_text(encoding="utf-8")
    syntax_script = (assets_dir / "vendor" / "prism.js").read_text(encoding="utf-8")
    behavior_script = (assets_dir / "review.js").read_text(encoding="utf-8")
    try:
        return render_document(
            title=plan["title"],
            main=main,
            assets=TrustedAssets(
                stylesheet=style,
                syntax_script=syntax_script,
                behavior_script=behavior_script,
            ),
        )
    except ValueError as error:
        raise EasyReviewError(str(error)) from error


def command_compile(args: argparse.Namespace) -> int:
    bundle = Path(args.bundle).expanduser().resolve()
    source, plan, inspection = load_bundle(bundle)
    errors, warnings, coverage = validate_plan(source, plan, inspection)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    review = {
        "schema_version": SCHEMA_VERSION,
        "source": {
            "source_sha256": source["source_sha256"],
            "capture": source["capture"],
            "stats": source["stats"],
            "hints": source["hints"],
            "lines": source["lines"],
        },
        "coverage": coverage,
        "warnings": warnings,
        "plan": plan,
        "files": source["files"],
    }
    write_json_atomic(bundle / "review.json", review)
    generated = [bundle / "review.json"]
    if args.format_value in {"chat", "both"}:
        markdown_path = bundle / "review.md"
        write_text_atomic(markdown_path, render_markdown(review))
        generated.append(markdown_path)
    if args.format_value in {"html", "both"}:
        html_path = bundle / "review.html"
        assets_dir = Path(__file__).resolve().parent.parent / "assets"
        serve_hint = f'python3 "{Path(__file__).resolve()}" serve --bundle "{bundle}"'
        write_text_atomic(html_path, render_html(review, assets_dir, serve_hint))
        generated.append(html_path)
    for path in generated:
        print(path)
    return 0


def command_serve(args: argparse.Namespace) -> int:
    bundle = Path(args.bundle).expanduser().resolve()
    if not (bundle / "review.html").is_file():
        raise EasyReviewError("review.html not found; run compile --format html first")
    source = read_json(bundle / "source.json")
    repo_value = args.repo or source.get("capture", {}).get("repo_root")
    if not repo_value:
        raise EasyReviewError("pass --repo so the assistant knows which repository to read")
    repo = Path(repo_value).expanduser().resolve()
    if not repo.is_dir():
        raise EasyReviewError(f"repository directory not found: {repo}; pass --repo")
    repo = git_root(repo)
    import chat_server

    chat_server.serve(bundle, repo, args.port, args.model)
    return 0


def command_describe(args: argparse.Namespace) -> int:
    description = {
        "name": "easy-review",
        "schema_version": SCHEMA_VERSION,
        "read_only": True,
        "pipeline_llm_api_calls": False,
        "chat": {
            "command": "serve",
            "listens_on": "127.0.0.1",
            "api_key_env": ["EASY_REVIEW_CHAT_API_KEY", "OPENROUTER_API_KEY"],
            "model_env": "EASY_REVIEW_CHAT_MODEL",
            "base_url_env": "EASY_REVIEW_CHAT_BASE_URL",
            "repo_access": "read-only tools (list_dir, read_file, search_code)",
            "log": "<bundle>/chat/<session>.jsonl",
        },
        "capture_modes": ["worktree", "unstaged", "staged", "revision", "range", "github_pr", "diff_file"],
        "commands": ["capture", "inspect", "preview", "compile", "serve", "describe"],
        "formats": ["chat", "html", "both"],
        "limits": {"max_diff_bytes": MAX_DIFF_BYTES, "default_chunk_bytes": DEFAULT_CHUNK_BYTES, "max_chunks": MAX_CHUNKS},
    }
    print(json.dumps(description, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture = subparsers.add_parser("capture", help="capture a diff into an immutable review bundle")
    capture.add_argument("--repo", default=".", help="repository directory")
    capture.add_argument("--output", help="new bundle directory; defaults under Git metadata")
    capture.add_argument("--chunk-bytes", type=int, default=DEFAULT_CHUNK_BYTES)
    modes = capture.add_mutually_exclusive_group(required=True)
    modes.add_argument("--worktree", action="store_true", help="all tracked and untracked changes against HEAD")
    modes.add_argument("--unstaged", action="store_true")
    modes.add_argument("--staged", action="store_true")
    modes.add_argument("--revision")
    modes.add_argument("--range", dest="range_value")
    modes.add_argument("--pr")
    modes.add_argument("--diff-file")
    capture.set_defaults(handler=command_capture)

    inspect_parser = subparsers.add_parser("inspect", help="show summary or one bounded source chunk")
    inspect_parser.add_argument("--bundle", required=True)
    inspect_parser.add_argument("--chunk")
    inspect_parser.set_defaults(handler=command_inspect)

    preview = subparsers.add_parser("preview", help="validate the current review plan")
    preview.add_argument("--bundle", required=True)
    preview.set_defaults(handler=command_preview)

    compile_parser = subparsers.add_parser("compile", help="compile a valid plan into review artifacts")
    compile_parser.add_argument("--bundle", required=True)
    compile_parser.add_argument("--format", dest="format_value", choices=("chat", "html", "both"), required=True)
    compile_parser.set_defaults(handler=command_compile)

    serve_parser = subparsers.add_parser("serve", help="serve review.html locally with the AI chat assistant")
    serve_parser.add_argument("--bundle", required=True)
    serve_parser.add_argument("--repo", help="repository the assistant may read; defaults to the captured repo")
    serve_parser.add_argument("--port", type=int, default=0, help="port to bind on 127.0.0.1; 0 picks a free port")
    serve_parser.add_argument("--model", help="chat model id; defaults to EASY_REVIEW_CHAT_MODEL")
    serve_parser.set_defaults(handler=command_serve)

    describe = subparsers.add_parser("describe", help="print the local command contract")
    describe.add_argument("--json", action="store_true", help="retained for explicit machine-readable invocation")
    describe.set_defaults(handler=command_describe)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.handler(args)
    except EasyReviewError as error:
        print(f"easy-review: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("easy-review: interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
