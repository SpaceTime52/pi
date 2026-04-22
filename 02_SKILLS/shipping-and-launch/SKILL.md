---
name: shipping-and-launch
description: Prepares launches and releases safely. Use when preparing to deploy, release, enable, or roll out a change in a controlled way.
---

# Shipping and Launch

## Overview

Shipping safely means reducing uncertainty before release, limiting blast radius during rollout, and making recovery straightforward if something goes wrong. Smaller, observable, reversible launches are safer than large opaque ones.

## When to Use

- Preparing a deployment or release
- Rolling out a risky or high-impact change
- Enabling a previously hidden capability
- Coordinating a change that affects users, operators, or external systems
- Designing monitoring and rollback plans

## Pre-Launch Checklist

### Quality
- [ ] Relevant tests and verification steps pass
- [ ] Build, packaging, or release validation succeeds
- [ ] The change has been reviewed at the required level
- [ ] Known TODOs that would endanger launch are resolved or explicitly accepted

### Safety
- [ ] No secrets are exposed in code or release artifacts
- [ ] Input, authorization, and boundary checks are in place where required
- [ ] Risky changes have guardrails, feature toggles, staged rollout plans, or recovery steps
- [ ] Data/state changes have a rollback or remediation plan

### Operability
- [ ] Monitoring and alerting cover the changed path
- [ ] Logs and metrics are sufficient to detect failure quickly
- [ ] On-call or responsible owners know the release is happening
- [ ] User or stakeholder communication is prepared if needed

## Rollout Strategy

Prefer the smallest safe blast radius:

```
1. deploy or release to the lowest-risk environment first
2. verify the critical path
3. enable for a small audience or limited scope if possible
4. monitor closely for a defined window
5. expand gradually only if signals remain healthy
```

Useful rollout mechanisms include:
- staged environments
- feature flags
- canary percentages
- account-, tenant-, or region-scoped enablement
- manual approval gates for high-risk changes

## Rollback Strategy

Every significant launch should answer:
- what triggers rollback?
- who decides?
- how fast can rollback happen?
- what state or data needs cleanup or remediation?

Template:

```markdown
## Rollback Plan
- Trigger conditions: [error rate, latency, failed workflow, data corruption risk]
- Action: [disable flag / redeploy previous version / run remediation]
- Data/state considerations: [preserve, repair, replay, or clean up]
- Expected recovery time: [estimate]
```

## Monitoring During Launch

Watch the signals that actually prove success or failure for this change, for example:
- error rate
- latency or throughput
- queue depth or backlog growth
- resource pressure
- user-visible workflow completion
- support volume or incident reports

Do not rely on a single metric when the failure mode could appear elsewhere.

## Communication

For non-trivial launches, define:
- who needs advance notice
- who confirms the rollout is healthy
- who is informed if rollback happens
- what users or downstream teams should expect

## Post-Launch Review

After the rollout window:
- compare actual results to expected success criteria
- record anything surprising
- remove temporary launch-only controls when safe
- create follow-up tasks for residual issues or cleanup

## See Also

For supporting review checklists, see:
- `references/security-checklist.md`
- `references/performance-checklist.md`
- `references/accessibility-checklist.md`

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Monitoring is overhead" | Without monitoring, you discover problems from user complaints instead of signals. |
| "Rollback won't be needed" | The time to design rollback is before the release, not during the incident. |
| "Let's ship everything at once" | Large blast radius makes diagnosis and recovery slower. |
| "We'll clean it up later" | Launch debt becomes operational debt quickly. |

## Red Flags

- No rollback or remediation plan for risky changes
- No clear owner watching the launch
- No defined success or failure signals
- Releasing a change no one can observe in production
- Large irreversible changes with no checkpoint

## Verification

Before marking a launch complete:

- [ ] The rollout completed without crossing failure thresholds
- [ ] Critical workflows remain healthy
- [ ] Monitoring confirms the expected outcome
- [ ] Any incident or rollback decision is documented
- [ ] Follow-up work is captured for anything intentionally deferred
