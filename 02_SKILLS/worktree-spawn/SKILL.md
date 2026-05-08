---
name: worktree-spawn
description: Routes natural-language worktree/pi-session requests through `pi-wt spawn`. Use when the user asks to create, take, open, or start a repo worktree with a new Pi session, especially Korean requests like "워크트리 따서 파이세션 열어줘", "product 작업 시작하게 새 pi 세션 열어줘", or "Ghostty에서 pi 띄워줘".
---

# Worktree Spawn

Use this skill when the user wants a new repository worktree and a Pi session opened from natural language.

## Contract

Natural-language worktree session requests **must** route through `pi-wt spawn`.

Do not hand-roll the workflow. `pi-wt spawn` is the source of truth for:
- city-slug worktree naming (`<city>-vN`),
- git worktree creation,
- Ghostty launch,
- starting `pi` inside the new worktree.

## Trigger Phrases

Use this skill for requests like:

- `내 product 레포 워크트리 따서 pi 세션 열어줘`
- `product 레포 새 워크트리 만들고 Ghostty에서 pi 띄워줘`
- `product 작업 시작하게 새 pi 세션 하나 열어줘`
- `product 레포 spawn 해줘`
- `워크트리 하나 따서 파이 열어줘`
- `새 작업 세션 열어줘` when the target repo is clear from context

## Required Procedure

1. Resolve the target repo.
   - If the user provides an absolute path, use it.
   - If the user provides an alias such as `product`, read `CONTEXT.md` and use the `Repo aliases` table.
   - If no repo is specified and the current working directory is inside a git repo, use the current repo.
   - If the target repo is ambiguous, ask one clarifying question. Do not guess.
2. Run exactly one spawn command:

   ```bash
   pi-wt spawn <resolved-repo-path>
   ```

   If using the current repo with no explicit path is intended, this is also valid:

   ```bash
   pi-wt spawn
   ```

3. Confirm the command output contains both:
   - `slug=<city>-vN`
   - `path=<absolute-worktree-path>`
4. Report only the useful result:
   - slug,
   - worktree path,
   - that Ghostty opened a Pi session.

## Hard Prohibitions

Do **not** do any of these for this request type:

- Do not call `git worktree add` directly.
- Do not invent timestamp names such as `pi-session-YYYYMMDD-HHMMSS`.
- Do not use `osascript tell application "Terminal"`.
- Do not open Terminal.app.
- Do not run `cd <worktree> && pi` in a manually created shell.
- Do not use `pi-wt new` plus `pi-wt-here` for this workflow.
- Do not involve `pi-conductor`; it is not part of this workflow.

If you accidentally produce a `pi-session-*` worktree or open Terminal.app, treat it as a routing failure and tell the user clearly.

## Output Pattern

After success, say something like:

```text
열었어요.
- slug: seoul-v1
- worktree: /Users/bohyeon/pi/workspaces/product/seoul-v1
- Ghostty 새 윈도우에서 pi가 실행 중입니다.
```

Keep it short. Do not add unrelated next steps unless the user asks.

## Failure Handling

- `alias_unresolved=...`: tell the user the alias is missing from `CONTEXT.md` `Repo aliases`.
- `Ghostty.app not installed`: tell the user Ghostty is required for this workflow.
- `no available city name`: suggest pruning old worktrees with `pi-wt prune` or deleting unused worktrees.
- `not inside a git repository`: ask for the target repo path or alias.

## Verification Signal

A correct execution has these properties:

- The worktree basename matches `^[a-z-]+-v[0-9]+$`.
- The output includes `slug=` and `path=` lines.
- The path is under `$PI_WT_ROOT/<repo>/` (default `~/pi/workspaces/<repo>/`).
- The terminal application used by the workflow is Ghostty, not Terminal.app.
