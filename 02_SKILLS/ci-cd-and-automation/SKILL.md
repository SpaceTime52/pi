---
name: ci-cd-and-automation
description: Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. Use when you need to automate quality gates, configure test runners in CI, or establish deployment strategies.
---

# CI/CD and Automation

## Overview

Automate quality gates so that no change reaches production without passing the project's relevant verification steps: tests, static analysis, formatting/linting, packaging/build checks, and any domain-specific validations. CI/CD is the enforcement mechanism for every other skill — it catches what humans and agents miss, and it does so consistently on every single change.

**Shift Left:** Catch problems as early in the pipeline as possible. A bug caught in linting costs minutes; the same bug caught in production costs hours. Move checks upstream — static analysis before tests, tests before staging, staging before production.

**Faster is Safer:** Smaller batches and more frequent releases reduce risk, not increase it. A deployment with 3 changes is easier to debug than one with 30. Frequent releases build confidence in the release process itself.

## When to Use

- Setting up a new project's CI pipeline
- Adding or modifying automated checks
- Configuring deployment pipelines
- When a change should trigger automated verification
- Debugging CI failures

## The Quality Gate Pipeline

Every change goes through these gates before merge:

```
Pull Request Opened
    │
    ▼
┌─────────────────────┐
│   STYLE CHECK        │  lint / format / schema validation
│   ↓ pass             │
│   STATIC ANALYSIS    │  typecheck / compile-check / linters
│   ↓ pass             │
│   AUTOMATED TESTS    │  unit / integration / contract tests
│   ↓ pass             │
│   BUILD / PACKAGE    │  artifact or release validation
│   ↓ pass             │
│   ENVIRONMENT TESTS  │  service / database / browser checks
│   ↓ pass             │
│   SECURITY AUDIT     │  dependency / policy / secret scans
│   ↓ pass             │
│   SIZE / PERF BUDGET │  optional artifact or runtime budgets
└─────────────────────┘
    │
    ▼
  Ready for review
```

**No gate can be skipped.** If lint fails, fix lint — don't disable the rule. If a test fails, fix the code — don't skip the test.

## CI Configuration Example

### Basic CI Pipeline

Use your CI provider's syntax, but keep the stages explicit and technology-agnostic:

```text
CI workflow:
- trigger on changes to the main integration branch and change-review events
- checkout source
- setup runtime/tooling for the project
- run [project install command]
- run [project lint/format command]
- run [project static-analysis/typecheck command]
- run [project test command]
- run [project build/package command]
- run [project dependency audit command]
```

### With Service or Datastore Integration Tests

```text
Integration job:
- provision the required service or datastore
- inject provider-managed test credentials
- run [project service setup or migration command]
- run [project integration test command]
```

> **Note:** Even for CI-only environments, use the CI provider's secret-management system rather than hardcoding credentials. This builds good habits and prevents accidental credential reuse.

### End-to-End or System Tests

```text
System-test job:
- checkout source
- setup runtime/tooling
- run [project install command]
- run [project browser/system test setup command]
- run [project build/package command]
- run [project end-to-end test command]
- upload failure artifacts (screenshots, traces, logs) if the provider supports it
```

## Feeding CI Failures Back to Agents

The power of CI with AI agents is the feedback loop. When CI fails:

```
CI fails
    │
    ▼
Copy the failure output
    │
    ▼
Feed it to the agent:
"The CI pipeline failed with this error:
[paste specific error]
Fix the issue and verify locally before pushing again."
    │
    ▼
Agent fixes → pushes → CI runs again
```

**Key patterns:**

```
Lint failure → Agent runs `[project lint/format command]` and commits
Type error  → Agent reads the error location and fixes the type
Test failure → Agent follows debugging-and-error-recovery skill
Build error → Agent checks config and dependencies
```

## Deployment Strategies

### Preview Deployments

When the platform supports it, create preview environments for human verification before production release:

```text
Preview deployment job:
- checkout source
- setup runtime/tooling
- run [project preview deployment command]
```

### Feature Flags

Feature flags decouple deployment from release. Deploy incomplete or risky features behind flags so you can:

