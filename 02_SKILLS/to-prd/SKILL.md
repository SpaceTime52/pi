---
name: to-prd
description: Synthesizes the current aligned conversation into a product requirements document. Use after grilling or when the user asks to turn context into a PRD.
---

# To PRD

Create a destination document from the current context. Do not restart the grilling session unless essential information is missing.

## Process

1. Review the current conversation, relevant docs, and codebase context.
2. Identify the major modules or seams likely to be touched.
3. Look for deep-module opportunities: simple interfaces hiding meaningful behavior.
4. Ask the user to confirm module/seam direction if it is uncertain.
5. Write the PRD.

## PRD Template

```markdown
# PRD: [Feature]

## Problem Statement
[Problem from the user's or operator's perspective]

## Solution
[The intended user-visible or operator-visible outcome]

## User Stories
1. As a [actor], I want [capability], so that [benefit].

## Implementation Decisions
- Modules or seams to build/modify.
- Interface contracts or API boundaries.
- Data/state decisions.
- Compatibility, migration, or rollout decisions.

Avoid brittle file paths unless they are essential context.

## Testing Decisions
- Behaviors to test.
- Test level: unit, integration, system, browser, or manual.
- Existing test patterns to follow.
- Verification commands when known.

## Out of Scope
- Explicitly excluded behavior, migration, polish, or future work.

## Acceptance Criteria
- [ ] Concrete, verifiable criterion.
- [ ] Concrete, verifiable criterion.
```

## Output Rules

- Use project domain vocabulary from `CONTEXT.md` when available.
- Include negative decisions in Out of Scope.
- Keep the PRD as a planning artifact; do not assume it should live forever in durable docs.
- Next recommended step is usually `to-tasks`.
