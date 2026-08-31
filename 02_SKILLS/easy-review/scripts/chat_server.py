#!/usr/bin/env python3
"""Local, read-only chat server for a compiled Easy Review bundle.

Serves review.html on 127.0.0.1 and proxies user-initiated chat turns to an
OpenAI-compatible endpoint (OpenRouter by default). The model can inspect the
local repository through read-only tools. Conversations are appended to
JSONL files under <bundle>/chat/.
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import uuid
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "anthropic/claude-haiku-4.5"
DEFAULT_MODEL_CHOICES = [
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-sonnet-4.5",
    "deepseek/deepseek-v4-flash-0731",
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "openai/gpt-5-mini",
    "qwen/qwen3-coder",
    "moonshotai/kimi-k2.5",
]
MODEL_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]+/[A-Za-z0-9_.:-]+$")
MAX_TOOL_ROUNDS = 8
MAX_HISTORY_MESSAGES = 40
MAX_FILE_LINES = 400
MAX_SEARCH_LINES = 120
MAX_DIR_ENTRIES = 200
MAX_TREE_LINES = 300
SESSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
MAX_ATTACHMENTS = 4
MAX_REQUEST_BYTES = 160 * 1024 * 1024
MAX_HISTORY_ITEMS = 80
ALLOWED_HOSTS = {"127.0.0.1", "localhost", "::1"}
MAX_IMAGE_DATA_CHARS = 8 * 1024 * 1024
MAX_PDF_DATA_CHARS = 28 * 1024 * 1024
MAX_TEXT_ATTACHMENT_CHARS = 100_000
IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$")
PDF_DATA_URL_RE = re.compile(r"^data:application/pdf;base64,([A-Za-z0-9+/=]+)$")
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
STATIC_FILES = {
    "/": ("review.html", "text/html; charset=utf-8"),
    "/review.html": ("review.html", "text/html; charset=utf-8"),
    "/source.diff": ("source.diff", "text/plain; charset=utf-8"),
    "/review.json": ("review.json", "application/json; charset=utf-8"),
    "/review.md": ("review.md", "text/markdown; charset=utf-8"),
}


class ChatServerError(RuntimeError):
    pass


class ChatConfig:
    def __init__(self, bundle: Path, repo: Path, model: str | None = None) -> None:
        self.bundle = bundle
        self.repo = repo
        self.model = model or os.environ.get("EASY_REVIEW_CHAT_MODEL") or DEFAULT_MODEL
        choices_env = os.environ.get("EASY_REVIEW_CHAT_MODELS")
        choices = (
            [item.strip() for item in choices_env.split(",") if item.strip()]
            if choices_env
            else list(DEFAULT_MODEL_CHOICES)
        )
        self.models = [self.model] + [item for item in choices if item != self.model]
        self.base_url = (os.environ.get("EASY_REVIEW_CHAT_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = os.environ.get("EASY_REVIEW_CHAT_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
        self.log_lock = threading.Lock()
        self._source: dict[str, Any] | None = None

    def source(self) -> dict[str, Any]:
        if self._source is None:
            self._source = json.loads((self.bundle / "source.json").read_text(encoding="utf-8"))
        return self._source


def run_git(repo: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", *arguments],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if completed.returncode != 0:
        return ""
    return completed.stdout


def safe_repo_path(repo: Path, raw: str) -> Path:
    candidate = (repo / str(raw)).resolve()
    if candidate != repo and repo not in candidate.parents:
        raise ChatServerError(f"path escapes the repository: {raw}")
    if ".git" in candidate.relative_to(repo).parts:
        raise ChatServerError("the .git directory is not readable")
    return candidate


def git_context(repo: Path) -> str:
    branch = run_git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
    head = run_git(repo, "log", "-1", "--format=%h %s").strip()
    recent = run_git(repo, "log", "--oneline", "-8").strip()
    status = run_git(repo, "status", "--short").strip()
    parts = [f"branch: {branch or 'unknown'}", f"HEAD: {head or 'unknown'}"]
    if recent:
        parts.append("recent commits:\n" + recent)
    if status:
        lines = status.splitlines()
        shown = "\n".join(lines[:30])
        suffix = f"\n... ({len(lines) - 30} more)" if len(lines) > 30 else ""
        parts.append("working tree status:\n" + shown + suffix)
    else:
        parts.append("working tree status: clean")
    return "\n".join(parts)


def repo_tree_text(repo: Path) -> str:
    listing = run_git(repo, "ls-files")
    if not listing:
        return "(no tracked files found)"
    directories: dict[str, int] = {}
    top_level_files: list[str] = []
    for tracked in listing.splitlines():
        parts = tracked.split("/")
        if len(parts) == 1:
            top_level_files.append(tracked)
            continue
        for depth in (1, 2):
            if len(parts) > depth:
                key = "/".join(parts[:depth]) + "/"
                directories[key] = directories.get(key, 0) + 1
    lines = [f"{name}  ({count} files)" for name, count in sorted(directories.items())]
    lines.extend(sorted(top_level_files))
    if len(lines) > MAX_TREE_LINES:
        lines = lines[:MAX_TREE_LINES] + [f"... ({len(lines) - MAX_TREE_LINES} more entries)"]
    return "\n".join(lines)


def tool_list_dir(repo: Path, arguments: dict[str, Any]) -> str:
    target = safe_repo_path(repo, arguments.get("path") or ".")
    if not target.is_dir():
        raise ChatServerError(f"not a directory: {arguments.get('path')}")
    entries = []
    for entry in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
        if entry.name == ".git":
            continue
        entries.append(entry.name + "/" if entry.is_dir() else entry.name)
        if len(entries) >= MAX_DIR_ENTRIES:
            entries.append("... (truncated)")
            break
    return "\n".join(entries) or "(empty directory)"


def tool_read_file(repo: Path, arguments: dict[str, Any]) -> str:
    target = safe_repo_path(repo, arguments.get("path") or "")
    if not target.is_file():
        raise ChatServerError(f"not a file: {arguments.get('path')}")
    start = max(1, int(arguments.get("start_line") or 1))
    limit = min(MAX_FILE_LINES, max(1, int(arguments.get("max_lines") or 200)))
    try:
        text = target.read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        raise ChatServerError(f"cannot read file: {error}") from error
    lines = text.splitlines()
    selected = lines[start - 1 : start - 1 + limit]
    if not selected:
        return f"(file has {len(lines)} lines; nothing at line {start})"
    body = "\n".join(f"{start + offset:>5}| {line}" for offset, line in enumerate(selected))
    remaining = len(lines) - (start - 1 + len(selected))
    if remaining > 0:
        body += f"\n... ({remaining} more lines; continue with start_line={start + len(selected)})"
    return body


def tool_search_code(repo: Path, arguments: dict[str, Any]) -> str:
    query = str(arguments.get("query") or "").strip()
    if not query:
        raise ChatServerError("query is required")
    command = ["grep", "-n", "-I", "--no-color", "-e", query]
    path = arguments.get("path")
    if path:
        safe_repo_path(repo, path)
        command.extend(["--", str(path)])
    output = run_git(repo, *command)
    if not output:
        return "(no matches)"
    lines = output.splitlines()
    if len(lines) > MAX_SEARCH_LINES:
        lines = lines[:MAX_SEARCH_LINES] + [f"... ({len(lines) - MAX_SEARCH_LINES} more matches)"]
    return "\n".join(lines)


MAX_DIFF_TOOL_CHARS = 24000


def tool_read_diff(config: "ChatConfig", arguments: dict[str, Any]) -> str:
    source = config.source()
    files = source["files"]
    path = str(arguments.get("path") or "").strip()
    if not path:
        return "\n".join(
            f"{entry['path']} ({entry['status']}, +{entry['additions']}/-{entry['deletions']})" for entry in files
        )
    target = next(
        (
            entry
            for entry in files
            if path in {entry.get("path"), entry.get("old_path"), entry.get("new_path")}
            or Path(entry["path"]).name == path
        ),
        None,
    )
    if target is None:
        available = ", ".join(entry["path"] for entry in files[:20])
        raise ChatServerError(f"this diff has no file named {path}; available: {available}")
    lines = source["lines"]
    body = "\n".join(lines[index]["text"] for index in target["line_indices"])
    if len(body) > MAX_DIFF_TOOL_CHARS:
        body = body[:MAX_DIFF_TOOL_CHARS] + "\n... (truncated; ask about a specific part)"
    return body


TOOLS: dict[str, Callable[[Path, dict[str, Any]], str]] = {
    "list_dir": tool_list_dir,
    "read_file": tool_read_file,
    "search_code": tool_search_code,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "read_diff",
            "description": "Read the actual changed code of THIS review (the PR diff). Use this first for any question about what the change does — it works even when the PR branch is not checked out locally. Without a path it lists all changed files.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Changed file path (or bare filename) from this diff; omit to list changed files."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List entries of a directory inside the reviewed repository (read-only).",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Repository-relative directory path; defaults to the repo root."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file from the reviewed repository with line numbers (read-only).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Repository-relative file path."},
                    "start_line": {"type": "integer", "description": "1-based first line to read; defaults to 1."},
                    "max_lines": {"type": "integer", "description": "Number of lines to read; defaults to 200, max 400."},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search tracked files with git grep and return matching lines (read-only).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Pattern passed to git grep -e."},
                    "path": {"type": "string", "description": "Optional repository-relative path to limit the search."},
                },
                "required": ["query"],
            },
        },
    },
]


def validate_attachments(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > MAX_ATTACHMENTS:
        raise ValueError(f"attachments must be a list of at most {MAX_ATTACHMENTS} items")
    clean: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("each attachment must be an object")
        name = item.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 120:
            raise ValueError("attachment name must be a short string")
        kind = item.get("kind")
        if kind == "image":
            data = item.get("data")
            if not isinstance(data, str) or len(data) > MAX_IMAGE_DATA_CHARS or not IMAGE_DATA_URL_RE.match(data):
                raise ValueError("image attachments need a png/jpeg/webp/gif data URL within the size limit")
            clean.append({"kind": "image", "name": name, "data": data})
        elif kind == "pdf":
            data = item.get("data")
            if not isinstance(data, str) or len(data) > MAX_PDF_DATA_CHARS or not PDF_DATA_URL_RE.match(data):
                raise ValueError("pdf attachments need a base64 data URL within the 20MB limit")
            clean.append({"kind": "pdf", "name": name, "data": data})
        elif kind == "text":
            text = item.get("text")
            if not isinstance(text, str) or len(text) > MAX_TEXT_ATTACHMENT_CHARS:
                raise ValueError(f"text attachments must be at most {MAX_TEXT_ATTACHMENT_CHARS} characters")
            clean.append({"kind": "text", "name": name, "text": text})
        else:
            raise ValueError("attachment kind must be image or text")
    return clean


def to_model_message(item: dict[str, Any]) -> dict[str, Any]:
    attachments = item.get("attachments") or []
    if item.get("role") != "user" or not attachments:
        return {"role": item["role"], "content": item["content"]}
    text = item["content"]
    for attachment in attachments:
        if attachment["kind"] == "text":
            text += f"\n\n[첨부 파일: {attachment['name']}]\n```\n{attachment['text']}\n```"
    parts: list[dict[str, Any]] = [{"type": "text", "text": text or "(첨부를 확인해 주세요)"}]
    for attachment in attachments:
        if attachment["kind"] == "image":
            parts.append({"type": "image_url", "image_url": {"url": attachment["data"]}})
        elif attachment["kind"] == "pdf":
            parts.append({"type": "file", "file": {"filename": attachment["name"], "file_data": attachment["data"]}})
    return {"role": "user", "content": parts}


def history_has_pdf(history: list[dict[str, Any]]) -> bool:
    return any(
        attachment.get("kind") == "pdf"
        for item in history
        for attachment in item.get("attachments") or []
    )


def store_attachments(config: ChatConfig, session: str, attachments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    if not attachments:
        return saved
    directory = config.bundle / "chat" / "attachments"
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
    for index, attachment in enumerate(attachments):
        safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", Path(attachment["name"]).stem)[:60].strip("_") or "attachment"
        if attachment["kind"] in {"image", "pdf"}:
            if attachment["kind"] == "image":
                match = IMAGE_DATA_URL_RE.match(attachment["data"])
                extension = {"jpeg": "jpg"}.get(match.group(1), match.group(1))
            else:
                match = PDF_DATA_URL_RE.match(attachment["data"])
                extension = "pdf"
            path = directory / f"{session}-{stamp}-{index}-{safe_name}.{extension}"
            try:
                path.write_bytes(base64.b64decode(match.group(len(match.groups()))))
            except (ValueError, OSError):
                continue
            saved.append({"kind": attachment["kind"], "name": attachment["name"], "path": str(path)})
        else:
            path = directory / f"{session}-{stamp}-{index}-{safe_name}.txt"
            try:
                path.write_text(attachment["text"], encoding="utf-8")
            except OSError:
                continue
            saved.append({"kind": "text", "name": attachment["name"], "path": str(path), "chars": len(attachment["text"])})
    return saved


def review_digest(bundle: Path) -> str:
    try:
        review = json.loads((bundle / "review.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "(review.json is unavailable)"
    plan = review.get("plan", {})
    files_by_id = {entry.get("id"): entry for entry in review.get("files", [])}
    parts = [f"title: {plan.get('title', '')}", f"summary: {plan.get('summary', '')}"]
    easy = plan.get("easy_context") or {}
    if easy.get("what"):
        parts.append("plain-language what: " + easy["what"])
    if easy.get("why"):
        parts.append("plain-language why: " + easy["why"])
    if easy.get("points"):
        parts.append("key points:\n" + "\n".join(f"- {item}" for item in easy["points"]))
    if easy.get("terms"):
        parts.append(
            "glossary (answer term questions directly from here):\n"
            + "\n".join(f"- {term.get('term')}: {term.get('meaning')}" for term in easy["terms"])
        )
    diagram = easy.get("diagram") or {}
    if diagram.get("kind") == "sequence":
        actor_labels = {actor["id"]: actor["label"] for actor in diagram.get("actors", [])}
        parts.append(
            "call sequence:\n"
            + "\n".join(
                f"- {actor_labels.get(step['from'], step['from'])} -> {actor_labels.get(step['to'], step['to'])}: {step['label']}"
                for step in diagram.get("steps", [])
            )
        )
    elif easy.get("flow"):
        parts.append("flow: " + " -> ".join(step["label"] for step in easy["flow"] if step.get("label")))
    if plan.get("overview"):
        parts.append("overview:\n" + "\n".join(f"- {item}" for item in plan["overview"]))
    if plan.get("attention"):
        attention_lines = [
            f"- [{item.get('type')}] {item.get('title')}: {item.get('body')}" for item in plan["attention"]
        ]
        parts.append("attention items:\n" + "\n".join(attention_lines))
    section_lines = []
    for index, section in enumerate(plan.get("sections", []), start=1):
        section_lines.append(f"{index}. {section.get('title')} — {section.get('summary')}")
        for file_plan in section.get("files", []):
            file_entry = files_by_id.get(file_plan.get("file_id"), {})
            section_lines.append(f"   - {file_entry.get('path', file_plan.get('file_id'))}: {file_plan.get('note', '')}")
            for focus in file_plan.get("focus", []):
                if focus.get("reason"):
                    section_lines.append(f"     * focus: {focus['reason']}")
    if section_lines:
        parts.append("reading sections:\n" + "\n".join(section_lines))
    if plan.get("omitted_files"):
        parts.append(
            "files omitted from the reading view:\n"
            + "\n".join(
                f"- {files_by_id.get(item.get('file_id'), {}).get('path', item.get('file_id'))}: {item.get('reason')}"
                for item in plan["omitted_files"]
            )
        )
    changed = [
        f"- {entry['path']} ({entry['status']}, +{entry['additions']}/-{entry['deletions']})"
        for entry in review.get("files", [])
    ]
    if changed:
        parts.append("changed files in this diff (readable via read_diff):\n" + "\n".join(changed))
    if plan.get("verification"):
        verification_lines = [f"- {item.get('status')}: {item.get('name')}" for item in plan["verification"]]
        parts.append("verification evidence:\n" + "\n".join(verification_lines))
    coverage = review.get("coverage", {})
    parts.append(
        f"coverage: {coverage.get('status')} (files {coverage.get('reviewed_files')}/{coverage.get('total_files')})"
    )
    return "\n\n".join(parts)


def build_system_prompt(config: ChatConfig) -> str:
    return "\n\n".join(
        [
            "You are the Easy Review assistant embedded in a local code-review page. "
            "Answer questions about this change and the surrounding repository. "
            "Default to Korean unless the user writes in another language.",
            "## Response style (always follow)\n"
            "- 항상 간결하게: 핵심 결론을 먼저, 기본 3~6문장 또는 짧은 목록 하나 안으로 답한다.\n"
            "- 기술 용어 대신 쉬운 말을 쓰고, 꾸미는 말·반복·서론·맺음말을 뺌다.\n"
            "- 제목·구분선·표는 정말 필요할 때만 최소로 쓴다.\n"
            "- 근거는 `파일경로:줄번호` 한 줄이면 충분하다.\n"
            "- 사용자가 '자세히'를 요청할 때만 길게 설명한다.",
            "## Tool policy\n"
            "- 아래 '리뷰 컨텍스트'로 답할 수 있으면 도구 호출 없이 즉시 답한다. 용어·배경·구조·주의사항 질문은 대부분 여기서 끝난다.\n"
            "- 이 리뷰의 실제 변경 코드는 read_diff 도구에 있다. 변경 내용 질문은 read_diff를 가장 먼저 쓴다. 로컬 체크아웃에는 이 변경이 반영되어 있지 않을 수 있으므로, 변경 코드를 list_dir/search_code로 찾지 않는다.\n"
            "- read_file/list_dir/search_code는 변경 밖의 기존 코드를 확인할 때만, 꼭 필요한 최소 횟수로 쓴다.",
            "## Honesty\n"
            "Be concrete: cite file paths and line numbers you actually inspected. "
            "If you have not verified something, say so plainly — in one short sentence. "
            "Never claim to have run tests or modified files — you cannot.",
            "## Review context\n" + review_digest(config.bundle),
            "## Repository state (local checkout)\n" + git_context(config.repo),
            "## Repository layout (tracked files)\n" + repo_tree_text(config.repo),
        ]
    )


def call_model(
    config: ChatConfig, messages: list[dict[str, Any]], model: str, *, with_pdf: bool = False
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "tools": TOOL_SCHEMAS,
        "tool_choice": "auto",
        "max_tokens": 4096,
    }
    if with_pdf:
        engine = os.environ.get("EASY_REVIEW_PDF_ENGINE") or "pdf-text"
        payload["plugins"] = [{"id": "file-parser", "pdf": {"engine": engine}}]
    request = urllib.request.Request(
        config.base_url + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}",
            "HTTP-Referer": "https://localhost/easy-review",
            "X-Title": "Easy Review",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:600]
        raise ChatServerError(f"model endpoint returned {error.code}: {detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise ChatServerError(f"cannot reach model endpoint: {error}") from error
    try:
        return body["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as error:
        raise ChatServerError(f"unexpected model response shape: {json.dumps(body)[:400]}") from error


def append_chat_log(config: ChatConfig, session: str, record: dict[str, Any]) -> None:
    record = {"ts": datetime.now(timezone.utc).isoformat(), **record}
    log_path = config.bundle / "chat" / f"{session}.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with config.log_lock:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def run_chat_turn(
    config: ChatConfig,
    session: str,
    history: list[dict[str, Any]],
    emit: Callable[[dict[str, Any]], None],
    model: str,
) -> None:
    recent = history[-MAX_HISTORY_MESSAGES:]
    messages: list[dict[str, Any]] = [{"role": "system", "content": build_system_prompt(config)}]
    messages.extend(to_model_message(item) for item in recent)
    with_pdf = history_has_pdf(recent)
    for _ in range(MAX_TOOL_ROUNDS):
        emit({"type": "status", "text": "모델 응답을 기다리는 중"})
        message = call_model(config, messages, model, with_pdf=with_pdf)
        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            answer = message.get("content") or "(빈 응답)"
            append_chat_log(config, session, {"role": "assistant", "content": answer, "model": model})
            emit({"type": "answer", "text": answer})
            return
        messages.append({"role": "assistant", "content": message.get("content"), "tool_calls": tool_calls})
        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            name = function.get("name", "")
            try:
                arguments = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = {}
            emit({"type": "tool", "name": name, "args": arguments})
            try:
                if name == "read_diff":
                    result = tool_read_diff(config, arguments)
                elif name in TOOLS:
                    result = TOOLS[name](config.repo, arguments)
                else:
                    result = f"unknown tool: {name}"
            except (ChatServerError, ValueError, OSError, KeyError) as error:
                result = f"tool error: {error}"
            append_chat_log(config, session, {"role": "tool", "name": name, "args": arguments, "result_chars": len(result)})
            messages.append({"role": "tool", "tool_call_id": tool_call.get("id", ""), "content": result})
    emit({"type": "error", "text": "도구 호출 한도를 초과했습니다. 질문을 더 좁혀서 다시 시도해 주세요."})


class ChatRequestHandler(BaseHTTPRequestHandler):
    config: ChatConfig
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def send_payload(self, status: int, content_type: str, payload: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, value: dict[str, Any]) -> None:
        self.send_payload(status, "application/json; charset=utf-8", json.dumps(value, ensure_ascii=False).encode("utf-8"))

    @staticmethod
    def is_loopback_host(value: str) -> bool:
        host = value.strip().lower()
        if host.startswith("["):
            host = host.partition("]")[0].lstrip("[")
        elif host.count(":") == 1:
            host = host.partition(":")[0]
        return host in ALLOWED_HOSTS

    def loopback_request(self) -> bool:
        if not self.is_loopback_host(self.headers.get("Host") or ""):
            return False
        origin = self.headers.get("Origin")
        return not origin or self.is_loopback_host(origin.split("://", 1)[-1])

    def do_GET(self) -> None:
        if not self.loopback_request():
            self.send_json(403, {"ok": False, "error": "loopback requests only"})
            return
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            self.send_json(
                200,
                {
                    "ok": True,
                    "model": self.config.model,
                    "models": self.config.models,
                    "has_key": bool(self.config.api_key),
                    "repo_root": str(self.config.repo),
                    "branch": run_git(self.config.repo, "rev-parse", "--abbrev-ref", "HEAD").strip(),
                },
            )
            return
        if path == "/vendor/deep-chat.js":
            vendor_path = ASSETS_DIR / "vendor" / "deep-chat.js"
            if vendor_path.is_file():
                self.send_payload(200, "text/javascript; charset=utf-8", vendor_path.read_bytes())
            else:
                self.send_json(404, {"ok": False, "error": "deep-chat bundle is missing"})
            return
        static = STATIC_FILES.get(path)
        if static is None:
            self.send_json(404, {"ok": False, "error": "not found"})
            return
        file_path = self.config.bundle / static[0]
        if not file_path.is_file():
            self.send_json(404, {"ok": False, "error": f"{static[0]} is missing; run compile first"})
            return
        self.send_payload(200, static[1], file_path.read_bytes())

    def do_POST(self) -> None:
        if not self.loopback_request():
            self.send_json(403, {"ok": False, "error": "loopback requests only"})
            return
        if self.path.split("?", 1)[0] != "/api/chat":
            self.send_json(404, {"ok": False, "error": "not found"})
            return
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            self.send_json(415, {"ok": False, "error": "application/json required"})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = -1
        if not 0 < length <= MAX_REQUEST_BYTES:
            self.send_json(413, {"ok": False, "error": f"request body must be 1..{MAX_REQUEST_BYTES} bytes"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            session = body["session"]
            history = body["messages"]
            if not SESSION_RE.match(session) or not isinstance(history, list) or len(history) > MAX_HISTORY_ITEMS:
                raise ValueError("invalid session or messages")
            clean_history = []
            for item in history:
                if item.get("role") not in {"user", "assistant"} or not isinstance(item.get("content"), str):
                    raise ValueError("history items must be user/assistant text messages")
                clean_item: dict[str, Any] = {"role": item["role"], "content": item["content"]}
                attachments = validate_attachments(item.get("attachments")) if item["role"] == "user" else []
                if attachments:
                    clean_item["attachments"] = attachments
                clean_history.append(clean_item)
            last = clean_history[-1] if clean_history else {}
            if last.get("role") != "user" or (not last.get("content", "").strip() and not last.get("attachments")):
                raise ValueError("last message must come from the user with text or attachments")
            model = body.get("model") or self.config.model
            if not isinstance(model, str) or not MODEL_ID_RE.match(model) or model not in self.config.models:
                raise ValueError(f"model is not in the allowed list: {model!r}")
        except (KeyError, ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()

        def emit(event: dict[str, Any]) -> None:
            try:
                self.wfile.write(f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                raise ChatServerError("client disconnected")

        saved = store_attachments(self.config, session, clean_history[-1].get("attachments") or [])
        user_record: dict[str, Any] = {"role": "user", "content": clean_history[-1]["content"]}
        if saved:
            user_record["attachments"] = saved
        append_chat_log(self.config, session, user_record)
        try:
            if not self.config.api_key:
                emit(
                    {
                        "type": "error",
                        "text": "API 키가 없습니다. OPENROUTER_API_KEY(또는 EASY_REVIEW_CHAT_API_KEY)를 설정한 뒤 serve를 다시 실행해 주세요.",
                    }
                )
            else:
                run_chat_turn(self.config, session, clean_history, emit, model)
        except ChatServerError as error:
            try:
                emit({"type": "error", "text": str(error)})
            except ChatServerError:
                return
        try:
            emit({"type": "done"})
        except ChatServerError:
            pass


def serve(bundle: Path, repo: Path, port: int, model: str | None = None) -> None:
    config = ChatConfig(bundle, repo, model)
    handler = type("BoundChatRequestHandler", (ChatRequestHandler,), {"config": config})
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{server.server_address[1]}/review.html"
    server_info = {"url": url, "port": server.server_address[1], "pid": os.getpid(), "model": config.model}
    info_path = bundle / "chat" / "server.json"
    info_path.parent.mkdir(parents=True, exist_ok=True)
    info_path.write_text(json.dumps(server_info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(url, flush=True)
    if not config.api_key:
        print("warning: OPENROUTER_API_KEY is not set; the chat panel will show setup guidance", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
