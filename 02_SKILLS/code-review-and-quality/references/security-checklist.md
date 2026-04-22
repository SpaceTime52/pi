# Security Review Checklist

Use this checklist when reviewing changes that affect trust boundaries, data handling, authentication, authorization, configuration, dependencies, or external integrations.

## 1. Trust Boundaries

- [ ] Every external input is treated as untrusted data
- [ ] Validation happens at the boundary where data enters the system
- [ ] Parsing, decoding, or deserializing untrusted input is constrained and checked
- [ ] Output is encoded or safely rendered for the destination context

## 2. Access Control

- [ ] Authentication is enforced where required
- [ ] Authorization is checked for every protected action or resource
- [ ] Sensitive actions require explicit role, ownership, or policy checks
- [ ] Failure paths deny access safely by default

## 3. Secrets and Sensitive Data

- [ ] No secrets are committed to source control
- [ ] Secrets are loaded from the project's approved secret-management path
- [ ] Sensitive values are not logged, echoed, or exposed in error messages
- [ ] API responses, exports, and telemetry exclude fields that should remain private

## 4. Dependency and Supply-Chain Safety

- [ ] The project's dependency/security audit step has been run
- [ ] New dependencies are justified and reviewed for maintenance, license, and risk
- [ ] High/critical findings are fixed or explicitly documented with a review date
- [ ] Build-time or development-only tooling is not silently promoted into runtime risk

## 5. Data and State Safety

- [ ] Data writes are bounded, validated, and reject malformed or out-of-policy input
- [ ] Destructive operations have guardrails, confirmation, or rollback considerations where needed
- [ ] File uploads, imports, or attachments are checked for type, size, and safety requirements
- [ ] Caches, queues, and background jobs do not bypass authorization or retention rules

## 6. External Integrations

- [ ] Requests to third-party systems use the minimum required permissions and scopes
- [ ] Retry, timeout, and failure handling are explicit
- [ ] Returned data is validated before it affects logic or rendering
- [ ] Webhooks, callbacks, or inbound messages are authenticated or signed where supported

## 7. Operational Hardening

- [ ] Security-relevant configuration is explicit and documented
- [ ] Error responses avoid leaking internals
- [ ] Logging and monitoring make abuse, failure, and access issues observable
- [ ] Rate limits, quotas, throttles, or abuse controls exist where appropriate

## 8. Review Questions

Ask these during review:
- [ ] What is the trust boundary here?
- [ ] What can an attacker or malformed client control?
- [ ] What should happen if validation fails?
- [ ] What should happen if authorization fails?
- [ ] What would the blast radius be if this path were abused?

## 9. Secret-Scanning / Diff Hygiene

Use the project's approved scanning or review workflow. If the project relies on manual checks, verify that staged changes do not contain credentials, keys, or tokens.

## 10. Review Summary Template

```markdown
## Security Review Summary
- Boundary: [where untrusted input or privileged action enters]
- Main risks: [key security concerns]
- Controls present: [validation, authz, secret handling, audit, limits]
- Gaps: [what still needs work]
- Decision: [approve / block / approve with follow-up]
```
