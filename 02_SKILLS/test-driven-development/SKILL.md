---
name: test-driven-development
description: Drives development with tests. Use when implementing logic, fixing bugs, or changing behavior and you need proof that the system works.
---

# Test-Driven Development

## Overview

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the bug with a test before attempting the fix. Tests are evidence — "seems right" is not done.

## When to Use

- Implementing new behavior
- Fixing a bug
- Changing existing behavior
- Adding edge-case handling
- Protecting a boundary or contract from regression

**When NOT to use:** documentation-only changes or changes with no behavioral effect.

## The TDD Cycle

```
RED       → test fails for the expected reason
GREEN     → minimal implementation makes the test pass
REFACTOR  → improve the implementation while tests stay green
```

## Step 1: RED

Write the smallest test that proves the missing behavior.

```text
Example RED test:
- arrange the input or state
- execute the behavior
- assert the expected observable outcome
- confirm it fails before the fix exists
```

A test that already passes does not prove the missing behavior.

## Step 2: GREEN

Implement the minimum code needed to satisfy the test.

Rules:
- do not generalize early
- do not add extra behavior "while you're here"
- keep the change narrow enough that you know why the test turned green

## Step 3: REFACTOR

Once tests are green, improve clarity and structure without changing behavior.

Typical refactors:
- rename unclear concepts
- remove duplication
- extract helpers
- simplify control flow
- isolate boundaries more cleanly

Run the relevant tests after each meaningful refactor step.

## The Prove-It Pattern for Bug Fixes

When a bug is reported:

```
1. Reproduce the bug with a test
2. Confirm the test fails for the right reason
3. Implement the fix
4. Confirm the test passes
5. Run the broader regression checks
```

Do not start by guessing at a fix. Start by proving the failure.

## Test Levels

Choose the smallest test that gives confidence:

| Level | Best For |
|---|---|
| Unit | Pure logic and local behavior |
| Integration | Boundaries between components, services, data stores, or files |
| System / end-to-end | Critical workflows in the real runtime |

Most tests should be small and fast. Use larger tests for critical paths and boundary confidence, not for everything.

## Writing Good Tests

### Test Outcomes, Not Internals

Prefer:
- returned values
- persistent state changes
- emitted events or outputs
- externally visible side effects

Avoid over-testing internal implementation details unless the interaction itself is the contract.

### Keep Tests Readable

A test should tell a complete story:
- what was arranged
- what happened
- what mattered about the result

Some duplication in tests is acceptable if it makes the scenario easier to read.

### Use Real Code Where Practical

Preference order:
1. real implementation
2. fake implementation
3. stub
4. mock interaction

Mock at boundaries where real dependencies are slow, unsafe, expensive, or non-deterministic.

### One Behavior Per Test

Good:
- rejects empty required fields
- trims surrounding whitespace
- preserves ordering under the requested sort

Bad:
- one giant test covering unrelated cases

## Browser or Runtime Verification

For behavior that depends on a real runtime environment, tests alone may not be enough. If the project has browser- or runtime-inspection tooling configured, use it to verify what the tests cannot see: visible rendering, runtime warnings, interaction timing, or real integration behavior.

Use the related browser-testing skill when the problem is specifically browser-facing.

## Using Subagents for Testing in pi

In pi, subagents can help isolate work such as:
- writing a reproduction test from a bug report
- exploring the smallest failing scenario
- gathering supporting diagnostics while the main agent preserves focus

Keep the responsibility clear: one agent proves the failure, another may implement the fix, and the main workflow verifies the result.

## See Also

For portable testing guidance, see `references/testing-patterns.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll write tests after the code works" | Tests written after the fact often validate the implementation, not the intended behavior. |
| "This is too simple to test" | Simple code becomes non-simple the moment requirements change. |
| "Manual testing is enough" | Manual testing is not durable and does not guard future regressions. |
| "Tests slow me down" | They slow guessing down and speed safe change up. |

## Red Flags

- Behavior changes with no corresponding test coverage
- Bug fixes with no reproduction test
- Tests that only prove an internal call sequence
- Flaky tests that no one trusts
- Huge tests that hide which behavior failed
- Skipped or muted tests used as a release strategy

## Verification

After completing any implementation:

- [ ] New or changed behavior has test coverage at the right level
- [ ] Bug fixes include a reproduction test where practical
- [ ] The relevant tests fail before the fix and pass after it
- [ ] The broader regression suite still passes
- [ ] No tests were skipped or weakened just to make the change pass
