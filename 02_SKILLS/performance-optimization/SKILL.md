---
name: performance-optimization
description: Optimizes performance based on measurement. Use when performance requirements exist, when you suspect a regression, or when profiling reveals a real bottleneck.
---

# Performance Optimization

## Overview

Measure before optimizing. Performance work without evidence usually adds complexity without improving the thing that actually matters. Start with a baseline, identify the real bottleneck, make the smallest effective change, then measure again.

## When to Use

- Performance requirements exist in the spec or operational targets
- Users or monitoring report slow behavior
- A change appears to have introduced a regression
- The system handles large datasets, high traffic, or expensive workflows
- Resource budgets (latency, CPU, memory, storage, network, rendering) matter

**When NOT to use:** when you have no evidence of a problem and are optimizing based on instinct alone.

## Optimization Workflow

```
1. Measure the current behavior
2. Identify the real bottleneck
3. Fix the narrowest thing that matters
4. Re-measure and compare
5. Add a regression guard if the issue is important
```

## Step 1: Measure

Measure in the environment that matches the problem as closely as possible.

Use whatever is appropriate for the project:
- profiling tools
- timing logs
- tracing
- benchmark suites
- browser/runtime inspection tools
- production telemetry or representative staging telemetry

Record at least:
- the operation being measured
- the baseline result
- the environment and scale
- the threshold or budget you care about

## Step 2: Identify the Bottleneck

Ask where the time or resource usage actually goes:

```
What is slow or expensive?
├── Compute work
│   └── repeated calculations, heavy transforms, expensive algorithms
├── Data access
│   └── repeated fetches, full scans, missing indexes, oversized results
├── Network / I/O
│   └── slow external calls, retries, large payloads, slow storage
├── Rendering / interaction
│   └── heavy redraws, expensive layout, large visual trees, repeated work
└── Memory / resource pressure
    └── leaks, oversized caches, retained data, queue growth
```

Do not fix the symptom until you know which class of bottleneck is responsible.

## Step 3: Fix Common Anti-Patterns

### Repeated Work

```text
Bad:
- recomputing the same expensive result for each request or interaction
- reloading the same reference data repeatedly

Better:
- compute once per needed boundary
- reuse stable results when the inputs are unchanged
- move heavy work off the critical path when possible
```

### Unbounded Data Processing

```text
Bad:
- loading or processing the full dataset when only a subset is needed

Better:
- paginate, stream, batch, chunk, or window the work
```

### N+1 or Per-Item Lookups

```text
Bad:
- one follow-up lookup for every item in a result set

Better:
- batch or join retrieval so related data arrives together
```

### Oversized Artifacts or Payloads

```text
Bad:
- large binaries, payloads, or assets transferred by default

Better:
- send only what is needed for the current path
- compress, split, or defer large optional artifacts
```

### Missing Caching or Expiry Control

```text
Bad:
- expensive reads repeated with no reuse
- caches with no invalidation or size bound

Better:
- cache where reads dominate writes
- define TTL, size limits, and invalidation rules explicitly
```

## Step 4: Verify

After the change:
- run the same measurement again
- compare before vs. after in the same conditions
- confirm the improvement is meaningful
- confirm correctness and stability did not regress

If the improvement is too small to matter, reconsider whether the complexity is worth keeping.

## Performance Budgets

Define the budgets that matter for the project. Examples:
- p95 latency for a key operation
- startup or build time budget
- memory ceiling under steady load
- request throughput target
- maximum artifact size
- acceptable user-visible responsiveness budget

If a budget matters, make it visible in the spec, docs, CI, or dashboards.

## Regression Guards

Add at least one guard for important regressions:
- benchmark or smoke check
- automated profiling step
- dashboard or alert tied to the metric
- review checklist item for high-risk changes

## See Also

For a portable review checklist, see `references/performance-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | Some debt compounds until it is expensive to unwind. Fix proven bottlenecks early. |
| "It's fast on my machine" | Your machine is not the user's environment or the production workload. |
| "This optimization is obvious" | If it wasn't measured, it is still a guess. |
| "A little slowdown doesn't matter" | Repeated small regressions accumulate into real user and operational cost. |

## Red Flags

- Optimization with no baseline measurement
- Large complexity added for tiny or unproven gains
- Unbounded scans, caches, or queues
- Repeated expensive work in hot paths
- No visible way to detect the regression next time

## Verification

After a performance change:

- [ ] A before/after measurement exists
- [ ] The actual bottleneck was identified before fixing
- [ ] The change improved a metric that matters
- [ ] Correctness and reliability still hold
- [ ] A regression guard exists when the path is important
