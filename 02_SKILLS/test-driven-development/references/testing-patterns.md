# Testing Patterns Reference

Use this reference alongside the `test-driven-development` skill. The examples are framework-neutral on purpose — translate them into the project's actual test runner and assertion style.

## Table of Contents

- [Arrange / Act / Assert](#arrange--act--assert)
- [Test Naming](#test-naming)
- [Assertions](#assertions)
- [Test Doubles](#test-doubles)
- [Boundary Testing](#boundary-testing)
- [System / Browser Testing](#system--browser-testing)
- [Anti-Patterns](#anti-patterns)

## Arrange / Act / Assert

```text
test "describes expected behavior":
  arrange: build the scenario and inputs
  act: perform the behavior under test
  assert: verify the observable outcome
```

## Test Naming

Good names describe behavior, not implementation details.

```text
[unit or component] [expected behavior] [condition]

Examples:
- creates a record with default status
- rejects an empty required field
- trims surrounding whitespace before saving
- returns results in descending timestamp order
```

## Assertions

Prefer assertions about observable outcomes:

- returned value or emitted output
- stored state after an operation
- externally visible side effects
- structured error shape and message
- ordering, filtering, or deduplication behavior

Avoid asserting on internal call sequences unless the interaction itself is the contract.

## Test Doubles

Use the lightest double that preserves confidence:

1. Real implementation
2. Fake implementation (in-memory store, fake clock, fake queue)
3. Stub (returns canned values)
4. Mock (verifies interaction) — use sparingly

Mock only at boundaries where real dependencies are slow, costly, non-deterministic, or unsafe.

## Boundary Testing

When code crosses a boundary, test the contract at that boundary:

- parsing and validation of untrusted input
- database or persistence behavior
- file system behavior
- external service integration
- background job scheduling
- CLI or API input/output

Example pattern:

```text
test "rejects invalid input at the boundary":
  arrange: malformed input payload
  act: invoke the boundary handler
  assert: validation fails with the expected error
```

## System / Browser Testing

For user-visible or multi-component behavior, validate the full flow in the real runtime.

```text
Scenario: user completes the primary workflow
1. Start the system in a representative environment
2. Exercise the workflow the way a real user or caller would
3. Verify the visible or externally observable outcome
4. Check errors, logs, or diagnostics if the flow fails
```

Use browser/runtime inspection tools when needed, but keep the testing principle independent of any specific framework.

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|---|---|---|
| Testing implementation details | Breaks on safe refactors | Test inputs, outputs, and observable effects |
| Shared mutable test state | Tests pollute each other | Create fresh state per test |
| Snapshotting everything | Large diffs nobody reviews | Assert on the fields and behaviors that matter |
| Over-mocking | Tests pass while production breaks | Prefer real code or simple fakes |
| One huge test for many behaviors | Hard to diagnose failures | One behavior or concept per test |
| Flaky timing assumptions | Erodes trust in the suite | Control time, isolate state, make assertions deterministic |

## Review Summary Template

```markdown
## Test Review Summary
- Behavior under test: [what is being proven]
- Test level: [unit / integration / system]
- Boundary covered: [if any]
- Main risk guarded: [regression, edge case, contract]
- Gaps: [what is still untested]
```
