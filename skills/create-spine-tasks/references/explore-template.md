# Explore findings template

Use for **Step 0 — Explore (optional)** in the create-spine-tasks skill.  
Output path: `{tasksRoot}/_explore/{slug}/findings.md`

**Constraints:** read-only investigation; no commits; no file edits. Findings inform File Scope in downstream task packets.

---

```markdown
# Explore: [slug]

**Date:** YYYY-MM-DD
**Status:** complete

## Summary

[1–3 sentences: what was investigated and the main conclusion for decomposition.]

## Codebase areas

- `path/to/module/` — [why relevant to the feature]
- `path/to/other/` — [dependency or risk]

## Risks

- [Risk] — [mitigation hint for task author]
- [Risk] — [mitigation hint]

## Suggested file scopes

Use these as starting points for per-task `## File Scope` sections (split when scopes overlap):

- `src/feature/`
- `tests/feature/`
- `docs/feature.md`

## Open questions

- [Question blocking decomposition] — [who/what resolves it]
- **None** — if ready to decompose
```

---

## When to skip explore

- Greenfield with clear PRD and known paths
- Single-file or S-sized fix
- Migrating existing Taskplane packets unchanged

## When explore is recommended

- Brownfield repo with unfamiliar modules
- L/XL epics (must split anyway)
- Parallel wave planning needs disjoint File Scopes
- After major refactor on `main` (re-explore; mark prior findings `Status: superseded`)

## Linking in CONTEXT.md

Add a row or note:

```markdown
| Explore: feature-x | 2026-06-10 | complete | spine-tasks/_explore/feature-x/findings.md |
```
