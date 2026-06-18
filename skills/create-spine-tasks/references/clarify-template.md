# Clarify template

Use for **Step A.5 — Clarify (optional)** in the create-spine-tasks skill.  
Output path: `{tasksRoot}/_authoring/{slug}/clarify.md`

**Constraints:** read-only pass on PRD/brief sources; no commits; no file edits outside read targets and the clarify artifact. Clarify informs task slicing in Step B. `spine tasks validate` does **not** require clarify artifacts.

External equivalent: [spec-kit `/speckit.clarify`](https://github.com/github/spec-kit) (see [Path 4](../../docs/adoption/upstream-execution-workflow.md#path-4--spec-kit-optional-upstream) in upstream-execution-workflow).

---

```markdown
# Clarify: {slug}

**Date:** YYYY-MM-DD
**Status:** complete | superseded
**Sources:** (PRD/brief paths reviewed)

## Summary

(1–3 sentences: what was clarified and readiness for decomposition.)

## Open questions

- (unresolved ambiguities needing operator or stakeholder input; None if clear)

## Assumptions

- (working assumptions for slicing until confirmed)

## Resolved decisions

- (decisions made during clarify; include rationale when non-obvious)

## Blockers for decomposition

- (must-resolve items before Step B slice; None if ready)
```

---

## When to skip clarify

- Greenfield with unambiguous PRD and concrete File Scope paths
- Single S/M task with no open requirements questions
- Migrating existing Taskplane packets unchanged
- Prior clarify artifact for the same slug is still `Status: complete`

## When clarify is recommended

- PRD or brief has ambiguous scope, acceptance criteria, or dependencies
- L/XL epics before splitting into waves
- Multiple stakeholders or conflicting requirements in source docs
- Brownfield work where explore findings raised open questions
- Full authoring mode (see SP-291 lean vs full) before checklist and slice

## Linking in CONTEXT.md

Add a row or note:

```markdown
| Clarify: feature-x | 2026-06-18 | complete | spine-tasks/_authoring/feature-x/clarify.md |
```

Or: `Clarify complete: feature-x (2026-06-18) — spine-tasks/_authoring/feature-x/clarify.md`

## Ordering with explore and slice

```text
Step 0 Explore (optional) → Step A Read sources → Step A.5 Clarify (optional) → Step B Slice
```

Use **Resolved decisions** and **Blockers for decomposition** when writing `## File Scope` and `## Dependencies` in downstream packets.
