---
name: to-tasks
description: Converts a PRD, plan, or aligned conversation into a Pi Task DAG using tracer-bullet vertical slices. Use when work should become TaskCreate/TaskUpdate items for humans and subagents.
---

# To Tasks

Convert a destination document into an executable Pi task graph.

## Process

1. Gather source material from the conversation, PRD, issue, or spec.
2. Explore relevant code only enough to understand layers, seams, and verification commands.
3. Draft tracer-bullet vertical slices.
4. Classify each slice as `AFK` or `HITL`.
5. Present the draft DAG to the user for approval.
6. After approval, materialize tasks using `TaskCreate` and dependency edges using `TaskUpdate`.

## Vertical Slice Rules

A good task:
- Crosses the minimum necessary layers end to end.
- Is demoable or verifiable by itself.
- Has 1-3 acceptance criteria.
- Has a focused verification command or manual check.
- Is small enough for one fresh agent session.

Avoid horizontal tasks like:
- "Add all database schema"
- "Build all API endpoints"
- "Create all UI"

Prefer:
- "User can complete one lesson and see points on dashboard"
- "Operator can retry one failed sync and see status"

## HITL vs AFK

Mark `HITL` when human judgment is required:
- Product behavior or UX taste.
- Architecture trade-off.
- Security, privacy, or compliance decision.
- Production migration or rollout decision.

Mark `AFK` when a coding agent can execute from clear acceptance criteria.
For AFK implementation tasks, set `agentType` to `afk-implementer` when creating the task.

## Draft Format

```markdown
## Proposed Task DAG

1. [AFK] Title
   - Acceptance criteria:
     - ...
   - Verification: `command` or manual check
   - Blocked by: none
   - agentType: afk-implementer

2. [HITL] Title
   - Decision needed: ...
   - Blocked by: 1
```

Ask:
- Is this too coarse or too fine?
- Are blockers correct?
- Should any task be HITL instead of AFK?
- Are acceptance criteria sufficient?

## Materialization Rules

After approval:
1. Call `TaskCreate` for each task in dependency order.
2. Include detailed descriptions and acceptance criteria.
3. Set `agentType: "afk-implementer"` only for AFK tasks.
4. Use `TaskUpdate` with `addBlockedBy` after IDs are known.
5. Call `TaskList` and report the final DAG.

Do not create duplicate tasks if similar tasks already exist.
