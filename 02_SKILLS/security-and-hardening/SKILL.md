---
name: security-and-hardening
description: Hardens software against vulnerabilities. Use when handling untrusted input, authentication, authorization, secrets, data storage, or external integrations.
---

# Security and Hardening

## Overview

Treat every external input as untrusted, every privilege boundary as important, and every secret as sensitive. Security is not a late-stage checklist — it is a constraint on design, implementation, deployment, and operations.

## When to Use

- Building features that accept user or third-party input
- Implementing authentication, authorization, or role checks
- Handling sensitive data, credentials, or regulated information
- Integrating with external services, callbacks, or webhooks
- Reviewing dependency or supply-chain risk
- Shipping a change that expands the system's attack surface

## Security Workflow

```
1. Identify the trust boundary
2. Validate or sanitize untrusted input at the boundary
3. Enforce authentication and authorization explicitly
4. Protect secrets and sensitive data
5. Verify dependency and configuration safety
6. Confirm logging, monitoring, and failure behavior are safe
7. Re-review before release
```

## Always Do

- Validate untrusted input where it enters the system
- Encode or safely render output for its destination context
- Use the minimum privileges required for users, services, and jobs
- Keep secrets out of source control and logs
- Prefer secure defaults over permissive fallbacks
- Run the project's dependency/security audit and remediation workflow before release

## Ask First

- Changing authentication or identity flows
- Expanding access to sensitive data or privileged operations
- Adding new inbound integrations, callbacks, or uploaded content types
- Relaxing policy, retention, throttling, or exposure boundaries
- Introducing new trust assumptions that are hard to reverse

## Never Do

- Store secrets directly in committed code
- Trust client-side or caller-side validation as the only control
- Return internal-only details in public error messages
- Add a dependency, integration, or permission without understanding its risk
- Turn off a safety control for convenience without an explicit exception process

## Common Security Review Areas

### 1. Input and Boundary Validation

At each boundary, answer:
- What can the caller control?
- What format and limits are allowed?
- What happens when validation fails?
- Does malformed input stop here, or leak deeper into the system?

### 2. Authentication and Authorization

Check that:
- authentication proves identity where required
- authorization proves permission for the specific action
- ownership, tenancy, role, or policy checks are explicit
- denial paths fail safely by default

### 3. Secrets and Sensitive Data

Check that:
- secrets come from the approved secret-management path
- logs and responses exclude sensitive values
- exports, backups, and audit trails follow policy
- sensitive data has the right retention and deletion behavior

### 4. External Integrations

Check that:
- inbound messages are authenticated or otherwise verified
- returned data is validated before affecting logic or rendering
- retries, timeouts, and backoff are explicit
- scopes, permissions, and credentials are minimal

### 5. Dependency and Supply-Chain Risk

Check that:
- new dependencies are justified
- the project's dependency/security audit is clean or explicitly waived with a review date
- the team understands whether a finding is reachable in production
- remediation is documented when a fix cannot be applied immediately

### 6. Failure and Abuse Handling

Check that:
- rate limits, quotas, or throttles exist where abuse is plausible
- suspicious behavior is observable through logs or metrics
- critical failures degrade safely
- destructive operations have guardrails or recovery procedures where needed

## Safe Design Patterns

### Validate at the Boundary

```text
Boundary receives input
→ parse it
→ validate structure, policy, and limits
→ reject invalid input with the standard error contract
→ pass only validated data inward
```

### Least Privilege

```text
Each actor should have only the minimum permissions needed:
- user session
- service account
- background worker
- deployment identity
- support/admin override path
```

### Safe Secret Handling

```text
Use:
- secret manager or vault
- deployment/runtime secret injection
- redaction in logs and telemetry

Avoid:
- hardcoded credentials
- plaintext secrets in docs or examples
- copying secrets into tickets, commits, or screenshots
```

## See Also

For a concise checklist you can apply during review, see `references/security-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's internal, so the risk is low" | Internal systems often become the easiest path to wider compromise. |
| "We'll harden it later" | Security retrofits are slower and riskier than secure defaults from the start. |
| "No one would target this" | Automated scanners and opportunistic abuse target weak links first. |
| "The framework/platform handles that" | Tools help, but they do not remove the need for correct configuration and review. |

## Red Flags

- Untrusted input flowing into logic with no clear validation boundary
- Privileged actions with no explicit authorization check
- Secrets in commits, logs, or sample configuration with real values
- Silent dependency findings with no remediation or review date
- Errors that expose internals to untrusted callers
- No abuse controls where brute force, spam, or overuse is plausible

## Verification

After security-relevant work:

- [ ] Trust boundaries are identified and protected
- [ ] Validation happens at the boundary
- [ ] Authentication and authorization are explicit where required
- [ ] Secrets are handled through the approved path only
- [ ] The project's dependency/security audit has been reviewed
- [ ] Logs, metrics, and failure modes do not leak sensitive data
- [ ] Any remaining risk is documented with a conscious decision
