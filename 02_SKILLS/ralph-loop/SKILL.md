---
name: ralph-loop
description: Runs or supervises a Ralph-style AFK loop over a Pi Task DAG. Use when pending AFK tasks with agentType should be executed autonomously with validation, fresh review, and blocker handling.
---

# Ralph Loop

A Ralph loop repeatedly moves a task graph closer to done using fresh-context agents and objective-first review.

## Preconditions

Before running:
- A Task DAG exists (`TaskList` shows tasks).
- AFK tasks have `agentType`, usually `afk-implementer`.
- Dependencies are represented with `blockedBy`.
- HITL tasks are clearly marked and have no `agentType` unless intentionally delegated.

If no task graph exists, run `to-tasks` first.

## Loop

1. Call `TaskList`.
2. Select pending tasks that:
   - are not blocked,
   - have `agentType`,
   - are safe to run AFK.
3. Start small:
   - one task for high-risk foundation work,
   - otherwise a small non-conflicting batch.
4. Call `TaskExecute` with stable task IDs.
5. Use `TaskOutput` with stable task IDs to wait for completion.
6. Review results:
   - run focused checks yourself when possible,
   - use `fresh-reviewer` for non-trivial diffs or branch outputs,
   - create follow-up tasks for required review findings.
7. If a task is blocked, keep it open or create a HITL blocker task.
8. Repeat until no unblocked AFK tasks remain.

## Additional Context Template

Pass this style of `additional_context` to `TaskExecute`:

```text
Complete only this task. Use TDD where practical. Work in thin vertical slices.
Run focused verification before reporting done. If blocked, report BLOCKED with evidence.
Do not broaden scope. Summarize files changed, tests run, and residual risks.
```

## Stop Conditions

Stop and report when:
- All AFK tasks are complete.
- Only HITL/blocker tasks remain.
- A validation command fails and the cause is outside the task.
- Repeated iterations produce no meaningful progress.
- The user-set iteration/time budget is reached.

## Safety Rules

- Do not merge, deploy, force-push, or run production writes without explicit user approval.
- Prefer worktree-isolated agents for implementation.
- Do not mark a task complete if acceptance criteria are unverified.
- When `TaskExecute` auto-completes a task but fresh review finds required fixes, create a new follow-up task that blocks shipping.