- **Ship code without enabling it.** Merge to main early, enable when ready.
- **Roll back without redeploying.** Disable the flag instead of reverting code.
- **Canary new features.** Enable for 1% of users, then 10%, then 100%.
- **Run A/B tests.** Compare behavior with and without the feature.

```text
Simple feature flag pattern:
if feature_flag("new-checkout-flow", context):
  use new behavior
else:
  use existing behavior
```

**Flag lifecycle:** Create → Enable for testing → Canary → Full rollout → Remove the flag and dead code. Flags that live forever become technical debt — set a cleanup date when you create them.

### Staged Rollouts

```
Change merged to the default integration branch
    │
    ▼
  Staging deployment (auto)
    │ Manual verification
    ▼
  Production deployment (manual trigger or auto after staging)
    │
    ▼
  Monitor for errors (15-minute window)
    │
    ├── Errors detected → Rollback
    └── Clean → Done
```

### Rollback Plan

Every deployment should be reversible:

```text
Rollback workflow:
- manual trigger provides a target release identifier
- run [project rollback command using target-version]
- verify recovery before resuming rollout
```

## Environment Management

```
example config      → Committed template for developers
local secret config → NOT committed
CI secrets          → Stored in the CI provider's secret manager / vault
Production secrets  → Stored in the deployment platform or secret manager
```

CI should never have production secrets. Use separate secrets for CI testing.

## Automation Beyond CI

### Automated Dependency Updates

Use the project's dependency-update tooling or platform automation to keep dependencies current on a predictable schedule.

### Build Cop Role

Designate someone responsible for keeping CI green. When the build breaks, the Build Cop's job is to fix or revert — not the person whose change caused the break. This prevents broken builds from accumulating while everyone assumes someone else will fix it.

### PR Checks

- **Required reviews:** Use the project's chosen approval policy
- **Required status checks:** CI must pass before merge
- **Branch protection:** Protect the default integration branch from unsafe updates
- **Auto-merge:** If all checks pass and approval policy is satisfied, merge automatically

## CI Optimization

When the pipeline exceeds 10 minutes, apply these strategies in order of impact:

```
Slow CI pipeline?
├── Cache dependencies
│   └── Use the CI provider's caching mechanism for dependency downloads or build artifacts
├── Run jobs in parallel
│   └── Split lint, typecheck, test, build into separate parallel jobs
├── Only run what changed
│   └── Use path filters to skip unrelated jobs (e.g., skip e2e for docs-only PRs)
├── Use matrix builds
│   └── Shard test suites across multiple runners
├── Optimize the test suite
│   └── Remove slow tests from the critical path, run them on a schedule instead
└── Use larger runners
    └── Choose larger hosted runners or self-hosted capacity for CPU-heavy builds
```

**Example: caching and parallelism**
```text
Parallel jobs:
- style job runs lint/format checks
- analysis job runs static analysis or type checks
- test job runs automated tests
- shared dependency or artifact caches reduce repeated setup work
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "CI is too slow" | Optimize the pipeline (see CI Optimization below), don't skip it. A 5-minute pipeline prevents hours of debugging. |
| "This change is trivial, skip CI" | Trivial changes break builds. CI is fast for trivial changes anyway. |
| "The test is flaky, just re-run" | Flaky tests mask real bugs and waste everyone's time. Fix the flakiness. |
| "We'll add CI later" | Projects without CI accumulate broken states. Set it up on day one. |
| "Manual testing is enough" | Manual testing doesn't scale and isn't repeatable. Automate what you can. |

## Red Flags

- No CI pipeline in the project
- CI failures ignored or silenced
- Tests disabled in CI to make the pipeline pass
- Production deploys without staging verification
- No rollback mechanism
- Secrets stored in code or CI config files (not secrets manager)
- Long CI times with no optimization effort

## Verification

After setting up or modifying CI:

- [ ] All quality gates are present (lint, types, tests, build, audit)
- [ ] Pipeline runs on every change-review event and every push to the default integration branch
- [ ] Failures block merge (branch protection configured)
- [ ] CI results feed back into the development loop
- [ ] Secrets are stored in the secrets manager, not in code
- [ ] Deployment has a rollback mechanism
- [ ] Pipeline runs in under 10 minutes for the test suite
