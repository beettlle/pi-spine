# Requirements checklist template

Use for **Step A.6 — Requirements checklist (optional)** in the create-spine-tasks skill.  
Output path: `{tasksRoot}/_authoring/{slug}/checklist.md`

**Purpose:** "Unit tests for requirements" — validate PRD/brief quality before task slicing. Inspired by spec-kit `/speckit.checklist`. This is **not** implementation verification; it checks whether requirements are complete, clear, measurable, and ready for decomposition.

**Ordering:** Run after **Step A.5 — Clarify** (`clarify.md` in the same `_authoring/{slug}/` folder) and before **Step B — Slice into spine tasks**.

**Constraints:** read-only on source docs; no commits; no file edits outside authoring output. `spine tasks validate` does **not** require checklist artifacts.

**Do not duplicate** Step 0 explore `findings.md` content — explore maps codebase touch points; checklist validates requirement quality.

---

```markdown
# Requirements checklist: {slug}

**Date:** YYYY-MM-DD
**Status:** complete | superseded
**Sources:** (PRD/brief paths reviewed)

## Summary

(1–3 sentences: overall readiness for decomposition and top gaps found.)

## Acceptance criteria quality

- [ ] CHK001 — Are success criteria measurable for each deliverable? [Measurability]
- [ ] CHK002 — Can completion be verified without subjective judgment? [Clarity]
- [ ] CHK003 — Are acceptance criteria traceable to user-facing outcomes? [Traceability]

## Security

- [ ] CHK010 — Are authn/authz requirements specified for protected operations? [Coverage, Gap]
- [ ] CHK011 — Are secrets, credentials, and sensitive data handling defined? [Completeness]
- [ ] CHK012 — Are input validation and fail-secure defaults documented? [Security]

## Edge cases

- [ ] CHK020 — Are empty, null, and zero-state scenarios addressed? [Edge Case]
- [ ] CHK021 — Are error and partial-failure paths specified? [Exception Flow]
- [ ] CHK022 — Are rollback or recovery requirements defined when state mutates? [Recovery, Gap]

## Testability

- [ ] CHK030 — Is the project's test command identifiable for downstream tasks? [Testability]
- [ ] CHK031 — Are verifiable behaviors separated from implementation details? [Clarity]
- [ ] CHK032 — Can workers derive a Testing step from the requirements? [Completeness]

## Non-functional requirements

- [ ] CHK040 — Are performance or latency targets quantified (not "fast")? [NFR, Clarity]
- [ ] CHK041 — Are observability, logging, or operability needs specified? [NFR, Gap]
- [ ] CHK042 — Are compatibility, migration, or reversibility constraints documented? [NFR]

## Gaps and blockers

- (items marked `[Gap]` or unresolved from clarify.md — None if ready to slice)
```

---

## When to run

| Signal | Why checklist helps |
|--------|---------------------|
| After clarify with open assumptions | Surfaces requirement gaps before slicing |
| L/XL epic or multi-task decomposition | Catches missing NFRs and edge cases early |
| Security- or compliance-touching work | Forces explicit auth/data handling in requirements |
| Vague acceptance language ("robust", "fast") | Converts ambiguity into measurable criteria |
| Parallel wave planning | Ensures disjoint scopes are justified by clear requirements |

## When to skip

- Single S/M task with concrete File Scope and measurable acceptance criteria already
- Greenfield with a short, unambiguous brief and no security surface
- Migrating existing spine packets unchanged
- Step 0 explore not run and requirements are already validated elsewhere

## Authoring pipeline order

```
Step A (Read sources)
  → Step A.5 Clarify → {tasksRoot}/_authoring/{slug}/clarify.md
  → Step A.6 Checklist → {tasksRoot}/_authoring/{slug}/checklist.md
  → Step B (Slice into spine tasks)
```

Resolve or explicitly defer checklist gaps before Step B. Link the slug in `{tasksRoot}/CONTEXT.md` when checklist informs decomposition (same pattern as explore findings).

## External equivalent

- spec-kit: `/speckit.checklist` — [github/spec-kit](https://github.com/github/spec-kit) (`templates/commands/checklist.md`)
