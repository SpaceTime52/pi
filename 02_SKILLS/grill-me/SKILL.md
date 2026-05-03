---
name: grill-me
description: Interviews the user relentlessly about a plan or design until shared understanding is reached. Use when a request is vague, before writing a PRD, before planning implementation, or when the user says grill me.
---

# Grill Me

Use this skill to align on intent before planning or coding.

## Contract

Interview the user about every important aspect of the idea until there is a shared design concept.

Rules:
- Ask one question at a time.
- For each question, provide your recommended answer and a short rationale.
- Walk the decision tree in dependency order.
- If a question can be answered by inspecting the repository, inspect instead of asking.
- Do not write implementation code during grilling.
- Stop when the remaining uncertainty is either documented as an assumption or explicitly out of scope.

## Question Order

1. Problem and user outcome.
2. Actors, permissions, and workflows.
3. Data, state transitions, and edge cases.
4. Interfaces, API boundaries, and compatibility.
5. Test strategy and verification signals.
6. Rollout, migration, and failure handling.
7. Out-of-scope boundaries.

## Final Output

When aligned, summarize:
- Shared design concept.
- Decisions made.
- Assumptions.
- Open questions.
- Recommended next step: `to-prd`, `to-tasks`, prototype, or stop.
