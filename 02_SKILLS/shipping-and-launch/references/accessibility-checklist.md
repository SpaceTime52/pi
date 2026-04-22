# Accessibility Checklist

Use this checklist for any user-facing interface. Adapt it to the product's actual interaction model, input methods, and compliance requirements.

## 1. Structure and Semantics

- [ ] Headings, landmarks, and regions reflect the page or screen structure
- [ ] Interactive controls use the correct semantic element or an equivalent accessible pattern
- [ ] Labels, descriptions, and help text are associated with the right controls
- [ ] Content order is meaningful when read linearly

## 2. Keyboard and Focus

- [ ] All interactive functionality is available by keyboard
- [ ] Focus order follows visual and logical order
- [ ] Focus remains visible in all states
- [ ] Focus moves intentionally when dialogs, menus, or major state changes occur
- [ ] Keyboard shortcuts do not trap or surprise the user

## 3. Names, Roles, and States

- [ ] Controls have clear accessible names
- [ ] Current state is conveyed programmatically (selected, expanded, checked, disabled, busy, etc.)
- [ ] Error and success states are announced or otherwise exposed accessibly
- [ ] Dynamic updates are perceivable without requiring vision alone

## 4. Text and Visual Presentation

- [ ] Text contrast meets project and accessibility requirements
- [ ] Information is not conveyed by color alone
- [ ] Text can scale without breaking core functionality
- [ ] Layout remains usable at small and large viewport sizes or window sizes
- [ ] Motion, animation, or flashing does not create avoidable barriers

## 5. Forms and Input

- [ ] Every input has a label or equivalent accessible name
- [ ] Validation errors identify the field and the problem clearly
- [ ] Required fields and constraints are communicated before submission where possible
- [ ] Users can review and correct data before destructive or important submission

## 6. Media and Non-Text Content

- [ ] Images, icons, and non-text content have meaningful alternatives when needed
- [ ] Decorative content is hidden from assistive technology where appropriate
- [ ] Audio/video content has the required transcripts, captions, or alternatives

## 7. Testing Expectations

- [ ] The interface is keyboard-tested end to end
- [ ] The interface is checked with at least one accessibility inspection method (manual review, scanner, or assistive technology walkthrough)
- [ ] Empty, loading, error, and success states are reviewed — not just the happy path
- [ ] A reviewer can describe how a non-visual or keyboard-only user completes the main flow

## 8. Common Failures to Flag

- [ ] Clickable non-controls with no keyboard support
- [ ] Missing labels or ambiguous button names
- [ ] Hidden focus, trapped focus, or lost focus after updates
- [ ] Status changes that are visible but not announced
- [ ] Placeholder text used as the only label
- [ ] Tables, lists, trees, or menus with broken semantics

## 9. Review Summary Template

```markdown
## Accessibility Review Summary
- Main flow tested: [what was exercised]
- Input methods checked: [keyboard, screen reader, scanner, etc.]
- Issues found: [list]
- Severity: [blocking / follow-up]
- Follow-up needed: [yes/no]
```
