<!-- Standardized PR template: intent + outcome + Linear link = the SOC 2 evidence chain. -->

## Linear ticket

Closes <!-- ABC-123 (required: every PR links a ticket) -->

## Intent

<!-- WHAT this change is meant to do and WHY. One or two sentences. -->

## Desired outcome

<!-- The observable result once merged. How a reviewer confirms it. -->

## Checklist

- [ ] `mise run ci` passes locally
- [ ] Linked to a Linear ticket
- [ ] No generated artifacts hand-edited
- [ ] For a bug fix: a test reproduces it, fails before, passes after (TDD doctrine)
