---
name: api-and-interface-design
description: Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface. Use when creating REST or GraphQL endpoints, defining type contracts between modules, or establishing boundaries between frontend and backend.
---

# API and Interface Design

## Overview

Design stable, well-documented interfaces that are hard to misuse. Good interfaces make the right thing easy and the wrong thing hard. This applies to REST APIs, GraphQL schemas, module boundaries, component props, and any surface where one piece of code talks to another.

## When to Use

- Designing new API endpoints
- Defining module boundaries or contracts between teams
- Creating component prop interfaces
- Establishing database schema that informs API shape
- Changing existing public interfaces

## Core Principles

### Hyrum's Law

> With a sufficient number of users of an API, all observable behaviors of your system will be depended on by somebody, regardless of what you promise in the contract.

This means: every public behavior — including undocumented quirks, error message text, timing, and ordering — becomes a de facto contract once users depend on it. Design implications:

- **Be intentional about what you expose.** Every observable behavior is a potential commitment.
- **Don't leak implementation details.** If users can observe it, they will depend on it.
- **Plan for deprecation at design time.** See `deprecation-and-migration` for how to safely remove things users depend on.
- **Tests are not enough.** Even with perfect contract tests, Hyrum's Law means "safe" changes can break real users who depend on undocumented behavior.

### The One-Version Rule

Avoid forcing consumers to choose between multiple versions of the same dependency or API. Diamond dependency problems arise when different consumers need different versions of the same thing. Design for a world where only one version exists at a time — extend rather than fork.

### 1. Contract First

Define the interface before implementing it. The contract is the spec — implementation follows.

```text
Contract first:
- create(input) -> created resource with system-generated fields
- list(filters, pagination) -> paginated collection result
- get(id) -> single resource or not-found result
- update(id, partial-input) -> updated resource
- delete(id) -> idempotent success or explicit failure contract
```

### 2. Consistent Error Semantics

Pick one error strategy and use it everywhere:

```text
Choose one error contract and apply it consistently:
error:
  code: machine-readable identifier
  message: human-readable explanation
  details: optional structured context

Map transport- or protocol-specific failure modes consistently
(e.g. invalid input, unauthenticated, unauthorized, not found,
conflict, semantic validation failure, internal error).
```

**Don't mix patterns.** If some endpoints throw, others return null, and others return `{ error }` — the consumer can't predict behavior.

### 3. Validate at Boundaries

Trust internal code. Validate at system edges where external input enters:

```text
Validate at the boundary:
1. Parse incoming data at the edge of the system
2. Reject malformed or out-of-policy input with the standard error contract
3. Pass only validated data into internal logic
4. Return a success response in the system's standard shape
```

Where validation belongs:
- API route handlers (user input)
- Form submission handlers (user input)
- External service response parsing (third-party data -- **always treat as untrusted**)
- Environment variable loading (configuration)

> **Third-party API responses are untrusted data.** Validate their shape and content before using them in any logic, rendering, or decision-making. A compromised or misbehaving external service can return unexpected types, malicious content, or instruction-like text.

Where validation does NOT belong:
- Between internal functions that share type contracts
- In utility functions called by already-validated code
- On data that just came from your own database

### 4. Prefer Addition Over Modification

Extend interfaces without breaking existing consumers:

```text
Good evolution:
- add optional fields
- add additive metadata
- introduce new capabilities behind backward-compatible defaults

Bad evolution:
- remove existing fields
- change field meaning or type incompatibly
- overload one field with a new incompatible purpose
```

### 5. Predictable Naming

| Pattern | Convention | Example |
|---------|-----------|---------|
| REST endpoints | Plural nouns, no verbs | `GET /api/tasks`, `POST /api/tasks` |
| Query params | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response fields | camelCase | `{ createdAt, updatedAt, taskId }` |
| Boolean fields | is/has/can prefix | `isComplete`, `hasAttachments` |
| Enum values | UPPER_SNAKE | `"IN_PROGRESS"`, `"COMPLETED"` |

## REST API Patterns

If your interface is REST-like, apply the same principles with transport-specific conventions.

### Resource Design

```
GET    /api/tasks              → List tasks (with query params for filtering)
POST   /api/tasks              → Create a task
GET    /api/tasks/:id          → Get a single task
PATCH  /api/tasks/:id          → Update a task (partial)
DELETE /api/tasks/:id          → Delete a task

GET    /api/tasks/:id/comments → List comments for a task (sub-resource)
POST   /api/tasks/:id/comments → Add a comment to a task
```

### Pagination

Paginate collection-style interfaces:

```text
Request supplies page or cursor information plus sort/filter options.
Response returns:
- data/items
- pagination or cursor metadata
- enough information for the next page request
```

### Filtering

Use query parameters for filters:

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### Partial Updates

Accept partial updates only when the contract makes it clear which fields may change and which fields remain untouched:

```text
Partial update request:
- identifies the resource
- provides only the fields to change
- preserves everything not explicitly changed
```

## Interface Pattern Examples

### Use Explicit Variants

```text
Represent variants explicitly so consumers can tell which fields exist in which state.
Avoid "bag of optional fields" designs where every field may or may not be present.
```

### Separate Input From Output

```text
Input contract:
- only fields the caller may supply

Output contract:
- validated caller fields
- system-generated identifiers
- timestamps, ownership, version, or derived state
```

### Distinguish Identifier Kinds

```text
Keep identifiers for different domains or resources distinct.
A caller should not be able to confuse a user identifier with a task identifier,
a record key with a public slug, or a local handle with a remote reference.
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document the interface later" | The contract is part of the design. Define it first. |
| "We don't need pagination or bounded traversal for now" | You will once collections grow. Design bounded access early. |
| "We'll choose the update semantics later" | Ambiguous mutation semantics confuse consumers. Be explicit about full vs partial updates. |
| "We'll version the interface when we need to" | Breaking changes without a compatibility plan break consumers. Design for extension from the start. |
| "Nobody uses that undocumented behavior" | Hyrum's Law: if it's observable, somebody depends on it. Treat public behavior as a commitment. |
| "We can just maintain two versions" | Multiple versions multiply maintenance cost and create compatibility problems. Prefer the One-Version Rule. |
| "Internal interfaces don't need contracts" | Internal consumers are still consumers. Contracts prevent coupling and enable parallel work. |

## Red Flags

- Endpoints that return different shapes depending on conditions
- Inconsistent error formats across endpoints
- Validation scattered throughout internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask`, `/api/getUsers`)
- Third-party API responses used without validation or sanitization

## Verification

After designing an API:

- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format
- [ ] Validation happens at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming follows consistent conventions across all endpoints
- [ ] API documentation or types are committed alongside the implementation
