---
description: Full development lifecycle workflow — from planning through commit
---

# Development Lifecycle Workflow

Two entrypoints cover the full lifecycle. Use `sh-new` to start work and `sh-finish` to ship it.

## `sh-new` — Start Work

Handles planning and implementation in a feedback loop with the user.

### Phase 1: Planning

- Write a structured plan to `PLAN.md` in the repository root.
- Include review and testing perspectives via prompt composition.
- **🚧 GATE: Present the plan and WAIT for explicit user approval.**
  - Do NOT proceed until the user confirms.
  - If the user requests changes, update PLAN.md and re-present.

### Phase 2: Implementation Cycle (loop)

1. **Implement** — Build the next piece of the plan. Create a feature branch if needed: `feature/<short-description>`. Follow router → service → DB layering.
2. **Test** — Run `python -m pytest tests/ -v` after each change. Write tests alongside implementation.
3. **Seek Feedback** — Present what changed and ask the user for feedback. WAIT for response.
4. **Iterate/Fix/Refactor** — Based on feedback, choose the right action:
   - New feedback → iterate
   - Bug or broken behavior → fix (root cause, regression test)
   - Structural problem → refactor (tests must exist first)
5. **Repeat** steps 1-4 until the user is satisfied.

When done, tell the user to run `sh-finish`.

---

## `sh-finish` — Ship It

Executes these steps in order, completing each fully before moving on:

1. **Test** — Run full test suite, check coverage, add tests for uncovered paths.
2. **Document** — Update README, docs/, and code comments as needed.
3. **Commit** — Verify feature branch (NOT main), run ruff + pytest, conventional commit, push, create PR.
4. **Review** — Thorough code review; if issues found, fix and loop back to step 1.
5. **Improve Prompts** — Ralph reviews the session and suggests prompt improvements.

---

## Quick Reference

| Situation | Use |
|---|---|
| New feature or epic | `sh-new` |
| Ready to ship | `sh-finish` |
| Small targeted task | Individual building blocks: `sh-fix`, `sh-iterate`, `sh-refactor`, etc. |
