---
name: improve-codebase-architecture
description: Finds deep-module refactoring opportunities that improve testability and AI navigability. Use when code feels like a ball of mud, tests are hard to write, or agents struggle to make safe changes.
---

# Improve Codebase Architecture

Use this skill to surface architectural friction before it becomes accelerated AI-generated entropy.

## Vocabulary

- **Module**: anything with an interface and implementation.
- **Interface**: everything a caller must know: type signature, invariants, ordering, errors, config, side effects.
- **Deep module**: simple interface with meaningful behavior behind it.
- **Shallow module**: interface almost as complex as the implementation.
- **Seam**: where a stable interface lets behavior change without editing every caller.
- **Locality**: related behavior and bugs are concentrated in one place.
- **Leverage**: callers get a lot of behavior from a small interface.

## Process

1. Read domain context (`CONTEXT.md`, ADRs, README) if present.
2. Use read-only exploration, preferably with an `architecture-deepener` or `Explore` subagent.
3. Note places where understanding one concept requires bouncing across many small files.
4. Apply the deletion test:
   - If deleting a module makes complexity disappear, it may be pass-through noise.
   - If deleting it spreads complexity to many callers, it was earning its keep.
5. Present candidates before designing interfaces.

## Candidate Format

```markdown
## Candidate: [Name]

Files/modules:
- ...

Current friction:
- ...

Deepening proposal:
- Introduce or reshape [module/seam] so callers use [simple interface].

Testing benefit:
- Behavior can be tested through [interface] instead of mocking internals.

Risks:
- ...
```

## Follow-up

After the user picks a candidate:
- Run a grilling loop on the desired interface.
- Record durable language in `CONTEXT.md` if needed.
- Use `to-tasks` to create a small refactor DAG.
- Keep refactor tasks separate from feature tasks unless the feature is blocked by the seam.
