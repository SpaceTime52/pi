---
name: grill-with-docs
description: Runs a grilling session against the existing domain language and durable docs. Use before non-trivial code changes when CONTEXT.md, ADRs, or project terminology should be updated.
---

# Grill With Docs

Use this skill when alignment must be grounded in the existing codebase and durable project knowledge.

## Process

1. Inspect existing durable context:
   - `CONTEXT.md` or nearby context files.
   - `CONTEXT-MAP.md` when multiple bounded contexts exist.
   - `docs/adr/` or equivalent architecture decisions.
   - README and relevant source files.
2. Start a grilling session using the `grill-me` rules.
3. Challenge fuzzy or conflicting language immediately.
4. Cross-check claims against code when practical.
5. Update docs inline only when a decision or term is durable.

## Shared Language Rules

When the user uses an overloaded term, ask for the canonical meaning.

Example:
- "Account" could mean billing account, login user, or customer organization.
- Ask which concept is intended before planning files or APIs.

When a term is resolved, record it in `CONTEXT.md` if it is domain language that future humans and agents should reuse.

Suggested format:

```markdown
# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| Materialization cascade | The process that turns draft course structure into filesystem-backed lessons | Use this term instead of "make lessons real" |
```

## ADR Rules

Offer an ADR only when all are true:
- The decision is hard to reverse.
- A future reader would find it surprising without context.
- Real alternatives were considered.

ADR skeleton:

```markdown
# ADR-NNNN: [Decision]

## Status
Accepted

## Context
[Why this decision exists]

## Decision
[What we chose]

## Consequences
[Trade-offs, risks, follow-up]
```

## Anti-Rot Rules

- Do not copy PRDs or task lists into durable docs.
- Do not document implementation details likely to drift.
- Prefer closed tasks/issues for transient planning artifacts.
- Keep `CONTEXT.md` about language and concepts, not everything that happened.
