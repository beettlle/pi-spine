# Explore findings template

Use for **Step 0 — Explore (optional)** in the create-spine-tasks skill.  
Output path: `{tasksRoot}/_explore/{slug}/findings.md`

**Constraints:** read-only investigation; no commits; no file edits outside read targets. Findings inform File Scope in downstream task packets. `spine tasks validate` does not require explore artifacts.

Normative schema: [PRD v1.3 §6.3 FR-UXB-03](../../docs/PRD-v1.3-upstream-execution-bridge.md#63-fr-uxb-03--optional-explore-phase).

---

```markdown
# Explore: {slug}

**Date:** YYYY-MM-DD
**Status:** complete | superseded

## Summary

(1–3 sentences: what was investigated and the main conclusion for decomposition.)

## Codebase areas

- `path/` — (why relevant)

## Risks

- (risk + mitigation hint)

## Suggested file scopes

- (paths for downstream task packets)

## Open questions

- (blockers for decomposition; None if clear)
```

---

## When to skip explore

- Greenfield with clear PRD and known paths
- Single S/M task with concrete File Scope
- Migrating existing Taskplane packets unchanged

## When explore is recommended

- Brownfield repo with unfamiliar modules
- L/XL epics (must split anyway)
- Parallel wave planning needs disjoint File Scopes
- File Scope uncertainty before decomposition
- After major refactor on `main` (re-explore; mark prior findings `Status: superseded`)

## Linking in CONTEXT.md

Add a row or note:

```markdown
| Explore: feature-x | 2026-06-10 | complete | spine-tasks/_explore/feature-x/findings.md |
```

Or: `Explore complete: feature-x (2026-06-10) — spine-tasks/_explore/feature-x/findings.md`
