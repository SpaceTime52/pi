# Ideation Session Examples

These examples show the rhythm of a good ideation session. Focus on the structure: reframing, sharpening questions, varied idea lenses, honest convergence, and an actionable final artifact.

---

## Example 1: Early Concept

**User invokes:** `/skill:idea-refine I want to help small local businesses keep more of their repeat customers`

### Phase 1: Understand & Expand

**Skill response:**

> **How might we** help a small business keep strong direct relationships with repeat customers instead of relying too heavily on intermediaries?

Let me sharpen that:

1. Which problem matters most: discovery, reordering, retention, margin pressure, or customer ownership?
2. Who is the primary user: the business owner, the end customer, or both?
3. What constraints matter most: budget, staffing, technology, time to launch?

**User responds:** "The owner is the primary user. Margin pressure and customer ownership matter most. I want something simple, mostly software, but I care more about adoption than technical sophistication."

**Skill continues:**

Good. That suggests the problem is not "build every capability" — it's "reduce dependency while keeping adoption friction low." Here are several directions:

1. **Retention-first tool:** help businesses keep their best repeat customers engaged directly.
2. **Inversion:** charge the end customer a convenience premium instead of the business paying a large commission.
3. **Constraint removal:** skip the hardest operational layer and solve only the part that preserves margins.
4. **Audience shift:** focus on regular customers rather than acquisition of strangers.
5. **Simplification:** make the whole experience run with near-zero daily management effort.
6. **Combination:** pair a direct channel with lightweight re-engagement automation.

Which directions feel alive versus merely plausible?

### Phase 2: Evaluate & Converge

**User responds:** "The regular-customer and low-management ideas feel strongest."

**Skill response:**

That combination suggests a narrow wedge: **a direct re-engagement tool for existing repeat customers that requires almost no ongoing management.**

Let me stress-test it:

- **User value:** high if the business already has repeat demand and loses margin to intermediaries.
- **Feasibility:** moderate if setup can be made extremely simple.
- **Differentiation:** strongest if it solves one painful repeat behavior extremely well instead of trying to be a full platform.

Big assumptions to surface:
- repeat customers will switch to the new channel if it is easy enough
- business owners will tolerate the initial setup cost
- the narrow workflow delivers enough value before broader features exist

### Phase 3: Sharpen & Ship

```markdown
# [Idea Name]

## Problem Statement
How might we help a small business preserve margin and direct customer relationships with minimal operational overhead?

## Recommended Direction
Start with the smallest workflow that helps repeat customers return directly.

## Key Assumptions to Validate
- [ ] Repeat customers will switch if the friction is low enough
- [ ] Owners will invest initial setup effort
- [ ] The narrow workflow creates measurable economic value

## MVP Scope
- Direct repeat-customer workflow
- Minimal owner setup
- Clear feedback loop on usage

## Not Doing (and Why)
- Broad marketplace features — too wide for the first version
- Heavy operational tooling — increases adoption friction
- Peripheral analytics — useful later, not critical now
```

---

## Example 2: Feature Idea in an Existing Codebase

**User invokes:** `/skill:idea-refine add collaboration to our editor`

### Phase 1: Understand & Expand

**Skill response:**

> **How might we** let multiple people work on the same document naturally, without creating chaos or conflict?

Before proposing solutions:

1. What collaboration pattern matters most: simultaneous editing, review/comments, or turn-taking?
2. How many concurrent users are expected?
3. Is this primarily a sales checkbox, a retention need, or a strategic differentiator?

**User responds:** "Usually 2-5 people. They mostly work in different sections. We keep hearing it's table stakes."

**Skill continues:**

That matters. If it is primarily a checkbox feature, the best direction may be the simplest one that delivers obvious collaborative value quickly.

Possible directions:
1. **Section-level coordination** — visible presence plus conflict avoidance at a coarse level.
2. **Async-first collaboration** — comments, suggestions, and structured review instead of full simultaneous editing.
3. **Presence without editing conflicts** — show who is where, but keep edits scoped and coordinated.
4. **Branch-and-merge collaboration** — independent edits with an explicit merge step.

The sharp question is not "What is the most advanced collaboration model?" but "What is the smallest collaboration model that closes the adoption gap?"

---

## Example 3: Team Process Problem

**User invokes:** `/skill:idea-refine our weekly retrospectives have become stale`

### Phase 1: Understand & Expand

**Skill response:**

> **How might we** make retrospectives produce real improvement instead of ritualized discussion?

A few sharpening questions:
1. Is the main failure poor participation, repetitive conversation, or weak follow-through?
2. How many people actively contribute today?
3. What would a genuinely useful retro produce that the current one does not?

**User responds:** "The action items go nowhere. A few people talk and everyone else watches."

**Skill continues:**

Then the real problem may not be the meeting format — it may be the output system.

Directions:
1. **Fix the output:** only one action item per retro, owned and reviewed next time.
2. **Async-first input:** gather honest feedback before the meeting, then synthesize.
3. **Quiet-voice-first structure:** anonymous input, pair discussion, then group review.
4. **Experiment loop:** every retro output becomes a small measurable experiment.

A likely starting point is a zero-cost experiment: limit the retro to one actionable change and begin the next retro by reviewing whether it actually happened.

---

## What to Notice in These Examples

1. **The restatement changes the frame.** A vague request becomes a sharper problem statement.
2. **Questions diagnose before prescribing.** The goal is to identify the real problem class.
3. **Variations have reasons.** Each direction exists because a specific lens produced it.
4. **The skill has opinions.** It is allowed to push toward the sharpest option.
5. **Phase 2 is honest.** Weak assumptions and complexity are surfaced directly.
6. **The output is actionable.** It ends with things you can validate or build, not vague discussion.
7. **The "Not Doing" list does real work.** Focus is part of the output.
