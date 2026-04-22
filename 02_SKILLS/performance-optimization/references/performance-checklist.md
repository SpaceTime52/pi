# Performance Review Checklist

Use this checklist when reviewing performance-sensitive changes. Adapt thresholds and commands to the project's actual runtime and performance goals.

## 1. Start With Evidence

- [ ] A baseline measurement exists before optimization
- [ ] The team knows which user-visible or system-visible symptom is being improved
- [ ] The proposed fix targets a measured bottleneck, not a guess
- [ ] Before/after measurements are captured in a comparable environment

## 2. Clarify the Performance Goal

Examples of valid goals:
- [ ] Response latency stays within the project's SLO/SLA
- [ ] Throughput or concurrency target is preserved
- [ ] Startup, build, or command runtime stays within budget
- [ ] Memory, CPU, storage, or network usage stays within budget
- [ ] User-visible interactions remain responsive on representative hardware

## 3. Check Common Bottleneck Classes

### Compute
- [ ] No avoidable repeated work in hot paths
- [ ] Expensive operations are bounded, cached, or moved off the critical path
- [ ] Large loops or recursive work have clear complexity bounds

### Data Access
- [ ] No repeated per-item fetches when batched retrieval is possible
- [ ] Queries, lookups, or scans are proportional to the actual need
- [ ] Large result sets are paginated, streamed, chunked, or otherwise bounded

### I/O and Networking
- [ ] Requests to external systems are minimized and de-duplicated
- [ ] Timeouts, retries, and backoff exist where appropriate
- [ ] Large payloads are avoided, compressed, or transferred incrementally when useful

### Memory
- [ ] Caches have size limits, TTLs, or eviction policies
- [ ] Large objects, buffers, or collections are not retained unnecessarily
- [ ] No obvious leak patterns (unbounded maps, listeners, references, queues)

### User-Facing Rendering / Interaction
- [ ] Visible state changes are responsive on representative devices
- [ ] Expensive rendering, layout, or redraw work is not repeated unnecessarily
- [ ] Large lists, tables, or trees are windowed, paginated, or incrementally rendered when needed
- [ ] Images, media, or large assets are sized appropriately for the usage context

## 4. Verify Operational Budgets

Define and review the budgets that matter for this project, for example:
- [ ] p50/p95/p99 latency budget
- [ ] CPU budget under expected load
- [ ] Memory ceiling under steady state
- [ ] Storage growth budget
- [ ] Network egress budget
- [ ] Interactive/rendering budget for user-facing software

## 5. Review the Fix Quality

- [ ] The optimization does not reduce correctness or resilience
- [ ] The change does not trade a small gain for large complexity
- [ ] The optimization is documented if it is non-obvious
- [ ] The behavior under failure, retry, and overload remains acceptable

## 6. Regression Guards

- [ ] The project has a repeatable way to rerun the measurement
- [ ] Monitoring, benchmarks, profiling steps, or smoke checks are updated if needed
- [ ] Alerts or dashboards cover the metric that regressed before
- [ ] A reviewer can understand how to detect regression in the future

## 7. Anti-Patterns to Flag

- [ ] Optimization without measurement
- [ ] Premature caching with no invalidation strategy
- [ ] Unbounded queues, caches, result sets, or retries
- [ ] Excessive parallelism that shifts pressure elsewhere
- [ ] Large assets or payloads sent where small ones would work
- [ ] A complex optimization with no measurable benefit

## 8. Review Summary Template

```markdown
## Performance Review Summary
- Symptom: [what was slow or expensive]
- Baseline: [before measurement]
- Bottleneck: [what actually caused it]
- Change: [what was optimized]
- Result: [after measurement]
- Remaining risks: [what still needs watching]
```
